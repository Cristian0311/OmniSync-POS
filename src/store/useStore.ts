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
  pushSupplierToSupabase, deleteSupplierFromSupabase, pushSupplierOrderToSupabase
} from '../services/supabaseSync';
import { getSupabaseCredentials } from '../lib/supabase';

// --- Datos Iniciales y Catálogo Pre-cargado ---
const INITIAL_USERS: User[] = [
  {
    id: 'admin-1',
    name: 'Administrador Cristian',
    email: 'cristianmarco2003@gmail.com',
    role: 'admin',
    password: '03111166702',
    baseSalary: 25000,
    salesGoal: 1000000,
    branchId: 'b-central',
    allowedBranches: ['b-central', 'b-almacen-1', 'b-vedado', 'b-playa'],
    permissions: ['pos_access', 'reports_access', 'inventory_access', 'admin_access', 'cash_audit'],
    isActive: true
  },
  {
    id: 'employee-1',
    name: 'Trabajador General',
    email: 'trabajador@gmail.com',
    role: 'employee',
    password: '03111166702',
    baseSalary: 12000,
    salesGoal: 350000,
    branchId: 'b-central',
    allowedBranches: ['b-central', 'b-vedado'],
    permissions: ['pos_access'],
    isActive: true
  },
  {
    id: 'user-alejandro',
    name: 'Alejandro Martínez',
    email: 'alejandro.vedado@gmail.com',
    role: 'employee',
    password: '03111166702',
    baseSalary: 16000,
    salesGoal: 500000,
    branchId: 'b-vedado',
    allowedBranches: ['b-vedado'],
    permissions: ['pos_access'],
    isActive: true
  },
  {
    id: 'user-beatriz',
    name: 'Beatriz Navarro',
    email: 'beatriz.central@gmail.com',
    role: 'employee',
    password: '03111166702',
    baseSalary: 15000,
    salesGoal: 450000,
    branchId: 'b-central',
    allowedBranches: ['b-central'],
    permissions: ['pos_access'],
    isActive: true
  }
];

const INITIAL_BRANCHES: Branch[] = [
  { id: 'b-central', name: 'Sucursal Principal', address: 'Calle Principal', phone: '+53 5200-1122', isMain: true }
];

const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-telefonia', name: 'Smartphones y Telefonía', department: 'Dispositivos' },
  { id: 'cat-accesorios', name: 'Accesorios y Audio', department: 'Electrónica' },
  { id: 'cat-computo', name: 'Laptops e Informática', department: 'Computación' },
  { id: 'cat-repuestos', name: 'Repuestos y Baterías', department: 'Taller' },
  { id: 'cat-servicios', name: 'Servicios Técnicos y Software', department: 'Servicios' }
];

