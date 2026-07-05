import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { Branch, Category, Product, InventoryLevel, CartItem, Transaction, ReturnItem, Currency, Customer, CashRegisterSession, User, PendingOrder, SalarySettlement, InventoryTransfer, Warranty, CashMovement, Supplier, SupplierOrder, InventoryAudit, FiscalConfig, DemandForecast } from '../types';
import { generateId, generateReadableId } from '../lib/utils';

// --- Datos Iniciales ---
const INITIAL_USERS: User[] = [];

const INITIAL_FISCAL_CONFIGS: FiscalConfig[] = [
  { id: crypto.randomUUID(), type: 'B01', name: 'Crédito Fiscal', prefix: 'B01', current: 1, limit: 1000, active: true },
  { id: crypto.randomUUID(), type: 'B02', name: 'Consumo', prefix: 'B02', current: 1, limit: 10000, active: true },
];

const INITIAL_CURRENCIES: Currency[] = [
  { code: 'CUP', name: 'Peso Cubano', symbol: 'CUP', rateToBase: 1, isBase: true },
  { code: 'USD', name: 'Dólar Estadounidense', symbol: '$', rateToBase: 320 },
  { code: 'EUR', name: 'Euro', symbol: '€', rateToBase: 350 },
];

const INITIAL_BRANCHES: Branch[] = [
  { id: crypto.randomUUID(), name: 'Principal' }
];

const INITIAL_CATEGORIES: Category[] = [
  { id: crypto.randomUUID(), name: 'Neveras', department: 'Electrodomésticos' },
  { id: crypto.randomUUID(), name: 'Lavadoras', department: 'Electrodomésticos' },
  { id: crypto.randomUUID(), name: 'Cocinas', department: 'Electrodomésticos' },
  { id: crypto.randomUUID(), name: 'Herramientas', department: 'Ferretería' },
  { id: crypto.randomUUID(), name: 'Tornillería', department: 'Ferretería' },
  { id: crypto.randomUUID(), name: 'Pinturas', department: 'Ferretería' },
  { id: crypto.randomUUID(), name: 'Ropa', department: 'Textil' },
  { id: crypto.randomUUID(), name: 'Sábanas', department: 'Textil' },
  { id: crypto.randomUUID(), name: 'Zapatos', department: 'Calzado' },
  { id: crypto.randomUUID(), name: 'Sandalias', department: 'Calzado' },
  { id: crypto.randomUUID(), name: 'Jabones', department: 'Higiene' },
  { id: crypto.randomUUID(), name: 'Champús', department: 'Higiene' },
  { id: crypto.randomUUID(), name: 'Granos', department: 'Alimentos' },
  { id: crypto.randomUUID(), name: 'Enlatados', department: 'Alimentos' },
  { id: crypto.randomUUID(), name: 'Refrescos', department: 'Bebidas' },
  { id: crypto.randomUUID(), name: 'Licores', department: 'Bebidas' },
  { id: crypto.randomUUID(), name: 'Sillas', department: 'Muebles' },
  { id: crypto.randomUUID(), name: 'Mesas', department: 'Muebles' },
  { id: crypto.randomUUID(), name: 'Celulares', department: 'Telefonía' },
  { id: crypto.randomUUID(), name: 'Accesorios', department: 'Telefonía' },
  { id: crypto.randomUUID(), name: 'Laptops', department: 'Computación' },
  { id: crypto.randomUUID(), name: 'Mouse', department: 'Computación' },
  { id: crypto.randomUUID(), name: 'Juegos de mesa', department: 'Juguetería' },
  { id: crypto.randomUUID(), name: 'Cuadernos', department: 'Librería' },
];

// --- Definición del Store ---
interface AppState {
  // Offline Architecture
  isInitialized: boolean;
  isOffline: boolean;
  pendingSyncTransactions: Transaction[];
  setOfflineStatus: (status: boolean) => void;
  syncPendingTransactions: () => void;

  // Auth
  users: User[];
  currentUser: User | null;
  login: (email: string, pass: string) => boolean;
  logout: () => void;
  clearAllData: () => Promise<void>;
  addUser: (user: User) => void;
  updateUser: (id: string, user: Partial<User>) => void;
  deleteUser: (id: string) => void;

  // Configuración
  currencies: Currency[];
  updateCurrencyRate: (code: string, newRate: number) => void;
  getBaseCurrency: () => Currency;
  storeConfig: import('../types').StoreConfig;
  updateStoreConfig: (config: import('../types').StoreConfig) => void;
  catalogConfig: import('../types').CatalogConfig;
  updateCatalogConfig: (config: import('../types').CatalogConfig) => void;

  // Sucursales
  branches: Branch[];
  currentBranchId: string;
  setCurrentBranch: (id: string) => void;
  addBranch: (branch: Branch) => void;
  updateBranch: (id: string, branch: Partial<Branch>) => void;
  deleteBranch: (id: string) => void;
  
