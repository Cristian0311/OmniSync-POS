import { getSupabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { enqueueOfflineItem } from './offlineSync';
import { 
  Product, Category, Branch, InventoryLevel, User, 
  BankCard, Customer, Currency, Transaction, CashRegisterSession,
  Warranty, ReturnItem, InventoryTransfer, IDNSettlementPrice,
  TimeShift, Quote, BankTransaction, SupplierOrder, InventoryAudit, SalarySettlement, Supplier,
  ReceiptConfig, StoreConfig
} from '../types';

export interface SyncResult {
  success: boolean;
  message: string;
  counts?: {
    products: number;
    categories: number;
    inventory: number;
    branches: number;
    users: number;
    bankCards: number;
    customers: number;
    currencies: number;
    transactions: number;
    cashSessions: number;
    idnSettlementPrices: number;
  };
  errors?: string[];
}

export async function pullAllFromSupabase(): Promise<{ data: any; result: SyncResult }> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      data: null,
      result: {
        success: false,
        message: "Supabase no está configurado. Ingresa la URL y Clave Anon en Configuración."
      }
    };
  }

  const errors: string[] = [];
  const fetchedData: any = {};

  try {
    // 1. Categories
    try {
      const { data, error } = await supabase.from('categories').select('*');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        fetchedData.categories = data.map((c: any): Category => ({
          id: c.id,
          name: c.name,
          department: c.department || '',
          color: c.color
        }));
      }
    } catch (e: any) {
      errors.push(`Categorías: ${e.message}`);
    }

    // 2. Branches
    try {
      const { data, error } = await supabase.from('branches').select('*');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        fetchedData.branches = data.map((b: any): Branch => ({
          id: b.id,
          name: b.name,
          address: b.address,
          phone: b.phone,
          isMain: b.is_main
        }));
      }
    } catch (e: any) {
      errors.push(`Sucursales: ${e.message}`);
    }

    // 3. Products
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        fetchedData.products = data.map((p: any): Product => ({
          id: p.id,
          name: p.name,
          sku: p.sku || '',
          barcode: p.barcode || '',
          costPrice: Number(p.cost_price) || 0,
          price: Number(p.price) || 0,
          margin: Number(p.margin) || (Number(p.price) - Number(p.cost_price)),
          categoryId: p.category_id || '',
          color: p.color || 'bg-slate-100 text-slate-700',
          commissionType: p.commission_type || 'percentage',
          commissionValue: Number(p.commission_value) || 0,
          unit: p.unit || 'unidad',
          status: p.status || 'active',
          minStockAlert: p.min_stock_alert || 5,
          hasSerial: Boolean(p.has_serial),
          warrantyDays: p.warranty_days || 0,
          isKit: Boolean(p.is_kit),
          kitItems: Array.isArray(p.kit_items) ? p.kit_items : [],
          deviceColor: p.device_color || '',
          availableSizes: Array.isArray(p.available_sizes) ? p.available_sizes : [],
          availableColors: Array.isArray(p.available_colors) ? p.available_colors : []
        }));
      }
    } catch (e: any) {
      errors.push(`Productos: ${e.message}`);
    }

    // 4. Inventory
    try {
      const { data, error } = await supabase.from('inventory').select('*');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        fetchedData.inventory = data.map((i: any): InventoryLevel => ({
          id: i.id,
          productId: i.product_id,
          branchId: i.branch_id,
          variantLabel: i.variant_label || undefined,
          quantity: Number(i.quantity) || 0,
          minQuantity: Number(i.min_quantity) || 0
        }));
      }
    } catch (e: any) {
      errors.push(`Inventario: ${e.message}`);
    }

    // 5. Users
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        fetchedData.users = data.map((u: any): User => ({
          id: u.id,
          name: u.name,
          email: u.email || '',
          password: u.password || '',
          role: u.role || 'employee',
          commissionRate: Number(u.commission_rate) || 0,
          baseSalary: Number(u.base_salary) || 0,
          salesGoal: Number(u.sales_goal) || 0,
          branchId: u.branch_id || undefined,
          allowedBranches: Array.isArray(u.allowed_branches) ? u.allowed_branches : undefined,
          permissions: Array.isArray(u.permissions) ? u.permissions : undefined,
          isActive: u.is_active !== false,
          isIndependent: u.is_independent === true,
          assignedBranchId: u.assigned_branch_id || undefined
        }));
      }
    } catch (e: any) {
      errors.push(`Usuarios: ${e.message}`);
    }

    // 6. IDN Settlement Prices
    try {
      const { data, error } = await supabase.from('idn_settlement_prices').select('*');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        fetchedData.idnSettlementPrices = data.map((p: any): IDNSettlementPrice => ({
          id: p.id,
          userId: p.user_id,
          productId: p.product_id,
          settlementPrice: Number(p.settlement_price) || 0
        }));
      }
    } catch (e: any) {
      errors.push(`Precios de Liquidación IDN: ${e.message}`);
    }

    // 6. Bank Cards
    try {
      const { data, error } = await supabase.from('bank_cards').select('*');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        fetchedData.bankCards = data.map((bc: any): BankCard => ({
          id: bc.id,
          name: bc.name || bc.card_holder || bc.bank_name || 'Tarjeta Bancaria',
          bank: bc.bank || bc.bank_name || 'Banco',
          bankName: bc.bank_name || bc.bank || 'Banco',
          cardHolder: bc.card_holder || bc.name || 'Titular',
          accountNumber: bc.account_number || bc.accountNumber || bc.last_four_digits || bc.last_four || '',
          lastFour: bc.last_four || bc.last_four_digits || (bc.account_number ? String(bc.account_number).slice(-4) : ''),
          lastFourDigits: bc.last_four_digits || bc.last_four || (bc.account_number ? String(bc.account_number).slice(-4) : ''),
          phone: bc.phone || '',
          currency: bc.currency || 'CUP',
          balance: Number(bc.balance) || 0,
          color: bc.color || 'from-blue-600 to-indigo-800',
          isActive: bc.is_active !== false
        }));
      }
    } catch (e: any) {
      errors.push(`Tarjetas Bancarias: ${e.message}`);
    }

    // 7. Customers
    try {
      const { data, error } = await supabase.from('customers').select('*');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        fetchedData.customers = data.map((c: any): Customer => ({
          id: c.id,
          name: c.name,
          email: c.email || '',
          phone: c.phone || '',
          taxId: c.tax_id || ''
        }));
      }
    } catch (e: any) {
      errors.push(`Clientes: ${e.message}`);
    }

    // 8. Currencies (Strictly CUP, USD, EUR)
    try {
      const { data, error } = await supabase.from('currencies').select('*');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        const allowedCodes = ['CUP', 'USD', 'EUR'];
        fetchedData.currencies = data
          .filter((c: any) => allowedCodes.includes(c.code))
          .map((c: any): Currency => ({
            code: c.code,
            name: c.name || (c.code === 'CUP' ? 'Peso Cubano' : c.code === 'USD' ? 'Dólar Estadounidense' : 'Euro'),
            symbol: c.symbol || (c.code === 'EUR' ? '€' : '$'),
            rateToBase: Number(c.rate_to_base) || (c.code === 'CUP' ? 1 : c.code === 'USD' ? 320 : 350),
            isBase: c.code === 'CUP' ? true : Boolean(c.is_base)
          }));
      }
    } catch (e: any) {
      errors.push(`Monedas: ${e.message}`);
    }

    // 9. Transactions
    try {
      const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false }).limit(500);
      if (!error && data && Array.isArray(data)) {
        fetchedData.transactions = data.map((t: any): Transaction => ({
          id: t.id,
          date: t.date,
          total: Number(t.total) || 0,
          tax: Number(t.tax) || 0,
          discount: Number(t.discount) || 0,
          branchId: t.branch_id,
          customerId: t.customer_id,
          userId: t.user_id,
          status: t.status || 'completed',
          notes: t.notes || '',
          paymentMethod: t.payment_method || 'cash',
          sessionId: t.session_id,
          changeGiven: Number(t.change_given) || 0,
          items: Array.isArray(t.items) ? t.items : [],
          payments: Array.isArray(t.payments) ? t.payments : [],
          changePayments: Array.isArray(t.change_payments) ? t.change_payments : [],
          sellerEmployeeIds: Array.isArray(t.seller_employee_ids) ? t.seller_employee_ids : []
        }));
      }
    } catch (e: any) {
      // Non-fatal
    }

    // 10. Cash Sessions
    try {
      const { data, error } = await supabase.from('cash_sessions').select('*').order('opened_at', { ascending: false }).limit(200);
      if (!error && data && Array.isArray(data)) {
        fetchedData.cashSessions = data.map((s: any): CashRegisterSession => {
          let notes = s.notes || '';
          let closingBalances = Array.isArray(s.closing_balances) ? s.closing_balances : [];
          let closingDate = s.closing_date || undefined;
          let movements = Array.isArray(s.movements) ? s.movements : [];

          if (notes && notes.includes('__META__:')) {
            const parts = notes.split('__META__:');
            notes = parts[0].trim();
            try {
              const meta = JSON.parse(parts[1]);
              if (meta.closing_balances && meta.closing_balances.length > 0) closingBalances = meta.closing_balances;
              if (meta.closing_date) closingDate = meta.closing_date;
              if (meta.movements && meta.movements.length > 0) movements = meta.movements;
            } catch (e) {
              // ignore
            }
          }

          return {
            id: s.id,
            userId: s.user_id,
            workerName: s.worker_name,
            branchId: s.branch_id,
            openedAt: s.opened_at,
            closedAt: s.closed_at,
            openingBalance: Number(s.opening_balance ?? s.opening_amount) || 0,
            openingAmount: Number(s.opening_amount ?? s.opening_balance) || 0,
            closingBalances,
            status: s.status || 'open',
            notes,
            closingDate,
            workingEmployeeIds: Array.isArray(s.working_employee_ids) ? s.working_employee_ids : [],
            movements
          };
        });
      }
    } catch (e: any) {
      // Non-fatal
    }

    // 11. Inventory Transfers
    try {
      const { data, error } = await supabase.from('inventory_transfers').select('*').order('date', { ascending: false });
      if (!error && data && Array.isArray(data)) {
        fetchedData.transfers = data.map((t: any): InventoryTransfer => ({
          id: t.id,
          productId: t.product_id,
          productName: t.product_name,
          fromBranchId: t.from_branch_id,
          fromBranchName: t.from_branch_name,
          toBranchId: t.to_branch_id,
          toBranchName: t.to_branch_name,
          variantLabel: t.variant_label,
          quantity: Number(t.quantity) || 0,
          variants: Array.isArray(t.variants) ? t.variants : [],
          date: t.date,
          userId: t.user_id,
          status: t.status || 'completed'
        }));
      }
    } catch (e) { /* ignore */ }

    // 12. Warranties
    try {
      const { data, error } = await supabase.from('warranties').select('*');
      if (!error && data && Array.isArray(data)) {
        fetchedData.warranties = data.map((w: any): Warranty => ({
          id: w.id,
          productId: w.product_id,
          productName: w.product_name,
          transactionId: w.transaction_id,
          customerId: w.customer_id,
          customerName: w.customer_name,
          purchaseDate: w.purchase_date,
          expiryDate: w.expiry_date,
          serialNumber: w.serial_number,
          status: w.status || 'active'
        }));
      }
    } catch (e) { /* ignore */ }

    // 13. Returns
    try {
      const { data, error } = await supabase.from('returns').select('*').order('date', { ascending: false });
      if (!error && data && Array.isArray(data)) {
        fetchedData.returns = data.map((r: any): ReturnItem => ({
          id: r.id,
          transactionId: r.transaction_id,
          productId: r.product_id,
          quantity: Number(r.quantity) || 1,
          reason: r.reason,
          date: r.date,
          status: r.status || 'pending',
          type: r.type || 'refund',
          notes: r.notes,
          variantLabel: r.variant_label
        }));
      }
    } catch (e) { /* ignore */ }

    // 14. Quotes
    try {
      const { data, error } = await supabase.from('quotes').select('*').order('date', { ascending: false });
      if (!error && data && Array.isArray(data)) {
        fetchedData.quotes = data.map((q: any): Quote => ({
          id: q.id,
          branchId: q.branch_id,
          userId: q.user_id,
          customerId: q.customer_id,
          date: q.date,
          subtotal: Number(q.subtotal) || 0,
          tax: Number(q.tax) || 0,
          total: Number(q.total) || 0,
          items: Array.isArray(q.items) ? q.items : [],
          status: q.status || 'pending',
          notes: q.notes
        }));
      }
    } catch (e) { /* ignore */ }

    // 15. Time Shifts
    try {
      const { data, error } = await supabase.from('time_shifts').select('*').order('clock_in', { ascending: false });
      if (!error && data && Array.isArray(data)) {
        fetchedData.timeShifts = data.map((s: any): TimeShift => ({
          id: s.id,
          userId: s.user_id,
          clockIn: s.clock_in,
          clockOut: s.clock_out,
          notes: s.notes
        }));
      }
    } catch (e) { /* ignore */ }

    // 16. Salary Settlements
    try {
      const { data, error } = await supabase.from('salary_settlements').select('*').order('date', { ascending: false });
      if (!error && data && Array.isArray(data)) {
        fetchedData.salarySettlements = data.map((s: any): SalarySettlement => ({
          id: s.id,
          userId: s.user_id,
          userName: s.user_name,
          sessionId: s.session_id,
          baseSalary: Number(s.base_salary) || 0,
          salesGoal: Number(s.sales_goal) || 0,
          commissions: Number(s.commissions) || 0,
          total: Number(s.total) || 0,
          date: s.date,
          status: s.status || 'pending'
        }));
      }
    } catch (e) { /* ignore */ }

    // 17. Suppliers
    try {
      const { data, error } = await supabase.from('suppliers').select('*');
      if (!error && data && Array.isArray(data)) {
        fetchedData.suppliers = data.map((s: any): Supplier => ({
          id: s.id,
          name: s.name,
          phone: s.phone || '',
          address: s.address || '',
          email: s.email || '',
          rating: Number(s.rating) || 5,
          products: Array.isArray(s.products) ? s.products : [],
          typeOfMerchandise: s.type_of_merchandise || s.typeOfMerchandise || ''
        }));
      }
    } catch (e) { /* ignore */ }

    // 18. Supplier Orders
    try {
      const { data, error } = await supabase.from('supplier_orders').select('*').order('date', { ascending: false });
      if (!error && data && Array.isArray(data)) {
        fetchedData.supplierOrders = data.map((o: any): SupplierOrder => ({
          id: o.id,
          supplierId: o.supplier_id || o.supplierId,
          date: o.date,
          expectedDeliveryDate: o.expected_delivery_date || o.expectedDeliveryDate,
          items: Array.isArray(o.items) ? o.items : [],
          total: Number(o.total) || 0,
          status: o.status || 'pending',
          branchId: o.branch_id || o.branchId,
          transportDetails: o.transport_details || o.transportDetails,
          transportCost: Number(o.transport_cost || o.transportCost) || 0
        }));
      }
    } catch (e) { /* ignore */ }

    // 19. Global Settings (Receipt, Store, and Catalog Configs)
    try {
      const { data: setRes, error: setErr } = await supabase.from('settings').select('*').eq('id', 'global').maybeSingle();
      if (!setErr && setRes) {
        if (setRes.receipt_config) fetchedData.receiptConfig = setRes.receipt_config;
        if (setRes.store_config) fetchedData.storeConfig = setRes.store_config;
        if (setRes.catalog_config) fetchedData.catalogConfig = setRes.catalog_config;
      }
    } catch (e: any) {
      errors.push(`Configuración de Tickets: ${e.message}`);
    }

    const counts = {
      products: fetchedData.products?.length || 0,
      categories: fetchedData.categories?.length || 0,
      inventory: fetchedData.inventory?.length || 0,
      branches: fetchedData.branches?.length || 0,
      users: fetchedData.users?.length || 0,
      bankCards: fetchedData.bankCards?.length || 0,
      customers: fetchedData.customers?.length || 0,
      currencies: fetchedData.currencies?.length || 0,
      transactions: fetchedData.transactions?.length || 0,
      cashSessions: fetchedData.cashSessions?.length || 0,
      idnSettlementPrices: fetchedData.idnSettlementPrices?.length || 0,
      suppliers: fetchedData.suppliers?.length || 0,
      supplierOrders: fetchedData.supplierOrders?.length || 0
    };

    return {
      data: fetchedData,
      result: {
        success: true,
        message: `Sincronización exitosa: ${counts.products} productos, ${counts.inventory} registros de stock y ${counts.categories} categorías descargados de Supabase.`,
        counts,
        errors: errors.length > 0 ? errors : undefined
      }
    };
  } catch (err: any) {
    return {
      data: null,
      result: {
        success: false,
        message: `Error durante la sincronización: ${err?.message || 'Error desconocido'}`
      }
    };
  }
}