const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-ip15pm',
    name: 'iPhone 15 Pro Max 256GB Titanio Natural',
    sku: 'IP15PM-256-NAT',
    barcode: '195949038291',
    costPrice: 285000,
    price: 340000,
    margin: 19.3,
    categoryId: 'cat-telefonia',
    color: 'bg-slate-600',
    commissionValue: 3000,
    unit: 'unidad',
    status: 'active',
    minStockAlert: 3,
    hasSerial: true,
    warrantyDays: 90,
    isKit: false,
    deviceColor: 'Titanio Natural',
    availableSizes: ['256GB', '512GB', '1TB'],
    availableColors: ['Natural', 'Azul', 'Negro', 'Blanco']
  },
  {
    id: 'prod-s24u',
    name: 'Samsung Galaxy S24 Ultra 512GB Gray',
    sku: 'S24U-512-GRY',
    barcode: '880609538192',
    costPrice: 260000,
    price: 315000,
    margin: 21.15,
    categoryId: 'cat-telefonia',
    color: 'bg-zinc-700',
    commissionValue: 2500,
    unit: 'unidad',
    status: 'active',
    minStockAlert: 3,
    hasSerial: true,
    warrantyDays: 90,
    isKit: false,
    deviceColor: 'Titanium Gray',
    availableSizes: ['256GB', '512GB'],
    availableColors: ['Gray', 'Black', 'Violet']
  },
  {
    id: 'prod-rn13p',
    name: 'Xiaomi Redmi Note 13 Pro+ 5G 256GB',
    sku: 'RN13P-256-BLK',
    barcode: '694181275482',
    costPrice: 68000,
    price: 88000,
    margin: 29.41,
    categoryId: 'cat-telefonia',
    color: 'bg-purple-600',
    commissionValue: 1500,
    unit: 'unidad',
    status: 'active',
    minStockAlert: 5,
    hasSerial: true,
    warrantyDays: 60,
    isKit: false,
    deviceColor: 'Midnight Black',
    availableSizes: ['256GB', '512GB'],
    availableColors: ['Midnight Black', 'Aurora Purple']
  },
  {
    id: 'prod-airpods2',
    name: 'Apple AirPods Pro (2da Generación USB-C)',
    sku: 'APP2-USBC-WHT',
    barcode: '195949052679',
    costPrice: 46000,
    price: 62000,
    margin: 34.78,
    categoryId: 'cat-accesorios',
    color: 'bg-emerald-600',
    commissionValue: 1000,
    unit: 'unidad',
    status: 'active',
    minStockAlert: 5,
    hasSerial: true,
    warrantyDays: 30,
    isKit: false,
    deviceColor: 'Blanco',
    availableSizes: ['Estándar'],
    availableColors: ['Blanco']
  },
  {
    id: 'prod-charger20w',
    name: 'Cargador Rápido 20W USB-C Power Delivery',
    sku: 'CHG-20W-PD',
    barcode: '742701928374',
    costPrice: 2200,
    price: 4800,
    margin: 118.18,
    categoryId: 'cat-accesorios',
    color: 'bg-blue-500',
    commissionValue: 200,
    unit: 'unidad',
    status: 'active',
    minStockAlert: 15,
    hasSerial: false,
    warrantyDays: 30,
    isKit: false,
    deviceColor: 'Blanco',
    availableSizes: ['20W', '35W'],
    availableColors: ['Blanco', 'Negro']
  },
  {
    id: 'prod-cable-c',
    name: 'Cable USB-C a USB-C Trenzado 60W 2 Metros',
    sku: 'CBL-CC-2M-BLK',
    barcode: '742701928481',
    costPrice: 1100,
    price: 2600,
    margin: 136.36,
    categoryId: 'cat-accesorios',
    color: 'bg-amber-600',
    commissionValue: 150,
    unit: 'unidad',
    status: 'active',
    minStockAlert: 20,
    hasSerial: false,
    warrantyDays: 15,
    isKit: false,
    deviceColor: 'Negro',
    availableSizes: ['1m', '2m'],
    availableColors: ['Negro', 'Gris']
  },
  {
    id: 'prod-case-mag',
    name: 'Funda Case MagSafe Silicona ShockProof',
    sku: 'CS-MAG-SIL',
    barcode: '742701928599',
    costPrice: 1400,
    price: 3500,
    margin: 150.0,
    categoryId: 'cat-accesorios',
    color: 'bg-rose-500',
    commissionValue: 200,
    unit: 'unidad',
    status: 'active',
    minStockAlert: 20,
    hasSerial: false,
    warrantyDays: 7,
    isKit: false,
    deviceColor: 'Transparente',
    availableSizes: ['iPhone 15 Pro Max', 'iPhone 15 Pro'],
    availableColors: ['Transparente', 'Negro Mate', 'Azul Marino']
  },
  {
    id: 'prod-glass-9d',
    name: 'Protector Cerámico Cristal Templado 9D',
    sku: 'GLS-9D-PRIV',
    barcode: '742701928612',
    costPrice: 700,
    price: 1900,
    margin: 171.42,
    categoryId: 'cat-accesorios',
    color: 'bg-indigo-500',
    commissionValue: 100,
    unit: 'unidad',
    status: 'active',
    minStockAlert: 25,
    hasSerial: false,
    warrantyDays: 7,
    isKit: false,
    deviceColor: 'Privacidad',
    availableSizes: ['Full Cover'],
    availableColors: ['Transparente', 'Privacidad']
  },
  {
    id: 'prod-bat-ip11',
    name: 'Batería Reemplazo Original iPhone 11 (3110 mAh)',
    sku: 'BAT-IP11-OEM',
    barcode: '742701928723',
    costPrice: 5800,
    price: 11500,
    margin: 98.27,
    categoryId: 'cat-repuestos',
    color: 'bg-teal-600',
    commissionValue: 600,
    unit: 'unidad',
    status: 'active',
    minStockAlert: 8,
    hasSerial: true,
    warrantyDays: 60,
    isKit: false,
    deviceColor: 'OEM',
    availableSizes: ['3110 mAh'],
    availableColors: ['Estándar']
  },
  {
    id: 'prod-serv-maint',
    name: 'Servicio Mantenimiento General y Cambio de Pasta',
    sku: 'SRV-MAINT-GEN',
    barcode: '000000000001',
    costPrice: 600,
    price: 4500,
    margin: 650.0,
    categoryId: 'cat-servicios',
    color: 'bg-violet-600',
    commissionValue: 500,
    unit: 'servicio',
    status: 'active',
    minStockAlert: 1,
    hasSerial: false,
    warrantyDays: 15,
    isKit: false,
    deviceColor: 'Taller',
    availableSizes: ['Completo'],
    availableColors: ['N/A']
  }
];