  // Catálogo
  categories: Category[];
  addCategory: (category: Category) => void;
  updateCategory: (id: string, category: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  products: Product[];
  inventory: InventoryLevel[];
  addProduct: (product: Product, initialQuantity?: number, branchId?: string, variantLabel?: string, initialVariantQuantities?: { [key: string]: number }) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  batchDeleteProducts: (ids: string[]) => void;
  batchUpdateProducts: (ids: string[], updates: Partial<Product>) => void;
  transferInventory: (productId: string, fromBranchId: string, toBranchId: string, quantity: number, variantLabel?: string) => Promise<boolean>;
  transferInventoryBatch: (productId: string, fromBranchId: string, toBranchId: string, variants: { variantLabel: string; quantity: number }[]) => Promise<boolean>;
  adjustInventory: (productId: string, branchId: string, delta: number, variantLabel?: string, minQuantity?: number) => void;
  setInventoryQuantity: (productId: string, branchId: string, quantity: number, variantLabel?: string, minQuantity?: number) => void;
  
  // Carrito POS
  cart: CartItem[];
  currentCustomerId?: string;
  addToCart: (product: Product, serialNumber?: string, attributes?: { size?: string, color?: string, variantLabel?: string }) => void;
  updateCartQty: (cartItemId: string, delta: number) => void;
  updateCartSerial: (cartItemId: string, serialNumber: string) => void;
  setCartCustomer: (customerId?: string) => void;
  clearCart: () => void;

  // Transacciones y Devoluciones
  transactions: Transaction[];
  timeShifts: import("../types").TimeShift[];
  addTimeShift: (shift: import("../types").TimeShift) => void;
  updateTimeShift: (id: string, updates: Partial<import("../types").TimeShift>) => void;
  quotes: import("../types").Quote[];
  addQuote: (quote: import("../types").Quote) => void;
  updateQuote: (id: string, updates: Partial<import("../types").Quote>) => void;
  returns: ReturnItem[];
  processTransaction: (transaction: Transaction) => void;
  createReturn: (returnItem: ReturnItem) => void;
  updateReturn: (id: string, returnItem: Partial<ReturnItem>) => void;
  processReturn: (id: string, action: 'complete' | 'reject') => void;

  // Clientes
  customers: Customer[];
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // Caja
  cashSessions: CashRegisterSession[];
  openSession: (session: CashRegisterSession) => void;
  closeSession: (sessionId: string, closingBalances: import('../types').Payment[]) => void;
  getCurrentSession: (branchId: string, userId: string) => CashRegisterSession | undefined;

  // Garantías
  warranties: import('../types').Warranty[];
  addWarranty: (warranty: import('../types').Warranty) => void;
  updateWarranty: (id: string, warranty: Partial<import('../types').Warranty>) => void;

  // Liquidaciones de Salario
  salarySettlements: SalarySettlement[];
  addSalarySettlement: (settlement: SalarySettlement) => void;
  updateSalarySettlement: (id: string, settlement: Partial<SalarySettlement>) => void;
  addCashMovement: (sessionId: string, movement: CashMovement) => void;
  transfers: InventoryTransfer[];
  addTransfer: (transfer: InventoryTransfer) => void;

  // Pedidos QR
  pendingOrders: PendingOrder[];
  createPendingOrder: (order: PendingOrder) => void;
  removePendingOrder: (id: string) => void;

  // Enterprise Modules
  suppliers: Supplier[];
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
  
  supplierOrders: SupplierOrder[];
  createSupplierOrder: (order: SupplierOrder) => void;
  updateSupplierOrder: (id: string, order: Partial<SupplierOrder>) => void;
  
  inventoryAudits: InventoryAudit[];
  createInventoryAudit: (audit: InventoryAudit) => void;
  completeInventoryAudit: (id: string, items: any[], notes?: string) => void;
  
  fiscalConfigs: FiscalConfig[];
  updateFiscalConfig: (id: string, config: Partial<FiscalConfig>) => void;
  getNextNCF: (type: string) => string | undefined;

  demandForecasts: DemandForecast[];
  updateForecasts: (forecasts: DemandForecast[]) => void;

  receiptConfig: import('../types').ReceiptConfig;
  updateReceiptConfig: (config: Partial<import('../types').ReceiptConfig>) => void;

  // Banks Module
  bankCards: import('../types').BankCard[];
  addBankCard: (card: import('../types').BankCard) => void;
  updateBankCard: (id: string, card: Partial<import('../types').BankCard>) => void;
  deleteBankCard: (id: string) => void;
  
  bankTransactions: import('../types').BankTransaction[];
  addBankTransaction: (transaction: import('../types').BankTransaction) => void;

  initializeFromSupabase: () => Promise<void>;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
  isInitialized: false,
  isOffline: !navigator.onLine,
  pendingSyncTransactions: [],
  setOfflineStatus: (status) => set({ isOffline: status }),
  syncPendingTransactions: () => {
    const { pendingSyncTransactions, transactions } = get();
    if (pendingSyncTransactions.length === 0) return;
    // Simulate background sync with main database
    console.log(`Syncing ${pendingSyncTransactions.length} transactions to main database...`);
    // Here would be an API call to sync data.
    // Assuming success, clear pending:
    set({ pendingSyncTransactions: [] });
  },

  users: INITIAL_USERS,
  currentUser: null,
  login: (email, pass) => {
    const user = get().users.find(u => u.email === email && u.password === pass);
    if (user) {
      set({ currentUser: user });
      if (user.branchId) {
        set({ currentBranchId: user.branchId });
      }
      return true;
    }
    return false;
  },
  logout: () => set({ currentUser: null }),
  clearAllData: async () => {
    // Determine the order to avoid foreign key constraints
    const tables = [
      'time_shifts', 'quote_items', 'quotes', 'salary_settlements',
      'inventory_audit_items', 'inventory_audits', 'bank_transactions', 'bank_cards',
      'supplier_order_items', 'supplier_orders', 'suppliers',
      'inventory_transfers', 'cash_movements', 'cash_sessions',
      'warranties', 'returns', 'transaction_items', 'transaction_payments', 'transactions',
      'customers', 'inventory_levels', 'products', 'categories', 'users', 'branches'
    ];
    
    // Clear in supabase
    try {
      for (const table of tables) {
        await supabase.from(table).delete().neq('id', 'dummy_id_to_match_all');
      }
    } catch (error) {
      console.error('Error clearing data in Supabase:', error);
    }
    
    // Reset local state to initial empty values
    set({
      users: [],
      currentUser: null,
      branches: [],
      currentBranchId: 'main',
      categories: [],
      products: [],
      inventory: [],
      customers: [],
      transactions: [],
      returns: [],
      warranties: [],
      cashSessions: [],
      transfers: [],
      suppliers: [],
      supplierOrders: [],
      bankCards: [],
      bankTransactions: [],
      inventoryAudits: [],
      salarySettlements: [],
      quotes: [],
      timeShifts: [],
      cart: [],
      currentCustomerId: undefined,
      pendingSyncTransactions: [],
      pendingOrders: [],
    });
  },
  addUser: async (user) => {
    set((state) => ({ users: [...state.users, user] }));
    try {
      await supabase.from('users').insert([{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        password: user.password || null,
        commission_rate: user.commissionRate,
        base_salary: user.baseSalary,
        sales_goal: user.salesGoal || 0,
        phone: user.phone || null,
        branch_id: user.branchId || null,
        supervisor_id: user.supervisorId || null
      }]);
    } catch (error) {
      console.error('Error adding user to Supabase:', error);
    }
  },
  updateUser: async (id, user) => {
    set((state) => ({
      users: state.users.map(u => u.id === id ? { ...u, ...user } : u)
    }));
    try {
      const updateData: any = {};
      if (user.name !== undefined) updateData.name = user.name;
      if (user.email !== undefined) updateData.email = user.email;
      if (user.role !== undefined) updateData.role = user.role;
      if (user.password !== undefined) updateData.password = user.password;
      if (user.commissionRate !== undefined) updateData.commission_rate = user.commissionRate;
      if (user.baseSalary !== undefined) updateData.base_salary = user.baseSalary;
      if (user.salesGoal !== undefined) updateData.sales_goal = user.salesGoal;
      if (user.phone !== undefined) updateData.phone = user.phone;
      if (user.branchId !== undefined) updateData.branch_id = user.branchId;
      if (user.supervisorId !== undefined) updateData.supervisor_id = user.supervisorId;

      if (Object.keys(updateData).length > 0) {
        await supabase.from('users').update(updateData).eq('id', id);
      }
    } catch (error) {
      console.error('Error updating user in Supabase:', error);
    }
  },
  deleteUser: async (id) => {
    set((state) => ({
      users: state.users.filter(u => u.id !== id)
    }));
    try {
      await supabase.from('users').delete().eq('id', id);
    } catch (error) {
      console.error('Error deleting user from Supabase:', error);
    }
  },

  currencies: INITIAL_CURRENCIES,
  updateCurrencyRate: (code, newRate) => set((state) => ({
    currencies: state.currencies.map(c => c.code === code ? { ...c, rateToBase: newRate } : c)
  })),
  getBaseCurrency: () => get().currencies.find(c => c.isBase) || get().currencies[0],
  
  storeConfig: { storeName: 'Mi Tienda POS', address: 'Calle Principal 123', phone: '+53 51234567', receiptNotes: '¡Gracias por su compra!' },
  updateStoreConfig: (config) => set({ storeConfig: config }),

  catalogConfig: { 
    themeColor: '#4f46e5', 
    bannerText: '¡Bienvenidos a nuestra tienda virtual!', 
    whatsappNumber: '+5351234567', 
    showPrices: true,
    visibleBranches: ['b1']
  },
  updateCatalogConfig: (config) => set({ catalogConfig: config }),

  branches: INITIAL_BRANCHES,
  currentBranchId: INITIAL_BRANCHES[0].id,
  setCurrentBranch: (id) => set({ currentBranchId: id, cart: [] }),
  addBranch: async (branch) => {
    set((state) => ({ branches: [...state.branches, branch] }));
    try {
      await supabase.from('branches').insert([{
        id: branch.id,
        name: branch.name,
        address: branch.address
      }]);
    } catch (error) {
      console.error('Error adding branch:', error);
    }
  },
  updateBranch: async (id, branch) => {
    set((state) => ({
      branches: state.branches.map(b => b.id === id ? { ...b, ...branch } : b)
    }));
    try {
      const updateData: any = {};
      if (branch.name !== undefined) updateData.name = branch.name;
      if (branch.address !== undefined) updateData.address = branch.address;
      
      if (Object.keys(updateData).length > 0) {
        await supabase.from('branches').update(updateData).eq('id', id);
      }
    } catch (error) {
      console.error('Error updating branch:', error);
    }
  },
  deleteBranch: async (id) => {
    let proceed = false;
    set((state) => {
      if (state.branches.length === 1) {
        alert("No puedes eliminar la única sucursal.");
        return state;
      }
      proceed = true;
      const newBranches = state.branches.filter(b => b.id !== id);
      return {
        branches: newBranches,
        currentBranchId: state.currentBranchId === id ? newBranches[0].id : state.currentBranchId
      };
    });
    if (proceed) {
      try {
        await supabase.from('branches').delete().eq('id', id);
      } catch (error) {
        console.error('Error deleting branch:', error);
      }
    }
  },
  
  categories: INITIAL_CATEGORIES,
  addCategory: async (category) => {
    set((state) => ({ categories: [...state.categories, category] }));
    try {
      await supabase.from('categories').insert([{
        id: category.id,
        name: category.name,
        department: category.department
      }]);
    } catch (error) {
      console.error('Error adding category:', error);
    }
  },
  updateCategory: async (id, category) => {
    set((state) => ({
      categories: state.categories.map(c => c.id === id ? { ...c, ...category } : c)
    }));
    try {
      const updateData: any = {};
      if (category.name !== undefined) updateData.name = category.name;
      if (category.department !== undefined) updateData.department = category.department;
      
      if (Object.keys(updateData).length > 0) {
        await supabase.from('categories').update(updateData).eq('id', id);
      }
    } catch (error) {
      console.error('Error updating category:', error);
    }
  },
  deleteCategory: async (id) => {
    set((state) => ({ categories: state.categories.filter(c => c.id !== id) }));
    try {
      await supabase.from('categories').delete().eq('id', id);
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  },
  
  products: [],
  inventory: [],
  addProduct: async (product, initialQuantity, branchId, variantLabel, initialVariantQuantities) => {
    const targetBranch = branchId || get().currentBranchId;
    let newInventoryEntries: any[] = [];
    
    if (initialVariantQuantities && Object.keys(initialVariantQuantities).length > 0) {
      Object.entries(initialVariantQuantities).forEach(([vLabel, qty]) => {
        if (qty > 0) {
          newInventoryEntries.push({ productId: product.id, branchId: targetBranch, quantity: qty, minQuantity: 5, variantLabel: vLabel });
        }
      });
    } else if (initialQuantity && initialQuantity > 0) {
      newInventoryEntries.push({ productId: product.id, branchId: targetBranch, quantity: initialQuantity, minQuantity: 5, variantLabel });
    }

    // Optimistic update
    set((state) => ({
      products: [product, ...state.products],
      inventory: [...state.inventory, ...newInventoryEntries]
    }));

    // Sync to Supabase
    try {
      await supabase.from('products').insert([{
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || null,
        cost_price: product.costPrice,
        price: product.price,
        margin: product.margin,
        category_id: product.categoryId !== 'General' ? product.categoryId : null,
        color: product.color,
        commission_type: product.commissionType,
        commission_value: product.commissionValue,
        unit: product.unit,
        status: product.status,
        min_stock_alert: product.minStockAlert,
        has_serial: product.hasSerial,
        is_kit: product.isKit,
        warranty_days: product.warrantyDays,
        device_color: product.deviceColor || null,
        available_sizes: product.availableSizes || [],
        available_colors: product.availableColors || [],
        next_serial: product.nextSerial,
        image: product.image || null
      }]);

      if (newInventoryEntries.length > 0) {
        await supabase.from('inventory_levels').insert(
          newInventoryEntries.map(i => ({
            product_id: i.productId,
            branch_id: i.branchId,
            variant_label: i.variantLabel || null,
            quantity: i.quantity,
            min_quantity: i.minQuantity
          }))
        );
      }
    } catch (error) {
      console.error('Error adding product to Supabase:', error);
    }
  },
  updateProduct: async (id, product) => {
    set((state) => ({
      products: state.products.map(p => p.id === id ? { ...p, ...product } : p)
    }));
    try {
      const updateData: any = {};
      if (product.name !== undefined) updateData.name = product.name;
      if (product.sku !== undefined) updateData.sku = product.sku;
      if (product.barcode !== undefined) updateData.barcode = product.barcode;
      if (product.costPrice !== undefined) updateData.cost_price = product.costPrice;
      if (product.price !== undefined) updateData.price = product.price;
      if (product.margin !== undefined) updateData.margin = product.margin;
      if (product.categoryId !== undefined) updateData.category_id = product.categoryId !== 'General' ? product.categoryId : null;
      if (product.color !== undefined) updateData.color = product.color;
      if (product.commissionType !== undefined) updateData.commission_type = product.commissionType;
      if (product.commissionValue !== undefined) updateData.commission_value = product.commissionValue;
      if (product.unit !== undefined) updateData.unit = product.unit;
      if (product.status !== undefined) updateData.status = product.status;
      if (product.minStockAlert !== undefined) updateData.min_stock_alert = product.minStockAlert;
      if (product.hasSerial !== undefined) updateData.has_serial = product.hasSerial;
      if (product.isKit !== undefined) updateData.is_kit = product.isKit;
      if (product.warrantyDays !== undefined) updateData.warranty_days = product.warrantyDays;
      if (product.deviceColor !== undefined) updateData.device_color = product.deviceColor;
      if (product.availableSizes !== undefined) updateData.available_sizes = product.availableSizes;
      if (product.availableColors !== undefined) updateData.available_colors = product.availableColors;
      if (product.nextSerial !== undefined) updateData.next_serial = product.nextSerial;
      if (product.image !== undefined) updateData.image = product.image;

      if (Object.keys(updateData).length > 0) {
        await supabase.from('products').update(updateData).eq('id', id);
      }
    } catch (error) {
      console.error('Error updating product in Supabase:', error);
    }
  },
  deleteProduct: async (id) => {
    set((state) => ({
      products: state.products.filter(p => p.id !== id),
      inventory: state.inventory.filter(i => i.productId !== id)
    }));
    try {
      await supabase.from('products').delete().eq('id', id);
    } catch (error) {
      console.error('Error deleting product from Supabase:', error);
    }
  },
  transferInventory: async (productId, fromBranchId, toBranchId, quantity, variantLabel) => {
    let success = false;
    let newSourceQty = 0;
    let newTargetQty = 0;
    
    set((state) => {
      const newInventory = [...state.inventory];
      
      const sourceIdx = newInventory.findIndex(i => i.productId === productId && i.branchId === fromBranchId && i.variantLabel === variantLabel);
      if (sourceIdx !== -1 && newInventory[sourceIdx].quantity >= quantity) {
        newSourceQty = newInventory[sourceIdx].quantity - quantity;
        newInventory[sourceIdx] = { ...newInventory[sourceIdx], quantity: newSourceQty };
        
        const targetIdx = newInventory.findIndex(i => i.productId === productId && i.branchId === toBranchId && i.variantLabel === variantLabel);
        if (targetIdx !== -1) {
          newTargetQty = newInventory[targetIdx].quantity + quantity;
          newInventory[targetIdx] = { ...newInventory[targetIdx], quantity: newTargetQty };
        } else {
          newTargetQty = quantity;
          newInventory.push({ productId, branchId: toBranchId, quantity, minQuantity: 5, variantLabel });
        }
        success = true;
      }
      
      return { inventory: newInventory };
    });

    if (success) {
      try {
        // Update Supabase
        await Promise.all([
          supabase.from('inventory_levels').upsert({
            product_id: productId,
            branch_id: fromBranchId,
            variant_label: variantLabel || null,
            quantity: newSourceQty,
            min_quantity: 5
          }, { onConflict: 'product_id, branch_id, variant_label' }),
          supabase.from('inventory_levels').upsert({
            product_id: productId,
            branch_id: toBranchId,
            variant_label: variantLabel || null,
            quantity: newTargetQty,
            min_quantity: 5
          }, { onConflict: 'product_id, branch_id, variant_label' })
        ]);

        const product = get().products.find(p => p.id === productId);
        const fromBranch = get().branches.find(b => b.id === fromBranchId);
        const toBranch = get().branches.find(b => b.id === toBranchId);
        
        get().addTransfer({
          id: crypto.randomUUID(),
          productId,
          productName: product?.name || 'Producto',
          fromBranchId,
          fromBranchName: fromBranch?.name || 'Sucursal',
          toBranchId,
          toBranchName: toBranch?.name || 'Sucursal',
          quantity,
          date: new Date().toISOString(),
          userId: get().currentUser?.id || 'system',
          status: 'completed',
          variantLabel
        });
      } catch (error) {
        console.error('Error in transferInventory sync:', error);
      }
    }
    return success;
  },
  transferInventoryBatch: async (productId, fromBranchId, toBranchId, variants) => {
    let success = false;
    let totalQuantity = 0;
    const updates: { branchId: string; variantLabel: string; quantity: number }[] = [];
    
    set((state) => {
      const newInventory = [...state.inventory];
      let allValid = true;

      // Check if we have enough stock for all variants
      for (const v of variants) {
        if (v.quantity <= 0) continue;
        const sourceIdx = newInventory.findIndex(i => i.productId === productId && i.branchId === fromBranchId && i.variantLabel === v.variantLabel);
        if (sourceIdx === -1 || newInventory[sourceIdx].quantity < v.quantity) {
          allValid = false;
          break;
        }
      }

      if (allValid && variants.length > 0) {
        for (const v of variants) {
          if (v.quantity <= 0) continue;
          totalQuantity += v.quantity;
          const sourceIdx = newInventory.findIndex(i => i.productId === productId && i.branchId === fromBranchId && i.variantLabel === v.variantLabel);
          const newSourceQty = newInventory[sourceIdx].quantity - v.quantity;
          newInventory[sourceIdx] = { ...newInventory[sourceIdx], quantity: newSourceQty };
          
          updates.push({ branchId: fromBranchId, variantLabel: v.variantLabel, quantity: newSourceQty });

          const targetIdx = newInventory.findIndex(i => i.productId === productId && i.branchId === toBranchId && i.variantLabel === v.variantLabel);
          if (targetIdx !== -1) {
            const newTargetQty = newInventory[targetIdx].quantity + v.quantity;
            newInventory[targetIdx] = { ...newInventory[targetIdx], quantity: newTargetQty };
            updates.push({ branchId: toBranchId, variantLabel: v.variantLabel, quantity: newTargetQty });
          } else {
            newInventory.push({ productId, branchId: toBranchId, quantity: v.quantity, minQuantity: 5, variantLabel: v.variantLabel });
            updates.push({ branchId: toBranchId, variantLabel: v.variantLabel, quantity: v.quantity });
          }
        }
        success = true;
      }
      
      return success ? { inventory: newInventory } : {};
    });

    if (success) {
      try {
        // Update Supabase
        await Promise.all(updates.map(update => 
          supabase.from('inventory_levels').upsert({
            product_id: productId,
            branch_id: update.branchId,
            variant_label: update.variantLabel || null,
            quantity: update.quantity,
            min_quantity: 5
          }, { onConflict: 'product_id, branch_id, variant_label' })
        ));

        const product = get().products.find(p => p.id === productId);
        const fromBranch = get().branches.find(b => b.id === fromBranchId);
        const toBranch = get().branches.find(b => b.id === toBranchId);
        
        get().addTransfer({
          id: crypto.randomUUID(),
          productId,
          productName: product?.name || 'Producto',
          fromBranchId,
          fromBranchName: fromBranch?.name || 'Sucursal',
          toBranchId,
          toBranchName: toBranch?.name || 'Sucursal',
          quantity: totalQuantity,
          variants: variants,
          date: new Date().toISOString(),
          userId: get().currentUser?.id || 'system',
          status: 'completed',
          variantLabel: variants.length === 1 ? variants[0].variantLabel : 'Múltiples Variantes'
        });
      } catch (error) {
        console.error('Error in transferInventoryBatch sync:', error);
      }
    }
    return success;
  },
  batchDeleteProducts: async (ids) => {
    set((state) => ({
      products: state.products.filter(p => !ids.includes(p.id)),
      inventory: state.inventory.filter(i => !ids.includes(i.productId))
    }));
    try {
      await supabase.from('products').delete().in('id', ids);
    } catch (error) {
      console.error('Error batch deleting products from Supabase:', error);
    }
  },
  batchUpdateProducts: async (ids, updates) => {
    set((state) => ({
      products: state.products.map(p => ids.includes(p.id) ? { ...p, ...updates } : p)
    }));
    try {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.sku !== undefined) updateData.sku = updates.sku;
      if (updates.barcode !== undefined) updateData.barcode = updates.barcode;
      if (updates.costPrice !== undefined) updateData.cost_price = updates.costPrice;
      if (updates.price !== undefined) updateData.price = updates.price;
      if (updates.margin !== undefined) updateData.margin = updates.margin;
      if (updates.categoryId !== undefined) updateData.category_id = updates.categoryId !== 'General' ? updates.categoryId : null;
      if (updates.color !== undefined) updateData.color = updates.color;
      if (updates.commissionType !== undefined) updateData.commission_type = updates.commissionType;
      if (updates.commissionValue !== undefined) updateData.commission_value = updates.commissionValue;
      if (updates.unit !== undefined) updateData.unit = updates.unit;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.minStockAlert !== undefined) updateData.min_stock_alert = updates.minStockAlert;
      if (updates.hasSerial !== undefined) updateData.has_serial = updates.hasSerial;
      if (updates.isKit !== undefined) updateData.is_kit = updates.isKit;
      if (updates.warrantyDays !== undefined) updateData.warranty_days = updates.warrantyDays;
      if (updates.deviceColor !== undefined) updateData.device_color = updates.deviceColor;
      if (updates.availableSizes !== undefined) updateData.available_sizes = updates.availableSizes;
      if (updates.availableColors !== undefined) updateData.available_colors = updates.availableColors;
      if (updates.nextSerial !== undefined) updateData.next_serial = updates.nextSerial;

      if (Object.keys(updateData).length > 0) {
        await supabase.from('products').update(updateData).in('id', ids);
      }
    } catch (error) {
      console.error('Error batch updating products in Supabase:', error);
    }
  },
  adjustInventory: async (productId, branchId, delta, variantLabel, minQuantity) => {
    let newQty = 0;
    let newMinQty = minQuantity ?? 5;
    
    set((state) => {
      const newInventory = [...state.inventory];
      const idx = newInventory.findIndex(i => i.productId === productId && i.branchId === branchId && i.variantLabel === variantLabel);
      if (idx !== -1) {
        newQty = Math.max(0, newInventory[idx].quantity + delta);
        if (minQuantity !== undefined) newMinQty = minQuantity;
        else newMinQty = newInventory[idx].minQuantity;
        
        newInventory[idx] = { 
          ...newInventory[idx], 
          quantity: newQty,
          minQuantity: newMinQty
        };
      } else if (delta > 0) {
        newQty = delta;
        newInventory.push({ productId, branchId, quantity: delta, minQuantity: newMinQty, variantLabel });
      } else {
        return state;
      }
      return { inventory: newInventory };
    });

    try {
      await supabase.from('inventory_levels').upsert({
        product_id: productId,
        branch_id: branchId,
        variant_label: variantLabel || null,
        quantity: newQty,
        min_quantity: newMinQty
      }, { onConflict: 'product_id, branch_id, variant_label' });
    } catch (error) {
      console.error('Error adjusting inventory in Supabase:', error);
    }
  },
  setInventoryQuantity: async (productId, branchId, quantity, variantLabel, minQuantity) => {
    let newMinQty = minQuantity ?? 5;
    set((state) => {
      const newInventory = [...state.inventory];
      const idx = newInventory.findIndex(i => i.productId === productId && i.branchId === branchId && i.variantLabel === variantLabel);
      if (idx !== -1) {
        if (minQuantity === undefined) newMinQty = newInventory[idx].minQuantity;
        newInventory[idx] = { 
          ...newInventory[idx], 
          quantity: Math.max(0, quantity),
          minQuantity: newMinQty
        };
      } else {
        newInventory.push({ productId, branchId, quantity: Math.max(0, quantity), minQuantity: newMinQty, variantLabel });
      }
      return { inventory: newInventory };
    });

    try {
      await supabase.from('inventory_levels').upsert({
        product_id: productId,
        branch_id: branchId,
        variant_label: variantLabel || null,
        quantity: Math.max(0, quantity),
        min_quantity: newMinQty
      }, { onConflict: 'product_id, branch_id, variant_label' });
    } catch (error) {
      console.error('Error setting inventory quantity in Supabase:', error);
    }
  },
  