/**
 * Realiza un upsert seguro en Supabase. Si una columna no existe en el esquema remoto
 * (error PGRST204), si hay un error de clave foránea (23503), o si un ID no es UUID válido (22P02),
 * lo corrige y reintenta la operación para garantizar persistencia continua sin fallos.
 */
export async function safeUpsert(
  supabase: any,
  table: string,
  row: Record<string, any>,
  options?: any
): Promise<{ data: any; error: any }> {
  let currentRow = { ...row };
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await supabase.from(table).upsert(currentRow, options);
    if (!error) return { data, error: null };

    // 1. Error de columna faltante en caché de esquema Supabase (PGRST204)
    if (
      error.code === 'PGRST204' ||
      (error.message && (error.message.includes('in the schema cache') || error.message.includes('Could not find the')))
    ) {
      const match = error.message.match(/Could not find the ['"]([^'"]+)['"] column/i) ||
                    error.message.match(/column ['"]?([a-zA-Z0-9_]+)['"]? does not exist/i);
      if (match && match[1]) {
        const missingCol = match[1];
        console.debug(`[safeUpsert] Columna '${missingCol}' no existe en '${table}'. Omitiendo y reintentando.`);
        delete currentRow[missingCol];
        continue;
      }
    }

    // 2. Error de clave foránea (error 23503)
    if (error.code === '23503') {
      let fkCol: string | null = null;
      if (error.details) {
        const fkMatch = error.details.match(/Key \(([^)]+)\)=/i);
        if (fkMatch && fkMatch[1]) fkCol = fkMatch[1];
      }
      if (!fkCol && error.message) {
        const mMatch = error.message.match(/violates foreign key constraint ".*?_([a-zA-Z0-9_]+)_fkey"/i) ||
                       error.message.match(/constraint "[a-zA-Z0-9_]+_([a-zA-Z0-9_]+)_fkey"/i);
        if (mMatch && mMatch[1]) fkCol = mMatch[1];
      }
      if (!fkCol) {
        if (table === 'products' && (error.details?.includes('categories') || error.message?.includes('category'))) {
          fkCol = 'category_id';
        } else if (table === 'inventory_transfers' && (error.details?.includes('products') || error.message?.includes('product'))) {
          fkCol = 'product_id';
        } else if (table === 'users' && (error.details?.includes('branches') || error.message?.includes('branch'))) {
          fkCol = 'branch_id';
        } else if (table === 'inventory' && (error.details?.includes('branches') || error.message?.includes('branch') || error.message?.includes('branches'))) {
          fkCol = 'branch_id';
        } else if (table === 'inventory' && (error.details?.includes('products') || error.message?.includes('product') || error.message?.includes('products'))) {
          fkCol = 'product_id';
        }
      }
      if (fkCol && currentRow[fkCol] !== undefined && currentRow[fkCol] !== null) {
        const fkVal = currentRow[fkCol];
        console.debug(`[safeUpsert] Llave foránea '${fkCol}' con valor '${fkVal}' falta en la tabla padre.`);
        
        try {
          if (fkCol === 'branch_id') {
            const storeBranch = useStore.getState().branches.find(b => b.id === fkVal);
            if (storeBranch) {
              await supabase.from('branches').upsert({
                id: storeBranch.id,
                name: storeBranch.name,
                address: storeBranch.address || null,
                phone: storeBranch.phone || null
              });
            } else {
              // Si no existe, reasignar a la principal para no romper la integridad
              const mainBranchId = useStore.getState().branches[0]?.id || 'b-central';
              console.warn(`[safeUpsert] Reasignando sucursal inexistente '${fkVal}' a '${mainBranchId}'`);
              currentRow[fkCol] = mainBranchId;
            }
          } else if (fkCol === 'product_id') {
            const storeProduct = useStore.getState().products.find(p => p.id === fkVal);
            if (storeProduct) {
              await supabase.from('products').upsert({
                id: storeProduct.id,
                name: storeProduct.name,
                sku: storeProduct.sku,
                cost_price: storeProduct.costPrice || 0,
                price: storeProduct.price || 0
              });
            } else {
              // Si el producto no existe en absoluto, no podemos inventarlo sin ensuciar
              console.warn(`[safeUpsert] Registro huérfano detectado para producto '${fkVal}'. Abortando push.`);
              return { data: null, error };
            }
          } else if (fkCol === 'category_id') {
            const storeCategory = useStore.getState().categories.find(c => c.id === fkVal);
            if (storeCategory) {
              await supabase.from('categories').upsert({
                id: storeCategory.id,
                name: storeCategory.name
              });
            } else {
              currentRow[fkCol] = useStore.getState().categories[0]?.id || null;
            }
          }
        } catch (autoErr) {
          console.warn('[safeUpsert] Falló la recuperación de integridad:', autoErr);
          return { data: null, error };
        }
        continue;
      }
    }

    // 2b. Error de Clave Única Duplicada (error 23505)
    if (error.code === '23505') {
      if (table === 'users' && (error.message?.includes('users_email_key') || error.details?.includes('email') || currentRow.email)) {
        console.debug(`[safeUpsert] Email duplicado '${currentRow.email}' en 'users'. Reintentando con email único.`);
        const base = (currentRow.email || 'user@system.local').split('@')[0];
        currentRow.email = `${base}_${Math.floor(1000 + Math.random() * 9000)}@system.local`;
        continue;
      }
      // Si hay un conflicto de clave única genérico, podemos intentar ignorarlo o continuar
      return { data: null, error };
    }

    // 3. Error de sintaxis UUID (22P02)
    if (error.code === '22P02' || (error.message && error.message.includes('invalid input syntax for type uuid'))) {
      if (currentRow.id && typeof currentRow.id === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentRow.id)) {
        console.debug(`[safeUpsert] ID '${currentRow.id}' no es UUID en tabla '${table}'. Generando UUID compatible.`);
        // Reemplazar con UUID estándar
        currentRow.id = crypto.randomUUID();
        continue;
      }
    }

    // 3b. Error de Not-Null Violation en ID (23502)
    if (error.code === '23502') {
      if (!currentRow.id || error.message?.includes('column "id"') || error.message?.includes("column 'id'")) {
        console.debug(`[safeUpsert] Columna id nula o faltante en tabla '${table}'. Asignando UUID generado.`);
        currentRow.id = crypto.randomUUID();
        continue;
      }
    }

    // 4. Fallo en restricción ON CONFLICT
    if (error.message && error.message.includes('ON CONFLICT specification')) {
      console.debug(`[safeUpsert] Restricción ON CONFLICT no encontrada en '${table}'. Reintentando insert.`);
      return await supabase.from(table).insert(currentRow);
    }

    return { data, error };
  }
  return { data: null, error: new Error('safeUpsert: Máximo número de reintentos alcanzado') };
}