const INITIAL_INVENTORY: InventoryLevel[] = [
  { id: 'inv-1', productId: 'prod-ip15pm', branchId: 'b-central', variantLabel: '256GB - Natural', quantity: 8, minQuantity: 2 },
  { id: 'inv-2', productId: 'prod-s24u', branchId: 'b-central', variantLabel: '512GB - Gray', quantity: 6, minQuantity: 2 },
  { id: 'inv-3', productId: 'prod-rn13p', branchId: 'b-central', variantLabel: '256GB - Black', quantity: 14, minQuantity: 3 },
  { id: 'inv-4', productId: 'prod-airpods2', branchId: 'b-central', variantLabel: 'Estándar', quantity: 12, minQuantity: 3 },
  { id: 'inv-5', productId: 'prod-charger20w', branchId: 'b-central', variantLabel: '20W - Blanco', quantity: 45, minQuantity: 10 },
  { id: 'inv-6', productId: 'prod-cable-c', branchId: 'b-central', variantLabel: '2m - Negro', quantity: 60, minQuantity: 15 },
  { id: 'inv-7', productId: 'prod-case-mag', branchId: 'b-central', variantLabel: 'iPhone 15 Pro Max', quantity: 35, minQuantity: 8 },
  { id: 'inv-8', productId: 'prod-glass-9d', branchId: 'b-central', variantLabel: 'Full Cover', quantity: 75, minQuantity: 15 },
  { id: 'inv-9', productId: 'prod-bat-ip11', branchId: 'b-central', variantLabel: '3110 mAh', quantity: 10, minQuantity: 2 },
  { id: 'inv-10', productId: 'prod-serv-maint', branchId: 'b-central', variantLabel: 'Servicio', quantity: 999, minQuantity: 1 },

  // Almacén Berroa
  { id: 'inv-11', productId: 'prod-ip15pm', branchId: 'b-almacen-1', variantLabel: '256GB - Natural', quantity: 25, minQuantity: 5 },
  { id: 'inv-12', productId: 'prod-s24u', branchId: 'b-almacen-1', variantLabel: '512GB - Gray', quantity: 20, minQuantity: 5 },
  { id: 'inv-13', productId: 'prod-rn13p', branchId: 'b-almacen-1', variantLabel: '256GB - Black', quantity: 40, minQuantity: 10 },
  { id: 'inv-14', productId: 'prod-airpods2', branchId: 'b-almacen-1', variantLabel: 'Estándar', quantity: 30, minQuantity: 5 },
  { id: 'inv-15', productId: 'prod-charger20w', branchId: 'b-almacen-1', variantLabel: '20W - Blanco', quantity: 150, minQuantity: 25 },
  { id: 'inv-16', productId: 'prod-cable-c', branchId: 'b-almacen-1', variantLabel: '2m - Negro', quantity: 200, minQuantity: 30 },
  { id: 'inv-17', productId: 'prod-case-mag', branchId: 'b-almacen-1', variantLabel: 'iPhone 15 Pro Max', quantity: 120, minQuantity: 20 },
  { id: 'inv-18', productId: 'prod-glass-9d', branchId: 'b-almacen-1', variantLabel: 'Full Cover', quantity: 300, minQuantity: 50 },
  { id: 'inv-19', productId: 'prod-bat-ip11', branchId: 'b-almacen-1', variantLabel: '3110 mAh', quantity: 50, minQuantity: 10 },

  // Vedado & Playa
  { id: 'inv-20', productId: 'prod-ip15pm', branchId: 'b-vedado', variantLabel: '256GB - Natural', quantity: 4, minQuantity: 1 },
  { id: 'inv-21', productId: 'prod-charger20w', branchId: 'b-vedado', variantLabel: '20W - Blanco', quantity: 25, minQuantity: 5 },
  { id: 'inv-22', productId: 'prod-ip15pm', branchId: 'b-playa', variantLabel: '256GB - Natural', quantity: 5, minQuantity: 1 },
  { id: 'inv-23', productId: 'prod-charger20w', branchId: 'b-playa', variantLabel: '20W - Blanco', quantity: 30, minQuantity: 5 }
];