  cart: [],
  currentCustomerId: undefined,
  setCartCustomer: (customerId) => set({ currentCustomerId: customerId }),
  addToCart: (product, serialNumber, attributes) => set((state) => {
    // Auto-generate serial if enabled and not provided
    let finalSerial = serialNumber;
    let updatedProducts = state.products;

    if (product.hasSerial && !finalSerial) {
      const currentProduct = state.products.find(p => p.id === product.id);
      const nextNum = currentProduct?.nextSerial || 1;
      finalSerial = `SN-${product.sku || product.id.slice(-4)}-${nextNum.toString().padStart(4, '0')}`;
      
      // Increment nextSerial in the products list
      updatedProducts = state.products.map(p => 
        p.id === product.id ? { ...p, nextSerial: nextNum + 1 } : p
      );
    }

    // Para productos con número de serie, siempre agregamos una fila nueva (qty=1)
    if (product.hasSerial || finalSerial) {
      return {
        products: updatedProducts,
        cart: [...state.cart, { 
          id: crypto.randomUUID(), 
          product: updatedProducts.find(p => p.id === product.id) || product, 
          quantity: 1, 
          serialNumber: finalSerial,
          selectedSize: attributes?.size,
          selectedColor: attributes?.color,
          variantLabel: attributes?.variantLabel || attributes?.size || attributes?.color
        }]
      };
    }

    // Para productos normales, aumentamos cantidad si ya existe (considerando atributos)
    const existing = state.cart.find(item => 
      item.product.id === product.id && 
      !item.serialNumber &&
      item.selectedSize === attributes?.size &&
      item.selectedColor === attributes?.color &&
      item.variantLabel === (attributes?.variantLabel || attributes?.size || attributes?.color)
    );
    
    if (existing) {
      return {
        cart: state.cart.map(item => 
          item.id === existing.id
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        )
      };
    }
    
    return {
      cart: [...state.cart, { 
        id: crypto.randomUUID(), 
        product, 
        quantity: 1,
        selectedSize: attributes?.size,
        selectedColor: attributes?.color,
        variantLabel: attributes?.variantLabel || attributes?.size || attributes?.color
      }]
    };
  }),
  
