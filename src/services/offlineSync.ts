/**
 * Offline synchronization engine.
 *
 * The durable queue itself lives in offlineQueue.ts so the application store can
 * enqueue operations without importing the replay engine or Supabase adapters.
 */
import { getSupabase, checkSupabaseReachability } from '../lib/supabase';
import { useStore } from '../store/useStore';
import type { OfflineActionType, OfflineQueueItem } from './offlineQueue';
import type { Transaction, CashRegisterSession, Customer, ReturnItem, Branch, Product, Category } from '../types';
import {
  getOfflineQueue,
  waitForOfflineQueueReady,
  getOfflineQueueCount,
  isOfflineQueueItemRemoved,
  clearOfflineQueueRemovalMark,
  setOfflineQueueMemory,
  persistOfflineQueueSnapshot
} from './offlineQueue';
import {
  callOpenSessionRPCWithId, callProcessTransactionRPC, callVoidTransactionRPC, callCancelSessionRPC,
  callCompleteReturnRPC, callTransferInventoryRPC, callReceiveSupplierOrderRPC,
  callStartInventoryAuditRPC, callSaveInventoryAuditCountRPC, callRequestInventoryAuditRecountRPC, callApproveInventoryAuditRPC,
  callBankInternalTransferRPC, callDeleteBankInternalTransferRPC, callDeleteBankTransactionRPC, callDeleteBankCardRPC, callProcessBankTransactionRPC,
  pushCashSessionToSupabase
} from './supabaseSync';
import { addSyncLog } from '../utils/syncLogger';

let isProcessingQueue = false;

class PermanentSyncError extends Error {
  permanent = true;
}

