import { create } from 'zustand';
import { Branch, Category, Product, InventoryLevel, CartItem, Transaction, ReturnItem, Currency, Customer, CashRegisterSession, User, PendingOrder, SalarySettlement, InventoryTransfer, Warranty, CashMovement, Supplier, SupplierOrder, InventoryAudit, FiscalConfig, DemandForecast } from '../types';
import { generateId, generateReadableId } from '../lib/utils';

// --- Datos Iniciales ---
const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'Administrador', email: 'admin@tienda.com', role: 'admin', password: 'admin', commissionRate: 0, baseSalary: 1000 },
];

const INITIAL_FISCAL_CONFIGS: FiscalConfig[] = [
  { id: 'fc1', type: 'B01', name: 'Crédito Fiscal', prefix: 'B01', current: 1, limit: 1000, active: true },
  { id: 'fc2', type: 'B02', name: 'Consumo', prefix: 'B02', current: 1, limit: 10000, active: true },
];

const INITIAL_CURRENCIES: Currency[] = [
  { code: 'CUP', name: 'Peso Cubano', symbol: 'CUP', rateToBase: 1, isBase: true },
  { code: 'USD', name: 'Dólar Estadounidense', symbol: '$', rateToBase: 320 },
  { code: 'EUR', name: 'Euro', symbol: '€', rateToBase: 350 },
];

const INITIAL_BRANCHES: Branch[] = [
  { id: 'b1', name: 'Principal' }
];

const INITIAL_CATEGORIES: Category[] = [
  { id: 'c1', name: 'Neveras', department: 'Electrodomésticos' },
  { id: 'c2', name: 'Lavadoras', department: 'Electrodomésticos' },
  { id: 'c3', name: 'Cocinas', department: 'Electrodomésticos' },
  { id: 'c4', name: 'Herramientas', department: 'Ferretería' },
  { id: 'c5', name: 'Tornillería', department: 'Ferretería' },
  { id: 'c6', name: 'Pinturas', department: 'Ferretería' },
  { id: 'c7', name: 'Ropa', department: 'Textil' },
  { id: 'c8', name: 'Sábanas', department: 'Textil' },
  { id: 'c9', name: 'Zapatos', department: 'Calzado' },
  { id: 'c10', name: 'Sandalias', department: 'Calzado' },
  { id: 'c11', name: 'Jabones', department: 'Higiene' },
  { id: 'c12', name: 'Champús', department: 'Higiene' },
  { id: 'c13', name: 'Granos', department: 'Alimentos' },
  { id: 'c14', name: 'Enlatados', department: 'Alimentos' },
  { id: 'c15', name: 'Refrescos', department: 'Bebidas' },
  { id: 'c16', name: 'Licores', department: 'Bebidas' },
  { id: 'c17', name: 'Sillas', department: 'Muebles' },
  { id: 'c18', name: 'Mesas', department: 'Muebles' },
  { id: 'c19', name: 'Celulares', department: 'Telefonía' },
  { id: 'c20', name: 'Accesorios', department: 'Telefonía' },
  { id: 'c21', name: 'Laptops', department: 'Computación' },
  { id: 'c22', name: 'Mouse', department: 'Computación' },
  { id: 'c23', name: 'Juegos de mesa', department: 'Juguetería' },
  { id: 'c24', name: 'Cuadernos', department: 'Librería' },
];

// --- Definición del Store ---
interface AppState {
  // Offline Architecture
  isOffline: boolean;
  pendingSyncTransactions: Transaction[];
  setOfflineStatus: (status: boolean) => void;
  syncPendingTransactions: () => void;

  // Auth
  users: User[];
  currentUser: User | null;
  login: (email: string, pass: string) => boolean;
  logout: () => void;
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
  transferInventory: (productId: string, fromBranchId: string, toBranchId: string, quantity: number, variantLabel?: string) => boolean;
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
}