  updateCartQty: (cartItemId, delta) => set((state) => ({
    cart: state.cart.map(item => {
      if (item.id === cartItemId) {
        // Productos con serie no deben cambiar cantidad > 1 (o se divide, pero simplificamos así)
        if (item.product.hasSerial && delta > 0) return item; 
        return { ...item, quantity: Math.max(0, item.quantity + delta) };
      }
      return item;
    }).filter(item => item.quantity > 0)
  })),

  updateCartSerial: (cartItemId, serialNumber) => set((state) => ({
    cart: state.cart.map(item => 
      item.id === cartItemId ? { ...item, serialNumber } : item
    )
  })),
  
  clearCart: () => set({ cart: [], currentCustomerId: undefined }),

  transactions: [],
  returns: [],
  quotes: [],
  addQuote: async (quote) => {
    set((state) => ({ quotes: [...state.quotes, quote] }));
    try {
      const { items, ...quoteData } = quote;
      await supabase.from("quotes").insert([{
        id: quoteData.id,
        branch_id: quoteData.branchId,
        user_id: quoteData.userId,
        customer_id: quoteData.customerId || null,
        date: quoteData.date,
        subtotal: quoteData.subtotal,
        tax: quoteData.tax,
        total: quoteData.total,
        status: quoteData.status,
        notes: quoteData.notes
      }]);
      const quoteItems = items.map(item => ({
        id: crypto.randomUUID(),
        quote_id: quote.id,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
        tax: 0,
        variant_label: item.variantLabel || null
      }));
      if (quoteItems.length > 0) {
        await supabase.from("quote_items").insert(quoteItems);
      }
    } catch (e) { console.error("Error saving quote", e); }
  },
  updateQuote: async (id, updates) => {
    set((state) => ({ quotes: state.quotes.map(q => q.id === id ? { ...q, ...updates } : q) }));
    try {
      const updateData: any = {};
      if (updates.status) updateData.status = updates.status;
      if (Object.keys(updateData).length > 0) {
        await supabase.from("quotes").update(updateData).eq("id", id);
      }
    } catch (e) { console.error("Error updating quote", e); }
  },

