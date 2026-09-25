import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Branch, Category, Product, InventoryLevel, CartItem, Transaction, ReturnItem, Currency, Customer, CashRegisterSession, User, PendingOrder, SalarySettlement, InventoryTransfer, Warranty, CashMovement, Supplier, SupplierOrder, InventoryAudit, FiscalConfig, DemandForecast, BankCard, BankTransaction, IDNSettlementPrice } from '../types';
import { generateId, generateReadableId } from '../lib/utils';
import { 
  pullAllFromSupabase, pushProductToSupabase, pushInventoryToSupabase, 
  pushTransactionToSupabase, pushCashSessionToSupabase, pushUserToSupabase, deleteUserFromSupabase, 
  pushIDNSettlementPriceToSupabase, deleteIDNSettlementPriceFromSupabase, SyncResult,
  pushBranchToSupabase, deleteBranchFromSupabase, pushCategoryToSupabase, deleteCategoryFromSupabase, deleteProductFromSupabase,
  pushCurrencyToSupabase, clearSupabaseData, pushBankCardToSupabase, deleteBankCardFromSupabase, pushBankTransactionToSupabase, pushAllToSupabase,
  pushSupplierToSupabase, deleteSupplierFromSupabase, pushSupplierOrderToSupabase, pushCustomerToSupabase,
  pushReceiptConfigToSupabase, pushStoreConfigToSupabase, deleteTransactionFromSupabase, deleteCashSessionFromSupabase,
  deleteBankTransactionFromSupabase, callOpenSessionRPC, callProcessTransactionRPC, callCloseSessionRPC
} from '../services/supabaseSync';
import { getSupabaseCredentials } from '../lib/supabase';
import { getOfflineQueue, enqueueOfflineItem } from '../services/offlineSync';
import { normalizeSemanticText, areSemanticallyEqual } from '../utils/textUtils';

// --- Datos Iniciales y Catálogo Pre-cargado ---
const INITIAL_USERS: User[] = [
  {
    id: 'admin-1',
    name: 'Administrador Cristian',
    email: 'cristianmarco2003@gmail.com',
    role: 'admin',
    password: '03111166702',
    baseSalary: 0,
    salesGoal: 0,
    branchId: '',
    allowedBranches: [],
    permissions: ['pos_access', 'reports_access', 'inventory_access', 'admin_access', 'cash_audit'],
    isActive: true
  },
  {
    id: 'employee-1',
    name: 'Trabajador',
    email: 'trabajador@gmail.com',
    role: 'employee',
    password: '03111166702',
    baseSalary: 0,
    salesGoal: 0,
    branchId: '',
    allowedBranches: [],
    permissions: ['pos_access'],
    isActive: true
  }
];

const INITIAL_BRANCHES: Branch[] = [];

const INITIAL_CATEGORIES: Category[] = [];

const INITIAL_PRODUCTS: Product[] = [];

const INITIAL_INVENTORY: InventoryLevel[] = [];

const INITIAL_BANK_CARDS: BankCard[] = [];

const INITIAL_FISCAL_CONFIGS: FiscalConfig[] = [
  { id: crypto.randomUUID(), type: 'B01', name: 'Crédito Fiscal', prefix: 'B01', current: 1, limit: 1000, active: true },
  { id: crypto.randomUUID(), type: 'B02', name: 'Consumo', prefix: 'B02', current: 1, limit: 10000, active: true },
];

const BASE_CURRENCY_CODE = import.meta.env.VITE_BASE_CURRENCY || 'CUP';

const INITIAL_CURRENCIES: Currency[] = [
  { 
    code: 'CUP', 
    name: 'Peso Cubano', 
    symbol: '$', 
    rateToBase: 1, 
    isBase: true 
  },
  { 
    code: 'USD', 
    name: 'Dólar Estadounidense', 
    symbol: '$', 
    rateToBase: 320, 
    isBase: false 
  },
  { 
    code: 'EUR', 
    name: 'Euro', 
    symbol: '€', 
    rateToBase: 350, 
    isBase: false 
  }
];