async function processQueueItem(supabase: any, item: OfflineQueueItem): Promise<boolean> {
  const { type, data } = item;
  switch (type) {
    case 'cash_session': {
      const session = data as CashRegisterSession & { __operation?: 'open' | 'close' | 'cancel' | 'snapshot'; settlement?: any; closedAt?: string };
      if (session.__operation === 'close') {
        const settlement = session.settlement;
        if (!settlement) throw new Error('Cierre offline sin liquidación asociada');
        const res = await (await import('./supabaseSync')).callCloseSessionRPC(session.id, session.closingBalances || [], session.closedAt || new Date().toISOString(), session.notes || '', settlement);
        if (!res.success) throw new Error(res.error || 'No se pudo cerrar el turno');
        return true;
      }
      if (session.__operation === 'cancel') {
        const res = await callCancelSessionRPC(session.id, session.userId || 'system', session.deleteReason || 'Cancelación de turno');
        if (!res.success) throw new Error(res.error || 'No se pudo cancelar el turno');
        return true;
      }
      if (session.__operation === 'open' || String(item.actionId).startsWith('cash-open:')) {
        const res = await callOpenSessionRPCWithId(session);
        if (res.success) return true;
        throw new Error(res.error || 'No se pudo abrir el turno en Supabase');
      }
      // Un snapshot nunca debe reabrir ni cerrar un turno por accidente.
      // Apertura/cierre/cancelación tienen sus propias operaciones. Aquí solo
      // reconciliamos metadatos de una sesión ya existente.
      const { data: remoteSession, error: remoteReadError } = await supabase
        .from('cash_sessions')
        .select('id,status,closed_at,deleted_at,deleted_by,delete_reason,branch_id,user_id')
        .eq('id', session.id)
        .maybeSingle();
      if (remoteReadError) throw remoteReadError;

      if (remoteSession && remoteSession.status !== 'open' && session.status === 'open') {
        // El servidor ya tiene la autoridad final (cerrado/cancelado). El
        // snapshot local quedó obsoleto; se descarta sin reabrir el turno.
        return true;
      }

      // Usamos el mismo adaptador protegido que el flujo online: mezcla
      // movimientos/colaboradores y evita reabrir un turno cerrado.
      const synced = await pushCashSessionToSupabase(session);
      if (!synced) throw new Error('El snapshot del turno no fue confirmado en Supabase.');
      return true;
    }
    case 'audit_start': {
      const d = data;
      const res = await (await import('./supabaseSync')).callStartInventoryAuditRPC(
        d.id, d.branchId, d.userId, d.mode || 'cycle_count', d.blindCount === true, d.notes || ''
      );
      if (!res.success) throw new Error(res.error || 'No se pudo iniciar la auditoría');
      return true;
    }
    case 'audit_recount': {
      const d = data;
      const res = await (await import('./supabaseSync')).callRequestInventoryAuditRecountRPC(d.id, d.userId, d.notes || '');
      if (!res.success) throw new Error(res.error || 'No se pudo solicitar el recuento');
      return true;
    }
    case 'audit_approve': {
      const d = data;
      const res = await (await import('./supabaseSync')).callApproveInventoryAuditRPC(d.id, d.userId, d.notes || '');
      if (!res.success) throw new Error(res.error || 'No se pudo aprobar la auditoría');
      return true;
    }
    case 'salary_settlement': {
      const settlement = data;
      // Keep the offline replay payload aligned with the live schema.
      // `discrepancy_deduction` was removed from salary_settlements; sending it
      // through PostgREST produces a 400/PGRST204 and leaves the item stuck.
      const { error } = await supabase.from('salary_settlements').upsert({
        id: settlement.id, user_id: settlement.userId || null, user_name: settlement.userName || '',
        session_id: settlement.sessionId || null, base_salary: settlement.baseSalary || 0,
        sales_goal: settlement.salesGoal || 0, commissions: settlement.commissions || 0,
        total: settlement.total || 0, date: settlement.date, status: settlement.status || 'pending'
      });
      if (error) throw error;
      return true;
    }
    case 'customer': {
      const customer = data as Customer;
      const { error } = await supabase.from('customers').upsert({ id: customer.id, name: customer.name, phone: customer.phone || null, email: customer.email || null, tax_id: customer.taxId || null });
      if (error) throw error; return true;
    }
    case 'customer_delete': {
      const { error } = await supabase.from('customers').delete().eq('id', data.id);
      if (error) throw error; return true;
    }
    case 'branch': {
      const b = data as Branch;
      const { error } = await supabase.from('branches').upsert({ id: b.id, name: b.name, address: b.address || null, phone: b.phone || null, is_active: b.isActive !== false, is_main: b.isMain === true });
      if (error) throw error; return true;
    }
    case 'category': {
      const c = data as Category;
      const { error } = await supabase.from('categories').upsert({ id: c.id, name: c.name, department: c.department || 'General', description: c.description || null, color: c.color || null, image: c.image || null });
      if (error) throw error; return true;
    }
    case 'product': {
      const p = data as Product;
      const { error } = await supabase.from('products').upsert({ id: p.id, name: p.name, sku: p.sku || null, barcode: p.barcode || null, cost_price: p.costPrice || 0, price: p.price || 0, margin: p.margin || 0, category_id: p.categoryId || null, color: p.color || null, commission_value: p.commissionValue || 0, unit: p.unit || 'unidad', status: p.status || 'active', min_stock_alert: p.minStockAlert || 5, has_serial: p.hasSerial || false, warranty_days: p.warrantyDays || 0, is_kit: p.isKit || false, kit_items: p.kitItems || [] });
      if (error) throw error; return true;
    }
    case 'user': {
      const u = data;
      const email = u.email && String(u.email).trim() ? u.email : `${String(u.name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '')}_${String(u.id).slice(0, 6)}@system.local`;
      const { error } = await supabase.from('users').upsert({ id:u.id, name:u.name, email, password:u.password || null, role:u.role || 'employee', base_salary:u.baseSalary || 0, sales_goal:u.salesGoal || 0, branch_id:u.branchId || null, allowed_branches:u.allowedBranches || [], permissions:u.permissions || [], is_active:u.isActive !== false, is_independent:u.isIndependent === true, assigned_branch_id:u.assignedBranchId || u.branchId || null });
      if (error) throw error; return true;
    }
    case 'currency': { const c=data; const {error}=await supabase.from('currencies').upsert({code:c.code,name:c.name,symbol:c.symbol,rate_to_base:c.rateToBase,is_base:c.isBase},{onConflict:'code'}); if(error) throw error; return true; }
    case 'idn_settlement_price': { const d=data; const {error}=await supabase.from('idn_settlement_prices').upsert({id:d.id,user_id:d.userId,product_id:d.productId,settlement_price:d.settlementPrice}); if(error) throw error; return true; }
    case 'warranty': { const d=data; const {error}=await supabase.from('warranties').upsert({id:d.id,product_id:d.productId,product_name:d.productName,transaction_id:d.transactionId,customer_id:d.customerId,customer_name:d.customerName,purchase_date:d.purchaseDate,expiry_date:d.expiryDate,serial_number:d.serialNumber,status:d.status}); if(error) throw error; return true; }
    case 'time_shift': { const d=data; const {error}=await supabase.from('time_shifts').upsert({id:d.id,user_id:d.userId,clock_in:d.clockIn,clock_out:d.clockOut,notes:d.notes}); if(error) throw error; return true; }
    case 'quote': { const d=data; const {error}=await supabase.from('quotes').upsert({id:d.id,branch_id:d.branchId,user_id:d.userId,customer_id:d.customerId,date:d.date,subtotal:d.subtotal,tax:d.tax,total:d.total,items:d.items||[],status:d.status,notes:d.notes}); if(error) throw error; return true; }
    case 'bank_card': {
      const d=data;
      if (d.__metadata_only) {
        const { data: updated, error } = await supabase.from('bank_cards').update({
          name:d.name||d.bankName||'Tarjeta Bancaria',
          bank:d.bank||d.bankName||'Banco',
          bank_name:d.bankName||d.bank||'Banco',
          card_holder:d.cardHolder||'Titular',
          account_number:d.accountNumber||d.lastFourDigits||d.lastFour||'',
          phone:d.phone||'',
          last_four_digits:d.lastFourDigits||d.lastFour||(d.accountNumber?String(d.accountNumber).slice(-4):'0000'),
          currency:d.currency||'CUP', color:d.color||'from-indigo-600 to-purple-800',
          is_active:d.isActive!==false
        }).eq('id',d.id).select('id');
        if(error) throw error;
        if(!updated?.length) {
          const {error: insertError}=await supabase.from('bank_cards').upsert({
            id:d.id,name:d.name||d.bankName||'Tarjeta Bancaria',bank:d.bank||d.bankName||'Banco',
            bank_name:d.bankName||d.bank||'Banco',card_holder:d.cardHolder||'Titular',
            account_number:d.accountNumber||d.lastFourDigits||d.lastFour||'',phone:d.phone||'',
            last_four_digits:d.lastFourDigits||d.lastFour||(d.accountNumber?String(d.accountNumber).slice(-4):'0000'),
            balance:d.balance||0,currency:d.currency||'CUP',
            color:d.color||'from-indigo-600 to-purple-800',is_active:d.isActive!==false
          });
          if(insertError) throw insertError;
        }
        return true;
      }
      const {error}=await supabase.from('bank_cards').upsert({
        id:d.id,name:d.name||d.bankName||'Tarjeta Bancaria',bank:d.bank||d.bankName||'Banco',
        bank_name:d.bankName||d.bank||'Banco',card_holder:d.cardHolder||'Titular',
        account_number:d.accountNumber||d.lastFourDigits||d.lastFour||'',phone:d.phone||'',
        last_four_digits:d.lastFourDigits||d.lastFour||(d.accountNumber?String(d.accountNumber).slice(-4):'0000'),
        balance:d.balance||0,currency:d.currency||'CUP',color:d.color||'from-indigo-600 to-purple-800',
        is_active:d.isActive!==false
      });
      if(error) throw error;
      return true;
    }
    case 'bank_transaction': {
      const d = data;
      if (d.__operation === 'delete') {
        const res = await callDeleteBankTransactionRPC(d.id);
        if (!res.success) throw new Error(res.error || 'No se pudo eliminar el movimiento bancario');
        return true;
      }
      // Un ingreso generado por una venta nunca se procesa solo. Aunque su
      // dependencia haya quedado marcada como conflict, verificamos de nuevo
      // que la venta exista y siga válida en Supabase antes del banco.
      if (d.transactionId) {
        const { data: sale, error: saleError } = await supabase
          .from('transactions')
          .select('id,status,deleted_at')
          .eq('id', d.transactionId)
          .maybeSingle();
        if (saleError) throw saleError;
        if (!sale || sale.deleted_at || sale.status !== 'completed') {
          throw new Error('La venta asociada todavía no está confirmada en Supabase; el movimiento bancario permanece pendiente.');
        }
      }
      const res = await callProcessBankTransactionRPC(d);
      if (!res.success) throw new Error(res.error || 'No se pudo sincronizar el movimiento bancario');
      return true;
    }
    case 'supplier': { const d=data; const {error}=await supabase.from('suppliers').upsert({id:d.id,name:d.name,phone:d.phone||'',address:d.address||'',email:d.email||'',rating:d.rating||5,type_of_merchandise:d.typeOfMerchandise||''}); if(error) throw error; return true; }
    case 'supplier_order': { const d=data; const {error}=await supabase.from('supplier_orders').upsert({id:d.id,supplier_id:d.supplierId,date:d.date,expected_delivery_date:d.expectedDeliveryDate,items:d.items||[],total:d.total,status:d.status,branch_id:d.branchId,transport_details:d.transportDetails,transport_cost:d.transportCost}); if(error) throw error; return true; }
    case 'inventory_audit': { const d=data; const {error}=await supabase.from('inventory_audits').upsert({id:d.id,date:d.date,branch_id:d.branchId,user_id:d.userId,status:d.status,items:d.items||[],notes:d.notes}); if(error) throw error; return true; }
    case 'transaction': {
      const transaction = data as Transaction;
      // IDN settlement records must be persisted without consuming inventory again.
      if (transaction.notes === 'LIQUIDACION_IDN') {
        const { error } = await supabase.from('transactions').upsert({
          id: transaction.id, date: transaction.date, total: transaction.total,
          tax: transaction.tax || 0, discount: transaction.discount || 0,
          branch_id: transaction.branchId, customer_id: transaction.customerId || null,
          user_id: transaction.userId || null, status: transaction.status || 'completed',
          notes: transaction.notes || '', payment_method: transaction.paymentMethod || 'cash',
          session_id: transaction.sessionId || null, change_given: transaction.changeGiven || 0,
          items: transaction.items || [], payments: transaction.payments || [],
          change_payments: transaction.changePayments || [], seller_employee_ids: transaction.sellerEmployeeIds || [],
          deleted_at: transaction.deletedAt || null, deleted_by: transaction.deletedBy || null,
          delete_reason: transaction.deleteReason || null
        });
        if (error) throw error;
        return true;
      }
      const res = await callProcessTransactionRPC(transaction);
      if (!res.success) {
        // Solo códigos de negocio explícitamente irreversibles se consideran
        // conflictos permanentes. Un timeout, 5xx, PostgREST o pérdida de
        // conexión debe volver a intentarse aunque incluya metadata de error.
        const permanentCodes = new Set(['P0001','23503','23505','22P02','22003','22007','IDEMPOTENCY_CONFLICT']);
        if (res.errorCode && permanentCodes.has(String(res.errorCode))) {
          throw new PermanentSyncError(res.error || 'La venta fue rechazada por Supabase');
        }
        throw new Error(res.error || 'No se pudo sincronizar la venta');
      }

      // No damos la operación por completada solo porque el HTTP/RPC respondió.
      // Confirmamos que la fila existe realmente en Supabase antes de retirar la
      // operación de IndexedDB. Así una respuesta incompleta o una caída durante
      // la confirmación nunca puede dejar una venta perdida y una cola vacía.
      const { data: persisted, error: verifyError } = await supabase
        .from('transactions')
        .select('id,status,total')
        .eq('id', transaction.id)
        .maybeSingle();
      if (verifyError) throw verifyError;
      if (!persisted || persisted.id !== transaction.id) {
        throw new Error('Supabase no confirmó la venta después de procesarla');
      }
      return true;
    }
    case 'void_transaction': { const res = await callVoidTransactionRPC(data.id, data.userId, data.reason || 'Anulación de venta'); if (!res.success) throw new Error(res.error || 'No se pudo anular la venta'); return true; }
    case 'return_complete': { const res = await callCompleteReturnRPC(data.id, data.userId); if (!res.success) throw new Error(res.error || 'No se pudo completar la devolución'); return true; }
    case 'transfer': { const res = await callTransferInventoryRPC(data); if (!res.success) throw new Error(res.error || 'No se pudo sincronizar la transferencia'); return true; }
    case 'bank_internal_transfer': { const res = await callBankInternalTransferRPC(data); if (!res.success) throw new Error(res.error || 'No se pudo sincronizar la transferencia bancaria'); return true; }
    case 'bank_internal_transfer_delete': { const res = await callDeleteBankInternalTransferRPC(data.operationId); if (!res.success) throw new Error(res.error || 'No se pudo revertir la transferencia bancaria'); return true; }
    case 'bank_transaction_delete': { const res = await callDeleteBankTransactionRPC(data.id); if (!res.success) throw new Error(res.error || 'No se pudo eliminar el movimiento bancario'); return true; }
    case 'bank_card_delete': { const res = await callDeleteBankCardRPC(data.id); if (!res.success) throw new Error(res.error || 'No se pudo eliminar la cuenta bancaria'); return true; }
    case 'supplier_receive': { const res = await callReceiveSupplierOrderRPC(data.id, data.userId || 'system'); if (!res.success) throw new Error(res.error || 'No se pudo recibir la orden'); return true; }
    case 'audit_complete': { const res = await callSaveInventoryAuditCountRPC(data.id, data.userId, data.items || [], data.notes); if (!res.success) throw new Error(res.error || 'No se pudo guardar el conteo'); return true; }
    case 'inventory': {
      // Compatibilidad con colas antiguas que guardaban un stock absoluto.
      // Nunca sobrescribimos silenciosamente un cambio remoto: solo aceptamos
      // la operación si el servidor todavía coincide con el valor esperado.
      const { data: current, error: readError } = await supabase.from('inventory').select('quantity').eq('product_id', data.productId).eq('branch_id', data.branchId).eq('variant_label', data.variantLabel || '').maybeSingle();
      if (readError) throw readError;
      if (current && Number(current.quantity) !== Number(data.quantity)) {
        throw new Error('Conflicto de inventario legado: el stock remoto cambió antes de sincronizar.');
      }
      return true;
    }
    case 'inventory_adjustment': {
      const { data: result, error } = await supabase.rpc('apply_inventory_adjustment_v2', {
        p_operation_id: item.actionId, p_product_id: data.productId, p_branch_id: data.branchId,
        p_variant_label: data.variantLabel || '', p_delta: Number(data.delta) || 0,
        p_min_quantity: Number(data.minQuantity) || 0, p_user_id: data.userId || null,
        p_movement_type: data.movementType || 'ADJUSTMENT'
      });
      if (error) throw error;
      if (result?.conflict) throw new Error(result.message || 'Conflicto de inventario');
      return true;
    }
    case 'inventory_reconcile': {
      const { data: result, error } = await supabase.rpc('reconcile_inventory_v2', {
        p_operation_id: item.actionId, p_product_id: data.productId, p_branch_id: data.branchId,
        p_variant_label: data.variantLabel || '', p_expected_quantity: Number(data.expectedQuantity),
        p_new_quantity: Math.max(0, Number(data.quantity) || 0), p_min_quantity: Number(data.minQuantity) || 0,
        p_user_id: data.userId || null
      });
      if (error) throw error;
      if (result?.conflict) throw new Error(result.message || 'Conflicto de inventario: el stock cambió mientras estaba offline');
      return true;
    }
    case 'return': {
      const ret = data as ReturnItem;
      const { error } = await supabase.from('returns').upsert({
        id: ret.id,
        transaction_id: ret.transactionId || null,
        product_id: ret.productId,
        quantity: Number(ret.quantity) || 1,
        reason: ret.reason || '',
        date: ret.date,
        status: ret.status || 'pending',
        type: ret.type || 'refund',
        notes: ret.notes || null,
        variant_label: ret.variantLabel || null,
        branch_id: ret.branchId || null,
        replacement_product_id: ret.replacementProductId || null,
        replacement_quantity: ret.replacementQuantity || null,
        processed_by: ret.processedBy || null,
        refund_status: ret.refundStatus || (ret.type === 'refund' ? 'pending' : 'not_required'),
        refund_amount: ret.refundAmount ?? null,
        refund_currency_code: ret.refundCurrencyCode || null,
        refund_method: ret.refundMethod || null,
        refund_bank_card_id: ret.refundBankCardId || null,
        refund_transaction_id: ret.refundTransactionId || null,
        received_at: ret.receivedAt || null,
        refunded_at: ret.refundedAt || null
      });
      if (error) throw error;
      return true;
    }
    case 'receipt_config': { const { error } = await supabase.from('settings').upsert({ id: 'global', receipt_config: data }); if (error) throw error; return true; }
    case 'store_config': { const { error } = await supabase.from('settings').upsert({ id: 'global', store_config: data }); if (error) throw error; return true; }
    case 'catalog_config': { const { error } = await supabase.from('settings').upsert({ id: 'global', catalog_config: data }); if (error) throw error; return true; }
    default: throw new PermanentSyncError(`Tipo de operación offline no soportado: ${String(type)}`);
  }
}