  timeShifts: [],
  addTimeShift: async (shift) => {
    set((state) => ({ timeShifts: [shift, ...state.timeShifts] }));
    try {
      await supabase.from("time_shifts").insert([{
        id: shift.id,
        user_id: shift.userId,
        clock_in: shift.clockIn,
        clock_out: shift.clockOut || null,
        notes: shift.notes || null
      }]);
    } catch (e) { console.error("Error saving time shift", e); }
  },
  updateTimeShift: async (id, updates) => {
    set((state) => ({ timeShifts: state.timeShifts.map(s => s.id === id ? { ...s, ...updates } : s) }));
    try {
      const updateData: any = {};
      if (updates.clockOut) updateData.clock_out = updates.clockOut;
      if (updates.notes) updateData.notes = updates.notes;
      if (Object.keys(updateData).length > 0) {
        await supabase.from("time_shifts").update(updateData).eq("id", id);
      }
    } catch (e) { console.error("Error updating time shift", e); }
  },
  processTransaction: async (transaction) => {
    let finalItems: any[] = [];
    let newWarranties: any[] = [];
    let updatedInventory: any[] = [];
    let newTransaction: any;

    set((state) => {
      updatedInventory = [...state.inventory];
      
      finalItems = transaction.items.map(item => {
        let finalItem = { ...item };
        
        // Automatic Warranty creation
        if (item.product.warrantyDays && item.product.warrantyDays > 0) {
          const purchaseDate = new Date(transaction.date);
          const expiryDate = new Date(purchaseDate);
          expiryDate.setDate(expiryDate.getDate() + item.product.warrantyDays);

          const customer = state.customers.find(c => c.id === transaction.customerId);
          const wrnId = generateReadableId('GDA', state.warranties.length + newWarranties.length);

          newWarranties.push({
            id: wrnId,
            productId: item.product.id,
            productName: item.product.name,
            transactionId: transaction.id,
            customerId: transaction.customerId,
            customerName: customer?.name || 'Cliente Genérico',
            purchaseDate: transaction.date,
            expiryDate: expiryDate.toISOString(),
            serialNumber: item.serialNumber,
            status: 'active'
          });
          
          finalItem.warrantyCode = wrnId;
        }
        return finalItem;
      });

      transaction.items.forEach(item => {
        // Check if it's a kit
        if (item.product.isKit && item.product.kitComponents) {
          item.product.kitComponents.forEach(comp => {
            const compIdx = updatedInventory.findIndex(i => 
              i.productId === comp.productId && 
              i.branchId === transaction.branchId
            );
            if (compIdx !== -1) {
              updatedInventory[compIdx] = {
                ...updatedInventory[compIdx],
                quantity: Math.max(0, updatedInventory[compIdx].quantity - (comp.quantity * item.quantity))
              };
            }
          });
        } else {
          // Normal item inventory reduction
          const idx = updatedInventory.findIndex(i => 
            i.productId === item.product.id && 
            i.branchId === transaction.branchId &&
            i.variantLabel === item.variantLabel
          );
          if (idx !== -1) {
            updatedInventory[idx] = { 
              ...updatedInventory[idx], 
              quantity: Math.max(0, updatedInventory[idx].quantity - item.quantity) 
            };
          }
        }
      });

      newTransaction = { ...transaction, items: finalItems };
      const pendingTransactions = state.isOffline 
        ? [...state.pendingSyncTransactions, newTransaction] 
        : state.pendingSyncTransactions;

      return {
        transactions: [newTransaction, ...state.transactions],
        pendingSyncTransactions: pendingTransactions,
        inventory: updatedInventory,
        warranties: [...newWarranties, ...state.warranties],
        cart: [],
        currentCustomerId: undefined
      };
    });

    try {
      // Sync Transaction
      await supabase.from('transactions').insert([{
        id: newTransaction.id,
        branch_id: newTransaction.branchId,
        user_id: newTransaction.userId,
        date: newTransaction.date,
        subtotal: newTransaction.subtotal,
        tax: newTransaction.tax,
        total: newTransaction.total,
        status: newTransaction.status,
        customer_id: newTransaction.customerId || null,
        ncf: newTransaction.ncf || null,
        ncf_type: newTransaction.ncfType || null,
        change_given: newTransaction.changeGiven || 0
      }]);

      // Sync Payments
      if (newTransaction.payments && newTransaction.payments.length > 0) {
        await supabase.from('transaction_payments').insert(
          newTransaction.payments.map((p: any) => ({
            id: crypto.randomUUID(),
            transaction_id: newTransaction.id,
            currency_code: p.currencyCode,
            amount: p.amount,
            exchange_rate: p.exchangeRate,
            method: p.method,
            bank_card_id: p.bankCardId || null
          }))
        );
      }

      // Sync Items
      if (newTransaction.items && newTransaction.items.length > 0) {
        await supabase.from('transaction_items').insert(
          newTransaction.items.map((i: any) => ({
            id: crypto.randomUUID(),
            transaction_id: newTransaction.id,
            cart_item_id: i.id,
            product_id: i.product.id,
            quantity: i.quantity,
            serial_number: i.serialNumber || null,
            warranty_code: i.warrantyCode || null,
            selected_size: i.selectedSize || null,
            selected_color: i.selectedColor || null,
            variant_label: i.variantLabel || null
          }))
        );
      }

      // Sync Inventory (Upsert)
      // A more robust way would be to just upsert the ones that changed
      // but for now we can rely on adjustInventory or just upsert the modified rows
      const modifiedInventory = updatedInventory.filter(ui => 
        transaction.items.some(ti => ti.product.id === ui.productId && ti.variantLabel === ui.variantLabel)
        || transaction.items.some(ti => ti.product.isKit && ti.product.kitComponents?.some(kc => kc.productId === ui.productId))
      );
      if (modifiedInventory.length > 0) {
        await supabase.from('inventory_levels').upsert(
          modifiedInventory.map(i => ({
            product_id: i.productId,
            branch_id: i.branchId,
            variant_label: i.variantLabel || null,
            quantity: i.quantity,
            min_quantity: i.minQuantity
          })), 
          { onConflict: 'product_id, branch_id, variant_label' }
        );
      }

    } catch (error) {
      console.error('Error syncing transaction to Supabase:', error);
    }
  },

  createReturn: async (returnItem) => {
    const readableId = generateReadableId('DEV', get().returns.length);
    const newReturn = { ...returnItem, id: readableId };
    set((state) => ({
      returns: [newReturn, ...state.returns]
    }));
    try {
      await supabase.from('returns').insert([{
        id: newReturn.id,
        transaction_id: newReturn.transactionId,
        product_id: newReturn.productId,
        quantity: newReturn.quantity,
        reason: newReturn.reason,
        date: newReturn.date,
        status: newReturn.status,
        type: newReturn.type,
        notes: newReturn.notes || null
      }]);
    } catch (error) {
      console.error('Error adding return to Supabase:', error);
    }
  },
  updateReturn: async (id, returnItem) => {
    set((state) => ({
      returns: state.returns.map(r => r.id === id ? { ...r, ...returnItem } : r)
    }));
    try {
      const updateData: any = {};
      if (returnItem.status !== undefined) updateData.status = returnItem.status;
      if (returnItem.notes !== undefined) updateData.notes = returnItem.notes;
      if (Object.keys(updateData).length > 0) {
        await supabase.from('returns').update(updateData).eq('id', id);
      }
    } catch (error) {
      console.error('Error updating return in Supabase:', error);
    }
  },
  processReturn: async (id, action) => {
    let returnReq: any;
    let modifiedInventory: any;
    let modifiedWarranty: any;

    set((state) => {
      returnReq = state.returns.find(r => r.id === id);
      if (!returnReq || returnReq.status !== 'pending') return state;
      
      let updatedInventory = [...state.inventory];
      let updatedWarranties = [...state.warranties];
      
      if (action === 'complete') {
        const branchId = state.currentBranchId;
        const idx = updatedInventory.findIndex(i => i.productId === returnReq.productId && i.branchId === branchId);
        
        // If it's a warranty exchange, we give them a new product, so we reduce the stock
        if (returnReq.type === 'warranty_exchange') {
          if (idx !== -1) {
            updatedInventory[idx] = { 
              ...updatedInventory[idx], 
              quantity: Math.max(0, updatedInventory[idx].quantity - returnReq.quantity) 
            };
            modifiedInventory = updatedInventory[idx];
          }
        } else if (returnReq.type === 'refund') {
          // If it's a refund (e.g. wrong size), it goes back to stock
          if (idx !== -1) {
            updatedInventory[idx] = { 
              ...updatedInventory[idx], 
              quantity: updatedInventory[idx].quantity + returnReq.quantity 
            };
            modifiedInventory = updatedInventory[idx];
          }
        }

        // Update matching warranty if exists
        const warrantyIdx = updatedWarranties.findIndex(w => w.transactionId === returnReq.transactionId && w.productId === returnReq.productId);
        if (warrantyIdx !== -1) {
          updatedWarranties[warrantyIdx] = {
            ...updatedWarranties[warrantyIdx],
            status: returnReq.type === 'warranty_exchange' ? 'exchanged' : 'refunded'
          };
          modifiedWarranty = updatedWarranties[warrantyIdx];
        }
      }
      
      return {
        returns: state.returns.map(r => r.id === id ? { ...r, status: action === 'complete' ? 'completed' : 'rejected' } : r),
        inventory: updatedInventory,
        warranties: updatedWarranties
      };
    });

    if (returnReq) {
      try {
        await supabase.from('returns').update({ status: action === 'complete' ? 'completed' : 'rejected' }).eq('id', id);
        
        if (modifiedInventory) {
          await supabase.from('inventory_levels').upsert({
            product_id: modifiedInventory.productId,
            branch_id: modifiedInventory.branchId,
            variant_label: modifiedInventory.variantLabel || null,
            quantity: modifiedInventory.quantity,
            min_quantity: modifiedInventory.minQuantity
          }, { onConflict: 'product_id, branch_id, variant_label' });
        }

        if (modifiedWarranty) {
          await supabase.from('warranties').update({ status: modifiedWarranty.status }).eq('id', modifiedWarranty.id);
        }
      } catch (error) {
        console.error('Error processing return in Supabase:', error);
      }
    }
  },