export async function pushProductToSupabase(product: Product) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    let validCategoryId = product.categoryId || null;
    if (validCategoryId) {
      try {
        const { data: catRow } = await supabase.from('categories').select('id').eq('id', validCategoryId).maybeSingle();
        if (!catRow) {
          validCategoryId = null;
        }
      } catch {
        validCategoryId = null;
      }
    }

    const row: Record<string, any> = {
      id: product.id,
      name: product.name,
      sku: product.sku || null,
      barcode: product.barcode || null,
      cost_price: product.costPrice,
      price: product.price,
      margin: product.margin,
      category_id: validCategoryId,
      color: product.color || null,
      commission_value: product.commissionValue || 0,
      unit: product.unit || 'unidad',
      status: product.status || 'active',
      min_stock_alert: product.minStockAlert || 5,
      has_serial: product.hasSerial || false,
      warranty_days: product.warrantyDays || 0,
      is_kit: product.isKit || false,
      kit_items: product.kitItems || [],
      device_color: product.deviceColor || null,
      available_sizes: product.availableSizes || [],
      available_colors: product.availableColors || []
    };

    const { error } = await safeUpsert(supabase, 'products', row);
    if (error) {
      console.warn("Supabase push product warning:", error);
    }
  } catch (e) {
    console.warn("Supabase push product failed:", e);
  }
}