export async function processOfflineQueue(): Promise<{ processed: number; failed: number; remaining: number; errors: Array<{ type: string; actionId: string; message: string; retryCount?: number }> }> {
  // Nunca inspeccionar una cola todavía no hidratada desde IndexedDB.
  await waitForOfflineQueueReady();
  if (isProcessingQueue || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { processed: 0, failed: 0, remaining: getOfflineQueueCount(), errors: [] };
  }
  const supabase = getSupabase();
  if (!supabase) return { processed: 0, failed: 0, remaining: getOfflineQueueCount(), errors: [{ type: 'system', actionId: 'supabase', message: 'Supabase no está disponible en esta sesión.' }] };
  const reachability = await checkSupabaseReachability();
  if (!reachability.ok) {
    return { processed: 0, failed: 0, remaining: getOfflineQueueCount(), errors: [{ type: 'network', actionId: 'connectivity', message: reachability.message || 'Supabase no está accesible todavía.' }] };
  }
  const allQueueAtStart = getOfflineQueue();
  const queueAtStart = allQueueAtStart.filter(item => item.status !== 'conflict');
  if (!queueAtStart.length) return { processed: 0, failed: 0, remaining: 0, errors: [] };

  isProcessingQueue = true;
  // Procesamos una instantánea estable. Las operaciones que entren mientras
  // sincronizamos se reconcilian al final y nunca se pierden por reemplazar
  // memoryQueue con una instantánea vieja.
  // Orden estable por dependencias reales. No usamos una prioridad global:
  // hacerlo podría mover una corrección de inventario posterior a una venta
  // anterior. Solo adelantamos una operación cuando otra operación ENCOLADA
  // es una dependencia explícita de ella.
  const allQueued = new Map<string, OfflineQueueItem>();
  const blockedExistingIds = new Set(
    allQueueAtStart.filter(q => q.status === 'conflict').map(q => q.id)
  );
  const cashBySessionId = new Map<string, OfflineQueueItem[]>();
  for (const q of allQueueAtStart) {
    allQueued.set(q.type + ':' + q.actionId, q);
    if (q.type === 'cash_session' && q.data?.id) {
      const list = cashBySessionId.get(String(q.data.id)) || [];
      list.push(q);
      cashBySessionId.set(String(q.data.id), list);
    }
  }
  const dep = (type: OfflineActionType, id?: string | null) => id ? allQueued.get(type + ':' + id) : undefined;
  const cashOp = (sessionId: string | undefined, operation: 'open' | 'close' | 'cancel' | 'join' | 'snapshot') => {
    if (!sessionId) return undefined;
    const list = cashBySessionId.get(String(sessionId)) || [];
    return list.find(q => q.data?.__operation === operation ||
      (operation === 'open' && String(q.actionId).startsWith('cash-open:')) ||
      (operation === 'close' && String(q.actionId).startsWith('cash-close:')) ||
      (operation === 'cancel' && String(q.actionId).startsWith('cash-cancel:')) ||
      (operation === 'join' && String(q.actionId).startsWith('cash-join:'))
    );
  };
  const dependencies = (item: OfflineQueueItem): OfflineQueueItem[] => {
    const d: OfflineQueueItem[] = [];
    const data = item.data || {};
    const add = (x?: OfflineQueueItem) => { if (x && x.id !== item.id) d.push(x); };
    switch (item.type) {
      case 'cash_session':
        if (data.__operation === 'open' || String(item.actionId).startsWith('cash-open:')) {
          add(dep('branch', data.branchId)); add(dep('user', data.userId));
        } else if (data.__operation === 'close' || data.__operation === 'cancel' ||
                   String(item.actionId).startsWith('cash-close:') ||
                   String(item.actionId).startsWith('cash-cancel:') ||
                   String(item.actionId).startsWith('cash-join:')) {
          add(cashOp(data.id, 'open'));
          if (data.__operation === 'close' || data.__operation === 'cancel' ||
              String(item.actionId).startsWith('cash-close:') || String(item.actionId).startsWith('cash-cancel:')) {
            // Un cierre/cancelación debe esperar a TODA operación de venta/liquidación
            // del turno que esté encolada. No dependemos del reloj local porque una
            // operación puede reintentarse horas después y recibir un timestamp nuevo.
            for (const candidate of queueAtStart) {
              if (candidate.type === 'transaction' && candidate.data?.sessionId === data.id) add(candidate);
            }
          }
        } else {
          add(cashOp(data.id, 'open'));
        }
        break;
      case 'transaction':
        add(dep('branch', data.branchId)); add(dep('user', data.userId)); add(dep('customer', data.customerId));
        add(cashOp(data.sessionId, 'open'));
        for (const it of data.items || []) add(dep('product', typeof it?.product === 'string' ? it.product : it?.product?.id));
        break;
      case 'void_transaction': add(dep('transaction', data.id)); break;
      case 'return': add(dep('transaction', data.transactionId)); add(dep('product', data.productId)); add(dep('customer', data.customerId)); break;
      case 'return_complete': add(dep('return', data.id)); break;
      case 'inventory': case 'inventory_adjustment': case 'inventory_reconcile':
        add(dep('branch', data.branchId)); add(dep('product', data.productId)); break;
      case 'transfer':
        add(dep('product', data.productId)); add(dep('branch', data.fromBranchId)); add(dep('branch', data.toBranchId)); add(dep('user', data.userId)); break;
      case 'supplier_order': add(dep('supplier', data.supplierId)); add(dep('branch', data.branchId)); break;
      case 'supplier_receive': add(dep('supplier_order', data.id)); break;
      case 'inventory_audit': add(dep('branch', data.branchId)); add(dep('user', data.userId)); break;
      case 'audit_complete': add(dep('inventory_audit', data.id)); break;
      case 'salary_settlement': add(cashOp(data.sessionId, 'close')); break;
      case 'bank_transaction': add(dep('bank_card', data.cardId)); add(dep('transaction', data.transactionId)); break;
      case 'idn_settlement_price': add(dep('product', data.productId)); add(dep('user', data.userId)); break;
      case 'time_shift': add(dep('user', data.userId)); break;
      case 'quote': add(dep('branch', data.branchId)); add(dep('user', data.userId)); add(dep('customer', data.customerId)); break;
      case 'warranty': add(dep('product', data.productId)); add(dep('transaction', data.transactionId)); add(dep('customer', data.customerId)); break;
      case 'user': add(dep('branch', data.branchId)); add(dep('branch', data.assignedBranchId)); add(dep('user', data.supervisorId)); break;
      case 'product': add(dep('category', data.categoryId)); break;
      case 'customer_delete': break;
    }
    return d;
  };

  const sorted: OfflineQueueItem[] = [];
  const pending = new Set(queueAtStart.map(x => x.id));
  while (pending.size) {
    const ready = queueAtStart
      .filter(x => pending.has(x.id) && dependencies(x).every(d => !pending.has(d.id)))
      .sort((a,b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
    if (!ready.length) {
      // Cycle protection: preserve deterministic FIFO rather than deadlocking
      // the entire queue forever because of a malformed dependency graph.
      const fallback = queueAtStart.filter(x => pending.has(x.id)).sort((a,b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
      sorted.push(...fallback); break;
    }
    for (const item of ready) { sorted.push(item); pending.delete(item.id); }
  }
  const startById = new Map(sorted.map(item => [item.id, item]));
  let processed = 0, failed = 0;
  const errors: Array<{ type: string; actionId: string; message: string; retryCount?: number }> = [];
  const remainingFromRun: OfflineQueueItem[] = [];
  const handledIds = new Set<string>();
  const failedDependencyIds = new Set<string>();

  for (let index = 0; index < sorted.length; index++) {
    const item = sorted[index];
    const itemDependencies = dependencies(item);
    if (itemDependencies.some(d => failedDependencyIds.has(d.id) || blockedExistingIds.has(d.id))) {
      // Un padre falló o quedó en conflicto: el hijo permanece en cola y no se
      // ejecuta con un estado incompleto.
      remainingFromRun.push({ ...item, status: 'failed' });
      continue;
    }
    item.status = 'processing';
    try {
      await processQueueItem(supabase, item);
      processed++;
      handledIds.add(item.id);
      addSyncLog({ level:'success', source:'offline_queue', title:`Item sincronizado (${item.type})`, details:`Operación ${item.actionId} confirmada por Supabase.`, entityType:item.type, actionId:item.actionId });
    } catch (err:any) {
      failed++;
      item.retryCount = (item.retryCount || 0) + 1;
      const code = err?.code ? ` [${err.code}]` : '';
      const status = err?.status || err?.statusCode ? ` HTTP ${err?.status || err?.statusCode}` : '';
      const detail = err?.details ? ` — ${err.details}` : '';
      const hint = err?.hint ? ` — ${err.hint}` : '';
      item.lastError = `${err?.message || 'Error desconocido'}${code}${status}${detail}${hint}`;
      const permanent = err?.permanent === true;
      // Ninguna operación durable válida se abandona por cantidad de reintentos.
      // Una tablet puede permanecer offline muchas horas o días; el elemento
      // queda pendiente hasta una confirmación real o un rechazo explícitamente permanente.
      item.status = permanent ? 'conflict' : 'failed';
      failedDependencyIds.add(item.id);
      remainingFromRun.push(item);
      errors.push({ type: item.type, actionId: item.actionId, message: item.lastError, retryCount: item.retryCount });
      addSyncLog({ level:'error', source:'offline_queue', title:`Error al procesar item (${item.type})`, details:item.lastError, entityType:item.type, actionId:item.actionId, retryAttempt:item.retryCount, maxRetries:8 });
      if (!permanent && (item.type === 'transaction' || item.type === 'cash_session' || item.type === 'transfer' || item.type === 'return_complete')) {
        // Las operaciones críticas mantienen el orden temporal: una dependencia
        // fallida no permite que las posteriores la salten.
        for (let tail = index + 1; tail < sorted.length; tail++) remainingFromRun.push(sorted[tail]);
        break;
      }
    }
  }

  // Conservar elementos de la instantánea que no fueron procesados por el corte
  // de dependencia anterior.
  const runRemainingIds = new Set(remainingFromRun.map(item => item.id));
  for (const item of sorted) {
    if (!handledIds.has(item.id) && !runRemainingIds.has(item.id)) remainingFromRun.push(item);
  }

  // Reconciliar con cambios hechos durante el procesamiento. Un enqueue nuevo
  // puede tener un ID distinto o actualizar el mismo actionId mientras la RPC
  // estaba en vuelo. En ambos casos debe sobrevivir a esta ejecución. Si el
  // usuario lo eliminó explícitamente, no lo reinsertamos.
  const currentAfterRun = getOfflineQueue();
  const currentById = new Map(currentAfterRun.map(item => [item.id, item]));
  const finalById = new Map<string, OfflineQueueItem>();
  for (const item of remainingFromRun) {
    if (!isOfflineQueueItemRemoved(item.id)) finalById.set(item.id, item);
  }

  for (const [id, current] of currentById) {
    if (isOfflineQueueItemRemoved(id)) continue;
    const original = startById.get(id);
    if (!original) {
      // Operación agregada mientras procesábamos.
      finalById.set(id, current);
      continue;
    }
    const changedDuringRun = current.timestamp !== original.timestamp ||
      current.actionId !== original.actionId ||
      JSON.stringify(current.data) !== JSON.stringify(original.data);
    if (changedDuringRun) {
      // Es una versión más reciente de la operación; no puede considerarse
      // completada por la versión antigua que estaba en vuelo.
      finalById.set(id, { ...current, status: 'pending' });
    } else if (!handledIds.has(id)) {
      // La operación sigue pendiente porque esta ejecución no llegó a confirmarla.
      finalById.set(id, current);
    }
  }

  const finalQueue = Array.from(finalById.values()).sort((a,b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
  for (const item of sorted) clearOfflineQueueRemovalMark(item.id);
  // Reconciliamos contra el estado final, no contra la instantánea inicial.
  // Esto evita que un enqueue concurrente sea borrado por el commit de la cola.
  try {
    await persistOfflineQueueSnapshot(finalQueue);
  } catch (persistenceError: any) {
    // El servidor puede haber confirmado la operación, pero si la cola local no
    // pudo persistir su nuevo estado, conservamos todas las operaciones de esta
    // ejecución para evitar una falsa sensación de sincronización. Las RPC son
    // idempotentes por sus IDs de operación.
    const durableFallback: OfflineQueueItem[] = queueAtStart.map(item => ({
      ...item,
      status: item.status === 'processing' ? 'pending' : item.status
    }));
    const fallbackById = new Map(durableFallback.map(item => [item.id, item]));
    for (const item of currentAfterRun) fallbackById.set(item.id, item);
    setOfflineQueueMemory(Array.from(fallbackById.values()));
    isProcessingQueue = false;
    const persistenceMessage = persistenceError?.message || 'Error de IndexedDB/localStorage. Las operaciones se conservaron para reintento.';
    errors.push({ type: 'offline_queue', actionId: 'persistence', message: persistenceMessage });
    addSyncLog({ level:'error', source:'offline_queue', title:'Cola local no pudo persistirse', details:persistenceMessage, entityType:'offline_queue' });
    return { processed, failed, remaining: getOfflineQueue().length, errors };
  }

  isProcessingQueue = false;
  return { processed, failed, remaining: finalQueue.length, errors };
}

function isManualOfflineSyncEnabled(): boolean {
  try {
    const config = useStore.getState().storeConfig;
    return config?.manualOfflineSync === true;
  } catch {
    return false;
  }
}

export function initOfflineSyncWatcher(): () => void {
  if (typeof window === 'undefined') return () => {};
  let intervalId: any = null;
  const handleOnline = async () => {
    if (isManualOfflineSyncEnabled()) return;
    // Chrome can emit 'online' before DNS/TLS/Internet access to Supabase is
    // actually usable. Give the connection a short settling window and probe
    // the REST endpoint before touching the durable queue.
    await new Promise(resolve => setTimeout(resolve, 1200));
    const reachability = await checkSupabaseReachability(12000);
    if (!reachability.ok) return;
    const count = getOfflineQueueCount();
    if (!count) return;
    useStore.getState().addNotification(`Conexión detectada. Sincronizando ${count} operaciones pendientes...`, 'info');
    try {
      const res = await processOfflineQueue();
      if (res.remaining > 0) {
        useStore.getState().addNotification(`Sincronización incompleta: ${res.processed} procesadas; ${res.remaining} siguen pendientes.`, 'warning', res.errors?.length ? res.errors.map(e => `${e.type} · ${e.actionId}: ${e.message}`).join('\n') : undefined);
      } else if (res.processed > 0) {
        useStore.getState().addNotification(`Sincronización completada: ${res.processed} operaciones confirmadas.`, 'success');
      }
    } catch (e: any) {
      useStore.getState().addNotification(`No se pudo completar la sincronización: ${e?.message || 'error desconocido'}.`, 'error');
    }
  };
  const handleOffline = () => useStore.getState().addNotification('Sin conexión. El POS continúa trabajando offline.', 'warning');
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  intervalId = setInterval(() => { 
    if (navigator.onLine && getOfflineQueueCount() && !isProcessingQueue && !isManualOfflineSyncEnabled()) {
      processOfflineQueue().catch(() => {}); 
    }
  }, 30000);
  if (navigator.onLine && getOfflineQueueCount() && !isManualOfflineSyncEnabled()) processOfflineQueue().catch(() => {});
  return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); if (intervalId) clearInterval(intervalId); };
}