  customers: [],
  addCustomer: async (customer) => {
    set((state) => ({ customers: [...state.customers, customer] }));
    try {
      await supabase.from('customers').insert([{
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        tax_id: customer.taxId || null
      }]);
    } catch (error) {
      console.error('Error adding customer to Supabase:', error);
    }
  },
  updateCustomer: async (id, customer) => {
    set((state) => ({
      customers: state.customers.map(c => c.id === id ? { ...c, ...customer } : c)
    }));
    try {
      const updateData: any = {};
      if (customer.name !== undefined) updateData.name = customer.name;
      if (customer.email !== undefined) updateData.email = customer.email;
      if (customer.phone !== undefined) updateData.phone = customer.phone;
      if (customer.taxId !== undefined) updateData.tax_id = customer.taxId;
      if (Object.keys(updateData).length > 0) {
        await supabase.from('customers').update(updateData).eq('id', id);
      }
    } catch (error) {
      console.error('Error updating customer in Supabase:', error);
    }
  },
  deleteCustomer: async (id) => {
    set((state) => ({
      customers: state.customers.filter(c => c.id !== id),
      currentCustomerId: state.currentCustomerId === id ? undefined : state.currentCustomerId
    }));
    try {
      await supabase.from('customers').delete().eq('id', id);
    } catch (error) {
      console.error('Error deleting customer from Supabase:', error);
    }
  },

  cashSessions: [],
  openSession: async (session) => {
    set((state) => ({ cashSessions: [...state.cashSessions, session] }));
    try {
      await supabase.from('cash_sessions').insert([{
        id: session.id,
        branch_id: session.branchId,
        opened_at: session.openedAt,
        opening_balance: session.openingBalance,
        expected_balance: session.expectedBalance || null,
        status: session.status,
        user_id: session.userId
      }]);
    } catch (error) {
      console.error('Error adding session to Supabase:', error);
    }
  },
  closeSession: async (sessionId, closingBalances) => {
    set((state) => ({
      cashSessions: state.cashSessions.map(s => 
        s.id === sessionId ? { ...s, closedAt: new Date().toISOString(), status: 'closed', closingBalances } : s
      )
    }));
    try {
      await supabase.from('cash_sessions').update({
        closed_at: new Date().toISOString(),
        status: 'closed',
        closing_balances: closingBalances ? JSON.stringify(closingBalances) : null
      }).eq('id', sessionId);
    } catch (error) {
      console.error('Error updating session in Supabase:', error);
    }
  },
  getCurrentSession: (branchId, userId) => {
    return get().cashSessions.find(s => s.branchId === branchId && s.userId === userId && s.status === 'open');
  },

  pendingOrders: [],
  createPendingOrder: (order) => set((state) => ({
    pendingOrders: [...state.pendingOrders, order]
  })),
  removePendingOrder: (id) => set((state) => ({
    pendingOrders: state.pendingOrders.filter(o => o.id !== id)
  })),

  // Suppliers
  suppliers: [],
  addSupplier: async (s) => {
    set(state => ({ suppliers: [...state.suppliers, s] }));
    try {
      await supabase.from('suppliers').insert([{
        id: s.id,
        name: s.name,
        rnc: s.rnc || null,
        email: s.email || null,
        phone: s.phone || null,
        address: s.address || null,
        type_of_merchandise: s.typeOfMerchandise,
        rating: s.rating
      }]);
    } catch (error) {
      console.error('Error adding supplier:', error);
    }
  },
  updateSupplier: async (id, s) => {
    set(state => ({ suppliers: state.suppliers.map(x => x.id === id ? { ...x, ...s } : x) }));
    try {
      const updateData: any = {};
      if (s.name !== undefined) updateData.name = s.name;
      if (s.rnc !== undefined) updateData.rnc = s.rnc;
      if (s.email !== undefined) updateData.email = s.email;
      if (s.phone !== undefined) updateData.phone = s.phone;
      if (s.address !== undefined) updateData.address = s.address;
      if (s.typeOfMerchandise !== undefined) updateData.type_of_merchandise = s.typeOfMerchandise;
      if (s.rating !== undefined) updateData.rating = s.rating;
      if (Object.keys(updateData).length > 0) {
        await supabase.from('suppliers').update(updateData).eq('id', id);
      }
    } catch (error) {
      console.error('Error updating supplier:', error);
    }
  },
  deleteSupplier: async (id) => {
    set(state => ({ suppliers: state.suppliers.filter(x => x.id !== id) }));
    try {
      await supabase.from('suppliers').delete().eq('id', id);
    } catch (error) {
      console.error('Error deleting supplier:', error);
    }
  },

  supplierOrders: [],
  createSupplierOrder: async (o) => {
    set(state => ({ supplierOrders: [o, ...state.supplierOrders] }));
    try {
      await supabase.from('supplier_orders').insert([{
        id: o.id,
        supplier_id: o.supplierId,
        date: o.date,
        expected_delivery_date: o.expectedDeliveryDate || null,
        total: o.total,
        status: o.status,
        branch_id: o.branchId,
        transport_details: o.transportDetails || null,
        transport_cost: o.transportCost || 0
      }]);

      if (o.items && o.items.length > 0) {
        await supabase.from('supplier_order_items').insert(
          o.items.map((i: any) => ({
            order_id: o.id,
            product_id: i.productId,
            product_name: i.productName,
            variant_label: i.variantLabel || null,
            quantity: i.quantity,
            cost: i.cost
          }))
        );
      }
    } catch (error) {
      console.error('Error adding supplier order:', error);
    }
  },
  updateSupplierOrder: async (id, o) => {
    let order: any;
    set(state => {
      const updated = state.supplierOrders.map(x => x.id === id ? { ...x, ...o } : x);
      // If received, update stock locally
      order = updated.find(x => x.id === id);
      if (order && order.status === 'received' && o.status === 'received') {
        order.items.forEach((item: any) => {
          get().adjustInventory(item.productId, order.branchId, item.quantity, item.variantLabel);
        });
      }
      return { supplierOrders: updated };
    });

    try {
      const updateData: any = {};
      if (o.status !== undefined) updateData.status = o.status;
      if (o.expectedDeliveryDate !== undefined) updateData.expected_delivery_date = o.expectedDeliveryDate;
      if (o.transportDetails !== undefined) updateData.transport_details = o.transportDetails;
      if (o.transportCost !== undefined) updateData.transport_cost = o.transportCost;
      if (o.total !== undefined) updateData.total = o.total;

      if (Object.keys(updateData).length > 0) {
        await supabase.from('supplier_orders').update(updateData).eq('id', id);
      }

      // If items were updated, we re-insert them
      if (o.items && o.items.length > 0) {
        await supabase.from('supplier_order_items').delete().eq('order_id', id);
        await supabase.from('supplier_order_items').insert(
          o.items.map((i: any) => ({
            order_id: id,
            product_id: i.productId,
            product_name: i.productName,
            variant_label: i.variantLabel || null,
            quantity: i.quantity,
            cost: i.cost
          }))
        );
      }
    } catch (error) {
      console.error('Error updating supplier order:', error);
    }
  },

  inventoryAudits: [],
  createInventoryAudit: async (a) => {
    set(state => ({ inventoryAudits: [a, ...state.inventoryAudits] }));
    try {
      await supabase.from('inventory_audits').insert([{
        id: a.id,
        date: a.date,
        branch_id: a.branchId,
        user_id: a.userId,
        status: a.status,
        notes: a.notes || null
      }]);
      if (a.items && a.items.length > 0) {
        await supabase.from('inventory_audit_items').insert(
          a.items.map((i: any) => ({
            audit_id: a.id,
            product_id: i.productId,
            product_name: i.productName,
            variant_label: i.variantLabel || null,
            expected: i.expected,
            actual: i.counted,
            difference: i.difference
          }))
        );
      }
    } catch (error) {
      console.error('Error creating inventory audit:', error);
    }
  },
  completeInventoryAudit: async (id, items, notes) => {
    let audit: any;
    set(state => {
      const updatedAudits = state.inventoryAudits.map(a => 
        a.id === id ? { ...a, status: 'completed' as 'completed', items, notes, date: new Date().toISOString() } : a
      );
      audit = updatedAudits.find(a => a.id === id);
      if (audit) {
        // Adjust inventory based on audit results
        audit.items.forEach((item: any) => {
          if (item.difference !== 0) {
            get().adjustInventory(item.productId, audit.branchId, item.difference, item.variantLabel);
          }
        });
      }
      return { inventoryAudits: updatedAudits };
    });

    try {
      if (audit) {
        await supabase.from('inventory_audits').update({
          status: 'completed',
          notes: notes || null,
          date: audit.date
        }).eq('id', id);

        await supabase.from('inventory_audit_items').delete().eq('audit_id', id);
        await supabase.from('inventory_audit_items').insert(
          items.map((i: any) => ({
            audit_id: id,
            product_id: i.productId,
            product_name: i.productName,
            variant_label: i.variantLabel || null,
            expected: i.expected,
            actual: i.counted,
            difference: i.difference
          }))
        );
      }
    } catch (error) {
      console.error('Error completing inventory audit:', error);
    }
  },

