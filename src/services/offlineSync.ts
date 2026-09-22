/**
 * Servicio de Cola y Sincronización Offline para POS y Operaciones Críticas
 * Garantiza que ninguna venta, turno de caja, cliente o movimiento se pierda
 * cuando la tablet o el equipo pierde la conexión a internet.
 */

import { getSupabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { 
  Transaction, CashRegisterSession, InventoryLevel, 
  Customer, ReturnItem, BankTransaction, Branch, Product, Category 
} from '../types';

export type OfflineActionType =
  | 'transaction'
  | 'cash_session'
  | 'inventory'
  | 'customer'
  | 'return'
  | 'bank_transaction'
  | 'branch'
  | 'product'
  | 'category'
  | 'receipt_config';

export interface OfflineQueueItem {
  id: string; // ID único del item en la cola
  actionId: string; // ID de la entidad (ej: id de la transacción)
  type: OfflineActionType;
  data: any;
  timestamp: string;
  retryCount: number;
}

const STORAGE_KEY = 'pos_offline_sync_queue';
let isProcessingQueue = false;

// Obtener cola desde localStorage
export function getOfflineQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineQueueItem[];
  } catch (e) {
    console.error('[offlineSync] Error al leer cola offline:', e);
    return [];
  }
}

// Guardar cola en localStorage y emitir evento reactivo
function saveOfflineQueue(queue: OfflineQueueItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline_queue_updated', { detail: { count: queue.length } }));
    }
  } catch (e) {
    console.error('[offlineSync] Error al guardar cola offline:', e);
  }
}

// Agregar o actualizar un elemento en la cola offline
export function enqueueOfflineItem(type: OfflineActionType, data: any, actionId?: string): void {
  const currentQueue = getOfflineQueue();
  const finalActionId = actionId || data?.id || crypto.randomUUID();

  // Si ya existe un elemento con el mismo tipo y actionId, actualizamos su data
  const existingIdx = currentQueue.findIndex(item => item.type === type && item.actionId === finalActionId);

  if (existingIdx !== -1) {
    currentQueue[existingIdx] = {
      ...currentQueue[existingIdx],
      data: { ...currentQueue[existingIdx].data, ...data },
      timestamp: new Date().toISOString()
    };
  } else {
    currentQueue.push({
      id: crypto.randomUUID(),
      actionId: finalActionId,
      type,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0
    });
  }

  saveOfflineQueue(currentQueue);
  console.info(`[offlineSync] Elemento encolado (${type}): ${finalActionId}. Pendientes: ${currentQueue.length}`);
}

// Remover elemento de la cola
export function removeFromOfflineQueue(id: string): void {
  const currentQueue = getOfflineQueue();
  const nextQueue = currentQueue.filter(item => item.id !== id);
  saveOfflineQueue(nextQueue);
}

// Limpiar toda la cola
export function clearOfflineQueue(): void {
  saveOfflineQueue([]);
}

// Retorna cantidad de items pendientes
export function getOfflineQueueCount(): number {
  return getOfflineQueue().length;
}