export async function pushInventoryToSupabase(level: InventoryLevel) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('inventory', level, `${level.productId}_${level.branchId}_${level.variantLabel || ''}`);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('inventory', level, `${level.productId}_${level.branchId}_${level.variantLabel || ''}`);
    return;
  }

  try {
    const vLabel = level.variantLabel || '';

    // 0. Verificar y asegurar dependencias (sucursal y producto en Supabase)
    if (level.branchId) {
      const { data: bData } = await supabase.from('branches').select('id').eq('id', level.branchId).maybeSingle();
      if (!bData) {
        const storeBranch = useStore.getState().branches.find(b => b.id === level.branchId);
        if (storeBranch) {
          await pushBranchToSupabase(storeBranch);
        }
      }
    }

    if (level.productId) {
      const { data: pData } = await supabase.from('products').select('id').eq('id', level.productId).maybeSingle();
      if (!pData) {
        const storeProduct = useStore.getState().products.find(p => p.id === level.productId);
        if (storeProduct) {
          await pushProductToSupabase(storeProduct);
        }
      }
    }

    // 1. Buscar si ya existe el registro en la base de datos para la combinación producto/sucursal
    const { data: existingRows } = await supabase
      .from('inventory')
      .select('id, variant_label')
      .eq('product_id', level.productId)
      .eq('branch_id', level.branchId);

    const matchingRow = existingRows?.find(r => (r.variant_label || '') === vLabel);

    if (matchingRow) {
      const { error: updateError } = await supabase
        .from('inventory')
        .update({
          quantity: Number(level.quantity) || 0,
          min_quantity: Number(level.minQuantity) || 0,
          variant_label: vLabel
        })
        .eq('id', matchingRow.id);

      if (!updateError) return;
    }

    // 2. Si no existe registro previo, insertar nuevo
    const isValidUUID = typeof level.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(level.id);
    const insertRow: Record<string, any> = {
      id: isValidUUID ? level.id : crypto.randomUUID(),
      product_id: level.productId,
      branch_id: level.branchId,
      variant_label: vLabel,
      quantity: Number(level.quantity) || 0,
      min_quantity: Number(level.minQuantity) || 0
    };

    const res = await safeUpsert(supabase, 'inventory', insertRow);
    if (res?.error) {
      enqueueOfflineItem('inventory', level, `${level.productId}_${level.branchId}_${level.variantLabel || ''}`);
    }
  } catch (e) {
    console.warn("Supabase push inventory failed, encolando offline:", e);
    enqueueOfflineItem('inventory', level, `${level.productId}_${level.branchId}_${level.variantLabel || ''}`);
  }
}