// --- Definición del Store ---
interface AppState {
  // Auth
  users: User[];
  currentUser: User | null;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  clearAllData: () => Promise<void>;
  clearReportsHistory: () => Promise<void>;
  exportData: () => string;
  importData: (jsonData: string) => Promise<{ success: boolean; error?: string }>;
  addUser: (user: User) => void;
  registerEmployee: (name: string, password: string) => User;
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
  transferInventory: (productId: string, fromBranchId: string, toBranchId: string, quantity: number, variantLabel?: string, transactionId?: string) => Promise<{ success: boolean; error?: string } | boolean>;
  transferInventoryBatch: (productId: string, fromBranchId: string, toBranchId: string, variants: { variantLabel: string; quantity: number }[], transactionId?: string, batchId?: string) => Promise<{ success: boolean; error?: string }>;
  reconcileProductStock: (productId: string, corrections: { branchId: string; variantLabel?: string; quantity: number; minQuantity?: number }[]) => Promise<{ success: boolean; error?: string }>;
  repairOrphanedInventoryLevels: () => Promise<{ repaired: number; message: string }>;
  adjustInventory: (productId: string, branchId: string, delta: number, variantLabel?: string, minQuantity?: number) => void;
  setInventoryQuantity: (productId: string, branchId: string, quantity: number, variantLabel?: string, minQuantity?: number) => void;
  transferProductsBulk: (fromBranchId: string, toBranchId: string, items: { productId: string; quantity: number; variant?: string }[]) => Promise<{ success: boolean; error?: string }>;
  
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
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string, reason?: string) => void;
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
  closeSession: (sessionId: string, closingBalances: import('../types').Payment[], workerName?: string, closingDate?: string, discrepancyDeduction?: number, sessionMeta?: Partial<CashRegisterSession>) => void;
  updateCashSession: (id: string, updates: Partial<CashRegisterSession>) => void;
  cancelSession: (sessionId: string) => void;
  deleteCashSession: (id: string) => void;
  updateCashSessionDateCascade: (sessionId: string, newDateYMD: string) => Promise<boolean>;
  joinOpenSession: (sessionId: string, userId: string, workerName?: string) => void;
  getCurrentSession: (branchId: string, userId: string) => CashRegisterSession | undefined;
  addInformationalSoldProductToSession: (sessionId: string, itemData: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    userId?: string;
    workerName?: string;
    paymentMethod?: 'cash' | 'transfer';
    currencyCode?: string;
  }) => Promise<{ success: boolean; transactionId?: string }>;
  forceCloseSessionFromReports: (sessionId: string, closingBalances?: import('../types').Payment[], closingDate?: string, notes?: string) => Promise<{ success: boolean }>;

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

  lastTurnNumber: number;

  // IDN Settlement
  idnSettlementPrices: IDNSettlementPrice[];
  addIDNSettlementPrice: (price: IDNSettlementPrice) => void;
  updateIDNSettlementPrice: (id: string, price: Partial<IDNSettlementPrice>) => void;
  deleteIDNSettlementPrice: (id: string) => void;

  // Banks Module
  bankCards: import('../types').BankCard[];
  addBankCard: (card: import('../types').BankCard) => void;
  updateBankCard: (id: string, card: Partial<import('../types').BankCard>) => void;
  deleteBankCard: (id: string) => void;
  
  bankTransactions: import('../types').BankTransaction[];
  addBankTransaction: (transaction: import('../types').BankTransaction) => void;
  deleteBankTransaction: (id: string) => void;
  reconcileBankBalances: () => Promise<{ removedDuplicates: number; totalSales?: number; totalMovements?: number; message: string }>;

  // Supabase Sync
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncResult: SyncResult | null;
  syncWithSupabase: () => Promise<SyncResult>;
  seedDemoProducts: () => void;

  isInitialized: boolean;
  
  // Notificaciones Globales
  notifications: { id: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }[];
  addNotification: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  removeNotification: (id: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      lastTurnNumber: 0,
      isSyncing: false,
      lastSyncTime: null,
      syncResult: null,
      users: INITIAL_USERS,
      idnSettlementPrices: [],
      currentUser: null,
  login: async (email, pass) => {
    const cleanIdentifier = (email || '').trim().toLowerCase();
    
    // 1. Intentar buscar en los usuarios locales (que vienen de Supabase sincronizados o INITIAL_USERS)
    let user = get().users.find(u => 
      ((u.email || '').trim().toLowerCase() === cleanIdentifier || (u.name || '').trim().toLowerCase() === cleanIdentifier) && 
      u.password === pass
    );
    
    // 2. Fallback de emergencia para cuentas administrativas críticas (siempre funcionan offline)
    if (!user) {
      if ((cleanIdentifier === 'cristianmarco2003@gmail.com' || cleanIdentifier === 'admin') && pass === '03111166702') {
        user = get().users.find(u => u.id === 'admin-1') || {
          id: 'admin-1',
          name: 'Administrador Cristian',
          email: 'cristianmarco2003@gmail.com',
          role: 'admin',
          baseSalary: 0,
          permissions: ['pos_access', 'reports_access', 'inventory_access', 'admin_access', 'cash_audit'],
          isActive: true
        };
      } else if ((cleanIdentifier === 'trabajador@gmail.com' || cleanIdentifier === 'trabajador') && pass === '03111166702') {
        user = get().users.find(u => u.id === 'employee-1') || {
          id: 'employee-1',
          name: 'Trabajador',
          email: 'trabajador@gmail.com',
          role: 'employee',
          baseSalary: 0,
          permissions: ['pos_access'],
          isActive: true
        };
      }
    }

    if (user) {
      set({ currentUser: user });
      
      // Auto-asignación de sucursal
      if (user.isIndependent && user.assignedBranchId) {
        set({ currentBranchId: user.assignedBranchId });
      } else if (user.branchId) {
        set({ currentBranchId: user.branchId });
      } else if (!get().currentBranchId && (get().branches || []).length > 0) {
        set({ currentBranchId: (get().branches || [])[0].id });
      }
      
      return true;
    }
    return false;
  },
  logout: () => set({ currentUser: null, cart: [] }), // LIMPIAR CARRITO AL SALIR
  clearAllData: async () => {
    // 1. Clear Supabase (with timeout/error handling to prevent blocking)
    try {
      // Give supabase 10 seconds max, but don't block the UI forever
      await Promise.race([
        clearSupabaseData(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout Supabase')), 12000))
      ]).catch(err => console.warn("Supabase clear warning (continuing locally):", err));
    } catch (err) {
      console.warn("Supabase clear failed (continuing locally):", err);
    }

    // Clear local storage cache
    try {
      localStorage.clear();
    } catch (e) {
      /* ignore */
    }

    // 2. Reset local state to absolute minimal (only first admin)
    const minUsers = [INITIAL_USERS[0]];
    const minBranches: Branch[] = [];
    
    set({
      users: minUsers,
      idnSettlementPrices: [],
      currentUser: null,
      branches: minBranches,
      currentBranchId: '',
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
      inventoryAudits: [],
      salarySettlements: [],
      fiscalConfigs: INITIAL_FISCAL_CONFIGS,
      bankCards: [],
      bankTransactions: [],
      demandForecasts: [],
      quotes: [],
      timeShifts: [],
      pendingOrders: [],
      cart: [],
      currentCustomerId: undefined,
      lastTurnNumber: 0
    });

    // 3. Re-push minimal data to Supabase to avoid lock-out
    await pushUserToSupabase(minUsers[0]);
  },
  clearReportsHistory: async () => {
    // 1. Clear Supabase History only (surgical)
    try {
      const { clearHistoryFromSupabase } = await import('../services/supabaseSync');
      await clearHistoryFromSupabase();
    } catch (err) {
      console.warn("Supabase history clear failed (continuing locally):", err);
    }

    // 2. Clear ONLY reporting/history states (KEEP products, categories, branches, users)
    set({ 
      transactions: [],
      returns: [],
      warranties: [],
      cashSessions: [],
      bankTransactions: [],
      inventoryAudits: [],
      salarySettlements: [],
      pendingOrders: [],
      cart: [],
      notifications: []
    });
  },
  exportData: () => {
    const state = get();
    const backupData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      data: {
        categories: state.categories,
        products: state.products,
        inventory: state.inventory,
        branches: state.branches,
        currencies: state.currencies,
        customers: state.customers,
        users: state.users,
        transactions: state.transactions,
        returns: state.returns,
        warranties: state.warranties,
        cashSessions: state.cashSessions,
        transfers: state.transfers,
        suppliers: state.suppliers,
        supplierOrders: state.supplierOrders,
        inventoryAudits: state.inventoryAudits,
        salarySettlements: state.salarySettlements,
        fiscalConfigs: state.fiscalConfigs,
        bankCards: state.bankCards,
        bankTransactions: state.bankTransactions,
        demandForecasts: state.demandForecasts,
        quotes: state.quotes,
        timeShifts: state.timeShifts,
        pendingOrders: state.pendingOrders,
        idnSettlementPrices: state.idnSettlementPrices,
        receiptConfig: state.receiptConfig,
        catalogConfig: state.catalogConfig,
        storeConfig: state.storeConfig
      }
    };
    return JSON.stringify(backupData, null, 2);
  },
  importData: async (jsonData: string) => {
    try {
      const backup = JSON.parse(jsonData);
      if (!backup.data || !backup.version) {
        throw new Error("Formato de backup inválido");
      }

      const d = backup.data;
      
      // Update local state
      set({
        categories: d.categories || [],
        products: d.products || [],
        inventory: d.inventory || [],
        branches: d.branches || [],
        currencies: d.currencies || [],
        customers: d.customers || [],
        users: d.users || [],
        transactions: d.transactions || [],
        returns: d.returns || [],
        warranties: d.warranties || [],
        cashSessions: d.cashSessions || [],
        transfers: d.transfers || [],
        suppliers: d.suppliers || [],
        supplierOrders: d.supplierOrders || [],
        inventoryAudits: d.inventoryAudits || [],
        salarySettlements: d.salarySettlements || [],
        fiscalConfigs: d.fiscalConfigs || [],
        bankCards: d.bankCards || [],
        bankTransactions: d.bankTransactions || [],
        demandForecasts: d.demandForecasts || [],
        quotes: d.quotes || [],
        timeShifts: d.timeShifts || [],
        pendingOrders: d.pendingOrders || [],
        idnSettlementPrices: d.idnSettlementPrices || [],
        receiptConfig: d.receiptConfig || get().receiptConfig,
        catalogConfig: d.catalogConfig || get().catalogConfig,
        storeConfig: d.storeConfig || get().storeConfig
      });

      // After local update, sync everything to Supabase
      const { pushAllToSupabase } = await import('../services/supabaseSync');
      await pushAllToSupabase(true);

      return { success: true };
    } catch (err: any) {
      console.error("Error importing data:", err);
      return { success: false, error: err.message };
    }
  },
  addUser: (user) => {
    const exists = get().users.find(u => 
      (u.email && u.email.toLowerCase() === user.email?.toLowerCase()) || 
      ((u.name || '').toLowerCase() === (user.name || '').toLowerCase())
    );
    if (exists) {
      return get().updateUser(exists.id, user);
    }
    set((state) => ({ users: [...state.users, user] }));
    pushUserToSupabase(user);
  },
  registerEmployee: (name, password) => {
    const newUser: import('../types').User = {
      id: crypto.randomUUID(),
      name,
      email: `${String(name || 'user').toLowerCase().replace(/\s/g, '')}_${Math.floor(1000 + Math.random() * 9000)}@system.local`,
      password,
      role: 'employee',
      permissions: ['pos_access'],
      isActive: true,
      baseSalary: 0
    };
    set((state) => ({ users: [...state.users, newUser] }));
    pushUserToSupabase(newUser);
    return newUser;
  },
  updateUser: (id, user) => {
    set((state) => ({
      users: state.users.map(u => u.id === id ? { ...u, ...user } : u)
    }));
    const updatedUser = get().users.find(u => u.id === id);
    if (updatedUser) pushUserToSupabase(updatedUser);
  },
  deleteUser: (id) => {
    set((state) => ({
      users: state.users.filter(u => u.id !== id)
    }));
    deleteUserFromSupabase(id);
  },

  addIDNSettlementPrice: (price) => {
    set((state) => ({
      idnSettlementPrices: [...state.idnSettlementPrices, price]
    }));
    pushIDNSettlementPriceToSupabase(price);
  },
  updateIDNSettlementPrice: (id, price) => {
    set((state) => ({
      idnSettlementPrices: state.idnSettlementPrices.map(p => p.id === id ? { ...p, ...price } : p)
    }));
    const updated = get().idnSettlementPrices.find(p => p.id === id);
    if (updated) pushIDNSettlementPriceToSupabase(updated);
  },
  deleteIDNSettlementPrice: (id) => {
    set((state) => ({
      idnSettlementPrices: state.idnSettlementPrices.filter(p => p.id !== id)
    }));
    deleteIDNSettlementPriceFromSupabase(id);
  },

  currencies: INITIAL_CURRENCIES,
  
  updateCurrencyRate: (code, newRate) => {
    set((state) => ({
      currencies: (state.currencies || INITIAL_CURRENCIES)
        .filter(c => ['CUP', 'USD', 'EUR'].includes(c.code))
        .map(c => c.code === code ? { ...c, rateToBase: newRate } : c)
    }));
    const updated = get().currencies.find(c => c.code === code);
    if (updated) {
      pushCurrencyToSupabase(updated);
    }
  },

  getBaseCurrency: () => {
    const list = (get().currencies || INITIAL_CURRENCIES).filter(c => ['CUP', 'USD', 'EUR'].includes(c.code));
    return list.find(c => c.isBase) || list.find(c => c.code === 'CUP') || INITIAL_CURRENCIES[0];
  },
  
  storeConfig: { storeName: 'Mi Tienda POS', address: 'Calle Principal 123', phone: '+53 51234567', receiptNotes: '¡Gracias por su compra!', darkMode: false },
  
  updateStoreConfig: (config) => {
    set({ storeConfig: config });
    pushStoreConfigToSupabase(config).catch(() => {});
  },


  catalogConfig: { 
    themeColor: '#4f46e5', 
    bannerText: '¡Bienvenidos a nuestra tienda virtual!', 
    whatsappNumber: '+5351234567', 
    showPrices: true,
    visibleBranches: ['b1']
  },
  
  updateCatalogConfig: (config) => {
    set({ catalogConfig: config });
  },


  branches: INITIAL_BRANCHES,
  currentBranchId: '',
  setCurrentBranch: (id) => set({ currentBranchId: id, cart: [] }),
  addBranch: (branch) => {
    let shouldPush = false;
    set((state) => {
      // Deduplicación estricta insensible a mayúsculas, acentos y espaciado
      const normName = normalizeSemanticText(branch.name);
      const isDuplicate = state.branches.some(b => 
        b.id === branch.id || 
        normalizeSemanticText(b.name) === normName
      );
      if (isDuplicate) {
        console.warn(`[MARÉ] Intento de agregar sucursal duplicada bloqueado: "${branch.name}"`);
        return state;
      }
      
      shouldPush = true;
      return { 
        branches: [...state.branches, branch],
        currentBranchId: state.currentBranchId || branch.id
      };
    });
    if (shouldPush) {
      pushBranchToSupabase(branch);
    }
  },
  updateBranch: (id, branch) => {
    let shouldPush = false;
    set((state) => {
      if (branch.name) {
        const normName = normalizeSemanticText(branch.name);
        const nameCollision = state.branches.some(b => b.id !== id && normalizeSemanticText(b.name) === normName);
        if (nameCollision) {
          console.warn(`[MARÉ] No se puede renombrar: ya existe otra sucursal con el nombre "${branch.name}"`);
          return state;
        }
      }
      shouldPush = true;
      return {
        branches: state.branches.map(b => b.id === id ? { ...b, ...branch } : b)
      };
    });
    if (shouldPush) {
      const updated = get().branches.find(b => b.id === id);
      if (updated) pushBranchToSupabase(updated);
    }
  },
  deleteBranch: (id) => {
    // Validar integridad referencial antes de permitir eliminación
    const hasInventory = (get().inventory || []).some(l => l.branchId === id && l.quantity > 0);
    const hasTx = (get().transactions || []).some(t => t.branchId === id && !t.deletedAt);
    const hasSessions = (get().cashSessions || []).some(s => s.branchId === id && !s.deletedAt);
    if (hasInventory || hasTx || hasSessions) {
      console.warn(`[MARÉ] Bloqueada eliminación de sucursal ${id} porque tiene relaciones activas (inventario, ventas o turnos).`);
      return;
    }

    set((state) => {
      const newBranches = state.branches.filter(b => b.id !== id);
      return {
        branches: newBranches,
        currentBranchId: state.currentBranchId === id ? (newBranches[0]?.id || '') : state.currentBranchId
      };
    });
    deleteBranchFromSupabase(id);
  },
  
  categories: INITIAL_CATEGORIES,
  addCategory: (category) => {
    let shouldPush = false;
    set((state) => {
      // Deduplicación estricta por ID o Nombre normalizado
      const normName = normalizeSemanticText(category.name);
      const isDuplicate = state.categories.some(c => 
        c.id === category.id || 
        normalizeSemanticText(c.name) === normName
      );
      if (isDuplicate) return state;
      shouldPush = true;
      return { categories: [...state.categories, category] };
    });
    if (shouldPush) {
      pushCategoryToSupabase(category);
    }
  },
  updateCategory: (id, category) => {
    set((state) => ({
      categories: state.categories.map(c => c.id === id ? { ...c, ...category } : c)
    }));
    const updated = get().categories.find(c => c.id === id);
    if (updated) pushCategoryToSupabase(updated);
  },
  deleteCategory: (id) => {
    set((state) => ({ categories: state.categories.filter(c => c.id !== id) }));
    deleteCategoryFromSupabase(id);
  },
  
  products: INITIAL_PRODUCTS,
  inventory: INITIAL_INVENTORY,
  addProduct: (product, initialQuantity, branchId, variantLabel, initialVariantQuantities) => {
    const targetBranch = branchId || get().currentBranchId;
    let newInventoryEntries: InventoryLevel[] = [];
    
    if (initialVariantQuantities && Object.keys(initialVariantQuantities).length > 0) {
      Object.entries(initialVariantQuantities).forEach(([vLabel, qty]) => {
        if (qty > 0) {
          newInventoryEntries.push({ id: crypto.randomUUID(), productId: product.id, branchId: targetBranch, quantity: qty, minQuantity: 5, variantLabel: vLabel });
        }
      });
    } else if (initialQuantity && initialQuantity > 0) {
      newInventoryEntries.push({ id: crypto.randomUUID(), productId: product.id, branchId: targetBranch, quantity: initialQuantity, minQuantity: 5, variantLabel });
    }

    set((state) => {
      // Deduplicación por ID, SKU o Nombre (ignoring case)
      const isDuplicate = state.products.some(p => 
        p.id === product.id || 
        (p.sku && product.sku && p.sku.toLowerCase().trim() === product.sku.toLowerCase().trim()) ||
        (p.name.toLowerCase().trim() === product.name.toLowerCase().trim())
      );
      if (isDuplicate) return state;
      return {
        products: [product, ...state.products],
        inventory: [...state.inventory, ...newInventoryEntries]
      };
    });

    // Async push to Supabase
    pushProductToSupabase(product).catch(() => {});
    newInventoryEntries.forEach(inv => pushInventoryToSupabase(inv).catch(() => {}));
  },
  updateProduct: (id, product) => {
    set((state) => ({
      products: state.products.map(p => p.id === id ? { ...p, ...product } : p)
    }));
    const updated = get().products.find(p => p.id === id);
    if (updated) pushProductToSupabase(updated);
  },
  deleteProduct: (id) => {
    set((state) => ({
      products: state.products.filter(p => p.id !== id),
      inventory: state.inventory.filter(i => i.productId !== id)
    }));
    deleteProductFromSupabase(id);
  },
  transferInventory: async (productId, fromBranchId, toBranchId, quantity, variantLabel, transactionId) => {
    const res = await get().transferInventoryBatch(
      productId,
      fromBranchId,
      toBranchId,
      [{ variantLabel: variantLabel || '', quantity }],
      transactionId
    );
    return res.success;
  },

  transferInventoryBatch: async (productId, fromBranchId, toBranchId, variants, transactionId, batchId) => {
    if (!productId || !fromBranchId || !toBranchId) {
      return { success: false, error: 'Información incompleta para realizar la transferencia.' };
    }
    if (fromBranchId === toBranchId) {
      return { success: false, error: 'La sucursal de origen y destino no pueden ser la misma.' };
    }
    const activeVariants = variants.filter(v => v.quantity > 0);
    if (activeVariants.length === 0) {
      return { success: false, error: 'Debes indicar una cantidad mayor a 0 para transferir.' };
    }

    const currentLevels = get().inventory.filter(i => i.productId === productId);

    for (const v of activeVariants) {
      const vLabel = v.variantLabel || '';
      const sourceLevel = currentLevels.find(
        i => i.branchId === fromBranchId && (i.variantLabel || '') === vLabel
      );
      const availableQty = sourceLevel ? sourceLevel.quantity : 0;
      if (availableQty < v.quantity) {
        const variantDesc = vLabel ? ` (Variante: "${vLabel}")` : '';
        return {
          success: false,
          error: `Stock insuficiente en la sucursal de origen${variantDesc}. Stock disponible: ${availableQty} uds, intentas transferir: ${v.quantity} uds.`
        };
      }
    }

    let totalQuantity = 0;
    const newInventory = [...get().inventory];

    for (const v of activeVariants) {
      totalQuantity += v.quantity;
      const vLabel = v.variantLabel || '';

      const sourceIdx = newInventory.findIndex(
        i => i.productId === productId && i.branchId === fromBranchId && (i.variantLabel || '') === vLabel
      );
      if (sourceIdx !== -1) {
        newInventory[sourceIdx] = { 
          ...newInventory[sourceIdx], 
          quantity: Math.max(0, newInventory[sourceIdx].quantity - v.quantity) 
        };
      }

      const targetIdx = newInventory.findIndex(
        i => i.productId === productId && i.branchId === toBranchId && (i.variantLabel || '') === vLabel
      );
      if (targetIdx !== -1) {
        newInventory[targetIdx] = { 
          ...newInventory[targetIdx], 
          quantity: newInventory[targetIdx].quantity + v.quantity 
        };
      } else {
        newInventory.push({
          id: crypto.randomUUID(),
          productId,
          branchId: toBranchId,
          variantLabel: vLabel || undefined,
          quantity: v.quantity,
          minQuantity: 5
        });
      }
    }

    set({ inventory: newInventory });

    // Sync inventory to Supabase
    activeVariants.forEach(v => {
      const vLabel = v.variantLabel || '';
      const source = newInventory.find(i => i.productId === productId && i.branchId === fromBranchId && (i.variantLabel || '') === vLabel);
      const target = newInventory.find(i => i.productId === productId && i.branchId === toBranchId && (i.variantLabel || '') === vLabel);
      if (source) pushInventoryToSupabase(source).catch(() => {});
      if (target) pushInventoryToSupabase(target).catch(() => {});
    });

    const product = get().products.find(p => p.id === productId);
    const fromBranch = get().branches.find(b => b.id === fromBranchId);
    const toBranch = get().branches.find(b => b.id === toBranchId);
    const variantSummary = activeVariants.length === 1 
      ? (activeVariants[0].variantLabel || 'Producto Base') 
      : activeVariants.map(v => `${v.variantLabel || 'Base'}: ${v.quantity}`).join(', ');

    const transferRecord: import('../types').InventoryTransfer = {
      id: crypto.randomUUID(),
      productId,
      productName: product?.name || 'Producto',
      fromBranchId,
      fromBranchName: fromBranch?.name || 'Sucursal Origen',
      toBranchId,
      toBranchName: toBranch?.name || 'Sucursal Destino',
      quantity: totalQuantity,
      variants: activeVariants,
      date: new Date().toISOString(),
      userId: (get().currentUser?.id && get().users.some(u => u.id === get().currentUser?.id)) ? get().currentUser!.id : 'system',
      status: 'completed',
      variantLabel: variantSummary,
      transactionId,
      batchId
    };

    get().addTransfer(transferRecord);
    return { success: true };
  },

  reconcileProductStock: async (productId, corrections) => {
    const newInventory = [...get().inventory];

    for (const item of corrections) {
      const vLabel = item.variantLabel || '';
      const idx = newInventory.findIndex(
        i => i.productId === productId && i.branchId === item.branchId && (i.variantLabel || '') === vLabel
      );

      if (idx !== -1) {
        newInventory[idx] = {
          ...newInventory[idx],
          quantity: Math.max(0, item.quantity),
          minQuantity: item.minQuantity ?? newInventory[idx].minQuantity ?? 5
        };
      } else {
        newInventory.push({
          id: crypto.randomUUID(),
          productId,
          branchId: item.branchId,
          variantLabel: vLabel || undefined,
          quantity: Math.max(0, item.quantity),
          minQuantity: item.minQuantity ?? 5
        });
      }
    }

    set({ inventory: newInventory });
    
    // Sync to Supabase
    corrections.forEach(c => {
      const vLabel = c.variantLabel || '';
      const inv = newInventory.find(i => i.productId === productId && i.branchId === c.branchId && (i.variantLabel || '') === vLabel);
      if (inv) pushInventoryToSupabase(inv).catch(() => {});
    });

    return { success: true };
  },

  repairOrphanedInventoryLevels: async () => {
    const defaultBranchId = get().branches[0]?.id;
    if (!defaultBranchId) return { repaired: 0, message: 'No hay sucursales configuradas.' };

    let repairedCount = 0;
    set((state) => ({
      inventory: state.inventory.map(i => {
        if (!i.branchId) {
          repairedCount++;
          return { ...i, branchId: defaultBranchId };
        }
        return i;
      })
    }));

    return { repaired: repairedCount, message: `Se repararon ${repairedCount} registros huérfanos.` };
  },
  batchDeleteProducts: (ids) => {
    set((state) => ({
      products: state.products.filter(p => !ids.includes(p.id)),
      inventory: state.inventory.filter(i => !ids.includes(i.productId))
    }));
    
    // Sync to Supabase
    ids.forEach(id => {
      deleteProductFromSupabase(id);
    });
  },
  batchUpdateProducts: (ids, updates) => {
    set((state) => ({
      products: state.products.map(p => ids.includes(p.id) ? { ...p, ...updates } : p)
    }));
  },
  adjustInventory: (productId, branchId, delta, variantLabel, minQuantity) => {
    set((state) => {
      const newInventory = [...state.inventory];
      const idx = newInventory.findIndex(i => i.productId === productId && i.branchId === branchId && (i.variantLabel || '') === (variantLabel || ''));
      if (idx !== -1) {
        newInventory[idx] = { 
          ...newInventory[idx], 
          quantity: Math.max(0, newInventory[idx].quantity + delta),
          minQuantity: minQuantity !== undefined ? minQuantity : newInventory[idx].minQuantity
        };
      } else if (delta > 0) {
        newInventory.push({ 
          id: crypto.randomUUID(), 
          productId, 
          branchId, 
          quantity: delta, 
          minQuantity: minQuantity ?? 5, 
          variantLabel 
        });
      } else {
        return state;
      }
      return { inventory: newInventory };
    });
    const inv = get().inventory.find(i => i.productId === productId && i.branchId === branchId && (i.variantLabel || '') === (variantLabel || ''));
    if (inv) pushInventoryToSupabase(inv).catch(() => {});
  },
  setInventoryQuantity: (productId, branchId, quantity, variantLabel, minQuantity) => {
    set((state) => {
      const newInventory = [...state.inventory];
      const idx = newInventory.findIndex(i => i.productId === productId && i.branchId === branchId && (i.variantLabel || '') === (variantLabel || ''));
      if (idx !== -1) {
        newInventory[idx] = { 
          ...newInventory[idx], 
          quantity: Math.max(0, quantity),
          minQuantity: minQuantity !== undefined ? minQuantity : newInventory[idx].minQuantity
        };
      } else {
        newInventory.push({ 
          id: crypto.randomUUID(), 
          productId, 
          branchId, 
          quantity: Math.max(0, quantity), 
          minQuantity: minQuantity ?? 5, 
          variantLabel 
        });
      }
      return { inventory: newInventory };
    });
    const inv = get().inventory.find(i => i.productId === productId && i.branchId === branchId && (i.variantLabel || '') === (variantLabel || ''));
    if (inv) pushInventoryToSupabase(inv).catch(() => {});
  },

  transferProductsBulk: async (fromBranchId, toBranchId, items) => {
    if (items.length === 0) return { success: true };
    const batchId = crypto.randomUUID();
    let successCount = 0;
    let lastError = "";

    for (const item of items) {
      const res = await get().transferInventoryBatch(
        item.productId,
        fromBranchId,
        toBranchId,
        [{ variantLabel: item.variant || '', quantity: item.quantity }],
        undefined,
        batchId
      );
      if (res.success) {
        successCount++;
      } else {
        lastError = res.error || "Error desconocido";
      }
    }

    if (successCount === items.length) {
      return { success: true };
    } else {
      return { 
        success: false, 
        error: `Se transfirieron ${successCount} de ${items.length} productos. ${lastError}` 
      };
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
      const prod = updatedProducts.find(p => p.id === product.id) || product;
      return {
        products: updatedProducts,
        cart: [...state.cart, { 
          id: crypto.randomUUID(), 
          product: prod, 
          quantity: 1, 
          price: prod.price,
          total: prod.price,
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
      (item.variantLabel || '') === ((attributes?.variantLabel || attributes?.size || attributes?.color) || '')
    );
    
    if (existing) {
      return {
        cart: state.cart.map(item => 
          item.id === existing.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price } 
            : item
        )
      };
    }
    
    return {
      cart: [...state.cart, { 
        id: crypto.randomUUID(), 
        product, 
        quantity: 1,
        price: product.price,
        total: product.price,
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
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty, total: newQty * item.price };
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
  addQuote: (quote) => {
    set((state) => ({ quotes: [...state.quotes, quote] }));
    import('../services/supabaseSync').then(({ pushQuoteToSupabase }) => {
      pushQuoteToSupabase(quote).catch(() => {});
    }).catch(() => {});
  },
  updateQuote: (id, updates) => {
    set((state) => ({ quotes: state.quotes.map(q => q.id === id ? { ...q, ...updates } : q) }));
    const updated = get().quotes.find(q => q.id === id);
    if (updated) {
      import('../services/supabaseSync').then(({ pushQuoteToSupabase }) => {
        pushQuoteToSupabase(updated).catch(() => {});
      }).catch(() => {});
    }
  },

  timeShifts: [],
  addTimeShift: (shift) => {
    set((state) => ({ timeShifts: [shift, ...state.timeShifts] }));
    import('../services/supabaseSync').then(({ pushTimeShiftToSupabase }) => {
      pushTimeShiftToSupabase(shift).catch(() => {});
    }).catch(() => {});
  },
  updateTimeShift: (id, updates) => {
    set((state) => ({ timeShifts: state.timeShifts.map(s => s.id === id ? { ...s, ...updates } : s) }));
    const updated = get().timeShifts.find(s => s.id === id);
    if (updated) {
      import('../services/supabaseSync').then(({ pushTimeShiftToSupabase }) => {
        pushTimeShiftToSupabase(updated).catch(() => {});
      }).catch(() => {});
    }
  },
  processTransaction: async (transaction) => {
    // 1. Optimistic Update (Local State)
    set((state) => {
      let newWarranties: any[] = [];
      const updatedInventory = [...state.inventory];
      
      const finalItems = transaction.items.map(item => {
        let finalItem = { ...item };
        
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
          const idx = updatedInventory.findIndex(i => 
            i.productId === item.product.id && 
            i.branchId === transaction.branchId &&
            (i.variantLabel || '') === (item.variantLabel || '')
          );
          if (idx !== -1) {
            updatedInventory[idx] = { 
              ...updatedInventory[idx], 
              quantity: Math.max(0, updatedInventory[idx].quantity - item.quantity) 
            };
          }
        }
      });

      const newTransaction = { ...transaction, items: finalItems };

      return {
        transactions: [newTransaction, ...state.transactions],
        inventory: updatedInventory,
        warranties: [...newWarranties, ...state.warranties],
        cart: [],
        currentCustomerId: undefined
      };
    });

    // 2. RPC Atómico si hay conexión
    if (navigator.onLine) {
      const res = await callProcessTransactionRPC(transaction);
      if (res.success) return;
    }

    // 3. Fallback a cola offline (si falló RPC o no hay red)
    pushTransactionToSupabase(transaction).catch(() => {});
  },

  deleteTransaction: (id: string, reason?: string) => {
    set((state) => {
      const transactionToDelete = (state.transactions || []).find(t => t.id === id);
      if (!transactionToDelete || transactionToDelete.deletedAt) return state;

      const updatedInventory = [...state.inventory];
      
      // SOLO restauramos stock si no estaba ya eliminado
      transactionToDelete.items.forEach(item => {
        if (item.product.isKit && item.product.kitComponents) {
          item.product.kitComponents.forEach(comp => {
            const compIdx = updatedInventory.findIndex(i => 
              i.productId === comp.productId && 
              i.branchId === transactionToDelete.branchId
            );
            if (compIdx !== -1) {
              updatedInventory[compIdx] = {
                ...updatedInventory[compIdx],
                quantity: updatedInventory[compIdx].quantity + (comp.quantity * item.quantity)
              };
              pushInventoryToSupabase(updatedInventory[compIdx]).catch(() => {});
            }
          });
        } else {
          const idx = updatedInventory.findIndex(i => 
            i.productId === item.product.id && 
            i.branchId === transactionToDelete.branchId &&
            (i.variantLabel || '') === (item.variantLabel || '')
          );
          if (idx !== -1) {
            updatedInventory[idx] = { 
              ...updatedInventory[idx], 
              quantity: updatedInventory[idx].quantity + item.quantity 
            };
            pushInventoryToSupabase(updatedInventory[idx]).catch(() => {});
          }
        }
      });

      const deletedAt = new Date().toISOString();
      const deletedBy = state.currentUser?.id || 'system';

      const updatedTransaction: Transaction = {
        ...transactionToDelete,
        deletedAt,
        deletedBy,
        deleteReason: reason || 'Anulación de venta'
      };

      // En lugar de borrar físicamente, actualizamos el registro en Supabase
      pushTransactionToSupabase(updatedTransaction).catch(() => {});

      // Revert associated bank transactions and bank card balances
      const relatedBankTxs = (state.bankTransactions || []).filter(bt => 
        bt.transactionId === id || 
        bt.reference === id || 
        (bt.description && bt.description.includes(id))
      );

      let updatedBankCards = [...state.bankCards];

      relatedBankTxs.forEach(bt => {
        // Soft delete bank transaction too? For now we'll just keep them but they might need marking.
        // Actually it's better to just delete them from the visible list if they were generated by this sale
        
        const cardIdx = updatedBankCards.findIndex(c => c.id === bt.cardId);
        if (cardIdx !== -1) {
          const card = updatedBankCards[cardIdx];
          let revertedBalance = card.balance;
          if (bt.type === 'deposit' || bt.type === 'payment_received') {
            revertedBalance = Math.max(0, revertedBalance - bt.amount);
          } else if (bt.type === 'withdrawal' || bt.type === 'supplier_payment') {
            revertedBalance = revertedBalance + bt.amount;
          }
          const updatedCard = { ...card, balance: revertedBalance };
          updatedBankCards[cardIdx] = updatedCard;
          pushBankCardToSupabase(updatedCard).catch(() => {});
        }
      });

      // Update warranties status
      const updatedWarranties = state.warranties.map(w => 
        w.transactionId === id ? { ...w, status: 'refunded' as const } : w
      );
      updatedWarranties.forEach(w => {
        if (w.transactionId === id) {
          import('../services/supabaseSync').then(({ pushWarrantyToSupabase }) => {
            pushWarrantyToSupabase(w).catch(() => {});
          });
        }
      });

      return {
        transactions: state.transactions.map(t => t.id === id ? updatedTransaction : t),
        inventory: updatedInventory,
        warranties: updatedWarranties,
        bankCards: updatedBankCards,
        // We filter out deleted bank transactions for now to not clutter bank history
        bankTransactions: state.bankTransactions.filter(bt => bt.transactionId !== id)
      };
    });
  },

  updateTransaction: (id: string, updates: Partial<Transaction>) => {
    set((state) => ({
      transactions: (state.transactions || []).map(t => t.id === id ? { ...t, ...updates } : t)
    }));
    const updated = get().transactions.find(t => t.id === id);
    if (updated) {
      pushTransactionToSupabase(updated).catch(() => {});
    }
  },

  cancelSession: (sessionId: string) => {
    const session = get().cashSessions.find(s => s.id === sessionId);
    if (!session) return;

    // 1. Find all transactions from this session
    const sessionTxs = get().transactions.filter(t => 
      t.sessionId === session.id || 
      (t.branchId === session.branchId && 
       new Date(t.date).getTime() >= new Date(session.openedAt).getTime() &&
       (!session.closedAt || new Date(t.date).getTime() <= new Date(session.closedAt).getTime()))
    );

    // 2. Void each transaction (restores stock)
    sessionTxs.forEach(tx => {
      get().deleteTransaction(tx.id);
    });

    // 3. Delete the session
    get().deleteCashSession(sessionId);
  },

  deleteCashSession: (id: string, reason?: string) => {
    set((state) => {
      const sessionToDelete = state.cashSessions.find(s => s.id === id);
      if (!sessionToDelete || sessionToDelete.deletedAt) return state;

      const deletedAt = new Date().toISOString();
      const deletedBy = state.currentUser?.id || 'system';

      const updatedSession: CashRegisterSession = {
        ...sessionToDelete,
        deletedAt,
        deletedBy,
        deleteReason: reason || 'Cancelación de turno'
      };

      // En lugar de borrar físicamente, actualizamos el registro en Supabase
      pushCashSessionToSupabase(updatedSession).catch(() => {});

      return {
        cashSessions: state.cashSessions.map(s => s.id === id ? updatedSession : s)
      };
    });
  },

  createReturn: (returnItem) => {
    const readableId = generateReadableId('DEV', get().returns.length);
    const newReturn = { ...returnItem, id: readableId };
    set((state) => ({
      returns: [newReturn, ...state.returns]
    }));
    import('../services/supabaseSync').then(({ pushReturnToSupabase }) => {
      pushReturnToSupabase(newReturn).catch(() => {});
    }).catch(() => {});
  },
  updateReturn: (id, returnItem) => {
    set((state) => ({
      returns: state.returns.map(r => r.id === id ? { ...r, ...returnItem } : r)
    }));
    const updated = get().returns.find(r => r.id === id);
    if (updated) {
      import('../services/supabaseSync').then(({ pushReturnToSupabase }) => {
        pushReturnToSupabase(updated).catch(() => {});
      }).catch(() => {});
    }
  },
  processReturn: (id, action) => {
    set((state) => {
      const returnReq = state.returns.find(r => r.id === id);
      if (!returnReq || returnReq.status !== 'pending') return state;
      
      let updatedInventory = [...state.inventory];
      let updatedWarranties = [...state.warranties];
      
      if (action === 'complete') {
        const branchId = state.currentBranchId;
        const idx = updatedInventory.findIndex(i => i.productId === returnReq.productId && i.branchId === branchId);
        
        if (returnReq.type === 'warranty_exchange') {
          if (idx !== -1) {
            updatedInventory[idx] = { 
              ...updatedInventory[idx], 
              quantity: Math.max(0, updatedInventory[idx].quantity - returnReq.quantity) 
            };
          }
        } else if (returnReq.type === 'refund') {
          if (idx !== -1) {
            updatedInventory[idx] = { 
              ...updatedInventory[idx], 
              quantity: updatedInventory[idx].quantity + returnReq.quantity 
            };
          }
        }

        const warrantyIdx = updatedWarranties.findIndex(w => w.transactionId === returnReq.transactionId && w.productId === returnReq.productId);
        if (warrantyIdx !== -1) {
          updatedWarranties[warrantyIdx] = {
            ...updatedWarranties[warrantyIdx],
            status: returnReq.type === 'warranty_exchange' ? 'exchanged' : 'refunded'
          };
        }
      }
      
      return {
        returns: state.returns.map(r => r.id === id ? { ...r, status: action === 'complete' ? 'completed' : 'rejected' } : r),
        inventory: updatedInventory,
        warranties: updatedWarranties
      };
    });
  },

  customers: [],
  addCustomer: (customer) => {
    set((state) => {
      // Deduplicación por ID, Teléfono o Correo
      const isDuplicate = (state.customers || []).some(c => 
        c.id === customer.id || 
        (c.phone && customer.phone && c.phone === customer.phone) ||
        (c.email && customer.email && c.email.toLowerCase().trim() === customer.email.toLowerCase().trim())
      );
      if (isDuplicate) return state;
      return { customers: [...(state.customers || []), customer] };
    });
    pushCustomerToSupabase(customer).catch(() => {});
  },
  updateCustomer: (id, customer) => {
    set((state) => ({
      customers: state.customers.map(c => c.id === id ? { ...c, ...customer } : c)
    }));
    const updated = get().customers.find(c => c.id === id);
    if (updated) pushCustomerToSupabase(updated).catch(() => {});
  },
  deleteCustomer: (id) => {
    set((state) => ({
      customers: state.customers.filter(c => c.id !== id),
      currentCustomerId: state.currentCustomerId === id ? undefined : state.currentCustomerId
    }));
  },

  cashSessions: [],
  openSession: async (session) => {
    const existingSessions = get().cashSessions || [];
    let maxTurn = 0;
    existingSessions.forEach(s => {
      const match = s.id?.match(/^Turno-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxTurn) maxTurn = num;
      }
    });
    
    // Si hay red, usar RPC para garantizar integridad y turno único
    if (navigator.onLine) {
      const res = await callOpenSessionRPC(session);
      if (res.success && res.data) {
        const officialSession = {
          ...res.data,
          openingBalance: Number(res.data.opening_balance || res.data.opening_amount) || 0,
          openingAmount: Number(res.data.opening_amount || res.data.opening_balance) || 0,
          workingEmployeeIds: res.data.working_employee_ids || [],
          movements: res.data.movements || []
        };
        set((state) => ({
          cashSessions: [...(state.cashSessions || []), officialSession],
          lastTurnNumber: Math.max(state.lastTurnNumber, parseInt(officialSession.id.split('-')[1]) || 0),
          cart: []
        }));
        return;
      }
    }

    const nextTurn = Math.max(maxTurn, get().lastTurnNumber || 0, existingSessions.length) + 1;
    const sessionWithSequentialId = {
      ...session,
      id: `Turno-${nextTurn}`,
      workingEmployeeIds: session.workingEmployeeIds && session.workingEmployeeIds.length > 0 
        ? session.workingEmployeeIds 
        : [session.userId]
    };
    set((state) => ({ 
      cashSessions: [...(state.cashSessions || []), sessionWithSequentialId],
      lastTurnNumber: nextTurn,
      cart: [] // ASEGURAR QUE EL CARRITO ESTÉ VACÍO AL ABRIR NUEVO TURNO
    }));
    pushCashSessionToSupabase(sessionWithSequentialId).catch(() => {});
  },
  closeSession: async (sessionId, closingBalances, workerName, closingDate, discrepancyDeduction, sessionMeta) => {
    const finalClosingDate = closingDate || new Date().toISOString();
    const session = get().cashSessions.find(s => s.id === sessionId);
    if (!session) return;

    const sessionTxs = get().transactions.filter(t => 
      t.sessionId 
        ? t.sessionId === session.id
        : (t.branchId === session.branchId && 
           new Date(t.date).getTime() >= new Date(session.openedAt).getTime() &&
           (!session.closedAt || new Date(t.date).getTime() <= new Date(session.closedAt).getTime()))
    );
    
    const user = get().users.find(u => u.id === session.userId || u.name?.toLowerCase() === (workerName || session.workerName)?.toLowerCase());
    const commissions = sessionTxs.reduce((sum, tx) => {
      return sum + (tx.items || []).reduce((itemSum, item) => {
        const prodObj = typeof item.product === 'object' ? item.product : get().products.find(p => p.id === (item.product as unknown as string));
        const commVal = prodObj?.commissionValue || 0;
        const comm = commVal * (item.quantity || 0);
        return itemSum + comm;
      }, 0);
    }, 0);

    const baseSalary = user?.baseSalary || 0;
    const deduction = discrepancyDeduction || 0;
    const totalSalary = (baseSalary + commissions) - deduction;

    const finalSellerName = workerName || session.workerName || user?.name || 'Vendedor';

    const settlement: SalarySettlement = {
      id: crypto.randomUUID(),
      userId: session.userId,
      userName: finalSellerName,
      sessionId: sessionId,
      baseSalary: baseSalary,
      commissions: commissions,
      discrepancyDeduction: deduction,
      total: totalSalary,
      date: finalClosingDate,
      status: 'pending'
    };

    const updatedSession = {
      ...session,
      closedAt: finalClosingDate,
      status: 'closed' as 'closed',
      closingBalances: closingBalances || [],
      workerName: finalSellerName,
      closingDate: finalClosingDate,
      ...(sessionMeta || {})
    };

    // Intentar RPC atómico
    if (navigator.onLine) {
      const res = await callCloseSessionRPC(sessionId, closingBalances, finalClosingDate, session.notes || '', settlement);
      if (res.success) {
        // Actualizar localmente
        set((state) => ({
          cashSessions: (state.cashSessions || []).map(s => s.id === sessionId ? updatedSession : s),
          salarySettlements: [...(state.salarySettlements || []), { ...settlement, id: res.data?.settlement_id || settlement.id }],
          cart: []
        }));
        return;
      }
    }

    set((state) => ({
      cashSessions: (state.cashSessions || []).map(s => 
        s.id === sessionId ? updatedSession : s
      ),
      salarySettlements: [...(state.salarySettlements || []), settlement],
      cart: [] // ASEGURAR QUE EL CARRITO ESTÉ VACÍO AL CERRAR TURNO
    }));

    pushCashSessionToSupabase(updatedSession).catch(() => {});
    import('../services/supabaseSync').then(({ pushSalarySettlementToSupabase }) => {
      pushSalarySettlementToSupabase(settlement).catch(() => {});
    });
  },
  updateCashSession: (id, updates) => {
    set((state) => ({
      cashSessions: (state.cashSessions || []).map(s => 
        s.id === id ? { ...s, ...updates } : s
      )
    }));
    const updated = get().cashSessions.find(s => s.id === id);
    if (updated) {
      pushCashSessionToSupabase(updated).catch(() => {});
    }
  },
  updateCashSessionDateCascade: async (sessionId, newDateYMD) => {
    const state = get();
    const session = (state.cashSessions || []).find(s => s.id === sessionId);
    if (!session || !newDateYMD) return false;

    // Helper to shift ISO string to target YYYY-MM-DD date
    const shiftDate = (isoStr: string | null | undefined): string => {
      if (!isoStr) return '';
      try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return `${newDateYMD}T12:00:00.000Z`;
        const [year, month, day] = newDateYMD.split('-').map(Number);
        const updated = new Date(d);
        updated.setFullYear(year, month - 1, day);
        return updated.toISOString();
      } catch {
        return `${newDateYMD}T12:00:00.000Z`;
      }
    };

    const newOpenedAt = shiftDate(session.openedAt);
    const newClosedAt = session.closedAt ? shiftDate(session.closedAt) : undefined;
    const newClosingDate = session.closingDate ? shiftDate(session.closingDate) : undefined;

    // Shift movements date
    const updatedMovements = (session.movements || []).map(m => ({
      ...m,
      date: shiftDate(m.date)
    }));

    const updatedSession: CashRegisterSession = {
      ...session,
      openedAt: newOpenedAt,
      closedAt: newClosedAt,
      closingDate: newClosingDate,
      movements: updatedMovements
    };

    // Find affected transactions
    const oldOpenTime = new Date(session.openedAt).getTime();
    const oldCloseTime = session.closedAt ? new Date(session.closedAt).getTime() : Infinity;

    const affectedTxIds = new Set<string>();
    const updatedTransactions = (state.transactions || []).map(tx => {
      const isLinked = tx.sessionId === session.id || (
        tx.branchId === session.branchId &&
        new Date(tx.date).getTime() >= oldOpenTime &&
        new Date(tx.date).getTime() <= oldCloseTime
      );
      if (isLinked) {
        affectedTxIds.add(tx.id);
        return {
          ...tx,
          sessionId: session.id, // Enforce sessionId linkage
          date: shiftDate(tx.date)
        };
      }
      return tx;
    });

    // Update bank transactions linked to these transactions
    const updatedBankTransactions = (state.bankTransactions || []).map(bt => {
      if (bt.transactionId && affectedTxIds.has(bt.transactionId)) {
        return {
          ...bt,
          date: shiftDate(bt.date)
        };
      }
      return bt;
    });

    // Update salary settlements linked to this session
    const updatedSalarySettlements = (state.salarySettlements || []).map(st => {
      if (st.sessionId === session.id) {
        return {
          ...st,
          date: newClosingDate || newOpenedAt
        };
      }
      return st;
    });

    // Update warranties linked to these transactions
    const updatedWarranties = (state.warranties || []).map(w => {
      if (affectedTxIds.has(w.transactionId)) {
        return {
          ...w,
          purchaseDate: shiftDate(w.purchaseDate)
        };
      }
      return w;
    });

    // Update returns linked to these transactions
    const updatedReturns = (state.returns || []).map(ret => {
      if (affectedTxIds.has(ret.transactionId)) {
        return {
          ...ret,
          date: shiftDate(ret.date)
        };
      }
      return ret;
    });

    // Update local state atomically
    set({
      cashSessions: (state.cashSessions || []).map(s => s.id === sessionId ? updatedSession : s),
      transactions: updatedTransactions,
      bankTransactions: updatedBankTransactions,
      salarySettlements: updatedSalarySettlements,
      warranties: updatedWarranties,
      returns: updatedReturns
    });

    // Sync updates to Supabase in background
    try {
      await pushCashSessionToSupabase(updatedSession);
      for (const tx of updatedTransactions) {
        if (affectedTxIds.has(tx.id)) {
          await pushTransactionToSupabase(tx);
        }
      }
      for (const bt of updatedBankTransactions) {
        if (bt.transactionId && affectedTxIds.has(bt.transactionId)) {
          await pushBankTransactionToSupabase(bt);
        }
      }
    } catch (e) {
      console.warn("Cascaded date update Supabase sync error:", e);
    }

    return true;
  },
  joinOpenSession: (sessionId, userId, workerName) => {
    set((state) => {
      const session = (state.cashSessions || []).find(s => s.id === sessionId);
      if (!session) return state;

      const employeeIds = [...(session.workingEmployeeIds || [])];
      if (userId && !employeeIds.includes(userId)) {
        employeeIds.push(userId);
      }

      const updatedSession: CashRegisterSession = {
        ...session,
        workingEmployeeIds: employeeIds,
        workerName: workerName || session.workerName
      };

      // Push updated session to Supabase
      pushCashSessionToSupabase(updatedSession).catch(() => {});

      return {
        cashSessions: (state.cashSessions || []).map(s => s.id === sessionId ? updatedSession : s)
      };
    });
  },
  getCurrentSession: (branchId, userId) => {
    const sessions = get().cashSessions || [];
    if (!userId) return undefined;
    
    // Strict match: must be open AND not deleted AND the specific user must be the opener or in working employees
    // Strictly isolate by branchId so cross-tablet/cross-branch sessions never collide
    return sessions.find(s => 
      s.status === 'open' && 
      !s.deletedAt &&
      (s.userId === userId || s.workingEmployeeIds?.includes(userId)) &&
      (branchId ? s.branchId === branchId : true)
    );
  },

  addInformationalSoldProductToSession: async (sessionId, itemData) => {
    const session = get().cashSessions.find(s => s.id === sessionId);
    if (!session) {
      return { success: false };
    }

    const txs = get().transactions || [];
    const maxNum = txs.reduce((max, t) => {
      const match = t.id?.match(/INF-(\d+)/i) || t.id?.match(/ADJ-(\d+)/i);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    const nextNum = Math.max(txs.length, maxNum) + 1;
    const txId = `INF-${nextNum.toString().padStart(3, '0')}`;

    const totalAmount = itemData.quantity * itemData.price;
    const txDate = session.closingDate || session.closedAt || session.openedAt || new Date().toISOString();
    const currencyCode = itemData.currencyCode || get().getBaseCurrency().code;
    const curr = get().currencies.find(c => c.code === currencyCode);
    const rate = curr?.rateToBase || 1;

    const informationalTx: Transaction = {
      id: txId,
      branchId: session.branchId,
      userId: itemData.userId || session.userId,
      cashierName: itemData.workerName || session.workerName,
      date: txDate,
      subtotal: totalAmount,
      tax: 0,
      total: totalAmount,
      items: [
        {
          id: crypto.randomUUID(),
          product: {
            id: itemData.productId,
            name: itemData.productName,
            price: itemData.price,
            costPrice: 0,
            sku: 'INF'
          } as any,
          quantity: itemData.quantity,
          price: itemData.price,
          total: totalAmount
        }
      ],
      payments: [
        {
          method: itemData.paymentMethod || 'cash',
          amount: totalAmount,
          currencyCode: currencyCode as any,
          exchangeRate: rate
        }
      ],
      status: 'completed',
      sessionId: session.id,
      notes: 'AJUSTE_MANUAL_INFORME (Sin afectar stock físico)'
    };

    // Agregar a transacciones locales SIN descontar inventario físico
    set(state => ({
      transactions: [informationalTx, ...state.transactions]
    }));

    // Sincronizar transacción con Supabase
    pushTransactionToSupabase(informationalTx).catch(() => {});

    // Si el turno está cerrado, recalcular nómina si aplica
    if (session.status === 'closed') {
      const existingSettlement = (get().salarySettlements || []).find(st => st.sessionId === session.id);
      if (existingSettlement) {
        const productObj = get().products.find(p => p.id === itemData.productId);
        const commValue = productObj?.commissionValue || 0;
        const extraCommissions = commValue * itemData.quantity;
        const updatedSettlement = {
          ...existingSettlement,
          commissions: (existingSettlement.commissions || 0) + extraCommissions,
          total: (existingSettlement.total || 0) + extraCommissions
        };
        set(state => ({
          salarySettlements: state.salarySettlements.map(st => st.id === existingSettlement.id ? updatedSettlement : st)
        }));
        import('../services/supabaseSync').then(({ pushSalarySettlementToSupabase }) => {
          pushSalarySettlementToSupabase(updatedSettlement).catch(() => {});
        });
      }
    }

    return { success: true, transactionId: txId };
  },

  forceCloseSessionFromReports: async (sessionId, closingBalances, closingDate, notes) => {
    const session = get().cashSessions.find(s => s.id === sessionId);
    if (!session) return { success: false };

    const finalClosingDate = closingDate || new Date().toISOString();
    const finalBalances = closingBalances && closingBalances.length > 0
      ? closingBalances
      : session.closingBalances && session.closingBalances.length > 0
        ? session.closingBalances
        : [{ currencyCode: get().getBaseCurrency().code, amount: session.openingBalance || 0, method: 'cash' as const, exchangeRate: 1 }];

    const updatedSession: CashRegisterSession = {
      ...session,
      status: 'closed',
      closedAt: finalClosingDate,
      closingDate: finalClosingDate,
      closingBalances: finalBalances,
      notes: notes ? (session.notes ? `${session.notes} | ${notes}` : notes) : session.notes
    };

    // Actualizar localmente de inmediato
    set(state => ({
      cashSessions: state.cashSessions.map(s => s.id === sessionId ? updatedSession : s)
    }));

    // Si no tiene liquidación de salario generada, crearla
    const sessionTxs = (get().transactions || []).filter(t => 
      t.sessionId === session.id || (
        t.branchId === session.branchId &&
        new Date(t.date).getTime() >= new Date(session.openedAt).getTime() &&
        new Date(t.date).getTime() <= new Date(finalClosingDate).getTime()
      )
    );

    const user = get().users.find(u => u.id === session.userId || u.name?.toLowerCase() === session.workerName?.toLowerCase());
    const commissions = sessionTxs.reduce((sum, tx) => {
      return sum + (tx.items || []).reduce((itemSum, item) => {
        const prodObj = typeof item.product === 'object' ? item.product : get().products.find(p => p.id === (item.product as unknown as string));
        const commVal = prodObj?.commissionValue || 0;
        return itemSum + (commVal * (item.quantity || 0));
      }, 0);
    }, 0);

    const baseSalary = user?.baseSalary || 0;
    const totalSalary = baseSalary + commissions;

    const settlement: SalarySettlement = {
      id: crypto.randomUUID(),
      userId: session.userId,
      userName: session.workerName || user?.name || 'Vendedor',
      sessionId: session.id,
      baseSalary: baseSalary,
      commissions: commissions,
      discrepancyDeduction: 0,
      total: totalSalary,
      date: finalClosingDate,
      status: 'pending'
    };

    set(state => {
      const filtered = (state.salarySettlements || []).filter(st => st.sessionId !== session.id);
      return { salarySettlements: [...filtered, settlement] };
    });

    // Subir a Supabase
    pushCashSessionToSupabase(updatedSession).catch(() => {});
    import('../services/supabaseSync').then(({ pushSalarySettlementToSupabase }) => {
      pushSalarySettlementToSupabase(settlement).catch(() => {});
    });

    return { success: true };
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
  addSupplier: (s) => {
    const newSupplier = { ...s, products: s.products || [] };
    set(state => ({ suppliers: [...state.suppliers, newSupplier] }));
    pushSupplierToSupabase(newSupplier).catch(() => {});
  },
  updateSupplier: (id, s) => {
    set(state => ({ suppliers: state.suppliers.map(x => x.id === id ? { ...x, ...s } : x) }));
    const updated = get().suppliers.find(x => x.id === id);
    if (updated) pushSupplierToSupabase(updated).catch(() => {});
  },
  deleteSupplier: (id) => {
    set(state => ({ suppliers: state.suppliers.filter(x => x.id !== id) }));
    deleteSupplierFromSupabase(id).catch(() => {});
  },

  supplierOrders: [],
  createSupplierOrder: (o) => {
    set(state => ({ supplierOrders: [o, ...state.supplierOrders] }));
    pushSupplierOrderToSupabase(o).catch(() => {});
  },
  updateSupplierOrder: (id, o) => {
    set(state => {
      const updated = state.supplierOrders.map(x => x.id === id ? { ...x, ...o } : x);
      const order = updated.find(x => x.id === id);
      if (order && order.status === 'received' && o.status === 'received') {
        order.items.forEach((item: any) => {
          get().adjustInventory(item.productId, order.branchId, item.quantity, item.variantLabel);
        });
      }
      return { supplierOrders: updated };
    });
    const updatedOrder = get().supplierOrders.find(x => x.id === id);
    if (updatedOrder) {
      pushSupplierOrderToSupabase(updatedOrder).catch(() => {});
    }
  },

  inventoryAudits: [],
  createInventoryAudit: (a) => {
    set(state => ({ inventoryAudits: [a, ...state.inventoryAudits] }));
  },
  completeInventoryAudit: (id, items, notes) => {
    set(state => {
      const updatedAudits = state.inventoryAudits.map(a => 
        a.id === id ? { ...a, status: 'completed' as 'completed', items, notes, date: new Date().toISOString() } : a
      );
      const audit = updatedAudits.find(a => a.id === id);
      if (audit) {
        audit.items.forEach((item: any) => {
          if (item.difference !== 0) {
            get().adjustInventory(item.productId, audit.branchId, item.difference, item.variantLabel);
          }
        });
      }
      return { inventoryAudits: updatedAudits };
    });
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
    showFooter: true,
    footerText: "¡GRACIAS POR SU PREFERENCIA!",
    businessName: "MARÉ",
    businessAddress: "Calle Principal #123, Cuba",
    businessPhone: "+53 000-0000",
    printerWidth: "58mm",
    openDrawer: true,
    autoPrint: true,
  },
  updateReceiptConfig: (config) => {
    set((state) => ({
      receiptConfig: { ...state.receiptConfig, ...config }
    }));
    const full = get().receiptConfig;
    pushReceiptConfigToSupabase(full).catch(() => {});
  },

  salarySettlements: [],
  addSalarySettlement: (settlement) => {
    set((state) => ({
      salarySettlements: [settlement, ...state.salarySettlements]
    }));
    import('../services/supabaseSync').then(({ pushSalarySettlementToSupabase }) => {
      pushSalarySettlementToSupabase(settlement).catch(() => {});
    }).catch(() => {});
  },
  updateSalarySettlement: (id, settlement) => {
    set((state) => ({
      salarySettlements: state.salarySettlements.map(s => s.id === id ? { ...s, ...settlement } : s)
    }));
  },
  addCashMovement: (sessionId, movement) => {
    set((state) => ({
      cashSessions: state.cashSessions.map(s => 
        s.id === sessionId ? { ...s, movements: [...(s.movements || []), movement] } : s
      )
    }));
    const updated = get().cashSessions.find(s => s.id === sessionId);
    if (updated) {
      pushCashSessionToSupabase(updated).catch(() => {});
    }
  },

  transfers: [],
  addTransfer: (transfer) => {
    set((state) => ({
      transfers: [transfer, ...state.transfers]
    }));
    import('../services/supabaseSync').then(({ pushInventoryTransferToSupabase }) => {
      pushInventoryTransferToSupabase(transfer).catch(() => {});
    }).catch(() => {});
  },

  warranties: [],
  addWarranty: (warranty) => {
    set((state) => ({ warranties: [warranty, ...state.warranties] }));
    import('../services/supabaseSync').then(({ pushWarrantyToSupabase }) => {
      pushWarrantyToSupabase(warranty).catch(() => {});
    }).catch(() => {});
  },
  updateWarranty: (id, warranty) => {
    set((state) => ({
      warranties: state.warranties.map(w => w.id === id ? { ...w, ...warranty } : w)
    }));
    const updated = get().warranties.find(w => w.id === id);
    if (updated) {
      import('../services/supabaseSync').then(({ pushWarrantyToSupabase }) => {
        pushWarrantyToSupabase(updated).catch(() => {});
      }).catch(() => {});
    }
  },

  bankCards: INITIAL_BANK_CARDS,
  addBankCard: (card) => {
    set(state => {
      // Deduplicación por ID, Número de Cuenta o Nombre+Banco
      const isDuplicate = state.bankCards.some(c => 
        c.id === card.id || 
        (c.accountNumber && card.accountNumber && c.accountNumber === card.accountNumber) ||
        (c.name.toLowerCase().trim() === card.name.toLowerCase().trim() && c.bankName?.toLowerCase().trim() === card.bankName?.toLowerCase().trim())
      );
      if (isDuplicate) return state;
      return { bankCards: [...state.bankCards, card] };
    });
    pushBankCardToSupabase(card).catch(() => {});
  },
  updateBankCard: (id, card) => {
    set(state => {
      const updated = state.bankCards.map(c => c.id === id ? { ...c, ...card } : c);
      const found = updated.find(c => c.id === id);
      if (found) pushBankCardToSupabase(found).catch(() => {});
      return { bankCards: updated };
    });
  },
  deleteBankCard: (id) => {
    set(state => ({ bankCards: state.bankCards.filter(c => c.id !== id) }));
    deleteBankCardFromSupabase(id).catch(() => {});
  },

  bankTransactions: [],
  addBankTransaction: (transaction) => {
    set(state => {
      // 1. Strict anti-duplication check
      const isDuplicate = (state.bankTransactions || []).some(t => {
        if (t.id === transaction.id) return true;
        if (transaction.transactionId && t.transactionId && t.transactionId === transaction.transactionId) return true;
        if (transaction.reference && t.reference && t.reference === transaction.reference && t.cardId === transaction.cardId) return true;
        return false;
      });

      if (isDuplicate) {
        console.warn("[Bank] Duplicate bank transaction blocked:", transaction);
        return state;
      }

      const updatedCards = state.bankCards.map(card => {
        if (card.id === transaction.cardId) {
          let newBalance = card.balance;
          if (transaction.type === 'deposit' || transaction.type === 'payment_received') {
            newBalance += transaction.amount;
          } else if (transaction.type === 'withdrawal' || transaction.type === 'supplier_payment') {
            newBalance = Math.max(0, newBalance - transaction.amount);
          }
          const updatedCard = { ...card, balance: newBalance };
          pushBankCardToSupabase(updatedCard).catch(() => {});
          return updatedCard;
        }
        return card;
      });

      pushBankTransactionToSupabase(transaction).catch(() => {});
      return { 
        bankTransactions: [transaction, ...state.bankTransactions],
        bankCards: updatedCards
      };
    });
  },

  deleteBankTransaction: (id) => {
    set(state => {
      const txToDelete = (state.bankTransactions || []).find(t => t.id === id);
      if (!txToDelete) return state;

      // Adjust card balance
      const updatedCards = state.bankCards.map(card => {
        if (card.id === txToDelete.cardId) {
          let newBalance = card.balance;
          if (txToDelete.type === 'deposit' || txToDelete.type === 'payment_received') {
            // Deduct deposit amount from card balance
            newBalance = Math.max(0, newBalance - txToDelete.amount);
          } else if (txToDelete.type === 'withdrawal' || txToDelete.type === 'supplier_payment') {
            // Restore withdrawal amount to card balance
            newBalance = newBalance + txToDelete.amount;
          }
          const updatedCard = { ...card, balance: newBalance };
          pushBankCardToSupabase(updatedCard).catch(() => {});
          return updatedCard;
        }
        return card;
      });

      // Delete from Supabase
      deleteBankTransactionFromSupabase(id).catch(() => {});

      return {
        bankTransactions: state.bankTransactions.filter(t => t.id !== id),
        bankCards: updatedCards
      };
    });
  },

  reconcileBankBalances: async () => {
    const state = get();
    const seenIds = new Set<string>();
    const seenTxIds = new Set<string>();
    const seenRefs = new Set<string>();
    const uniqueTxs: import('../types').BankTransaction[] = [];
    let removedDuplicates = 0;

    // Filter duplicates preserving the most recent unique record
    for (const bt of state.bankTransactions || []) {
      const isDuplicate = seenIds.has(bt.id) || 
                          (bt.transactionId && seenTxIds.has(bt.transactionId)) ||
                          (bt.reference && seenRefs.has(`${bt.cardId}::${bt.reference}`));

      if (isDuplicate) {
        removedDuplicates++;
        // Si detectamos duplicado, intentar eliminar de Supabase para limpiar la nube también
        deleteBankTransactionFromSupabase(bt.id).catch(() => {});
        continue;
      }

      seenIds.add(bt.id);
      if (bt.transactionId) seenTxIds.add(bt.transactionId);
      if (bt.reference) seenRefs.add(`${bt.cardId}::${bt.reference}`);
      uniqueTxs.push(bt);
    }

    if (removedDuplicates > 0) {
      set({ bankTransactions: uniqueTxs });
    }

    const totalSales = state.transactions.length;
    const totalMovements = uniqueTxs.length;

    return {
      removedDuplicates,
      totalSales,
      totalMovements,
      message: `Reconciliación completada: Base de datos sincronizada con ${totalSales} ventas y ${totalMovements} movimientos bancarios verificados.${removedDuplicates > 0 ? ` Se eliminaron ${removedDuplicates} duplicados.` : ''}`
    };
  },

  syncWithSupabase: async () => {
    set({ isSyncing: true });
    try {
      const { data, result } = await pullAllFromSupabase();
      if (result.success && data) {
        set((state) => {
          // Helper para deduplicar arrays por ID o clave personalizada
          // AHORA ES ADITIVO: No descarta datos locales que no están en Supabase, 
          // simplemente prioriza Supabase para los conflictos de ID.
          const mergeUnique = <T extends Record<string, any>>(supabaseData: T[] | undefined, localData: T[], options?: { offlineIds?: Set<string | number>, semanticDedupe?: boolean, idKey?: string, semanticKeys?: string[] }): T[] => {
            const idKey = options?.idKey || 'id';
            const semanticKeys = options?.semanticKeys || (options?.semanticDedupe ? ['name'] : []);
            const map = new Map<string | number, T>();
            const semanticMap = new Map<string, string | number>(); 
            
            const getSemanticKey = (item: T): string | null => {
              if (semanticKeys.length === 0) return null;
              const values = semanticKeys.map(k => normalizeSemanticText(String(item[k] || ''))).filter(Boolean);
              return values.length > 0 ? values.join('::') : null;
            };

            // 1. Cargar TODOS los datos locales primero
            localData.forEach(item => {
              const sKey = getSemanticKey(item);
              if (sKey) {
                semanticMap.set(sKey, item[idKey]);
              }
              map.set(item[idKey], item);
            });
            
            // 2. Sobrescribir con datos de Supabase (la fuente de verdad principal)
            if (supabaseData) {
              supabaseData.forEach(item => {
                const sKey = getSemanticKey(item);
                if (sKey) {
                  const existingId = semanticMap.get(sKey);
                  if (existingId && existingId !== item[idKey]) {
                    map.delete(existingId);
                  }
                  semanticMap.set(sKey, item[idKey]);
                }
                
                // Si es una sesión de caja y localmente ya fue cerrada pero en la nube está abierta, preservar el estado cerrado
                if (item.status === 'open') {
                  const localItem = map.get(item[idKey]);
                  if (localItem && localItem.status === 'closed') {
                    map.set(item[idKey], {
                      ...item,
                      status: 'closed',
                      closedAt: localItem.closedAt || item.closed_at || new Date().toISOString(),
                      closingDate: localItem.closingDate || localItem.closedAt,
                      closingBalances: localItem.closingBalances || []
                    });
                    return;
                  }
                }

                map.set(item[idKey], item);
              });
            }
            
            return Array.from(map.values());
          };

          // --- 1. Sucursales ---
          const offlineQueuedBranchItems = getOfflineQueue().filter(i => i.type === 'branch');
          const offlineQueuedBranchIds = new Set(offlineQueuedBranchItems.map(i => i.data.id));
          
          const mergedBranches = mergeUnique(data.branches, state.branches || [], { 
            offlineIds: offlineQueuedBranchIds, 
            semanticDedupe: true,
            semanticKeys: ['name']
          });
          
          // Purge: Si recibimos datos de Supabase, eliminar locales que no estén en Supabase Y no estén en la cola offline
          const finalBranches = data.branches 
            ? mergedBranches.filter(b => 
                data.branches.some((sb: any) => sb.id === b.id) || 
                offlineQueuedBranchIds.has(b.id)
              )
            : mergedBranches;

          const validBranchIds = new Set(finalBranches.map(b => b.id));

          let nextBranchId = state.currentBranchId;
          if (!nextBranchId || !validBranchIds.has(nextBranchId)) {
            nextBranchId = finalBranches[0]?.id || '';
          }

          // --- 2. Transacciones ---
          const offlineQueuedTxIds = new Set(
            getOfflineQueue().filter(i => i.type === 'transaction').map(i => i.data.id)
          );
          const mergedTransactions = mergeUnique(data.transactions, state.transactions || [], { offlineIds: offlineQueuedTxIds });

          // --- 3. Sesiones ---
          const offlineQueuedSessionIds = new Set(
            getOfflineQueue().filter(i => i.type === 'cash_session').map(i => i.data.id)
          );
          const mergedCashSessions = mergeUnique(data.cashSessions, state.cashSessions || [], { offlineIds: offlineQueuedSessionIds });

          // --- 4. Clientes ---
          const offlineQueuedCustomerIds = new Set(
            getOfflineQueue().filter(i => i.type === 'customer').map(i => i.data.id)
          );
          const mergedCustomers = mergeUnique(data.customers, state.customers || [], { 
            offlineIds: offlineQueuedCustomerIds,
            semanticDedupe: true,
            semanticKeys: ['phone', 'email']
          });

          // --- 5. Devoluciones ---
          const offlineQueuedReturnIds = new Set(
            getOfflineQueue().filter(i => i.type === 'return').map(i => i.data.id)
          );
          const mergedReturns = mergeUnique(data.returns, state.returns || [], { offlineIds: offlineQueuedReturnIds });

          // --- 6. Inventario (Deduplicación por combinación única) ---
          const offlineQueuedInventory = getOfflineQueue()
            .filter(i => i.type === 'inventory')
            .map(i => i.data as InventoryLevel);
            
          const baseInv = data.inventory !== undefined ? data.inventory : state.inventory;
          const invMap = new Map<string, InventoryLevel>();
          
          // 1. Cargar inventario base (Supabase o Local si falló fetch)
          baseInv.forEach(inv => {
            const key = `${inv.productId}_${inv.branchId}_${inv.variantLabel || ''}`;
            invMap.set(key, inv);
          });
          
          // 2. Sobrescribir con cambios pendientes offline
          offlineQueuedInventory.forEach(inv => {
            const key = `${inv.productId}_${inv.branchId}_${inv.variantLabel || ''}`;
            invMap.set(key, inv);
          });
          
          // Purge Inventario: Si recibimos de Supabase, quitar los que no estén en Supabase y no estén en cola offline
          let mergedInventory = Array.from(invMap.values()).filter(inv => !inv.branchId || validBranchIds.has(inv.branchId));
          if (data.inventory) {
            const supabaseInvKeys = new Set(data.inventory.map((si: any) => `${si.product_id || si.productId}_${si.branch_id || si.branchId}_${si.variant_label || si.variantLabel || ''}`));
            const offlineInvKeys = new Set(offlineQueuedInventory.map(oi => `${oi.productId}_${oi.branchId}_${oi.variantLabel || ''}`));
            
            mergedInventory = mergedInventory.filter(inv => {
              const key = `${inv.productId}_${inv.branchId}_${inv.variantLabel || ''}`;
              return supabaseInvKeys.has(key) || offlineInvKeys.has(key);
            });
          }

          // --- 7. Otros (Deduplicación simple por ID o clave única) ---
          const mergedProducts = mergeUnique(data.products, state.products || [], {
            semanticDedupe: true,
            semanticKeys: ['sku', 'name']
          });
          // Purge Productos
          const finalProducts = data.products 
            ? mergedProducts.filter(p => data.products.some((sp: any) => sp.id === p.id))
            : mergedProducts;

          const mergedCategories = mergeUnique(data.categories, state.categories || [], { 
            semanticDedupe: true,
            semanticKeys: ['name']
          });
          // Purge Categorías
          const finalCategories = data.categories
            ? mergedCategories.filter(c => data.categories.some((sc: any) => sc.id === c.id))
            : mergedCategories;

          const mergedUsers = mergeUnique(data.users, state.users || [], {
            semanticDedupe: true,
            semanticKeys: ['email']
          });
          // Purge Users (except initial admins)
          const finalUsers = data.users
            ? mergedUsers.filter(u => data.users.some((su: any) => su.id === u.id) || u.id.startsWith('admin-') || u.id.startsWith('employee-'))
            : mergedUsers;

          const mergedBankCards = mergeUnique(data.bankCards, state.bankCards || [], {
            semanticDedupe: true,
            semanticKeys: ['accountNumber']
          });
          const mergedBankTransactions = mergeUnique(data.bankTransactions, state.bankTransactions || [], {
            idKey: 'id',
            semanticDedupe: true,
            semanticKeys: ['reference']
          });
          const mergedSuppliers = mergeUnique(data.suppliers, state.suppliers || []);
          const mergedSupplierOrders = mergeUnique(data.supplierOrders, state.supplierOrders || []);
          const mergedCurrencies = mergeUnique(data.currencies, state.currencies || [], { idKey: 'code' });
          const mergedTransfers = mergeUnique(data.transfers, state.transfers || []);
          const mergedWarranties = mergeUnique(data.warranties, state.warranties || []);
          const mergedQuotes = mergeUnique(data.quotes, state.quotes || []);
          const mergedTimeShifts = mergeUnique(data.timeShifts, state.timeShifts || []);
          const mergedSalarySettlements = mergeUnique(data.salarySettlements, state.salarySettlements || []);
          const mergedIdnSettlementPrices = mergeUnique(data.idnSettlementPrices, state.idnSettlementPrices || []);

          const updatedCurrentUser = state.currentUser
            ? (finalUsers.find((u: any) => u.id === state.currentUser?.id) || state.currentUser)
            : null;

          return {
            products: finalProducts,
            categories: finalCategories,
            inventory: mergedInventory,
            branches: finalBranches,
            currentBranchId: nextBranchId,
            users: finalUsers,
            currentUser: updatedCurrentUser,
            bankCards: mergedBankCards,
            bankTransactions: mergedBankTransactions,
            customers: mergedCustomers,
            suppliers: mergedSuppliers,
            supplierOrders: mergedSupplierOrders,
            currencies: mergedCurrencies,
            transactions: mergedTransactions,
            cashSessions: mergedCashSessions,
            transfers: mergedTransfers,
            warranties: mergedWarranties,
            returns: mergedReturns,
            quotes: mergedQuotes,
            timeShifts: mergedTimeShifts,
            salarySettlements: mergedSalarySettlements,
            idnSettlementPrices: mergedIdnSettlementPrices,
            receiptConfig: data.receiptConfig ? { ...state.receiptConfig, ...data.receiptConfig } : state.receiptConfig,
            storeConfig: data.storeConfig ? { ...state.storeConfig, ...data.storeConfig } : state.storeConfig,
            catalogConfig: data.catalogConfig ? { ...state.catalogConfig, ...data.catalogConfig } : state.catalogConfig,
            lastTurnNumber: data.lastTurnNumber !== undefined ? Math.max(state.lastTurnNumber, data.lastTurnNumber) : state.lastTurnNumber,
            lastSyncTime: new Date().toISOString(),
            syncResult: result,
            isSyncing: false
          };
        });
      } else {
        set({ isSyncing: false, syncResult: result });
      }
      if (result.success) {
        get().reconcileBankBalances().catch(() => {});
      }
      return result;
    } catch (e: any) {
      const errRes: SyncResult = { success: false, message: e?.message || 'Error al sincronizar con Supabase' };
      set({ isSyncing: false, syncResult: errRes });
      return errRes;
    }
  },

  seedDemoProducts: () => {
    set({
      products: INITIAL_PRODUCTS,
      inventory: INITIAL_INVENTORY,
      categories: INITIAL_CATEGORIES,
      branches: INITIAL_BRANCHES,
      bankCards: INITIAL_BANK_CARDS,
      currencies: INITIAL_CURRENCIES
    });
  },

  notifications: [],
  addNotification: (message, type = 'info') => {
    const id = crypto.randomUUID();
    set(state => ({
      notifications: [...state.notifications, { id, message, type }]
    }));
    setTimeout(() => {
      set(state => ({
        notifications: state.notifications.filter(n => n.id !== id)
      }));
    }, 4000);
  },
  removeNotification: (id) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }));
  },

  isInitialized: true
}),
{
  name: 'pos-store-storage',
}
));