// Procesar individualmente según el tipo de acción
async function processQueueItem(supabase: any, item: OfflineQueueItem): Promise<boolean> {
  const { type, data } = item;

  switch (type) {
    case 'cash_session': {
      const session = data as CashRegisterSession;
      let extendedNotes = session.notes || '';
      const meta = {
        closing_balances: session.closingBalances || [],
        closing_date: session.closingDate || null,
        movements: session.movements || []
      };
      if (extendedNotes.includes('__META__:')) {
        extendedNotes = extendedNotes.split('__META__:')[0].trim();
      }
      extendedNotes = (extendedNotes ? extendedNotes + ' ' : '') + '__META__:' + JSON.stringify(meta);

      const row = {
        id: session.id,
        user_id: session.userId || null,
        worker_name: session.workerName || null,
        branch_id: session.branchId,
        opened_at: session.openedAt,
        closed_at: session.closedAt || null,
        opening_balance: session.openingAmount,
        status: session.status,
        notes: extendedNotes,
        working_employee_ids: session.workingEmployeeIds || []
      };

      const { error } = await supabase.from('cash_sessions').upsert(row);
      if (error) throw error;
      return true;
    }

    case 'customer': {
      const customer = data as Customer;
      const row = {
        id: customer.id,
        name: customer.name,
        phone: customer.phone || null,
        email: customer.email || null,
        tax_id: customer.taxId || null
      };
      const { error } = await supabase.from('customers').upsert(row);
      if (error) throw error;
      return true;
    }

    case 'branch': {
      const branch = data as Branch;
      const row = {
        id: branch.id,
        name: branch.name,
        address: branch.address || null,
        phone: branch.phone || null,
        is_active: branch.isActive !== false,
        is_main: branch.isMain === true
      };
      const { error } = await supabase.from('branches').upsert(row);
      if (error) throw error;
      return true;
    }

    case 'category': {
      const category = data as Category;
      const row = {
        id: category.id,
        name: category.name,
        department: category.department || 'General',
        description: category.description || null,
        color: category.color || null,
        image: category.image || null
      };
      const { error } = await supabase.from('categories').upsert(row);
      if (error) throw error;
      return true;
    }

    case 'product': {
      const product = data as Product;
      const row = {
        id: product.id,
        name: product.name,
        sku: product.sku || null,
        barcode: product.barcode || null,
        cost_price: product.costPrice || 0,
        price: product.price || 0,
        margin: product.margin || 0,
        category_id: product.categoryId || null,
        color: product.color || null,
        commission_value: product.commissionValue || 0,
        unit: product.unit || 'unidad',
        status: product.status || 'active',
        min_stock_alert: product.minStockAlert || 5,
        has_serial: product.hasSerial || false,
        warranty_days: product.warrantyDays || 0,
        is_kit: product.isKit || false,
        kit_items: product.kitItems || []
      };
      const { error } = await supabase.from('products').upsert(row);
      if (error) throw error;
      return true;
    }

    case 'transaction': {
      const tx = data as Transaction;
      // Si la transacción está vinculada a una sesión, asegurar que la sesión esté en Supabase
      if (tx.sessionId) {
        const localSession = useStore.getState().cashSessions?.find(s => s.id === tx.sessionId);
        if (localSession) {
          try {
            await processQueueItem(supabase, {
              id: 'temp-session',
              actionId: localSession.id,
              type: 'cash_session',
              data: localSession,
              timestamp: localSession.openedAt,
              retryCount: 0
            });
          } catch {
            // Continuar
          }
        }
      }

      const row = {
        id: tx.id,
        date: tx.date,
        total: tx.total,
        tax: tx.tax || 0,
        discount: tx.discount || 0,
        branch_id: tx.branchId,
        customer_id: tx.customerId || null,
        user_id: tx.userId || null,
        status: tx.status || 'completed',
        notes: tx.notes || '',
        payment_method: tx.paymentMethod || 'cash',
        session_id: tx.sessionId || null,
        change_given: tx.changeGiven || 0,
        items: tx.items || [],
        payments: tx.payments || [],
        change_payments: tx.changePayments || [],
        seller_employee_ids: tx.sellerEmployeeIds || []
      };

      const { error } = await supabase.from('transactions').upsert(row);
      if (error) throw error;
      return true;
    }

    case 'inventory': {
      const level = data as InventoryLevel;
      const isValidUUID = typeof level.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(level.id);
      const row = {
        id: isValidUUID ? level.id : crypto.randomUUID(),
        product_id: level.productId,
        branch_id: level.branchId || null,
        variant_label: level.variantLabel || '',
        quantity: Number(level.quantity) || 0,
        min_quantity: Number(level.minQuantity) || 0
      };
      const { error } = await supabase.from('inventory').upsert(row);
      if (error) throw error;
      return true;
    }

    case 'bank_transaction': {
      const tx = data as BankTransaction;
      const row = {
        id: tx.id,
        card_id: tx.cardId,
        type: tx.type,
        amount: Number(tx.amount) || 0,
        date: tx.date,
        reference: tx.reference || null,
        description: tx.description || '',
        transaction_id: tx.transactionId || null
      };
      const { error } = await supabase.from('bank_transactions').upsert(row);
      if (error) throw error;
      return true;
    }

    case 'return': {
      const ret = data as ReturnItem;
      const row = {
        id: ret.id,
        transaction_id: ret.transactionId || null,
        product_id: ret.productId,
        quantity: Number(ret.quantity) || 1,
        reason: ret.reason || '',
        date: ret.date,
        status: ret.status || 'pending',
        type: ret.type || 'refund',
        notes: ret.notes || null,
        variant_label: ret.variantLabel || null
      };
      const { error } = await supabase.from('returns').upsert(row);
      if (error) throw error;
      return true;
    }

    case 'receipt_config': {
      const { error } = await supabase.from('settings').upsert({
        id: 'global',
        receipt_config: data
      });
      if (error) throw error;
      return true;
    }

    default:
      return true;
  }
}