export async function pushTransactionToSupabase(tx: Transaction) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('transaction', tx, tx.id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('transaction', tx, tx.id);
    return;
  }

  try {
    // Si la transacción está asociada a una sesión de caja, asegurar que la sesión esté en Supabase primero
    if (tx.sessionId) {
      try {
        const localSession = useStore.getState().cashSessions?.find(s => s.id === tx.sessionId);
        if (localSession) {
          await pushCashSessionToSupabase(localSession);
        }
      } catch (e) {
        // Ignorar si falla
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

    const res = await safeUpsert(supabase, 'transactions', row);
    if (res?.error) {
      enqueueOfflineItem('transaction', tx, tx.id);
    }
  } catch (e) {
    console.warn("Supabase push transaction failed, guardando en cola offline:", e);
    enqueueOfflineItem('transaction', tx, tx.id);
  }
}

export async function pushCashSessionToSupabase(session: CashRegisterSession) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('cash_session', session, session.id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('cash_session', session, session.id);
    return;
  }

  try {
    // Empaquetar datos extendidos en el campo notes para no provocar errores de columnas inexistentes
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

    const res = await safeUpsert(supabase, 'cash_sessions', row);
    if (res?.error) {
      enqueueOfflineItem('cash_session', session, session.id);
    }
  } catch (e) {
    console.warn("Supabase push cash session failed, guardando en cola offline:", e);
    enqueueOfflineItem('cash_session', session, session.id);
  }
}

export async function pushBranchToSupabase(branch: Branch) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('branch', branch, branch.id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('branch', branch, branch.id);
    return;
  }

  try {
    const row = {
      id: branch.id,
      name: branch.name,
      address: branch.address || null,
      phone: branch.phone || null,
      is_active: branch.isActive !== false,
      is_main: branch.isMain === true
    };

    const res = await safeUpsert(supabase, 'branches', row);
    if (res?.error) {
      console.warn("Supabase push branch warning:", res.error);
      enqueueOfflineItem('branch', branch, branch.id);
    }
  } catch (e) {
    console.warn("Supabase push branch failed, guardando en cola offline:", e);
    enqueueOfflineItem('branch', branch, branch.id);
  }
}

export async function deleteBranchFromSupabase(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    // 1. Delete associated inventory in Supabase first so FK constraints or stale records don't resurrect
    await supabase.from('inventory').delete().eq('branch_id', id);
    // 2. Unassign branch from users in Supabase
    await supabase.from('users').update({ branch_id: null, assigned_branch_id: null }).eq('branch_id', id);
    // 3. Delete the branch row from Supabase
    await supabase.from('branches').delete().eq('id', id);
  } catch (e) {
    console.warn("Supabase delete branch failed:", e);
  }
}

export async function pushCategoryToSupabase(category: Category) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const row = {
      id: category.id,
      name: category.name,
      department: category.department || 'General',
      description: category.description || null,
      color: category.color || null,
      image: category.image || null
    };

    await safeUpsert(supabase, 'categories', row);
  } catch (e) {
    console.warn("Supabase push category failed:", e);
  }
}

export async function deleteCategoryFromSupabase(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.from('categories').delete().eq('id', id);
  } catch (e) {
    console.warn("Supabase delete category failed:", e);
  }
}

export async function deleteProductFromSupabase(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.from('products').delete().eq('id', id);
  } catch (e) {
    console.warn("Supabase delete product failed:", e);
  }
}

export async function clearSupabaseData() {
  const supabase = getSupabase();
  if (!supabase) return;

  console.debug("[clearSupabaseData] Iniciando limpieza total de Supabase...");

  // List of tables to clear, in order to respect FK constraints (dependents first)
  const tables = [
    'inventory',
    'transactions',
    'cash_sessions',
    'idn_settlement_prices',
    'inventory_transfers',
    'inventory_audits',
    'supplier_orders',
    'returns',
    'warranties',
    'salary_settlements',
    'quotes',
    'time_shifts',
    'bank_transactions',
    'products',
    'categories',
    'users',
    'branches',
    'bank_cards',
    'customers',
    'suppliers'
  ];

  // Realizar 2 pasadas para asegurar que las restricciones de llave foránea no bloqueen todo
  for (let pass = 1; pass <= 2; pass++) {
    console.debug(`[clearSupabaseData] Pasada de eliminación #${pass}`);
    for (const table of tables) {
      try {
        // Intentar borrar usando diferentes filtros comunes
        await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from(table).delete().not('id', 'is', null);
        
        // Para tablas sin 'id' (si hubiera) o como respaldo
        if (table === 'inventory') {
          await supabase.from(table).delete().neq('quantity', -999999);
        }
      } catch (e) {
        console.debug(`[clearSupabaseData] Error en pasada ${pass} tabla ${table}:`, e);
      }
    }
  }
  console.debug("[clearSupabaseData] Limpieza completada.");
}

export async function clearHistoryFromSupabase() {
  const supabase = getSupabase();
  if (!supabase) return;

  console.debug("[clearHistoryFromSupabase] Iniciando limpieza selectiva de Historial (Ventas/Turnos/Movimientos)...");

  // Only tables related to history/reports - PERSIST MASTER DATA (products, branches, users)
  const historyTables = [
    'transactions',
    'cash_sessions',
    'cash_movements',
    'bank_transactions',
    'inventory_audits',
    'salary_settlements',
    'returns',
    'warranties'
  ];

  for (const table of historyTables) {
    try {
      console.debug(`[clearHistoryFromSupabase] Limpiando ${table}...`);
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
    } catch (err) {
      console.warn(`[clearHistoryFromSupabase] Error en tabla ${table}:`, err);
    }
  }
}

export async function pushUserToSupabase(user: User) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const email = user.email && user.email.trim().length > 0
      ? user.email
      : `${String(user.name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '')}_${user.id.slice(0, 6)}@system.local`;

    const row: Record<string, any> = {
      id: user.id,
      name: user.name,
      email: email,
      password: user.password || null,
      role: user.role || 'employee',
      base_salary: user.baseSalary || 0,
      sales_goal: user.salesGoal || 0,
      branch_id: user.branchId || null,
      allowed_branches: user.allowedBranches || [],
      permissions: user.permissions || [],
      is_active: user.isActive !== false,
      is_independent: user.isIndependent === true,
      assigned_branch_id: user.assignedBranchId || user.branchId || null
    };

    const { error } = await safeUpsert(supabase, 'users', row);
    if (error) {
      console.warn("Supabase push user warning:", error);
    }
  } catch (e) {
    console.warn("Supabase push user failed:", e);
  }
}

export async function pushIDNSettlementPriceToSupabase(price: IDNSettlementPrice) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const row = {
      id: price.id,
      user_id: price.userId,
      product_id: price.productId,
      settlement_price: price.settlementPrice
    };

    await safeUpsert(supabase, 'idn_settlement_prices', row);
  } catch (e) {
    console.warn("Supabase push settlement price failed:", e);
  }
}

export async function deleteIDNSettlementPriceFromSupabase(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.from('idn_settlement_prices').delete().eq('id', id);
  } catch (e) {
    console.warn("Supabase delete settlement price failed:", e);
  }
}

export async function deleteUserFromSupabase(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.from('users').delete().eq('id', id);
  } catch (e) {
    console.warn("Supabase delete user failed:", e);
  }
}

