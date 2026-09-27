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
  try {
    const invoke = async () => supabase.rpc('open_cash_session_v3', {
      p_session_id: session.id, p_user_id: session.userId, p_worker_name: session.workerName,
      p_branch_id: session.branchId, p_opening_amount: session.openingAmount, p_opened_at: session.openedAt,
      p_working_employee_ids: session.workingEmployeeIds || [], p_notes: session.notes || ''
    });

    let { data, error } = await invoke();
    // PGRST202 is a PostgREST schema-cache failure, not proof that the cash
    // session operation itself is invalid. Do not let this infrastructure
    // problem block the POS. Retry once, then use the stable-ID table path.
    if (error?.code === 'PGRST202') {
      await new Promise(resolve => setTimeout(resolve, 800));
      ({ data, error } = await invoke());
    }
    if (!error) {
      assertRpcSuccess(data, 'open_cash_session_v3');
      return { success: true, data };
    }

    if (error.code === 'PGRST202') {
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
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('cash_sessions')
        .upsert(row, { onConflict: 'id' })
        .select()
        .single();
      if (!fallbackError && fallbackData) {
        console.warn('[CashSession] v3 unavailable in PostgREST cache; used stable-ID table fallback');
        return { success: true, data: fallbackData };
      }
      if (fallbackError) {
        console.warn('[CashSession] stable-ID table fallback failed:', fallbackError);
      }
    }

    throw error;
  } catch (e: any) {
    console.error('[RPC] open_cash_session_v3 failed:', e);
    return { success: false, error: formatSupabaseError(e), errorCode: e.code || e.statusCode || undefined };
  }
}

export async function callProcessTransactionRPC(tx: Transaction): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: "Supabase no configurado" };

  try {
    const { data, error } = await supabase.rpc('process_pos_transaction_v2', {
      p_id: tx.id,
      p_branch_id: tx.branchId,
      p_user_id: tx.userId,
      p_date: tx.date,
      p_total: tx.total,
      p_tax: tx.tax || 0,
      p_discount: tx.discount || 0,
      p_items: (tx.items || []).map(item => {
        if (!item) return null;
        const prod = item.product;
        return {
          product_id: typeof prod === 'string' ? prod : prod?.id,
          quantity: item.quantity || 0,
          variant_label: item.variantLabel || null,
          is_kit: (prod && typeof prod === 'object' && 'isKit' in prod) ? (prod as any).isKit === true : false,
          kit_components: (prod && typeof prod === 'object' && 'kitComponents' in prod) ? (prod as any).kitComponents || [] : []
        };
      }).filter(Boolean),
      p_payments: tx.payments || [],
      p_payment_method: tx.paymentMethod || 'cash',
      p_session_id: tx.sessionId,
      p_customer_id: tx.customerId || null,
      p_notes: tx.notes || ''
    });

    if (error) throw error;
    assertRpcSuccess(data, 'process_pos_transaction_v2');
    return { success: true, data };
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
  operationId: string; productId: string; fromBranchId: string; toBranchId: string;
  variants: { variantLabel: string; quantity: number }[]; userId: string;
}): Promise<{ success: boolean; data?: any; error?: string; errorCode?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase no configurado' };
  try {
    const { data, error } = await supabase.rpc('process_inventory_transfer_v2', {
      p_operation_id: params.operationId, p_product_id: params.productId,
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

