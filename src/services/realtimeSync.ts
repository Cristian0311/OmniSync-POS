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
let debounceTimeout: any = null;
let bootstrappedBranchId: string | null = null;
const BRANCH_SCOPED_TABLES = new Set(['inventory','transactions','cash_sessions','inventory_transfers','supplier_orders','inventory_audits','time_shifts','bank_transactions']);
const REMOTE_SYNC_TABLES = ['settings','cash_movements','currencies','branches','categories','products','users','inventory','customers','cash_sessions','transactions','idn_settlement_prices','inventory_transfers','warranties','returns','quotes','time_shifts','bank_cards','bank_transactions','suppliers','supplier_orders','inventory_audits','salary_settlements','inventory_movements','inventory_audit_items'];

async function reconcileRemoteState(forceBootstrap = false): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (getOfflineQueueCount() > 0) { await triggerBackgroundSync(false); return; }
  const branchId = useStore.getState().currentBranchId || null;
  if (forceBootstrap || bootstrappedBranchId !== branchId) {
    await useStore.getState().bootstrapPosFromSupabase();
    bootstrappedBranchId = branchId;
  } else {
    await useStore.getState().refreshBranchInventory();
  }
}

export async function triggerBackgroundSync(force = false): Promise<void> {
  if (isSyncInProgress) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  isSyncInProgress = true;
  try {
    const manualOfflineSync = useStore.getState().storeConfig?.manualOfflineSync === true;
    if (getOfflineQueueCount() > 0 && (!manualOfflineSync || force)) await processOfflineQueue();
    if (getOfflineQueueCount() === 0) {
      const branchId = useStore.getState().currentBranchId || null;
      if (force || bootstrappedBranchId !== branchId) {
        await useStore.getState().bootstrapPosFromSupabase();
        bootstrappedBranchId = branchId;
      } else {
        await useStore.getState().refreshBranchInventory();
      }
    } else if (!force) {
      await useStore.getState().refreshBranchInventory();
    }
  } catch (err) { console.warn('[RealtimeSync] Error en sincronización de fondo:', err); }
  finally { isSyncInProgress = false; }
}

export function scheduleDebouncedSync(delayMs = 1200): void {
  if (debounceTimeout) clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    if (navigator.onLine && !isSyncInProgress) reconcileRemoteState().catch(() => {});
  }, delayMs);
}

export function initMultiDeviceRealtimeSync(): () => void {
  if (typeof window === 'undefined') return () => {};
  const supabase = getSupabase();
  const handleRemoteChange = (payload: any) => {
    window.dispatchEvent(new CustomEvent('remote_data_changed', { detail: payload }));
    scheduleDebouncedSync();
  };
  const subscribeRealtime = () => {
    if (!supabase || realtimeChannel) return;
    const branchId = useStore.getState().currentBranchId;
    try {
      realtimeChannel = supabase.channel('pos-sync-' + (branchId || 'global'));
      for (const table of REMOTE_SYNC_TABLES) {
        const config: any = { event: '*', schema: 'public', table };
        if (branchId && BRANCH_SCOPED_TABLES.has(table)) config.filter = 'branch_id=eq.' + branchId;
        realtimeChannel.on('postgres_changes', config, handleRemoteChange);
      }
      realtimeChannel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') { console.info('[RealtimeSync] Canal multi-dispositivo conectado.'); scheduleDebouncedSync(300); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('[RealtimeSync] Canal Realtime:', status);
      });
    } catch (e) { realtimeChannel = null; console.warn('[RealtimeSync] No se pudo inicializar Realtime:', e); }
  };
  const handleOffline = () => { if (realtimeChannel && supabase) { try { supabase.removeChannel(realtimeChannel); } catch {} realtimeChannel = null; } };
  const handleOnline = () => { subscribeRealtime(); triggerBackgroundSync(false).catch(() => {}); };
  if (navigator.onLine) { subscribeRealtime(); triggerBackgroundSync(false).catch(() => {}); }
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      // Returning to the POS must not redownload the complete bootstrap.
      // Realtime + the branch inventory refresh are sufficient here.
      useStore.getState().refreshBranchInventory().catch(() => {});
    }
  };
  const handleWindowFocus = () => {
    if (navigator.onLine && !isSyncInProgress) {
      if (getOfflineQueueCount() > 0) triggerBackgroundSync(false).catch(() => {});
      else useStore.getState().refreshBranchInventory().catch(() => {});
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  // The safety poll must not download the whole POS snapshot every 30s.
  // That caused repeated bursts of REST requests on multi-device sessions and
  // contributed to PostgREST timeout pressure. Realtime/reconnect/visibility
  // events perform the authoritative bootstrap; the periodic poll only drains
  // pending operations or refreshes branch inventory when the queue is empty.
  pollIntervalId = setInterval(() => {
    if (!navigator.onLine || isSyncInProgress) return;
    if (getOfflineQueueCount() > 0) {
      triggerBackgroundSync(false).catch(() => {});
    } else {
      useStore.getState().refreshBranchInventory().catch(() => {});
    }
  }, 30000);
  branchRepairIntervalId = setInterval(() => { if (navigator.onLine && !isSyncInProgress) reconcileRemoteState(false).catch(() => {}); }, 120000);
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleWindowFocus);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (pollIntervalId) clearInterval(pollIntervalId);
    if (branchRepairIntervalId) clearInterval(branchRepairIntervalId);
    if (debounceTimeout) clearTimeout(debounceTimeout);
    if (realtimeChannel && supabase) { try { supabase.removeChannel(realtimeChannel); } catch {} realtimeChannel = null; }
  };
}