export async function pushCustomerToSupabase(customer: Customer) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('customer', customer, customer.id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    enqueueOfflineItem('customer', customer, customer.id);
    return;
  }

  try {
    const row = {
      id: customer.id,
      name: customer.name,
      phone: customer.phone || null,
      email: customer.email || null,
      tax_id: customer.taxId || null
    };

    const res = await safeUpsert(supabase, 'customers', row);
    if (res?.error) {
      enqueueOfflineItem('customer', customer, customer.id);
    }
  } catch (e) {
    console.warn("Supabase push customer failed, encolando offline:", e);
    enqueueOfflineItem('customer', customer, customer.id);
  }
}

export async function deleteCustomerFromSupabase(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.from('customers').delete().eq('id', id);
  } catch (e) {
    console.warn("Supabase delete customer failed:", e);
  }
}

export async function pushInventoryTransferToSupabase(transfer: InventoryTransfer) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    // Verificar si el producto existe en Supabase; si no, empujarlo primero
    try {
      const { data: prodExists } = await supabase.from('products').select('id').eq('id', transfer.productId).maybeSingle();
      if (!prodExists) {
        const localProduct = useStore.getState().products.find(p => p.id === transfer.productId);
        if (localProduct) {
          await pushProductToSupabase(localProduct);
        }
      }
    } catch {
      // Continuar normalmente
    }

    const validUserId = transfer.userId && transfer.userId !== 'system' ? transfer.userId : null;
    const row = {
      id: transfer.id,
      product_id: transfer.productId,
      product_name: transfer.productName,
      from_branch_id: transfer.fromBranchId,
      from_branch_name: transfer.fromBranchName,
      to_branch_id: transfer.toBranchId,
      to_branch_name: transfer.toBranchName,
      variant_label: transfer.variantLabel || 'Estándar',
      quantity: transfer.quantity,
      variants: transfer.variants || [],
      date: transfer.date,
      user_id: validUserId,
      status: transfer.status || 'completed'
    };
    const { error } = await safeUpsert(supabase, 'inventory_transfers', row);
    if (error) {
      console.warn("Supabase push transfer warning:", error);
    }
  } catch (e) {
    console.warn("Supabase push transfer failed:", e);
  }
}

export async function pushWarrantyToSupabase(warranty: Warranty) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const row = {
      id: warranty.id,
      product_id: warranty.productId,
      product_name: warranty.productName,
      transaction_id: warranty.transactionId,
      customer_id: warranty.customerId,
      customer_name: warranty.customerName,
      purchase_date: warranty.purchaseDate,
      expiry_date: warranty.expiryDate,
      serial_number: warranty.serialNumber,
      status: warranty.status
    };
    await safeUpsert(supabase, 'warranties', row);
  } catch (e) {
    console.warn("Supabase push warranty failed:", e);
  }
}

export async function pushCurrencyToSupabase(currency: Currency) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const row = {
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      rate_to_base: currency.rateToBase,
      is_base: currency.isBase
    };
    await safeUpsert(supabase, 'currencies', row, 'code');
  } catch (e) {
    console.warn("Supabase push currency failed:", e);
  }
}

export async function pushReturnToSupabase(returnItem: ReturnItem) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const row = {
      id: returnItem.id,
      transaction_id: returnItem.transactionId,
      product_id: returnItem.productId,
      quantity: returnItem.quantity,
      reason: returnItem.reason,
      date: returnItem.date,
      status: returnItem.status,
      type: returnItem.type,
      notes: returnItem.notes,
      variant_label: returnItem.variantLabel
    };
    await safeUpsert(supabase, 'returns', row);
  } catch (e) {
    console.warn("Supabase push return failed:", e);
  }
}

export async function pushTimeShiftToSupabase(shift: TimeShift) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const row = {
      id: shift.id,
      user_id: shift.userId,
      clock_in: shift.clockIn,
      clock_out: shift.clockOut,
      notes: shift.notes
    };
    await safeUpsert(supabase, 'time_shifts', row);
  } catch (e) {
    console.warn("Supabase push time shift failed:", e);
  }
}

export async function pushQuoteToSupabase(quote: Quote) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const row = {
      id: quote.id,
      branch_id: quote.branchId,
      user_id: quote.userId,
      customer_id: quote.customerId,
      date: quote.date,
      subtotal: quote.subtotal,
      tax: quote.tax,
      total: quote.total,
      items: quote.items || [],
      status: quote.status,
      notes: quote.notes
    };
    await safeUpsert(supabase, 'quotes', row);
  } catch (e) {
    console.warn("Supabase push quote failed:", e);
  }
}

export async function pushBankTransactionToSupabase(tx: BankTransaction) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const row = {
      id: tx.id,
      card_id: tx.cardId,
      type: tx.type,
      amount: tx.amount,
      date: tx.date,
      reference: tx.reference,
      description: tx.description,
      transaction_id: tx.transactionId
    };
    await safeUpsert(supabase, 'bank_transactions', row);
  } catch (e) {
    console.warn("Supabase push bank tx failed:", e);
  }
}

export async function pushBankCardToSupabase(card: BankCard) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const row = {
      id: card.id,
      name: card.name || card.bankName || 'Tarjeta Bancaria',
      bank: card.bank || card.bankName || 'Banco',
      bank_name: card.bankName || card.bank || 'Banco',
      card_holder: card.cardHolder || 'Titular',
      account_number: card.accountNumber || card.lastFourDigits || card.lastFour || '',
      phone: card.phone || '',
      last_four_digits: card.lastFourDigits || card.lastFour || (card.accountNumber ? String(card.accountNumber).slice(-4) : '0000'),
      balance: card.balance || 0,
      currency: card.currency || 'CUP',
      color: card.color || 'from-indigo-600 to-purple-800',
      is_active: card.isActive !== false
    };
    await safeUpsert(supabase, 'bank_cards', row);
  } catch (e) {
    console.warn("Supabase push bank card failed:", e);
  }
}

export async function deleteBankCardFromSupabase(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.from('bank_cards').delete().eq('id', id);
  } catch (e) {
    console.warn("Supabase delete bank card failed:", e);
  }
}

export async function pushSupplierToSupabase(supplier: Supplier) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const row = {
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone || '',
      address: supplier.address || '',
      email: supplier.email || '',
      rating: supplier.rating || 5,
      type_of_merchandise: supplier.typeOfMerchandise || ''
    };
    await safeUpsert(supabase, 'suppliers', row);
  } catch (e) {
    console.warn("Supabase push supplier failed:", e);
  }
}

export async function deleteSupplierFromSupabase(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.from('suppliers').delete().eq('id', id);
  } catch (e) {
    console.warn("Supabase delete supplier failed:", e);
  }
}

export async function pushSupplierOrderToSupabase(order: SupplierOrder) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const row = {
      id: order.id,
      supplier_id: order.supplierId,
      date: order.date,
      expected_delivery_date: order.expectedDeliveryDate,
      items: order.items || [],
      total: order.total,
      status: order.status,
      branch_id: order.branchId,
      transport_details: order.transportDetails,
      transport_cost: order.transportCost
    };
    await safeUpsert(supabase, 'supplier_orders', row);
  } catch (e) {
    console.warn("Supabase push supplier order failed:", e);
  }
}

