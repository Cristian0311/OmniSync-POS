import { getSupabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import { enqueueOfflineItem } from '../offlineSync';
import { normalizeSemanticText } from '../../utils/textUtils';
import { 
  Product, Category, Branch, InventoryLevel, User, 
  BankCard, Customer, Currency, Transaction, CashRegisterSession,
  Warranty, ReturnItem, InventoryTransfer, IDNSettlementPrice,
  TimeShift, Quote, BankTransaction, SupplierOrder, InventoryAudit, SalarySettlement, Supplier,
  ReceiptConfig, StoreConfig
} from '../../types';
import { fetchAllRows, safeUpsert, safeUpsertMany, SyncResult } from './core';

function assertRpcSuccess(data: any, operation: string) {
  if (data && data.success === false) {
    const e: any = new Error(data.message || data.error || data.reason || `La operación ${operation} fue rechazada por Supabase`);
    e.code = data.code || data.error_code;
    throw e;
  }
  if (data == null) throw new Error(`Supabase no devolvió confirmación para ${operation}`);
}

function formatSupabaseError(e: any): string {
  if (!e) return 'Error desconocido';
  const parts = [e.message || String(e)];
  if (e.code) parts.push(`code=${e.code}`);
  if (e.status) parts.push(`status=${e.status}`);
  if (e.details) parts.push(`details=${e.details}`);
  if (e.hint) parts.push(`hint=${e.hint}`);
  return parts.join(' | ');
}

export async function logAuditEvent(entry: {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldData?: any;
  newData?: any;
  meta?: any;
}) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.from('audit_log').insert({
      user_id: entry.userId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      old_data: entry.oldData,
      new_data: entry.newData,
      meta: entry.meta
    });
  } catch (e) {
    console.warn("Audit log failed:", e);
  }
}

export async function callOpenSessionRPC(session: CashRegisterSession): Promise<{ success: boolean; data?: any; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: "Supabase no configurado" };

  try {
    const { data, error } = await supabase.rpc('open_cash_session_v2', {
      p_user_id: session.userId,
      p_worker_name: session.workerName,
      p_branch_id: session.branchId,
      p_opening_amount: session.openingAmount,
      p_opened_at: session.openedAt,
      p_working_employee_ids: session.workingEmployeeIds || [],
      p_notes: session.notes || ''
    });

    if (error) throw error;
    assertRpcSuccess(data, 'open_cash_session_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error("[RPC] open_cash_session_v2 failed:", e);
    return { success: false, error: formatSupabaseError(e) };
  }
}

