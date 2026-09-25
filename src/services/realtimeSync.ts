/**
 * Servicio de Sincronización en Tiempo Real Multi-Dispositivo
 * Asegura que todos los dispositivos (tablets, teléfonos, PCs, distintas cajas)
 * vean siempre exactamente los mismos datos en tiempo real.
 */

import { getSupabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { processOfflineQueue, getOfflineQueueCount } from './offlineSync';

let realtimeChannel: any = null;
let pollIntervalId: any = null;
let debounceTimeout: any = null;
let isSyncInProgress = false;
let lastSyncTimestamp = 0;

// Sincronización suave en segundo plano sin bloquear la interfaz con estrangulamiento (throttle)
export async function triggerBackgroundSync(force = false): Promise<void> {
  const now = Date.now();
  // Evitar ráfagas repetidas: al menos 3 segundos de descanso entre pulls completos (salvo force)
  if (!force && now - lastSyncTimestamp < 3000) {
    return;
  }
  if (isSyncInProgress) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  isSyncInProgress = true;
  lastSyncTimestamp = now;
  try {
    // Si hay cola offline pendiente, procesarla primero para subirla
    if (getOfflineQueueCount() > 0) {
      await processOfflineQueue();
    }
    // Traer todos los datos actualizados de Supabase
    await useStore.getState().syncWithSupabase();
  } catch (err) {
    console.warn('[RealtimeSync] Error en sincronización de fondo:', err);
  } finally {
    isSyncInProgress = false;
  }
}

// Sincronización con debounce para cambios rápidos en ráfaga (ej: ventas continuas)
export function scheduleDebouncedSync(delayMs = 2500): void {
  if (debounceTimeout) clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    triggerBackgroundSync().catch(() => {});
  }, delayMs);
}

/**
 * Inicializa el canal de Supabase Realtime y los escuchadores de ciclo de vida
 * (focus, visibilitychange, online, interval)
 */
export function initMultiDeviceRealtimeSync(): () => void {
  if (typeof window === 'undefined') return () => {};

  console.info('[RealtimeSync] Inicializando monitor multi-dispositivo...');

  // 1. Sincronización inicial inmediata
  triggerBackgroundSync(true).catch(() => {});

  // 2. Suscribirse a Supabase Realtime para cambios instantáneos entre dispositivos
  const supabase = getSupabase();
  if (supabase) {
    try {
      realtimeChannel = supabase
        .channel('pos-multi-device-channel')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          console.debug('[RealtimeSync] Cambio detectado en base de datos:', payload.table);
          // Debounce suave de 2.5s para no ahogar con ráfagas
          scheduleDebouncedSync(2500);
        })
        .subscribe((status) => {
          console.info('[RealtimeSync] Estado de canal Realtime:', status);
        });
    } catch (e) {
      console.warn('[RealtimeSync] No se pudo inicializar canal Realtime (usando respaldo por sondeo):', e);
    }
  }

  // 3. Sincronizar al volver a la pestaña o app (Wake-up / Focus)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      triggerBackgroundSync().catch(() => {});
    }
  };

  const handleWindowFocus = () => {
    if (navigator.onLine) {
      triggerBackgroundSync().catch(() => {});
    }
  };

  const handleOnline = () => {
    console.info('[RealtimeSync] Conexión restablecida, sincronizando...');
    triggerBackgroundSync(true).catch(() => {});
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('online', handleOnline);

  // 4. Sondeo periódico de seguridad relajado (cada 45 segundos)
  pollIntervalId = setInterval(() => {
    if (document.visibilityState === 'visible' && navigator.onLine && !isSyncInProgress) {
      triggerBackgroundSync().catch(() => {});
    }
  }, 45000);

  // Función de limpieza al desmontar
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleWindowFocus);
    window.removeEventListener('online', handleOnline);

    if (pollIntervalId) clearInterval(pollIntervalId);
    if (debounceTimeout) clearTimeout(debounceTimeout);

    if (realtimeChannel && supabase) {
      try {
        supabase.removeChannel(realtimeChannel);
      } catch (e) {
        // ignore
      }
      realtimeChannel = null;
    }
  };
}