  fiscalConfigs: INITIAL_FISCAL_CONFIGS,
  updateFiscalConfig: (id, c) => set(state => ({ fiscalConfigs: state.fiscalConfigs.map(x => x.id === id ? { ...x, ...c } : x) })),
  getNextNCF: (type) => {
    const config = get().fiscalConfigs.find(c => c.type === type && c.active);
    if (!config) return undefined;
    if (config.current > config.limit) return undefined;
    
    const ncf = `${config.prefix}${config.current.toString().padStart(8, '0')}`;
    get().updateFiscalConfig(config.id, { current: config.current + 1 });
    return ncf;
  },

  demandForecasts: [],
  updateForecasts: (f) => set({ demandForecasts: f }),

  receiptConfig: {
    showLogo: true,
    showAddress: true,
    showPhone: true,
    showNCF: true,
    showFooter: true,
    footerText: "¡GRACIAS POR SU PREFERENCIA!",
    businessName: "MI NEGOCIO CORP",
    businessAddress: "CALLE COMERCIAL #456",
    businessPhone: "+53 555-5555",
    printerWidth: "80mm",
    openDrawer: true,
  },
  updateReceiptConfig: (config) => set((state) => ({
    receiptConfig: { ...state.receiptConfig, ...config }
  })),

  salarySettlements: [],
  addSalarySettlement: async (settlement) => {
    set((state) => ({
      salarySettlements: [settlement, ...state.salarySettlements]
    }));
    try {
      await supabase.from('salary_settlements').insert([{
        id: settlement.id,
        user_id: settlement.userId,
        user_name: settlement.userName,
        session_id: settlement.sessionId,
        base_salary: settlement.baseSalary,
        commissions: settlement.commissions,
        total: settlement.total,
        date: settlement.date,
        status: settlement.status
      }]);
    } catch (error) {
      console.error('Error adding salary settlement:', error);
    }
  },
  updateSalarySettlement: async (id, settlement) => {
    set((state) => ({
      salarySettlements: state.salarySettlements.map(s => s.id === id ? { ...s, ...settlement } : s)
    }));
    try {
      const updateData: any = {};
      if (settlement.status !== undefined) updateData.status = settlement.status;
      if (Object.keys(updateData).length > 0) {
        await supabase.from('salary_settlements').update(updateData).eq('id', id);
      }
    } catch (error) {
      console.error('Error updating salary settlement:', error);
    }
  },
  addCashMovement: async (sessionId, movement) => {
    set((state) => ({
      cashSessions: state.cashSessions.map(s => 
        s.id === sessionId ? { ...s, movements: [...(s.movements || []), movement] } : s
      )
    }));
    try {
      await supabase.from('cash_movements').insert([{
        id: movement.id,
        session_id: sessionId,
        type: movement.type,
        amount: movement.amount,
        currency_code: movement.currencyCode,
        description: movement.description,
        date: movement.date
      }]);
    } catch (error) {
      console.error('Error adding cash movement to Supabase:', error);
    }
  },

  transfers: [],
  addTransfer: async (transfer) => {
    set((state) => ({
      transfers: [transfer, ...state.transfers]
    }));
    try {
      await supabase.from('inventory_transfers').insert([{
        id: transfer.id,
        product_id: transfer.productId,
        product_name: transfer.productName,
        from_branch_id: transfer.fromBranchId,
        from_branch_name: transfer.fromBranchName,
        to_branch_id: transfer.toBranchId,
        to_branch_name: transfer.toBranchName,
        variant_label: transfer.variantLabel || null,
        quantity: transfer.quantity,
        variants: transfer.variants || null,
        date: transfer.date,
        user_id: transfer.userId,
        status: transfer.status
      }]);
    } catch (error) {
      console.error('Error adding inventory transfer to Supabase:', error);
    }
  },

  warranties: [],
  addWarranty: async (warranty) => {
    set((state) => ({ warranties: [warranty, ...state.warranties] }));
    try {
      await supabase.from('warranties').insert([{
        id: warranty.id,
        product_id: warranty.productId,
        product_name: warranty.productName,
        transaction_id: warranty.transactionId,
        customer_id: warranty.customerId || null,
        customer_name: warranty.customerName || null,
        purchase_date: warranty.purchaseDate,
        expiry_date: warranty.expiryDate,
        serial_number: warranty.serialNumber || null,
        status: warranty.status
      }]);
    } catch (error) {
      console.error('Error adding warranty to Supabase:', error);
    }
  },
  updateWarranty: async (id, warranty) => {
    set((state) => ({
      warranties: state.warranties.map(w => w.id === id ? { ...w, ...warranty } : w)
    }));
    try {
      const updateData: any = {};
      if (warranty.status !== undefined) updateData.status = warranty.status;
      if (Object.keys(updateData).length > 0) {
        await supabase.from('warranties').update(updateData).eq('id', id);
      }
    } catch (error) {
      console.error('Error updating warranty in Supabase:', error);
    }
  },

  bankCards: [],
  addBankCard: async (card) => {
    set(state => ({ bankCards: [...state.bankCards, card] }));
    try {
      await supabase.from('bank_cards').insert([{
        id: card.id,
        name: card.name,
        bank: card.bank,
        last_four: card.lastFour || null,
        balance: card.balance,
        currency: card.currency,
        is_active: card.isActive
      }]);
    } catch (error) {
      console.error('Error adding bank card:', error);
    }
  },
  updateBankCard: async (id, card) => {
    set(state => ({ bankCards: state.bankCards.map(c => c.id === id ? { ...c, ...card } : c) }));
    try {
      const updateData: any = {};
      if (card.name !== undefined) updateData.name = card.name;
      if (card.bank !== undefined) updateData.bank = card.bank;
      if (card.lastFour !== undefined) updateData.last_four = card.lastFour;
      if (card.balance !== undefined) updateData.balance = card.balance;
      if (card.isActive !== undefined) updateData.is_active = card.isActive;
      if (Object.keys(updateData).length > 0) {
        await supabase.from('bank_cards').update(updateData).eq('id', id);
      }
    } catch (error) {
      console.error('Error updating bank card:', error);
    }
  },
  deleteBankCard: async (id) => {
    set(state => ({ bankCards: state.bankCards.filter(c => c.id !== id) }));
    try {
      await supabase.from('bank_cards').delete().eq('id', id);
    } catch (error) {
      console.error('Error deleting bank card:', error);
    }
  },

  bankTransactions: [],
  addBankTransaction: async (transaction) => {
    let updatedCard: any;
    set(state => {
      const updatedCards = state.bankCards.map(card => {
        if (card.id === transaction.cardId) {
          let newBalance = card.balance;
          if (transaction.type === 'deposit' || transaction.type === 'payment_received') {
            newBalance += transaction.amount;
          } else if (transaction.type === 'withdrawal' || transaction.type === 'supplier_payment') {
            newBalance -= transaction.amount;
          }
          updatedCard = { ...card, balance: newBalance };
          return updatedCard;
        }
        return card;
      });
      return { 
        bankTransactions: [transaction, ...state.bankTransactions],
        bankCards: updatedCards
      };
    });

    try {
      await supabase.from('bank_transactions').insert([{
        id: transaction.id,
        card_id: transaction.cardId,
        type: transaction.type,
        amount: transaction.amount,
        date: transaction.date,
        reference: transaction.reference || null,
        description: transaction.description,
        original_transaction_id: transaction.transactionId || null
      }]);

      if (updatedCard) {
        await supabase.from('bank_cards').update({ balance: updatedCard.balance }).eq('id', updatedCard.id);
      }
    } catch (error) {
      console.error('Error adding bank transaction:', error);
    }
  },