export const useStore = create<AppState>((set, get) => ({
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
  addUser: (user) => set((state) => ({ users: [...state.users, user] })),
  updateUser: (id, user) => set((state) => ({
    users: state.users.map(u => u.id === id ? { ...u, ...user } : u)
  })),
  deleteUser: (id) => set((state) => ({
    users: state.users.filter(u => u.id !== id)
  })),

  currencies: INITIAL_CURRENCIES,
  updateCurrencyRate: (code, newRate) => set((state) => ({
    currencies: state.currencies.map(c => c.code === code ? { ...c, rateToBase: newRate } : c)
  })),
  getBaseCurrency: () => get().currencies.find(c => c.isBase) || get().currencies[0],
  
  storeConfig: { storeName: 'Mi Tienda POS', address: 'Calle Principal 123', phone: '+53 51234567', receiptNotes: '¡Gracias por su compra!' },
  updateStoreConfig: (config) => set({ storeConfig: config }),

  catalogConfig: { themeColor: '#4f46e5', bannerText: '¡Bienvenidos a nuestra tienda virtual!', whatsappNumber: '+5351234567', showPrices: true },
  updateCatalogConfig: (config) => set({ catalogConfig: config }),

  branches: INITIAL_BRANCHES,
  currentBranchId: INITIAL_BRANCHES[0].id,
  setCurrentBranch: (id) => set({ currentBranchId: id, cart: [] }),
  addBranch: (branch) => set((state) => ({ branches: [...state.branches, branch] })),
  updateBranch: (id, branch) => set((state) => ({
    branches: state.branches.map(b => b.id === id ? { ...b, ...branch } : b)
  })),
  deleteBranch: (id) => set((state) => {
    if (state.branches.length === 1) {
      alert("No puedes eliminar la única sucursal.");
      return state;
    }
    const newBranches = state.branches.filter(b => b.id !== id);
    return {
      branches: newBranches,
      currentBranchId: state.currentBranchId === id ? newBranches[0].id : state.currentBranchId
    };
  }),
  
  categories: INITIAL_CATEGORIES,
  addCategory: (category) => set((state) => ({ categories: [...state.categories, category] })),
  updateCategory: (id, category) => set((state) => ({
    categories: state.categories.map(c => c.id === id ? { ...c, ...category } : c)
  })),
  deleteCategory: (id) => set((state) => ({ categories: state.categories.filter(c => c.id !== id) })),
  
  products: [],
  inventory: [],
  addProduct: (product, initialQuantity, branchId, variantLabel, initialVariantQuantities) => set((state) => {
    const targetBranch = branchId || state.currentBranchId;
    let newInventory = [...state.inventory];
    
    if (initialVariantQuantities && Object.keys(initialVariantQuantities).length > 0) {
      Object.entries(initialVariantQuantities).forEach(([vLabel, qty]) => {
        if (qty > 0) {
          newInventory.push({ productId: product.id, branchId: targetBranch, quantity: qty, minQuantity: 5, variantLabel: vLabel });
        }
      });
    } else if (initialQuantity && initialQuantity > 0) {
      newInventory.push({ productId: product.id, branchId: targetBranch, quantity: initialQuantity, minQuantity: 5, variantLabel });
    }

    return {
      products: [product, ...state.products],
      inventory: newInventory
    };
  }),
  updateProduct: (id, product) => set((state) => ({
    products: state.products.map(p => p.id === id ? { ...p, ...product } : p)
  })),
  deleteProduct: (id) => set((state) => ({
    products: state.products.filter(p => p.id !== id),
    inventory: state.inventory.filter(i => i.productId !== id)
  })),
  transferInventory: (productId, fromBranchId, toBranchId, quantity, variantLabel) => {
    let success = false;
    set((state) => {
      const newInventory = [...state.inventory];
      
      const sourceIdx = newInventory.findIndex(i => i.productId === productId && i.branchId === fromBranchId && i.variantLabel === variantLabel);
      if (sourceIdx !== -1 && newInventory[sourceIdx].quantity >= quantity) {
        newInventory[sourceIdx] = { ...newInventory[sourceIdx], quantity: newInventory[sourceIdx].quantity - quantity };
        
        const targetIdx = newInventory.findIndex(i => i.productId === productId && i.branchId === toBranchId && i.variantLabel === variantLabel);
        if (targetIdx !== -1) {
          newInventory[targetIdx] = { ...newInventory[targetIdx], quantity: newInventory[targetIdx].quantity + quantity };
        } else {
          newInventory.push({ productId, branchId: toBranchId, quantity, minQuantity: 5, variantLabel });
        }
        success = true;
      }
      
      return { inventory: newInventory };
    });

    if (success) {
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
    }
    return success;
  },
  batchDeleteProducts: (ids) => set((state) => ({
    products: state.products.filter(p => !ids.includes(p.id)),
    inventory: state.inventory.filter(i => !ids.includes(i.productId))
  })),
  batchUpdateProducts: (ids, updates) => set((state) => ({
    products: state.products.map(p => ids.includes(p.id) ? { ...p, ...updates } : p)
  })),
  adjustInventory: (productId, branchId, delta, variantLabel, minQuantity) => set((state) => {
    const newInventory = [...state.inventory];
    const idx = newInventory.findIndex(i => i.productId === productId && i.branchId === branchId && i.variantLabel === variantLabel);
    if (idx !== -1) {
      newInventory[idx] = { 
        ...newInventory[idx], 
        quantity: Math.max(0, newInventory[idx].quantity + delta),
        ...(minQuantity !== undefined ? { minQuantity } : {})
      };
    } else if (delta > 0) {
      newInventory.push({ productId, branchId, quantity: delta, minQuantity: minQuantity ?? 5, variantLabel });
    }
    return { inventory: newInventory };
  }),
  setInventoryQuantity: (productId, branchId, quantity, variantLabel, minQuantity) => set((state) => {
    const newInventory = [...state.inventory];
    const idx = newInventory.findIndex(i => i.productId === productId && i.branchId === branchId && i.variantLabel === variantLabel);
    if (idx !== -1) {
      newInventory[idx] = { 
        ...newInventory[idx], 
        quantity: Math.max(0, quantity),
        ...(minQuantity !== undefined ? { minQuantity } : {})
      };
    } else {
      newInventory.push({ productId, branchId, quantity: Math.max(0, quantity), minQuantity: minQuantity ?? 5, variantLabel });
    }
    return { inventory: newInventory };
  }),
  
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

  processTransaction: (transaction) => set((state) => {
    // Deduct inventory
    let updatedInventory = [...state.inventory];
    const newWarranties: import('../types').Warranty[] = [];

    const finalItems = transaction.items.map(item => {
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

    const newTransaction = { ...transaction, items: finalItems };
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
  }),

  createReturn: (returnItem) => set((state) => {
    const readableId = generateReadableId('DEV', state.returns.length);
    return {
      returns: [{ ...returnItem, id: readableId }, ...state.returns]
    };
  }),
  updateReturn: (id, returnItem) => set((state) => ({
    returns: state.returns.map(r => r.id === id ? { ...r, ...returnItem } : r)
  })),
  processReturn: (id, action) => set((state) => {
    const returnReq = state.returns.find(r => r.id === id);
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
        }
      } else if (returnReq.type === 'refund') {
        // If it's a refund (e.g. wrong size), it goes back to stock
        if (idx !== -1) {
          updatedInventory[idx] = { 
            ...updatedInventory[idx], 
            quantity: updatedInventory[idx].quantity + returnReq.quantity 
          };
        }
      }

      // Update matching warranty if exists
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
  }),

  customers: [],
  addCustomer: (customer) => set((state) => ({
    customers: [...state.customers, customer]
  })),
  updateCustomer: (id, customer) => set((state) => ({
    customers: state.customers.map(c => c.id === id ? { ...c, ...customer } : c)
  })),
  deleteCustomer: (id) => set((state) => ({
    customers: state.customers.filter(c => c.id !== id),
    currentCustomerId: state.currentCustomerId === id ? undefined : state.currentCustomerId
  })),

  cashSessions: [],
  openSession: (session) => set((state) => ({
    cashSessions: [...state.cashSessions, session]
  })),
  closeSession: (sessionId, closingBalances) => set((state) => ({
    cashSessions: state.cashSessions.map(s => 
      s.id === sessionId ? { ...s, closedAt: new Date().toISOString(), status: 'closed', closingBalances } : s
    )
  })),
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
  addSupplier: (s) => set(state => ({ suppliers: [...state.suppliers, s] })),
  updateSupplier: (id, s) => set(state => ({ suppliers: state.suppliers.map(x => x.id === id ? { ...x, ...s } : x) })),
  deleteSupplier: (id) => set(state => ({ suppliers: state.suppliers.filter(x => x.id !== id) })),

  supplierOrders: [],
  createSupplierOrder: (o) => set(state => ({ supplierOrders: [o, ...state.supplierOrders] })),
  updateSupplierOrder: (id, o) => set(state => {
    const updated = state.supplierOrders.map(x => x.id === id ? { ...x, ...o } : x);
    // If received, update stock
    const order = updated.find(x => x.id === id);
    if (order && order.status === 'received' && o.status === 'received') {
      order.items.forEach(item => {
        get().adjustInventory(item.productId, order.branchId, item.quantity, item.variantLabel);
      });
    }
    return { supplierOrders: updated };
  }),

  inventoryAudits: [],
  createInventoryAudit: (a) => set(state => ({ inventoryAudits: [a, ...state.inventoryAudits] })),
  completeInventoryAudit: (id, items, notes) => set(state => {
    const updatedAudits = state.inventoryAudits.map(a => 
      a.id === id ? { ...a, status: 'completed' as 'completed', items, notes, date: new Date().toISOString() } : a
    );
    const audit = updatedAudits.find(a => a.id === id);
    if (audit) {
      // Adjust inventory based on audit results
      audit.items.forEach(item => {
        if (item.difference !== 0) {
          get().adjustInventory(item.productId, audit.branchId, item.difference, item.variantLabel);
        }
      });
    }
    return { inventoryAudits: updatedAudits };
  }),

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
  addSalarySettlement: (settlement) => set((state) => ({
    salarySettlements: [settlement, ...state.salarySettlements]
  })),
  updateSalarySettlement: (id, settlement) => set((state) => ({
    salarySettlements: state.salarySettlements.map(s => s.id === id ? { ...s, ...settlement } : s)
  })),
  addCashMovement: (sessionId, movement) => set((state) => ({
    cashSessions: state.cashSessions.map(s => 
      s.id === sessionId ? { ...s, movements: [...(s.movements || []), movement] } : s
    )
  })),

  transfers: [],
  addTransfer: (transfer) => set((state) => ({
    transfers: [transfer, ...state.transfers]
  })),

  warranties: [],
  addWarranty: (warranty) => set((state) => ({ warranties: [warranty, ...state.warranties] })),
  updateWarranty: (id, warranty) => set((state) => ({
    warranties: state.warranties.map(w => w.id === id ? { ...w, ...warranty } : w)
  })),

  bankCards: [],
  addBankCard: (card) => set(state => ({ bankCards: [...state.bankCards, card] })),
  updateBankCard: (id, card) => set(state => ({ bankCards: state.bankCards.map(c => c.id === id ? { ...c, ...card } : c) })),
  deleteBankCard: (id) => set(state => ({ bankCards: state.bankCards.filter(c => c.id !== id) })),

  bankTransactions: [],
  addBankTransaction: (transaction) => set(state => {
    // Also update the card balance
    const updatedCards = state.bankCards.map(card => {
      if (card.id === transaction.cardId) {
        let newBalance = card.balance;
        if (transaction.type === 'deposit' || transaction.type === 'payment_received') {
          newBalance += transaction.amount;
        } else if (transaction.type === 'withdrawal' || transaction.type === 'supplier_payment') {
          newBalance -= transaction.amount;
        }
        return { ...card, balance: newBalance };
      }
      return card;
    });
    return { 
      bankTransactions: [transaction, ...state.bankTransactions],
      bankCards: updatedCards
    };
  })
}));