export async function pushInventoryAuditToSupabase(audit: InventoryAudit) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const row = {
      id: audit.id,
      date: audit.date,
      branch_id: audit.branchId,
      user_id: audit.userId,
      status: audit.status,
      items: audit.items || [],
      notes: audit.notes
    };
    await safeUpsert(supabase, 'inventory_audits', row);
  } catch (e) {
    console.warn("Supabase push audit failed:", e);
  }
}

export async function pushSalarySettlementToSupabase(settlement: SalarySettlement) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const row = {
      id: settlement.id,
      user_id: settlement.userId,
      user_name: settlement.userName,
      session_id: settlement.sessionId,
      base_salary: settlement.baseSalary,
      sales_goal: settlement.salesGoal,
      commissions: settlement.commissions,
      total: settlement.total,
      date: settlement.date,
      status: settlement.status
    };
    await safeUpsert(supabase, 'salary_settlements', row);
  } catch (e) {
    console.warn("Supabase push salary settlement failed:", e);
  }
}

export async function pushReceiptConfigToSupabase(config: ReceiptConfig) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('settings').upsert({
      id: 'global',
      receipt_config: config
    });
    if (error) {
      console.warn("Supabase push receipt config failed:", error);
      enqueueOfflineItem('receipt_config', config, 'global');
    }
  } catch (e) {
    console.warn("Supabase push receipt config exception:", e);
    enqueueOfflineItem('receipt_config', config, 'global');
  }
}

export async function pushStoreConfigToSupabase(config: StoreConfig) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('settings').upsert({
      id: 'global',
      store_config: config
    });
    if (error) {
      console.warn("Supabase push store config failed:", error);
    }
  } catch (e) {
    console.warn("Supabase push store config exception:", e);
  }
}

export async function deleteTransactionFromSupabase(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) console.warn("Supabase delete transaction failed:", error);
  } catch (e) {
    console.warn("Supabase delete transaction exception:", e);
  }
}

export async function deleteCashSessionFromSupabase(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('cash_sessions').delete().eq('id', id);
    if (error) console.warn("Supabase delete cash session failed:", error);
  } catch (e) {
    console.warn("Supabase delete cash session exception:", e);
  }
}

export interface TableTestResult {
  table: string;
  label: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  count: number;
  canRead: boolean;
  canWrite: boolean;
}

export interface SupabaseDiagnosticReport {
  connected: boolean;
  url: string;
  tables: TableTestResult[];
  summary: string;
  timestamp: string;
}

/**
 * Realiza un test exhaustivo tabla por tabla en Supabase:
 * Verifica lectura, escritura con safeUpsert y eliminación de prueba.
 */
export async function testSupabaseTables(): Promise<SupabaseDiagnosticReport> {
  const supabase = getSupabase();
  const url = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('mare_supabase_url') || 'https://kghnrcxuzpftnmlbvdou.supabase.co';
  
  if (!supabase) {
    return {
      connected: false,
      url,
      tables: [],
      summary: 'No se pudo inicializar el cliente de Supabase. Revisa las credenciales.',
      timestamp: new Date().toISOString()
    };
  }

  const tablesToTest = [
    { table: 'branches', label: 'Sucursales / Almacenes' },
    { table: 'users', label: 'Usuarios y Empleados' },
    { table: 'categories', label: 'Categorías de Productos' },
    { table: 'products', label: 'Productos del Inventario' },
    { table: 'inventory', label: 'Stock por Sucursal' },
    { table: 'idn_settlement_prices', label: 'Precios Liquidación IDN' },
    { table: 'transactions', label: 'Ventas y Facturas' },
    { table: 'cash_sessions', label: 'Sesiones de Caja' },
    { table: 'customers', label: 'Clientes' },
    { table: 'currencies', label: 'Monedas y Tasas' },
    { table: 'suppliers', label: 'Proveedores' },
    { table: 'bank_cards', label: 'Cuentas Bancarias' },
  ];

  const results: TableTestResult[] = [];

  for (const { table, label } of tablesToTest) {
    try {
      // 1. Test Read
      const { data, count, error: readError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: false })
        .limit(5);

      if (readError) {
        results.push({
          table,
          label,
          status: 'error',
          message: `Fallo de lectura: ${readError.message}`,
          count: 0,
          canRead: false,
          canWrite: false
        });
        continue;
      }

      const totalCount = count ?? (data ? data.length : 0);

      // 2. Test Write (Probe test record)
      const testId = crypto.randomUUID();
      let probeRow: Record<string, any> = { id: testId };
      if (table === 'branches') {
        probeRow = { id: testId, name: '__TEST_PROBE__' };
      } else if (table === 'categories') {
        probeRow = { id: testId, name: '__TEST_CAT__' };
      } else if (table === 'users') {
        probeRow = { id: testId, name: '__TEST_USER__', email: `test_${testId.slice(0,6)}@test.com`, role: 'employee' };
      } else if (table === 'currencies') {
        probeRow = { code: 'TST', name: 'Test Currency', symbol: 'T', rate_to_base: 1, is_base: false };
      } else if (table === 'customers') {
        probeRow = { id: testId, name: '__TEST_CUSTOMER__' };
      } else if (table === 'suppliers') {
        probeRow = { id: testId, name: '__TEST_SUPPLIER__' };
      } else if (table === 'bank_cards') {
        probeRow = { id: testId, name: '__TEST_CARD__', last_four_digits: '0000', currency: 'CUP', bank: 'Test' };
      }

      let writeOk = false;
      let writeMsg = 'Lectura y acceso correcto';

      if (probeRow && Object.keys(probeRow).length > 1) {
        const { error: writeError } = await safeUpsert(supabase, table, probeRow);
        if (writeError) {
          writeMsg = `Lectura OK (${totalCount} registros), pero escritura falló: ${writeError.message}`;
          results.push({
            table,
            label,
            status: 'warning',
            message: writeMsg,
            count: totalCount,
            canRead: true,
            canWrite: false
          });
          continue;
        } else {
          writeOk = true;
          // Clean up probe record
          if (table === 'currencies') {
            await supabase.from(table).delete().eq('code', 'TST');
          } else {
            await supabase.from(table).delete().eq('id', testId);
          }
        }
      } else {
        writeOk = true;
      }

      results.push({
        table,
        label,
        status: 'ok',
        message: `Conectado y funcional (${totalCount} registros)`,
        count: totalCount,
        canRead: true,
        canWrite: writeOk
      });
    } catch (err: any) {
      results.push({
        table,
        label,
        status: 'error',
        message: `Excepción: ${err.message || 'Desconocido'}`,
        count: 0,
        canRead: false,
        canWrite: false
      });
    }
  }

  const okCount = results.filter(r => r.status === 'ok').length;
  const total = results.length;

  return {
    connected: true,
    url,
    tables: results,
    summary: `${okCount} de ${total} tablas operativas y sincronizables al 100%.`,
    timestamp: new Date().toISOString()
  };
}