  initializeFromSupabase: async () => {
    try {
      const [
        { data: branchesData },
        { data: categoriesData },
        { data: productsData },
        { data: inventoryData },
        { data: customersData },
        { data: usersData },
        { data: transactionsData },
        { data: returnsData },
        { data: warrantiesData },
        { data: cashSessionsData },
        { data: cashMovementsData },
        { data: transfersData },
        { data: suppliersData },
        { data: supplierOrdersData },
        { data: supplierOrderItemsData },
        { data: bankCardsData },
        { data: bankTransactionsData },
        { data: inventoryAuditsData },
        { data: inventoryAuditItemsData },
        { data: quotesData },
        { data: timeShiftsData },
        { data: salarySettlementsData }
      ] = await Promise.all([
        supabase.from('branches').select('*'),
        supabase.from('categories').select('*'),
        supabase.from('products').select('*'),
        supabase.from('inventory_levels').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('users').select('*'),
        supabase.from('transactions').select('*, transaction_payments(*), transaction_items(*)'),
        supabase.from('returns').select('*'),
        supabase.from('warranties').select('*'),
        supabase.from('cash_sessions').select('*'),
        supabase.from('cash_movements').select('*'),
        supabase.from('inventory_transfers').select('*'),
        supabase.from('suppliers').select('*'),
        supabase.from('supplier_orders').select('*'),
        supabase.from('supplier_order_items').select('*'),
        supabase.from('bank_cards').select('*'),
        supabase.from('bank_transactions').select('*'),
        supabase.from('inventory_audits').select('*'),
        supabase.from('inventory_audit_items').select('*'),
        supabase.from('salary_settlements').select('*'),
        supabase.from("quotes").select("*, quote_items(*)"),
        supabase.from("time_shifts").select("*")
      ]);

      set((state) => ({
        ...state,
        branches: branchesData?.length ? branchesData.map(b => ({
          id: b.id,
          name: b.name,
          address: b.address || '',
          phone: '', 
        })) : state.branches,
        categories: categoriesData?.length ? categoriesData.map(c => ({
          id: c.id,
          name: c.name,
          department: c.department
        })) : state.categories,
        products: productsData?.length ? productsData.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode || '',
          price: p.price,
          costPrice: p.cost_price,
          margin: p.margin,
          categoryId: p.category_id,
          color: p.color || 'bg-slate-100',
          commissionType: p.commission_type || 'percentage',
          commissionValue: p.commission_value || 0,
          unit: p.unit || 'unidad',
          status: p.status || 'active',
          minStockAlert: p.min_stock_alert || 0,
          hasSerial: p.has_serial || false,
          isKit: p.is_kit || false,
          warrantyDays: p.warranty_days || 0,
          deviceColor: p.device_color,
          availableSizes: p.available_sizes || [],
          availableColors: p.available_colors || [],
          nextSerial: p.next_serial || 1,
          image: p.image
        })) : state.products,
        inventory: inventoryData?.length ? inventoryData.map(i => ({
          productId: i.product_id,
          branchId: i.branch_id,
          variantLabel: i.variant_label,
          quantity: i.quantity,
          minQuantity: i.min_quantity
        })) : state.inventory,
        customers: customersData?.length ? customersData.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          taxId: c.tax_id || undefined
        })) : state.customers,
        users: usersData?.length ? usersData.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          password: u.password,
          commissionRate: u.commission_rate,
          baseSalary: u.base_salary,
          salesGoal: u.sales_goal || 0,
          phone: u.phone || undefined,
          branchId: u.branch_id || undefined,
          supervisorId: u.supervisor_id || undefined
        })) : state.users,
        transactions: transactionsData?.length ? transactionsData.map(t => ({
          id: t.id,
          branchId: t.branch_id,
          userId: t.user_id,
          date: t.date,
          subtotal: t.subtotal,
          tax: t.tax,
          total: t.total,
          status: t.status,
          customerId: t.customer_id || undefined,
          ncf: t.ncf || undefined,
          ncfType: t.ncf_type || undefined,
          changeGiven: t.change_given,
          payments: t.transaction_payments ? t.transaction_payments.map((p: any) => ({
            currencyCode: p.currency_code,
            amount: p.amount,
            exchangeRate: p.exchange_rate,
            method: p.method,
            bankCardId: p.bank_card_id || undefined
          })) : [],
          items: t.transaction_items ? t.transaction_items.map((i: any) => {
            const product = state.products.find(p => p.id === i.product_id) || productsData?.map(p => ({
              id: p.id, name: p.name, sku: p.sku, price: p.price, costPrice: p.cost_price, margin: p.margin, categoryId: p.category_id, color: p.color, commissionType: p.commission_type, commissionValue: p.commission_value
            })).find(p => p.id === i.product_id); // Fallback to raw data mapping if not fully loaded yet in state
            return {
              id: i.cart_item_id || i.id,
              product: product as any, // Mapped locally
              quantity: i.quantity,
              serialNumber: i.serial_number || undefined,
              warrantyCode: i.warranty_code || undefined,
              selectedSize: i.selected_size || undefined,
              selectedColor: i.selected_color || undefined,
              variantLabel: i.variant_label || undefined
            };
          }) : []
        })) : state.transactions,
        returns: returnsData?.length ? returnsData.map(r => ({
          id: r.id,
          transactionId: r.transaction_id,
          productId: r.product_id,
          quantity: r.quantity,
          reason: r.reason,
          date: r.date,
          status: r.status,
          type: r.type,
          notes: r.notes || undefined
        })) : state.returns,
        warranties: warrantiesData?.length ? warrantiesData.map(w => ({
          id: w.id,
          productId: w.product_id,
          productName: w.product_name,
          transactionId: w.transaction_id,
          customerId: w.customer_id || undefined,
          customerName: w.customer_name || undefined,
          purchaseDate: w.purchase_date,
          expiryDate: w.expiry_date,
          serialNumber: w.serial_number || undefined,
          status: w.status
        })) : state.warranties,
        cashSessions: cashSessionsData?.length ? cashSessionsData.map(s => ({
          id: s.id,
          branchId: s.branch_id,
          userId: s.user_id,
          openedAt: s.opened_at,
          closedAt: s.closed_at || undefined,
          openingBalance: s.opening_balance,
          closingBalances: s.closing_balances || undefined,
          expectedBalance: s.expected_balance || undefined,
          status: s.status,
          movements: cashMovementsData?.filter(m => m.session_id === s.id).map(m => ({
            id: m.id,
            type: m.type,
            amount: m.amount,
            currencyCode: m.currency_code,
            description: m.description,
            date: m.date
          })) || []
        })) : state.cashSessions,
        transfers: transfersData?.length ? transfersData.map(t => ({
          id: t.id,
          productId: t.product_id,
          productName: t.product_name,
          fromBranchId: t.from_branch_id,
          fromBranchName: t.from_branch_name,
          toBranchId: t.to_branch_id,
          toBranchName: t.to_branch_name,
          variantLabel: t.variant_label || undefined,
          quantity: t.quantity,
          variants: t.variants || undefined,
          date: t.date,
          userId: t.user_id,
          status: t.status
        })) : state.transfers,
        suppliers: suppliersData?.length ? suppliersData.map(s => ({
          id: s.id,
          name: s.name,
          rnc: s.rnc || undefined,
          email: s.email || undefined,
          phone: s.phone || undefined,
          address: s.address || undefined,
          typeOfMerchandise: s.type_of_merchandise,
          rating: s.rating || undefined
        })) : state.suppliers,
        supplierOrders: supplierOrdersData?.length ? supplierOrdersData.map(o => ({
          id: o.id,
          supplierId: o.supplier_id,
          date: o.date,
          expectedDeliveryDate: o.expected_delivery_date || undefined,
          total: o.total,
          status: o.status,
          branchId: o.branch_id,
          transportDetails: o.transport_details || undefined,
          transportCost: o.transport_cost || 0,
          items: supplierOrderItemsData?.filter(i => i.order_id === o.id).map(i => ({
            productId: i.product_id,
            productName: i.product_name,
            variantLabel: i.variant_label || undefined,
            quantity: i.quantity,
            cost: i.cost
          })) || []
        })) : state.supplierOrders,
        bankCards: bankCardsData?.length ? bankCardsData.map(c => ({
          id: c.id,
          name: c.name,
          bank: c.bank,
          lastFour: c.last_four || undefined,
          balance: c.balance,
          currency: c.currency,
          isActive: c.is_active
        })) : state.bankCards,
        bankTransactions: bankTransactionsData?.length ? bankTransactionsData.map(t => ({
          id: t.id,
          cardId: t.card_id,
          type: t.type,
          amount: t.amount,
          date: t.date,
          reference: t.reference || undefined,
          description: t.description,
          transactionId: t.original_transaction_id || undefined
        })) : state.bankTransactions,
        quotes: quotesData?.length ? quotesData.map(q => ({
          id: q.id,
          branchId: q.branch_id,
          userId: q.user_id,
          customerId: q.customer_id || undefined,
          date: q.date,
          subtotal: q.subtotal,
          tax: q.tax,
          total: q.total,
          status: q.status,
          notes: q.notes || undefined,
          items: (q.quote_items || []).map((i: any) => ({
            product: { id: i.product_id, name: i.product_name, price: i.price },
            quantity: i.quantity,
            variantLabel: i.variant_label || undefined
          }))
        })) : state.quotes,
        timeShifts: timeShiftsData?.length ? timeShiftsData.map(ts => ({
          id: ts.id,
          userId: ts.user_id,
          clockIn: ts.clock_in,
          clockOut: ts.clock_out || undefined,
          notes: ts.notes || undefined
        })) : state.timeShifts,
        inventoryAudits: inventoryAuditsData?.length ? inventoryAuditsData.map(a => ({
          id: a.id,
          date: a.date,
          branchId: a.branch_id,
          userId: a.user_id,
          status: a.status,
          notes: a.notes || undefined,
          items: inventoryAuditItemsData?.filter(i => i.audit_id === a.id).map(i => ({
            productId: i.product_id,
            productName: i.product_name,
            variantLabel: i.variant_label || undefined,
            expected: i.expected,
            counted: i.actual,
            difference: i.difference
          })) || []
        })) : state.inventoryAudits,
        salarySettlements: salarySettlementsData?.length ? salarySettlementsData.map(s => ({
          id: s.id,
          userId: s.user_id,
          userName: s.user_name,
          sessionId: s.session_id,
          baseSalary: s.base_salary,
          commissions: s.commissions,
          total: s.total,
          date: s.date,
          status: s.status
        })) : state.salarySettlements,
        isInitialized: true
      }));
    } catch (error) {
      console.error('Error fetching from Supabase:', error);
      set({ isInitialized: true });
    }
  }
}),
{
  name: 'pos-store-storage',
}
));