// Procesar toda la cola offline
export async function processOfflineQueue(): Promise<{ processed: number; failed: number; remaining: number }> {
  if (isProcessingQueue) {
    return { processed: 0, failed: 0, remaining: getOfflineQueue().length };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { processed: 0, failed: 0, remaining: getOfflineQueue().length };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { processed: 0, failed: 0, remaining: getOfflineQueue().length };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { processed: 0, failed: 0, remaining: 0 };
  }

  isProcessingQueue = true;
  console.info(`[offlineSync] Iniciando sincronización de cola (${queue.length} elementos pendientes)...`);

  // Orden de prioridad para no romper llaves foráneas:
  // 1. Sucursales, Categorías, Productos, Clientes, Sesiones de caja
  // 2. Transacciones (ventas)
  // 3. Inventario, Movimientos de banco, Devoluciones
  const priorityOrder: Record<OfflineActionType, number> = {
    branch: 1,
    category: 2,
    product: 3,
    customer: 4,
    cash_session: 5,
    transaction: 6,
    inventory: 7,
    bank_transaction: 8,
    return: 9,
    receipt_config: 10
  };

  const sortedQueue = [...queue].sort((a, b) => {
    const pA = priorityOrder[a.type] || 10;
    const pB = priorityOrder[b.type] || 10;
    if (pA !== pB) return pA - pB;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  let processed = 0;
  let failed = 0;
  const remainingQueue: OfflineQueueItem[] = [];

  for (const item of sortedQueue) {
    try {
      await processQueueItem(supabase, item);
      processed++;
      console.debug(`[offlineSync] Item sincronizado con éxito (${item.type}): ${item.actionId}`);
    } catch (err: any) {
      console.warn(`[offlineSync] Fallo al sincronizar item (${item.type} ${item.actionId}):`, err?.message || err);
      failed++;
      item.retryCount = (item.retryCount || 0) + 1;
      // Si falló por desconexión de red súbita, mantenerlo para la próxima reconexión
      remainingQueue.push(item);
    }
  }

  saveOfflineQueue(remainingQueue);
  isProcessingQueue = false;

  console.info(`[offlineSync] Proceso finalizado. Sincronizados: ${processed}, Fallidos: ${failed}, Restantes: ${remainingQueue.length}`);

  if (processed > 0) {
    // Si se subieron ventas o cambios offline, invocar sincronización local para reconciliar estados
    useStore.getState().syncWithSupabase().catch(() => {});
  }

  return { processed, failed, remaining: remainingQueue.length };
}

// Inicializar el vigilante automático de conectividad
export function initOfflineSyncWatcher(): () => void {
  if (typeof window === 'undefined') return () => {};

  let intervalId: any = null;

  const handleOnline = async () => {
    console.info('[offlineSync] Conexión a internet detectada.');
    const count = getOfflineQueueCount();
    if (count > 0) {
      useStore.getState().addNotification(`Conexión detectada. Sincronizando ${count} operaciones pendientes...`, 'info');
      const res = await processOfflineQueue();
      if (res.processed > 0) {
        useStore.getState().addNotification(`Sincronización completada: ${res.processed} operaciones subidas a Supabase.`, 'info');
      }
    }
  };

  const handleOffline = () => {
    console.warn('[offlineSync] Conexión perdida. Operando en modo Offline local.');
    useStore.getState().addNotification('Sin conexión a internet. El POS continuará operando localmente.', 'warning');
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Verificación periódica cada 30 segundos si hay items en cola y hay red
  intervalId = setInterval(() => {
    if (navigator.onLine && getOfflineQueueCount() > 0 && !isProcessingQueue) {
      processOfflineQueue().catch(() => {});
    }
  }, 30000);

  // Verificación inicial inmediata
  if (navigator.onLine && getOfflineQueueCount() > 0) {
    processOfflineQueue().catch(() => {});
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (intervalId) clearInterval(intervalId);
  };
}
