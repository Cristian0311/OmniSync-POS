/**
 * Connectivity/realtime coordinator for an offline-first POS.
 * Realtime events no longer trigger a full database download. A full pull is
 * reserved for initial/recovery/manual synchronization; reconnect only drains
 * the local operation queue and lets the POS keep its local cache authoritative
 * until an explicit incremental refresh is implemented.
 */
import { getSupabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { processOfflineQueue, getOfflineQueueCount } from './offlineSync';

let realtimeChannel: any = null;
let pollIntervalId: any = null;
let branchRepairIntervalId: any = null;
let isSyncInProgress = false;

export async function triggerBackgroundSync(force = false): Promise<void> {
  if (isSyncInProgress) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  isSyncInProgress = true;
  try {
    // Reconnection path: upload local operations first. Do NOT immediately pull
    // the whole database afterward; doing so was the main source of heavy UI
    // stalls and local/remote merge races.
    const manualOfflineSync = useStore.getState().storeConfig?.manualOfflineSync === true;
    if (getOfflineQueueCount() > 0 && (!manualOfflineSync || force)) await processOfflineQueue();
    if (!force) {
      await useStore.getState().refreshBranchInventory();
    }
    if (force && getOfflineQueueCount() === 0) {
      // Explicit/manual recovery may still request the existing full pull.
      await useStore.getState().syncWithSupabase();
    }
  } catch (err) {
    console.warn('[RealtimeSync] Error en sincronización de fondo:', err);
  } finally {
    isSyncInProgress = false;
  }
}

let debounceTimeout: any = null;
export function scheduleDebouncedSync(delayMs = 1500): void {
  if (debounceTimeout) clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    if (navigator.onLine) useStore.getState().refreshBranchInventory().catch(() => {});
  }, delayMs);
}

export function initMultiDeviceRealtimeSync(): () => void {
  if (typeof window === 'undefined') return () => {};
  const supabase = getSupabase();

  const handleInventoryChange = (payload: any) => {
    window.dispatchEvent(new CustomEvent('remote_data_changed', { detail: payload }));
    const row = payload?.new || payload?.old;
    if (!row) return;
    useStore.setState((state: any) => {
      const key = `${row.product_id}:${row.branch_id}:${row.variant_label || ''}`;
      const list = [...(state.inventory || [])];
      const idx = list.findIndex((i: any) => `${i.productId}:${i.branchId}:${i.variantLabel || ''}` === key);
      if (payload.eventType === 'DELETE') { if (idx >= 0) list.splice(idx, 1); }
      else {
        const next = { id: row.id, productId: row.product_id, branchId: row.branch_id, variantLabel: row.variant_label || undefined, quantity: Number(row.quantity) || 0, minQuantity: Number(row.min_quantity) || 0 };
        if (idx >= 0) list[idx] = next; else list.push(next);
      }
      return { inventory: list };
    });
  };

  const handleTransactionChange = (payload: any) => {
    window.dispatchEvent(new CustomEvent('remote_data_changed', { detail: payload }));
  };

  const subscribeRealtime = () => {
    if (!supabase || realtimeChannel) return;
    const branchId = useStore.getState().currentBranchId;
    try {
      realtimeChannel = supabase.channel(`pos-sync-${branchId || 'global'}`);
      realtimeChannel.on('postgres_changes', {
        event: '*', schema: 'public', table: 'inventory',
        ...(branchId ? { filter: `branch_id=eq.${branchId}` } : {})
      }, handleInventoryChange);
      realtimeChannel.on('postgres_changes', {
        event: '*', schema: 'public', table: 'transactions',
        ...(branchId ? { filter: `branch_id=eq.${branchId}` } : {})
      }, handleTransactionChange);
      realtimeChannel.subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('[RealtimeSync] Canal Realtime:', status);
      });
    } catch (e) {
      realtimeChannel = null;
      console.warn('[RealtimeSync] No se pudo inicializar Realtime:', e);
    }
  };

  const handleOffline = () => {
    if (realtimeChannel && supabase) {
      try { supabase.removeChannel(realtimeChannel); } catch {}
      realtimeChannel = null;
    }
  };

  const handleOnline = () => {
    subscribeRealtime();
    triggerBackgroundSync(false).catch(() => {});
  };

  if (navigator.onLine) {
    useStore.getState().bootstrapPosFromSupabase().catch(() => {});
    subscribeRealtime();
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && navigator.onLine && getOfflineQueueCount() > 0) triggerBackgroundSync().catch(() => {});
  };
  const handleWindowFocus = () => {
    if (navigator.onLine && getOfflineQueueCount() > 0) triggerBackgroundSync().catch(() => {});
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  pollIntervalId = setInterval(() => {
    if (navigator.onLine && getOfflineQueueCount() > 0 && !isSyncInProgress) triggerBackgroundSync().catch(() => {});
  }, 30000);

  branchRepairIntervalId = setInterval(() => {
    if (navigator.onLine && !isSyncInProgress && getOfflineQueueCount() === 0) useStore.getState().refreshBranchInventory().catch(() => {});
  }, 120000);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleWindowFocus);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (pollIntervalId) clearInterval(pollIntervalId);
    if (branchRepairIntervalId) clearInterval(branchRepairIntervalId);
    if (debounceTimeout) clearTimeout(debounceTimeout);
    if (realtimeChannel && supabase) {
      try { supabase.removeChannel(realtimeChannel); } catch {}
      realtimeChannel = null;
    }
  };
}