export async function callOpenSessionRPCWithId(session: CashRegisterSession): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };

  // IMPORTANT:
  // PostgREST in this project is currently serving a stale schema cache for
  // open_cash_session_v3 (PGRST202), even though the exact PostgreSQL function
  // exists. Do not call the broken RPC from the POS path: doing so produces a
  // visible error and adds latency before the stable-ID fallback.
  //
  // The cash_sessions table has a unique partial index enforcing one open
  // session per branch, so this write remains safe/idempotent by session ID.
  try {
    const row = {
      id: session.id,
      user_id: session.userId || null,
      worker_name: session.workerName || null,
      branch_id: session.branchId,
      opened_at: session.openedAt,
      opening_balance: session.openingAmount || 0,
      opening_amount: session.openingAmount || 0,
      status: 'open',
      working_employee_ids: session.workingEmployeeIds || [],
      notes: session.notes || '',
    };

    const { data, error } = await supabase
      .from('cash_sessions')
      .insert(row)
      .select()
      .single();

    if (!error) return { success: true, data };

    // A retry must never reopen a session that was already closed/cancelled.
    // The previous upsert could overwrite its status back to "open".
    if (error.code === '23505') {
      const existing = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('id', session.id)
        .maybeSingle();

      if (existing.data) {
        if (existing.data.status === 'open' && existing.data.branch_id === session.branchId) {
          return { success: true, data: existing.data };
        }
        return {
          success: false,
          error: 'El turno ya existe y no está abierto; no se puede reabrir automáticamente.',
          errorCode: 'CASH_SESSION_REOPEN_BLOCKED'
        };
      }

      // Another device already owns the only open shift for this branch.
      // Do not create a local "phantom" shift that could later accept sales.
      const branchOpen = await supabase
        .from('cash_sessions')
        .select('id,branch_id,user_id,worker_name,status,opened_at')
        .eq('branch_id', session.branchId)
        .eq('status', 'open')
        .is('deleted_at', null)
        .maybeSingle();
      if (branchOpen.data) {
        return {
          success: false,
          data: branchOpen.data,
          error: 'La sucursal ya tiene un turno abierto en otra terminal.',
          errorCode: 'CASH_BRANCH_ALREADY_OPEN'
        };
      }
    }

    console.error('[CashSession] No se pudo crear el turno estable:', error);
    return { success: false, error: formatSupabaseError(error), errorCode: error.code || undefined };
  } catch (e: any) {
    console.error('[CashSession] Error creando turno estable:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callProcessTransactionRPC(tx: Transaction): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: "Supabase no configurado" };

  try {
    const rpcItems = (tx.items || []).map(item => {
      if (!item) return null;
      const prod = item.product;
      return {
        id: item.id,
        product_id: typeof prod === 'string' ? prod : prod?.id,
        product_name: typeof prod === 'object' ? prod?.name || null : null,
        product_sku: typeof prod === 'object' ? prod?.sku || null : null,
        product_snapshot: typeof prod === 'object' ? prod : null,
        quantity: item.quantity || 0,
        price: item.price ?? (typeof prod === 'object' ? prod?.price : null),
        total: item.total ?? ((item.price ?? (typeof prod === 'object' ? prod?.price : 0)) * (item.quantity || 0)),
        variant_label: item.variantLabel || null,
        selected_size: item.selectedSize || null,
        selected_color: item.selectedColor || null,
        serial_number: item.serialNumber || null,
        warranty_code: item.warrantyCode || null,
        is_kit: (prod && typeof prod === 'object' && 'isKit' in prod) ? (prod as any).isKit === true : false,
        kit_components: (prod && typeof prod === 'object' && 'kitComponents' in prod) ? (prod as any).kitComponents || [] : []
      };
    }).filter(Boolean);

    const { data, error } = await supabase.rpc('process_pos_transaction_v2', {
      p_id: tx.id,
      p_branch_id: tx.branchId,
      p_user_id: tx.userId,
      p_date: tx.date,
      p_total: tx.total,
      p_tax: tx.tax || 0,
      p_discount: tx.discount || 0,
      p_items: rpcItems,
      p_payments: tx.payments || [],
      p_payment_method: tx.paymentMethod || 'cash',
      p_session_id: tx.sessionId,
      p_customer_id: tx.customerId || null,
      p_notes: tx.notes || ''
    });

    if (error) throw error;
    assertRpcSuccess(data, 'process_pos_transaction_v2');

    // Idempotency is only valid when the existing row is the SAME operation.
    // Two terminals must never be allowed to reuse a locally generated ticket
    // and accidentally turn a second sale into a false success.
    const { data: persisted, error: verifyError } = await supabase
      .from('transactions')
      .select('id,branch_id,user_id,total,tax,discount,session_id,payment_method,status,items,payments')
      .eq('id', tx.id)
      .maybeSingle();

    if (verifyError) throw verifyError;
    if (!persisted) {
      const e: any = new Error('Supabase no confirmó la venta en la tabla transactions.');
      e.code = 'TRANSACTION_NOT_PERSISTED';
      throw e;
    }

    const persistedItems = Array.isArray(persisted.items) ? persisted.items : [];
    const persistedPayments = Array.isArray(persisted.payments) ? persisted.payments : [];
    // La columna transactions.items conserva el objeto completo del carrito,
    // mientras la RPC recibe una representación compacta. Comparar JSON crudo
    // provocaba falsos conflictos incluso cuando la venta acababa de insertarse
    // correctamente. Normalizamos ambas representaciones al mismo fingerprint.
    const normalizeItems = (items: any[]) => items.map((item: any) => {
      const prod = item?.product;
      const productId = typeof prod === 'string' ? prod : prod?.id || item?.product_id;
      const isKit = typeof prod === 'object' ? prod?.isKit === true : item?.is_kit === true;
      const components = typeof prod === 'object' ? (prod?.kitComponents || prod?.kitItems || []) : (item?.kit_components || []);
      return {
        product_id: productId || null,
        quantity: Number(item?.quantity) || 0,
        variant_label: item?.variantLabel || item?.variant_label || null,
        is_kit: isKit,
        kit_components: isKit ? components : []
      };
    });
    const sameItems = JSON.stringify(normalizeItems(persistedItems)) === JSON.stringify(normalizeItems(rpcItems));
    const normalizePayments = (payments: any[]) => payments.map((p:any) => ({
      method: p?.method || 'cash',
      amount: Number(p?.amount) || 0,
      currencyCode: p?.currencyCode || p?.currency_code || null,
      exchangeRate: Number(p?.exchangeRate ?? p?.exchange_rate ?? 0) || 0,
      bankCardId: p?.bankCardId || p?.bank_card_id || null
    }));
    const samePayments = JSON.stringify(normalizePayments(persistedPayments)) === JSON.stringify(normalizePayments(tx.payments || []));
    const sameCore =
      persisted.branch_id === tx.branchId &&
      persisted.user_id === tx.userId &&
      Number(persisted.total) === Number(tx.total) &&
      Number(persisted.tax || 0) === Number(tx.tax || 0) &&
      Number(persisted.discount || 0) === Number(tx.discount || 0) &&
      (persisted.session_id || null) === (tx.sessionId || null) &&
      (persisted.payment_method || 'cash') === (tx.paymentMethod || 'cash') &&
      persisted.status === 'completed';

    if (!sameCore || !sameItems || !samePayments) {
      const e: any = new Error('Conflicto de idempotencia: el ID del ticket ya pertenece a otra venta.');
      e.code = 'IDEMPOTENCY_CONFLICT';
      throw e;
    }

    return { success: true, data: { ...(data || {}), persisted, already_existed: Boolean(data?.already_existed) } };
  } catch (e: any) {
    console.error("[RPC] process_pos_transaction_v2 failed:", e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callCompleteInventoryAuditRPC(auditId: string, branchId: string, userId: string, items: any[], notes?: string): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('complete_inventory_audit_v2', {
      p_audit_id: auditId, p_branch_id: branchId, p_user_id: userId, p_items: items, p_notes: notes || ''
    });
    if (error) throw error;
    assertRpcSuccess(data, 'complete_inventory_audit_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] complete_inventory_audit_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callReceiveSupplierOrderRPC(orderId: string, userId: string): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('receive_supplier_order_v2', { p_order_id: orderId, p_user_id: userId });
    if (error) throw error;
    assertRpcSuccess(data, 'receive_supplier_order_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] receive_supplier_order_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callTransferInventoryRPC(params: {
  operationId: string; batchId?: string; productId: string; fromBranchId: string; toBranchId: string;
  variants: { variantLabel: string; quantity: number }[]; userId: string;
}): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('process_inventory_transfer_v2', {
      p_operation_id: params.operationId, p_batch_id: params.batchId || null, p_product_id: params.productId,
      p_from_branch_id: params.fromBranchId, p_to_branch_id: params.toBranchId,
      p_variants: params.variants, p_user_id: params.userId
    });
    if (error) throw error;
    assertRpcSuccess(data, 'process_inventory_transfer_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] process_inventory_transfer_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callCompleteReturnRPC(returnId: string, userId: string): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('complete_return_v2', { p_return_id: returnId, p_user_id: userId });
    if (error) throw error;
    assertRpcSuccess(data, 'complete_return_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] complete_return_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callVoidTransactionRPC(id: string, userId: string, reason: string): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('void_pos_transaction_v2', {
      p_id: id, p_user_id: userId, p_reason: reason
    });
    if (error) throw error;
    assertRpcSuccess(data, 'void_pos_transaction_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] void_pos_transaction_v2 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callCancelSessionRPC(
  sessionId: string,
  userId: string,
  reason: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: "Supabase no configurado" };

  try {
    const { data, error } = await supabase.rpc('cancel_cash_session_v2', {
      p_session_id: sessionId,
      p_user_id: userId,
      p_reason: reason || 'Cancelación de turno'
    });

    if (error) throw error;
    assertRpcSuccess(data, 'cancel_cash_session_v2');
    return { success: true, data };
  } catch (e: any) {
    // No hacemos escrituras parciales desde el cliente cuando el RPC falla.
    // Un timeout/401/5xx puede significar que el servidor ya ejecutó la
    // operación; el replay idempotente de la cola es la ruta segura.
    console.warn('[RPC] cancel_cash_session_v2 failed; leaving operation for queue replay:', e);
    return { success: false, error: formatSupabaseError(e) };
  }
}

export async function callCloseSessionRPC(
  sessionId: string, 
  closingBalances: any[], 
  closedAt: string, 
  notes: string, 
  settlement: SalarySettlement
): Promise<{ success: boolean; data?: any; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: "Supabase no configurado" };

  try {
    const { data, error } = await supabase.rpc('close_cash_session_v2', {
      p_session_id: sessionId,
      p_closing_balances: closingBalances,
      p_closed_at: closedAt,
      p_notes: notes,
      p_settlement_data: {
        userId: settlement.userId,
        userName: settlement.userName,
        baseSalary: settlement.baseSalary,
        commissions: settlement.commissions,
        total: settlement.total,
        salesGoal: settlement.salesGoal || 0
      }
    });

    if (error) throw error;
    assertRpcSuccess(data, 'close_cash_session_v2');
    return { success: true, data };
  } catch (e: any) {
    // No hacemos fallback directo: cerrar el turno y guardar la liquidación
    // deben permanecer atómicos. Si el RPC falló después de commit, el replay
    // de close_cash_session_v2 es idempotente y recupera el resultado.
    console.warn('[RPC] close_cash_session_v2 failed; leaving operation for queue replay:', e);
    return { success: false, error: formatSupabaseError(e) };
  }
}



export async function callBankInternalTransferRPC(params: {
  operationId: string;
  fromCardId: string;
  toCardId: string;
  amount: number;
  targetAmount: number;
  date: string;
  reason?: string;
}): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('process_bank_internal_transfer_v2', {
      p_operation_id: params.operationId,
      p_from_card_id: params.fromCardId,
      p_to_card_id: params.toCardId,
      p_amount: params.amount,
      p_target_amount: params.targetAmount,
      p_date: params.date,
      p_reason: params.reason || ''
    });
    if (error) throw error;
    assertRpcSuccess(data, 'process_bank_internal_transfer_v2');
    return { success: true, data };
  } catch (e: any) {
    console.error('[RPC] process_bank_internal_transfer_v2 failed:', e);
    return {
      success: false,
      error: formatSupabaseError(e),
      errorCode: e.code || e.statusCode || undefined
    };
  }
}