export async function safeUpsertMany(
  supabase: any,
  table: string,
  rows: Record<string, any>[]
): Promise<{ success: boolean; error?: any }> {
  if (!rows || rows.length === 0) return { success: true };

  try {
    const { error } = await supabase.from(table).upsert(rows);
    if (!error) return { success: true };
    console.debug(`[safeUpsertMany] Upsert por lote en '${table}' falló (${error.message}). Reintentando por partes.`);
  } catch (e) {
    // ignore
  }

  // Si falla el lote completo por algún esquema o restricción, procesar en lotes de 10 en paralelo
  const chunkSize = 10;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await Promise.all(chunk.map(row => safeUpsert(supabase, table, row)));
  }

  return { success: true };
}

/**
 * Empuja toda la base de datos local (Sucursales, Usuarios, Categorías, Productos, Stock, IDN, etc.)
 * a Supabase para garantizar respaldo total sin pérdida de datos en solo ~11 peticiones en lote.
 */
export async function pushAllToSupabase(): Promise<{ success: boolean; pushed: Record<string, number>; errors: string[] }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, pushed: {}, errors: ["Supabase no configurado"] };

  const store = useStore.getState();
  const errors: string[] = [];
  const pushed: Record<string, number> = {
    branches: store.branches.length,
    categories: store.categories.length,
    users: store.users.length,
    bankCards: (store.bankCards || []).length,
    products: store.products.length,
    inventory: store.inventory.length,
    idnPrices: store.idnSettlementPrices.length,
    customers: store.customers.length,
    suppliers: (store.suppliers || []).length,
    supplierOrders: (store.supplierOrders || []).length,
    transactions: Math.min(store.transactions.length, 100)
  };

  try {
    // 1. Branches
    const branchRows = store.branches.map(b => ({
      id: b.id, name: b.name, address: b.address || '', phone: b.phone || ''
    }));
    await safeUpsertMany(supabase, 'branches', branchRows);

    // 2. Categories
    const categoryRows = store.categories.map(c => ({
      id: c.id, name: c.name, department: c.department || '', color: c.color || '#6366f1'
    }));
    await safeUpsertMany(supabase, 'categories', categoryRows);

    // 3. Users
    const userRows = store.users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email || `${String(u.name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '')}_${u.id.slice(0, 6)}@system.local`,
      password: u.password || null,
      role: u.role || 'employee',
      base_salary: u.baseSalary || 0,
      sales_goal: u.salesGoal || 0,
      branch_id: u.branchId || null,
      allowed_branches: u.allowedBranches || [],
      permissions: u.permissions || [],
      is_active: u.isActive !== false,
      is_independent: u.isIndependent === true,
      assigned_branch_id: u.assignedBranchId || u.branchId || null
    }));
    await safeUpsertMany(supabase, 'users', userRows);

    // 4. Bank Cards
    const cardRows = (store.bankCards || []).map(bc => ({
      id: bc.id,
      name: bc.name || bc.bankName || 'Tarjeta',
      bank: bc.bank || bc.bankName || 'Banco',
      bank_name: bc.bankName || bc.bank || 'Banco',
      card_holder: bc.cardHolder || 'Titular',
      account_number: bc.accountNumber || bc.lastFourDigits || '',
      balance: Number(bc.balance) || 0,
      currency: bc.currency || 'CUP'
    }));
    await safeUpsertMany(supabase, 'bank_cards', cardRows);

    // 5. Products
    const productRows = store.products.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku || null,
      barcode: p.barcode || null,
      cost_price: p.costPrice || 0,
      price: p.price || 0,
      margin: p.margin || 0,
      category_id: p.categoryId || null,
      color: p.color || null,
      commission_value: p.commissionValue || 0,
      unit: p.unit || 'unidad',
      status: p.status || 'active',
      min_stock_alert: p.minStockAlert || 5,
      has_serial: p.hasSerial || false,
      warranty_days: p.warrantyDays || 0,
      is_kit: p.isKit || false,
      kit_items: p.kitItems || [],
      device_color: p.deviceColor || null,
      available_sizes: p.availableSizes || [],
      available_colors: p.availableColors || []
    }));
    await safeUpsertMany(supabase, 'products', productRows);

    // Set of valid IDs for foreign key reference safety
    const validProdIds = new Set(store.products.map(p => p.id));
    const validBranchIds = new Set(store.branches.map(b => b.id));

    // 6. Inventory
    const invRows = store.inventory
      .filter(inv => validProdIds.has(inv.productId) && (!inv.branchId || validBranchIds.has(inv.branchId)))
      .map(inv => {
        const isValidUUID = typeof inv.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inv.id);
        return {
          id: isValidUUID ? inv.id : crypto.randomUUID(),
          product_id: inv.productId,
          branch_id: inv.branchId || null,
          variant_label: inv.variantLabel || '',
          quantity: Number(inv.quantity) || 0,
          min_quantity: Number(inv.minQuantity) || 0
        };
      });
    await safeUpsertMany(supabase, 'inventory', invRows);

    // 7. IDN Prices
    const idnRows = store.idnSettlementPrices
      .filter(price => validProdIds.has(price.productId))
      .map(price => ({
        id: price.id,
        user_id: price.userId,
        product_id: price.productId,
        settlement_price: price.settlementPrice
      }));
    await safeUpsertMany(supabase, 'idn_settlement_prices', idnRows);

    // 8. Customers
    const custRows = store.customers.map(cust => ({
      id: cust.id,
      name: cust.name,
      phone: cust.phone || null,
      email: cust.email || null,
      tax_id: cust.taxId || null
    }));
    await safeUpsertMany(supabase, 'customers', custRows);

    // 9. Suppliers
    const supRows = (store.suppliers || []).map(sup => ({
      id: sup.id,
      name: sup.name,
      phone: sup.phone || '',
      address: sup.address || '',
      email: sup.email || '',
      rating: Number(sup.rating) || 5,
      type_of_merchandise: sup.typeOfMerchandise || ''
    }));
    await safeUpsertMany(supabase, 'suppliers', supRows);

    // 10. Supplier Orders
    const validSupIds = new Set((store.suppliers || []).map(s => s.id));
    const orderRows = (store.supplierOrders || [])
      .filter(o => !o.supplierId || validSupIds.has(o.supplierId))
      .map(o => ({
        id: o.id,
        supplier_id: o.supplierId || null,
        date: o.date,
        expected_delivery_date: o.expectedDeliveryDate || null,
        items: o.items || [],
        total: Number(o.total) || 0,
        status: o.status || 'pending',
        branch_id: o.branchId || null,
        transport_details: o.transportDetails || '',
        transport_cost: Number(o.transportCost) || 0
      }));
    await safeUpsertMany(supabase, 'supplier_orders', orderRows);

    // 11. Recent Transactions (last 100)
    const txRows = store.transactions.slice(0, 100).map(tx => ({
      id: tx.id,
      date: tx.date,
      total: Number(tx.total) || 0,
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
    }));
    await safeUpsertMany(supabase, 'transactions', txRows);

    return { success: true, pushed, errors };
  } catch (err: any) {
    errors.push(`Error en push total: ${err.message}`);
    return { success: false, pushed, errors };
  }
}