const INITIAL_BANK_CARDS: BankCard[] = [
  {
    id: 'bc-cup-bpa',
    bankName: 'BPA Transfermóvil (CUP)',
    cardHolder: 'MARÉ INVERSIONES S.U.R.L',
    lastFourDigits: '8910',
    currency: 'CUP',
    balance: 350000,
    color: 'from-blue-600 to-indigo-800',
    isActive: true
  },
  {
    id: 'bc-cup-bandec',
    bankName: 'BANDEC EnZona (CUP)',
    cardHolder: 'MARÉ INVERSIONES S.U.R.L',
    lastFourDigits: '4421',
    currency: 'CUP',
    balance: 185000,
    color: 'from-cyan-600 to-blue-700',
    isActive: true
  },
  {
    id: 'bc-cup-banmet',
    bankName: 'BANMET Pago Móvil (CUP)',
    cardHolder: 'MARÉ COMERCIAL',
    lastFourDigits: '6732',
    currency: 'CUP',
    balance: 95000,
    color: 'from-indigo-600 to-purple-800',
    isActive: true
  },
  {
    id: 'bc-usd-mlc',
    bankName: 'BPA Cuenta MLC / USD',
    cardHolder: 'MARÉ IMPORT & EXPORT',
    lastFourDigits: '1234',
    currency: 'USD',
    balance: 4250,
    color: 'from-emerald-600 to-teal-800',
    isActive: true
  }
];

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
  transferInventory: (productId: string, fromBranchId: string, toBranchId: string, quantity: number, variantLabel?: string) => Promise<{ success: boolean; error?: string } | boolean>;
  transferInventoryBatch: (productId: string, fromBranchId: string, toBranchId: string, variants: { variantLabel: string; quantity: number }[]) => Promise<{ success: boolean; error?: string }>;
  reconcileProductStock: (productId: string, corrections: { branchId: string; variantLabel?: string; quantity: number; minQuantity?: number }[]) => Promise<{ success: boolean; error?: string }>;
  repairOrphanedInventoryLevels: () => Promise<{ repaired: number; message: string }>;
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
  closeSession: (sessionId: string, closingBalances: import('../types').Payment[], workerName?: string, closingDate?: string) => void;
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

  // Supabase Sync
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncResult: SyncResult | null;
  syncWithSupabase: () => Promise<SyncResult>;
  seedDemoProducts: () => void;

  isInitialized: boolean;
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
    let user = get().users.find(u => 
      ((u.email || '').trim().toLowerCase() === cleanIdentifier || (u.name || '').trim().toLowerCase() === cleanIdentifier) && 
      u.password === pass
    );
    
    // Hardcoded accounts requested by the user
    if (!user) {
      if (cleanIdentifier === 'cristianmarco2003@gmail.com' && pass === '03111166702') {
        user = {
          id: 'admin-1',
          name: 'Administrador',
          email: 'cristianmarco2003@gmail.com',
          role: 'admin',
          baseSalary: 0
        };
      } else if (cleanIdentifier === 'trabajador@gmail.com' && pass === '03111166702') {
        user = {
          id: 'employee-1',
          name: 'Trabajador',
          email: 'trabajador@gmail.com',
          role: 'employee',
          baseSalary: 0
        };
      }
    }

    if (user) {
      set({ currentUser: user });
      
      // If the hardcoded user logs in and we have branches, auto-assign the first one if they don't have one
      if (user.isIndependent && user.assignedBranchId) {
        set({ currentBranchId: user.assignedBranchId });
      } else if (!user.branchId && (get().branches || []).length > 0) {
        set({ currentBranchId: (get().branches || [])[0].id });
      } else if (user.branchId) {
        set({ currentBranchId: user.branchId });
      }
      
      return true;
    }
    return false;
  },
  logout: () => set({ currentUser: null }),
  clearAllData: async () => {
    // 1. Clear Supabase
    await clearSupabaseData();

    // 2. Reset local state to absolute minimal (only first admin and main branch)
    const minUsers = [INITIAL_USERS[0]];
    const minBranches = [INITIAL_BRANCHES[0]];
    
    set({
      users: minUsers,
      idnSettlementPrices: [],
      currentUser: null,
      branches: minBranches,
      currentBranchId: minBranches[0]?.id || '',
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
    await pushBranchToSupabase(minBranches[0]);
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
  
  storeConfig: { storeName: 'Mi Tienda POS', address: 'Calle Principal 123', phone: '+53 51234567', receiptNotes: '¡Gracias por su compra!' },
  
  updateStoreConfig: (config) => {
    set({ storeConfig: config });
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
  currentBranchId: INITIAL_BRANCHES[0].id,
  setCurrentBranch: (id) => set({ currentBranchId: id, cart: [] }),
  addBranch: (branch) => {
    set((state) => ({ branches: [...state.branches, branch] }));
    pushBranchToSupabase(branch);
  },
  updateBranch: (id, branch) => {
    set((state) => ({
      branches: state.branches.map(b => b.id === id ? { ...b, ...branch } : b)
    }));
    const updated = get().branches.find(b => b.id === id);
    if (updated) pushBranchToSupabase(updated);
  },
  deleteBranch: (id) => {
    set((state) => {
      if (state.branches.length === 1) {
        alert("No puedes eliminar la única sucursal.");
        return state;
      }
      const newBranches = state.branches.filter(b => b.id !== id);
      return {
        branches: newBranches,
        currentBranchId: state.currentBranchId === id ? newBranches[0].id : state.currentBranchId
      };
    });
    deleteBranchFromSupabase(id);
  },
  
  categories: INITIAL_CATEGORIES,
  addCategory: (category) => {
    set((state) => ({ categories: [...state.categories, category] }));
    pushCategoryToSupabase(category);
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

    set((state) => ({
      products: [product, ...state.products],
      inventory: [...state.inventory, ...newInventoryEntries]
    }));

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
  transferInventory: async (productId, fromBranchId, toBranchId, quantity, variantLabel) => {
    const res = await get().transferInventoryBatch(
      productId,
      fromBranchId,
      toBranchId,
      [{ variantLabel: variantLabel || '', quantity }]
    );
    return res.success;
  },

  transferInventoryBatch: async (productId, fromBranchId, toBranchId, variants) => {
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

    const transferRecord: InventoryTransfer = {
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
      userId: (get().currentUser?.id && get().users.some(u => u.id === get().currentUser?.id)) ? get().currentUser!.id : undefined,
      status: 'completed',
      variantLabel: variantSummary
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
  processTransaction: (transaction) => {
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

      // Push transaction to Supabase asynchronously
      pushTransactionToSupabase(newTransaction).catch(() => {});

      // Push updated inventory items to Supabase
      transaction.items.forEach(item => {
        const inv = updatedInventory.find(i => 
          i.productId === (item.product?.id || item.product) && 
          i.branchId === transaction.branchId &&
          (i.variantLabel || '') === (item.variantLabel || '')
        );
        if (inv) pushInventoryToSupabase(inv).catch(() => {});
      });

      return {
        transactions: [newTransaction, ...state.transactions],
        inventory: updatedInventory,
        warranties: [...newWarranties, ...state.warranties],
        cart: [],
        currentCustomerId: undefined
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
    set((state) => ({ customers: [...state.customers, customer] }));
  },
  updateCustomer: (id, customer) => {
    set((state) => ({
      customers: state.customers.map(c => c.id === id ? { ...c, ...customer } : c)
    }));
  },
  deleteCustomer: (id) => {
    set((state) => ({
      customers: state.customers.filter(c => c.id !== id),
      currentCustomerId: state.currentCustomerId === id ? undefined : state.currentCustomerId
    }));
  },

  cashSessions: [],
  openSession: (session) => {
    const existingSessions = get().cashSessions || [];
    let maxTurn = 0;
    existingSessions.forEach(s => {
      const match = s.id?.match(/^Turno-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxTurn) maxTurn = num;
      }
    });
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
      lastTurnNumber: nextTurn
    }));
  },
  closeSession: (sessionId, closingBalances, workerName, closingDate) => {
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
    const totalSalary = baseSalary + commissions;

    const finalSellerName = workerName || session.workerName || user?.name || 'Vendedor';

    const settlement: SalarySettlement = {
      id: crypto.randomUUID(),
      userId: session.userId,
      userName: finalSellerName,
      sessionId: sessionId,
      baseSalary: baseSalary,
      commissions: commissions,
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
      closingDate: finalClosingDate
    };

    set((state) => ({
      cashSessions: (state.cashSessions || []).map(s => 
        s.id === sessionId ? updatedSession : s
      ),
      salarySettlements: [...(state.salarySettlements || []), settlement]
    }));

    pushCashSessionToSupabase(updatedSession).catch(() => {});
  },
  getCurrentSession: (branchId, userId) => {
    const sessions = get().cashSessions || [];
    // 1. Check exact match by branch and user or workingEmployeeIds
    if (branchId && userId) {
      const match = sessions.find(s => s.branchId === branchId && (s.userId === userId || s.workingEmployeeIds?.includes(userId)) && s.status === 'open');
      if (match) return match;
    }
    // 2. Check open session in current branch
    if (branchId) {
      const branchSession = sessions.find(s => s.branchId === branchId && s.status === 'open');
      if (branchSession) return branchSession;
    }
    // 3. Fallback to any open session across branches
    return sessions.find(s => s.status === 'open');
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

  bankCards: [
    {
      id: 'bank-1',
      name: 'Tarjeta CUP Principal',
      bank: 'Banco Metropolitano',
      accountNumber: '9225 1234 5678 9012',
      phone: '5351234567',
      balance: 50000,
      currency: 'CUP',
      isActive: true
    },
    {
      id: 'bank-2',
      name: 'Tarjeta USD/MLC',
      bank: 'BANDEC',
      accountNumber: '9202 8765 4321 0987',
      phone: '5357654321',
      balance: 1500,
      currency: 'USD',
      isActive: true
    }
  ],
  addBankCard: (card) => {
    set(state => ({ bankCards: [...state.bankCards, card] }));
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
      const updatedCards = state.bankCards.map(card => {
        if (card.id === transaction.cardId) {
          let newBalance = card.balance;
          if (transaction.type === 'deposit' || transaction.type === 'payment_received') {
            newBalance += transaction.amount;
          } else if (transaction.type === 'withdrawal' || transaction.type === 'supplier_payment') {
            newBalance -= transaction.amount;
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

  syncWithSupabase: async () => {
    set({ isSyncing: true });
    try {
      const { data, result } = await pullAllFromSupabase();
      if (result.success && data) {
        set((state) => {
          // Fusionar sucursales
          const supBranches = data.branches && data.branches.length > 0 ? data.branches : state.branches;
          const mergedBranches = [...supBranches];
          state.branches.forEach(localB => {
            if (!mergedBranches.some(b => b.id === localB.id)) {
              mergedBranches.push(localB);
              pushBranchToSupabase(localB).catch(() => {});
            }
          });

          // Fusionar inventarios por almacén/variante
          const supInv = data.inventory || [];
          const mergedInventory = [...supInv];
          state.inventory.forEach(localInv => {
            const existsInSup = supInv.some(s => 
              s.productId === localInv.productId && 
              s.branchId === localInv.branchId && 
              (s.variantLabel || '') === (localInv.variantLabel || '')
            );
            if (!existsInSup) {
              mergedInventory.push(localInv);
              pushInventoryToSupabase(localInv).catch(() => {});
            }
          });

          return {
            products: data.products && data.products.length > 0 ? data.products : state.products,
            categories: data.categories && data.categories.length > 0 ? data.categories : state.categories,
            inventory: mergedInventory,
            branches: mergedBranches,
            users: data.users && data.users.length > 0 ? data.users : state.users,
            bankCards: data.bankCards && data.bankCards.length > 0 ? data.bankCards : state.bankCards,
            customers: data.customers && data.customers.length > 0 ? data.customers : state.customers,
            suppliers: data.suppliers && data.suppliers.length > 0 ? data.suppliers : state.suppliers,
            supplierOrders: data.supplierOrders && data.supplierOrders.length > 0 ? data.supplierOrders : state.supplierOrders,
            currencies: data.currencies && data.currencies.length > 0 ? data.currencies : state.currencies,
            transactions: data.transactions && data.transactions.length > 0 ? data.transactions : state.transactions,
            cashSessions: data.cashSessions && data.cashSessions.length > 0 ? data.cashSessions : state.cashSessions,
            transfers: data.transfers && data.transfers.length > 0 ? data.transfers : state.transfers,
            warranties: data.warranties && data.warranties.length > 0 ? data.warranties : state.warranties,
            returns: data.returns && data.returns.length > 0 ? data.returns : state.returns,
            quotes: data.quotes && data.quotes.length > 0 ? data.quotes : state.quotes,
            timeShifts: data.timeShifts && data.timeShifts.length > 0 ? data.timeShifts : state.timeShifts,
            salarySettlements: data.salarySettlements && data.salarySettlements.length > 0 ? data.salarySettlements : state.salarySettlements,
            idnSettlementPrices: data.idnSettlementPrices && data.idnSettlementPrices.length > 0 ? data.idnSettlementPrices : state.idnSettlementPrices,
            lastSyncTime: new Date().toISOString(),
            syncResult: result,
            isSyncing: false
          };
        });
        // Purgar y asegurar que los registros locales existan en Supabase
        pushAllToSupabase().catch(() => {});
      } else {
        set({ isSyncing: false, syncResult: result });
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

  isInitialized: true
}),
{
  name: 'pos-store-storage',
}
));
