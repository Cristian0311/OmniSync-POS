import React, { lazy, Suspense, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { Search, Wifi, WifiOff, RefreshCw, Plus, Minus, CreditCard, Receipt, Trash2, ShoppingCart, ShieldCheck, DollarSign, Banknote, QrCode, ArrowLeftRight, UserPlus, X, Lock, Unlock, Camera, AlertCircle, TrendingUp, Wallet, MessageSquare, Mail, HelpCircle, Calculator, ArrowRight, Package, User, RotateCcw, Printer, Bluetooth, Usb, Smartphone, Send, Copy, Check, CheckCircle, Share2, Store, ChevronDown, ChevronUp, Filter } from "lucide-react";
import type { Html5QrcodeScanner } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import { cn, generateId } from "../lib/utils";
import {
  connectBluetoothPrinter,
  connectPrinter,
  getConnectedDeviceName,
  printThermalReceipt
} from "../lib/escpos";
import { useStore } from "../store/useStore";
import { Product, Payment, Transaction, CashRegisterSession } from "../types";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { InfoTooltip } from "../components/InfoTooltip";
import { getOfflineQueueCount, getOfflineConflictCount } from "../services/offlineQueue";
import { normalizeSemanticText } from "../utils/textUtils";
import { POSCatalog } from "../components/POSCatalog";
const CheckoutModal = lazy(() => import("../components/pos/CheckoutModal"));

const POSReceiptModal = lazy(() => import("../components/POSReceiptModal"));
const POSPrinterSetupModal = lazy(() => import("../components/POSPrinterSetupModal"));

const EMPTY_TRANSACTIONS: Transaction[] = [];
const EMPTY_CASH_SESSIONS: CashRegisterSession[] = [];

export default function POS() {
  const [showCashManagementModal, setShowCashManagementModal] = useState(false);
  const [lastClosedSession, setLastClosedSession] = useState<CashRegisterSession | null>(null);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const { categories, products, cart, addToCart, updateCartQty, clearCart, processTransaction, branches, currentBranchId, setCurrentBranch, activeSessionId, setActiveSessionId, currencies, getBaseCurrency, currentCustomerId, setCartCustomer, currentUser, pendingOrders, removePendingOrder, getCurrentSession, openSession, closeSession, addCashMovement, removeCashMovement, inventory, addCustomer, bankCards, addBankTransaction, customers, users, logout, createReturn, processReturn, receiptConfig, idnSettlementPrices, addIDNSettlementPrice, updateIDNSettlementPrice, deleteIDNSettlementPrice, setInventoryQuantity, addNotification, joinOpenSession, salarySettlements } = useStore(useShallow((state) => ({ categories: state.categories, products: state.products, cart: state.cart, addToCart: state.addToCart, updateCartQty: state.updateCartQty, clearCart: state.clearCart, processTransaction: state.processTransaction, branches: state.branches, currentBranchId: state.currentBranchId, setCurrentBranch: state.setCurrentBranch, activeSessionId: state.activeSessionId, setActiveSessionId: state.setActiveSessionId, currencies: state.currencies, getBaseCurrency: state.getBaseCurrency, currentCustomerId: state.currentCustomerId, setCartCustomer: state.setCartCustomer, currentUser: state.currentUser, pendingOrders: state.pendingOrders, removePendingOrder: state.removePendingOrder, getCurrentSession: state.getCurrentSession, openSession: state.openSession, closeSession: state.closeSession, addCashMovement: state.addCashMovement, removeCashMovement: state.removeCashMovement, inventory: state.inventory, addCustomer: state.addCustomer, bankCards: state.bankCards, addBankTransaction: state.addBankTransaction, customers: state.customers, users: state.users, logout: state.logout, createReturn: state.createReturn, processReturn: state.processReturn, receiptConfig: state.receiptConfig, idnSettlementPrices: state.idnSettlementPrices, addIDNSettlementPrice: state.addIDNSettlementPrice, updateIDNSettlementPrice: state.updateIDNSettlementPrice, deleteIDNSettlementPrice: state.deleteIDNSettlementPrice, setInventoryQuantity: state.setInventoryQuantity, addNotification: state.addNotification, joinOpenSession: state.joinOpenSession, salarySettlements: state.salarySettlements })));


  // Heavy administrative collections subscribe only while their UI is visible.
  // Normal sales therefore do not re-render because a transaction/session changed elsewhere.
  const needsTransactions = showCashManagementModal || !!lastClosedSession;
  const transactions = useStore((state) => needsTransactions ? state.transactions : EMPTY_TRANSACTIONS);
  // cash_sessions es un conjunto pequeño y crítico para el selector/apertura.
  // Debe permanecer reactivo para mostrar inmediatamente qué trabajador ya tiene turno abierto.
  const cashSessions = useStore((state) => state.cashSessions);
  const activeCashSessions = useMemo(() => cashSessions.filter(s => !s.deletedAt), [cashSessions]);
  const openSessionForWorker = useCallback((workerId: string) => {
    return activeCashSessions.find(s =>
      s.status === 'open' &&
      (s.userId === workerId || s.workingEmployeeIds?.includes(workerId))
    ) || null;
  }, [activeCashSessions]);
  const activeTransactions = useMemo(() => transactions.filter(t => !t.deletedAt), [transactions]);
  const [idnFilter, setIdnFilter] = useState("");
  const [debouncedIdnFilter, setDebouncedIdnFilter] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedIdnFilter(idnFilter);
    }, 200);
    return () => clearTimeout(timer);
  }, [idnFilter]);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [idnPhysicalCounts, setIdnPhysicalCounts] = useState<{ [productId: string]: number }>({});
  const [isProcessingIDN, setIsProcessingIDN] = useState(false);
  const [idnSelectedProductFilter, setIdnSelectedProductFilter] = useState("all");

  const [showIDNReceiptModal, setShowIDNReceiptModal] = useState<{
    tx: Transaction;
    details: any[];
    workerName: string;
    branchName: string;
    totalToPay: number;
    publicSales: number;
    date: string;
  } | null>(null);

  const [showSetSettlementPriceModal, setShowSetSettlementPriceModal] = useState(false);
  const [idnPriceFormProduct, setIdnPriceFormProduct] = useState("");
  const [idnPriceFormAmount, setIdnPriceFormAmount] = useState("");


  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(getOfflineQueueCount());
  const [offlineConflictCount, setOfflineConflictCount] = useState(getOfflineConflictCount());
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);

  useEffect(() => {
    const updateCount = () => {
      setPendingOfflineCount(getOfflineQueueCount());
      setOfflineConflictCount(getOfflineConflictCount());
    };
    const handleOnline = () => {
      setIsOnline(true);
      updateCount();
    };
    const handleOffline = () => {
      setIsOnline(false);
      updateCount();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline_queue_updated', updateCount);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline_queue_updated', updateCount);
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline) {
      addNotification('No hay conexión a internet actualmente.', 'warning');
      return;
    }
    setIsSyncingOffline(true);
    try {
      const { processOfflineQueue } = await import("../services/offlineSync");
      const res = await processOfflineQueue();
      setPendingOfflineCount(res.remaining);
      setOfflineConflictCount(getOfflineConflictCount());
      if (res.remaining > 0 || getOfflineConflictCount() > 0) {
        addNotification(`Sincronización incompleta: ${res.processed} operaciones procesadas y ${res.remaining} siguen pendientes.`, 'warning');
      } else if (res.processed > 0) {
        addNotification(`Sincronización manual completada: ${res.processed} operaciones confirmadas.`, 'success');
      } else if (getOfflineConflictCount() > 0) {
        addNotification('La cola tiene ' + getOfflineConflictCount() + ' conflicto(s) que requieren revisión.', 'warning');
      } else {
        addNotification('Todo está al día y sincronizado con Supabase.', 'info');
      }
    } finally {
      setIsSyncingOffline(false);
    }
  };
  
  // Cash Management State
  const [cashManagementTab, setCashManagementTab] = useState<'movements' | 'close' | 'sales'>('movements');
  const [closingBalances, setClosingBalances] = useState<{ [key: string]: number }>({});
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);
  const [finalBalancesToClose, setFinalBalancesToClose] = useState<Payment[]>([]);
  const [movementData, setMovementData] = useState({ type: 'expense' as 'income' | 'expense', amount: '', currencyCode: 'CUP', description: '' });

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', taxId: '' });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [configData, setConfigData] = useState<{ serialNumber?: string, selectedSize?: string, selectedColor?: string }>({});
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [isBottomBarMinimized, setIsBottomBarMinimized] = useState(false);
  
  const queryParams = new URLSearchParams(window.location.search);
  
  
  const navigate = useNavigate();
  const fallbackSessionBranchId = currentBranchId || (currentUser?.branchId || currentUser?.assignedBranchId || branches[0]?.id || '');
  const currentSession = useMemo(() => {
    if (activeSessionId) {
      const active = cashSessions.find(s => s.id === activeSessionId && s.status === 'open' && !s.deletedAt);
      if (active) return active;
    }
    // Recuperación automática para cuentas que son propietarias del turno.
    return getCurrentSession(fallbackSessionBranchId, currentUser?.id || '');
  }, [activeSessionId, cashSessions, fallbackSessionBranchId, currentUser?.id, getCurrentSession]);

  useEffect(() => {
    if (activeSessionId) return;
    if (!currentUser?.id) return;
    const own = getCurrentSession(fallbackSessionBranchId, currentUser.id);
    if (own?.id && activeSessionId !== own.id) setActiveSessionId(own.id);
  }, [activeSessionId, currentUser?.id, fallbackSessionBranchId, cashSessions, getCurrentSession, setActiveSessionId]);

  // Al entrar al POS/volver al foco, actualizar operaciones de caja y catálogo.
  // Esto evita que un selector abierto durante horas conserve una lista vieja.
  useEffect(() => {
    if (!currentUser || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    const run = async () => {
      try {
        await useStore.getState().refreshGlobalCatalogData();
        await useStore.getState().refreshBranchOperationalData();
      } catch (error) {
        console.warn('[POS] No se pudo refrescar el estado operativo al entrar:', error);
      }
    };
    void run();
  }, [currentUser?.id, fallbackSessionBranchId]);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showSalarySummary, setShowSalarySummary] = useState(false);
  const [connectedPrinterName, setConnectedPrinterName] = useState<string | null>(null);
  const [showPrinterSetupModal, setShowPrinterSetupModal] = useState(false);
  const [isConnectingPrinter, setIsConnectingPrinter] = useState(false);
  const [printerStatusMsg, setPrinterStatusMsg] = useState("");

  useEffect(() => {
    import('../lib/escpos').then(async ({ getConnectedDeviceName }) => {
      const name = await getConnectedDeviceName();
      if (name) setConnectedPrinterName(name);
    }).catch(() => {});
  }, []);
  
  type PaymentLine = { id: string, code: string, amount: number, method: 'cash' | 'transfer', bankCardId?: string };
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);
  const [showReceiptModal, setShowReceiptModal] = useState<Transaction | null>(null);
  const [returnConfirm, setReturnConfirm] = useState<{ tx: Transaction, item: any } | null>(null);

  const [activePaymentLineId, setActivePaymentLineId] = useState<string | null>(null);

  const [salesFilter, setSalesFilter] = useState<'all' | 'usd' | 'transfer' | 'cash_cup' | 'mixed'>('all');
  const [salesSubTab, setSalesSubTab] = useState<'tickets' | 'products'>('tickets');

  const [posError, setPosError] = useState("");
  const [posSuccess, setPosSuccess] = useState("");
  const [openingAmount, setOpeningAmount] = useState("");
  const [sessionWorkerName, setSessionWorkerName] = useState("");
  const [sessionWorkerId, setSessionWorkerId] = useState("");
  // La identidad del trabajador debe reconstruirse desde la sesión persistida
  // después de cambiar de módulo, recargar la página o rehidratar Zustand.
  useEffect(() => {
    // Mantener la selección manual del vendedor mientras se prepara la apertura.
    // No hay sesión abierta todavía, por lo que currentSession es null y no debe
    // borrar sessionWorkerName justo después de que el usuario lo selecciona.
    if (!currentSession) return;
    if (sessionWorkerName !== (currentSession.workerName || "")) {
      setSessionWorkerName(currentSession.workerName || "");
    }
    if (sessionWorkerId !== (currentSession.userId || "")) {
      setSessionWorkerId(currentSession.userId || "");
    }
    if (currentBranchId !== currentSession.branchId) {
      setCurrentBranch(currentSession.branchId);
    }
  }, [currentSession?.id, currentSession?.userId, currentSession?.workerName, currentSession?.branchId, sessionWorkerName, sessionWorkerId, currentBranchId, setCurrentBranch]);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [employeePickerSearch, setEmployeePickerSearch] = useState("");
  const employeePickerRef = useRef<HTMLDivElement>(null);
  const [sessionPassword, setSessionPassword] = useState("");

  useEffect(() => {
    if (!employeePickerOpen) return;

    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && employeePickerRef.current?.contains(target)) return;
      setEmployeePickerOpen(false);
      setEmployeePickerSearch("");
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setEmployeePickerOpen(false);
      setEmployeePickerSearch("");
    };

    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [employeePickerOpen]);
  const [isOpeningSession, setIsOpeningSession] = useState(false);
  const [isClosingSession, setIsClosingSession] = useState(false);

  const [joiningSessionPassword, setJoiningSessionPassword] = useState("");
  const [isNewEmployee, setIsNewEmployee] = useState(false);

  // Worker detection for shift opening and branch locking
  const detectedWorker = React.useMemo(() => {
    if (sessionWorkerId) {
      const byId = (users || []).find(u => u.id === sessionWorkerId);
      if (byId) return byId;
    }
    const trimmed = (sessionWorkerName || '').toLowerCase().trim();
    if (trimmed) {
      return (users || []).find(u => (u.name || '').toLowerCase() === trimmed) || null;
    }
    return null;
  }, [sessionWorkerId, sessionWorkerName, users]);

  const isWorkerIndependent = detectedWorker?.isIndependent === true;
  const workerAssignedBranchId = detectedWorker?.assignedBranchId || (
    detectedWorker?.allowedBranches && detectedWorker.allowedBranches.length === 1 ? detectedWorker.allowedBranches[0] : null
  );

  const [posViewMode, setPosViewMode] = useState<'standard' | 'idn'>('standard');
  const [selectedAdminIDNUserId, setSelectedAdminIDNUserId] = useState<string>('');

  const isCurrentUserIndependent = currentUser?.isIndependent === true;
  const currentSessionWorker = currentSession ? (
    (users || []).find(u => u.id === currentSession.userId || (u.name && currentSession.workerName && u.name.toLowerCase() === currentSession.workerName.toLowerCase()))
  ) : null;
  const isSessionIndependent = currentSessionWorker?.isIndependent === true;

  const independentUsers = (users || []).filter(u => u.isIndependent);

  useEffect(() => {
    if (!selectedAdminIDNUserId && independentUsers.length > 0) {
      setSelectedAdminIDNUserId(independentUsers[0].id);
    }
  }, [independentUsers, selectedAdminIDNUserId]);

  // When a shift is opened for an independent worker or current user is independent, default view to 'idn'
  useEffect(() => {
    if (isSessionIndependent || isCurrentUserIndependent) {
      setPosViewMode('idn');
    }
  }, [isSessionIndependent, isCurrentUserIndependent]);

  const shouldShowIDNView = isCurrentUserIndependent || isSessionIndependent || posViewMode === 'idn';

  const activeIDNWorker = React.useMemo(() => {
    // En la vista administrativa, la selección explícita del vendedor siempre
    // tiene prioridad. Así el selector no pierde el valor al cambiar de vendedor.
    if (currentUser?.role === 'admin' && selectedAdminIDNUserId) {
      const selected = (users || []).find(u => u.id === selectedAdminIDNUserId && u.isIndependent);
      if (selected) return selected;
    }
    if (isCurrentUserIndependent) return currentUser;
    if (isSessionIndependent) return currentSessionWorker;
    return (users || []).find(u => u.isIndependent) || currentUser;
  }, [currentUser?.role, isCurrentUserIndependent, isSessionIndependent, selectedAdminIDNUserId, users, currentUser, currentSessionWorker]);

  const activeIDNBranchId = activeIDNWorker?.assignedBranchId || activeIDNWorker?.branchId || currentBranchId;

  // Auto-lock sessionBranchId if worker has an assigned branch
  useEffect(() => {
    if (workerAssignedBranchId) {
      setSessionBranchId(workerAssignedBranchId);
    }
  }, [workerAssignedBranchId]);

  useEffect(() => {
    if (sessionWorkerName) {
      const exists = users.find(u => (u.name || '').toLowerCase() === sessionWorkerName.toLowerCase().trim());
      setIsNewEmployee(!exists);
    } else {
      setIsNewEmployee(false);
    }
  }, [sessionWorkerName, users]);
  
  const isBranchLocked = Boolean(
    workerAssignedBranchId ||
    (currentUser?.role !== 'admin' && currentUser?.assignedBranchId) ||
    (currentSession && ((users || []).find(u => u.id === currentSession.userId)?.assignedBranchId))
  );

  const allowedBranches = React.useMemo(() => {
    // Administradores pueden operar todas las sucursales.
    if (currentUser?.role === 'admin') return branches || [];

    // En el flujo trabajador -> seleccionar empleado -> contraseña, el alcance
    // de sucursal debe corresponder al trabajador seleccionado, no a la cuenta
    // que inició sesión.
    const scopeUser = detectedWorker || currentUser;
    const assignedId = scopeUser?.assignedBranchId || scopeUser?.branchId;
    if (assignedId) {
      return (branches || []).filter(b => b.id === assignedId);
    }
    if (scopeUser?.allowedBranches && scopeUser.allowedBranches.length > 0) {
      return (branches || []).filter(b => scopeUser.allowedBranches!.includes(b.id));
    }
    return [];
  }, [currentUser, detectedWorker, branches, workerAssignedBranchId]);
    
  const [showConfirmIDNModal, setShowConfirmIDNModal] = useState(false);

  const [sessionBranchId, setSessionBranchId] = useState<string>(
    currentBranchId || ((allowedBranches || []).length > 0 ? allowedBranches[0].id : "")
  );

  const handleCloseIDNAccount = () => {
    const targetWorker = activeIDNWorker;
    const branchId = activeIDNBranchId;
    if (!targetWorker) {
      setPosError("No se ha seleccionado ningún vendedor independiente.");
      return;
    }
    if (!branchId) {
      setPosError("El vendedor no tiene un almacén asignado para liquidar.");
      return;
    }
    setShowConfirmIDNModal(true);
  };

  const handleExecuteIDNSettlement = async () => {
    const targetWorker = activeIDNWorker;
    const branchId = activeIDNBranchId;
    if (!targetWorker || !branchId) {
      setShowConfirmIDNModal(false);
      return;
    }

    setIsProcessingIDN(true);
    try {
      const settlementDetails: any[] = [];
      let totalToPay = 0;

      const branchInventory = (inventory || []).filter(i => i.branchId === branchId);
      
      for (const invItem of branchInventory) {
        const product = (products || []).find(p => p.id === invItem.productId);
        if (!product) continue;

        const settlementPrice = (idnSettlementPrices || []).find(
          sp => sp.userId === targetWorker.id && sp.productId === product.id
        )?.settlementPrice || product.costPrice || 0;

        const physicalCount = idnPhysicalCounts[product.id] ?? invItem.quantity;
        const soldQty = Math.max(0, invItem.quantity - physicalCount);

        if (soldQty > 0) {
          const subtotal = soldQty * settlementPrice;
          totalToPay += subtotal;
          settlementDetails.push({
            productId: product.id,
            name: product.name,
            sku: product.sku,
            qty: soldQty,
            publicPrice: product.price || 0,
            price: settlementPrice,
            subtotal
          });
        } else if (physicalCount > invItem.quantity) {
          // If physical count was manually increased above system stock without sales, update stock directly
          setInventoryQuantity(product.id, branchId, physicalCount);
        }
      }

      // Permitir liquidación con 0 ventas o 0 CUP de acuerdo a la solicitud del usuario
      const currentTransactions = useStore.getState().transactions.filter(t => !t.deletedAt);
      const maxIdnNum = currentTransactions.reduce((max, t) => {
        const match = t.id?.match(/LIQ-IDN-(\d+)/i);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 0);
      let nextIdnNum = Math.max(currentTransactions.length, maxIdnNum) + 1;
      let idnTxId = `LIQ-IDN-${nextIdnNum.toString().padStart(2, '0')}`;
      if (currentTransactions.some(t => t.id === idnTxId)) {
        const wSuffix = targetWorker.name?.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase() || 'W';
        idnTxId = `LIQ-IDN-${nextIdnNum.toString().padStart(2, '0')}-${wSuffix}`;
      }

      const transaction: Transaction = {
        id: idnTxId,
        items: settlementDetails.map(d => ({
          id: crypto.randomUUID(),
          product: (products || []).find(p => p.id === d.productId) || {
            id: d.productId,
            name: d.name,
            price: d.publicPrice,
            costPrice: d.price,
            sku: d.sku || 'IDN'
          } as any,
          quantity: d.qty,
          price: d.price,
          total: d.subtotal
        })),
        total: totalToPay,
        date: new Date().toISOString(),
        paymentMethod: 'cash',
        payments: [{
          method: 'cash',
          amount: totalToPay,
          currencyCode: baseCurrency.code,
          exchangeRate: 1
        }],
        branchId: branchId,
        userId: targetWorker.id,
        cashierName: targetWorker.name,
        sessionId: currentSession?.id,
        notes: 'LIQUIDACION_IDN',
        status: 'completed'
      };

      // La liquidación IDN debe quedar confirmada o durablemente encolada
      // antes de mostrar éxito y, especialmente, antes de cerrar el turno.
      const saved = await useStore.getState().processTransaction(transaction);
      if (!saved) {
        setPosError('La liquidación IDN no fue confirmada. El turno permanece abierto y la operación sigue protegida para reintento.');
        return;
      }

      const branchName = branches.find(b => b.id === branchId)?.name || 'Almacén Asignado';
      const totalPublicSales = settlementDetails.reduce((sum, d) => sum + ((d.publicPrice || d.price) * d.qty), 0);
      const receiptData = {
        tx: transaction,
        details: settlementDetails,
        workerName: targetWorker.name || 'Vendedor IDN',
        branchName: branchName,
        totalToPay: totalToPay,
        publicSales: totalPublicSales,
        date: transaction.date
      };

      setShowIDNReceiptModal(receiptData);
      setIdnPhysicalCounts({});
      setPosSuccess(`Liquidación de ${targetWorker.name} procesada correctamente.`);
      setTimeout(() => setPosSuccess(""), 3500);
      setShowConfirmIDNModal(false);
    } catch (err) {
      console.error("Error in IDN settlement:", err);
      setPosError("Error al procesar la liquidación.");
    } finally {
      setIsProcessingIDN(false);
    }
  };

  const handlePrintIDNThermal = async (data: typeof showIDNReceiptModal) => {
    if (!data) return;
    try {
      const lines: string[] = [
        `CENTER|BOLD|${receiptConfig.businessName || 'MARÉ'}`,
        "CENTER|VALE DE LIQUIDACION IDN",
        `VENDEDOR: ${(data.workerName || 'VENDEDOR').toUpperCase()}`,
        `ALMACEN: ${(data.branchName || 'ALMACEN').toUpperCase()}`,
        `FECHA: ${new Date(data.date).toLocaleString()}`,
        "---",
        "BOLD|DETALLE DE VENTAS (CUP):",
      ];
      (data.details || []).forEach(d => {
        const label = `${d.qty}x ${(d.name || '').slice(0, 16)}`;
        const val = `${baseCurrency.symbol}${d.subtotal.toLocaleString()} CUP`;
        const spaceCount = Math.max(1, 32 - label.length - val.length);
        lines.push(`${label}${" ".repeat(spaceCount)}${val}`);
      });
      lines.push("---");
      lines.push(`BOLD|TOTAL LIQUIDAR: ${baseCurrency.symbol}${data.totalToPay.toLocaleString()} CUP`);
      lines.push("---");
      lines.push("CENTER|CUADRE REALIZADO CON EXITO");
      await printThermalReceipt({
        lines,
        width: (receiptConfig.printerWidth || '58mm') as '58mm' | '80mm'
      });
      setPosSuccess("Vale de liquidación enviado a la impresora.");
      setTimeout(() => setPosSuccess(""), 3000);
    } catch (printErr: any) {
      console.warn("Thermal print error:", printErr);
      setPosError(printErr?.message || "No se pudo imprimir el ticket.");
      setTimeout(() => setPosError(""), 3500);
    }
  };

  const [deductFromSalary, setDeductFromSalary] = useState(false);

  const [showCancelShiftModal, setShowCancelShiftModal] = useState(false);
  const [cancelShiftPassword, setCancelShiftPassword] = useState("");
  const [isCancellingShift, setIsCancellingShift] = useState(false);
  const [isExitingIDN, setIsExitingIDN] = useState(false);
  const [isFinishingIDN, setIsFinishingIDN] = useState(false);

  const handleCancelShift = async () => {
    if (!currentSession || isCancellingShift) return;

    const worker = users.find(u =>
      u.id === currentSession.userId ||
      (u.name && currentSession.workerName && u.name.toLowerCase() === currentSession.workerName.toLowerCase())
    );

    const isAdminAuthorized =
      currentUser?.role === 'admin' &&
      !!currentUser.password &&
      cancelShiftPassword === currentUser.password;

    const isWorkerAuthorized =
      currentUser?.role !== 'admin' &&
      !!worker?.password &&
      cancelShiftPassword === worker.password &&
      worker.isActive !== false;

    if (!isAdminAuthorized && !isWorkerAuthorized) {
      setPosError(
        currentUser?.role === 'admin'
          ? "Contraseña de administrador incorrecta."
          : `Debes ingresar la contraseña del trabajador del turno (${worker?.name || 'trabajador'}).`
      );
      setTimeout(() => setPosError(""), 3000);
      return;
    }

    setIsCancellingShift(true);
    setPosError("");
    try {
      const sessionId = currentSession.id;
      const ok = await useStore.getState().cancelSession(sessionId);
      if (!ok) {
        setPosError("No se pudo cancelar el turno. La operación no fue confirmada; el turno sigue abierto.");
        return;
      }

      setShowCancelShiftModal(false);
      setCancelShiftPassword("");
      setShowCashManagementModal(false);
      setShowDiscrepancyModal(false);
      setClosingBalances({});
      setFinalBalancesToClose([]);
      setCashManagementTab('movements');
      setDeductFromSalary(false);
      setShowOpenShiftModal(false);
      setJoiningSessionId(null);
      setJoiningSessionPassword("");
      setLastClosedSession(null);
      setActiveSessionId(null);
      clearCart();

      setPosSuccess(
        isOnline
          ? "Turno cancelado correctamente. Regresando al selector de empleado."
          : "Turno cancelado localmente. La cancelación quedó guardada y se sincronizará al recuperar la conexión."
      );
      setTimeout(() => setPosSuccess(""), 3500);
    } catch (err: any) {
      console.error("[POS] Error cancelando turno:", err);
      setPosError(err?.message || "No se pudo cancelar el turno. El turno permanece abierto.");
    } finally {
      setIsCancellingShift(false);
    }
  };

  const handleFinishIDNAndGoHome = async () => {
    if (isFinishingIDN) return;
    setIsFinishingIDN(true);
    setPosError("");

    try {
      if (currentSession) {
        const closingBalances: Payment[] = [
          { currencyCode: baseCurrency.code, amount: showIDNReceiptModal?.totalToPay || 0, method: 'cash', exchangeRate: 1 }
        ];

        const ok = await closeSession(
          currentSession.id,
          closingBalances,
          activeIDNWorker?.name || currentSession.workerName
        );

        if (!ok) {
          setPosError("El cierre no fue confirmado. El turno permanece abierto para proteger las ventas.");
          return;
        }

        setLastClosedSession({
          ...currentSession,
          closedAt: new Date().toISOString(),
          closingDate: new Date().toISOString(),
          status: 'closed',
          closingBalances
        });
      }

      setShowIDNReceiptModal(null);
      setIdnPhysicalCounts({});
      setShowConfirmIDNModal(false);
      setPosViewMode('standard');
      setActiveSessionId(null);
      setSessionWorkerName(""); setSessionWorkerId("");
      setSessionPassword("");
      setPosSuccess("Liquidación completada. Sesión cerrada.");
      setTimeout(() => setPosSuccess(""), 3000);
    } catch (err: any) {
      console.error("[POS] Error finalizando liquidación IDN:", err);
      setPosError(err?.message || "No se pudo finalizar la liquidación.");
    } finally {
      setIsFinishingIDN(false);
    }
  };

  const handleCancelAndReturnToEmployeeSelector = async () => {
    if (isExitingIDN) return;

    setIsExitingIDN(true);
    setPosError("");

    try {
      const session = currentSession || (
        activeSessionId
          ? (useStore.getState().cashSessions || []).find(s => s.id === activeSessionId)
          : undefined
      );

      // "Cancelar / Salir" del flujo IDN cancela el turno únicamente cuando
      // todavía no existen ventas confirmadas. Nunca se deben borrar ventas
      // silenciosamente desde este botón.
      const sessionTransactions = session
        ? (useStore.getState().transactions || []).filter(
            tx => tx.sessionId === session.id && !tx.deletedAt
          )
        : [];

      if (session && sessionTransactions.length > 0) {
        setPosError("Este turno ya tiene ventas registradas. No se puede cancelar silenciosamente desde aquí; usa Cerrar Caja o Cancelar Turno.");
        return;
      }

      if (session) {
        const cancelled = await useStore.getState().cancelSession(
          session.id,
          'Cancelación del POS IDN antes de registrar ventas'
        );
        if (!cancelled) {
          setPosError("No se pudo cancelar el turno. La operación no fue confirmada.");
          return;
        }
      }

      setIdnPhysicalCounts({});
      clearCart();
      setIdnFilter("");
      setDebouncedIdnFilter("");
      setIdnSelectedProductFilter("all");
      setShowConfirmIDNModal(false);
      setShowIDNReceiptModal(null);
      setShowCheckoutModal(false);
      setShowMobileCart(false);
      setPosViewMode('standard');
      setActiveSessionId(null);
      setSessionWorkerName("");
      setSessionPassword("");
      setSelectedAdminIDNUserId("");
      setJoiningSessionId(null);
      setJoiningSessionPassword("");
      setLastClosedSession(null);
      setPosSuccess("Punto de venta cancelado. Turno cancelado correctamente. Regresando al selector de empleado.");
      setTimeout(() => setPosSuccess(""), 3000);
    } catch (err: any) {
      console.error("[POS] Error al cancelar/salir del flujo IDN:", err);
      setPosError(err?.message || "No se pudo cancelar y salir del punto de venta.");
    } finally {
      setIsExitingIDN(false);
    }
  };

  const handleSaveIDNSettlementPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIDNWorker?.id || !idnPriceFormProduct) {
      setPosError("Seleccione un producto");
      return;
    }
    const val = parseFloat(idnPriceFormAmount);
    if (isNaN(val) || val < 0) {
      setPosError("Ingrese un precio válido");
      return;
    }

    const existing = (idnSettlementPrices || []).find(
      p => p.userId === activeIDNWorker.id && p.productId === idnPriceFormProduct
    );

    if (existing) {
      updateIDNSettlementPrice(existing.id, { settlementPrice: val });
    } else {
      addIDNSettlementPrice({
        id: generateId('SP'),
        userId: activeIDNWorker.id,
        productId: idnPriceFormProduct,
        settlementPrice: val
      });
    }

    setShowSetSettlementPriceModal(false);
    setPosSuccess("Precio de liquidación actualizado.");
    setTimeout(() => setPosSuccess(""), 3000);
  };

  const baseCurrency = getBaseCurrency();
  const expectedBalances = React.useMemo(() => {
    if (!currentSession) return [];
    
    // Start with opening balance as cash in base currency
    const expected: Payment[] = [
      { currencyCode: baseCurrency.code as any, amount: currentSession.openingBalance, exchangeRate: 1, method: 'cash' }
    ];

    // Add all transaction payments from this session
    const sessionTxs = activeTransactions.filter(t => 
      t.branchId === currentBranchId && 
      t.sessionId === currentSession.id
    );

    sessionTxs.forEach(tx => {
      (tx.payments || []).forEach(p => {
        const existing = expected.find(e => e.currencyCode === p.currencyCode && e.method === p.method);
        if (existing) {
          existing.amount += p.amount;
        } else {
          expected.push({ ...p });
        }
      });
      
      // Subtract change given in each currency
      if (tx.changePayments && tx.changePayments.length > 0) {
        tx.changePayments.forEach(cp => {
          const existing = expected.find(e => e.currencyCode === cp.currencyCode && e.method === cp.method);
          if (existing) {
            existing.amount -= cp.amount;
          } else {
            expected.push({ ...cp, amount: -cp.amount });
          }
        });
      } else if (tx.changeGiven && tx.changeGiven > 0) {
        // Fallback for activeTransactions with only changeGiven in base currency
        const existing = expected.find(e => e.currencyCode === baseCurrency.code && e.method === 'cash');
        if (existing) {
          existing.amount -= tx.changeGiven;
        } else {
          expected.push({ 
            currencyCode: baseCurrency.code as any, 
            amount: -tx.changeGiven, 
            exchangeRate: 1, 
            method: 'cash' 
          });
        }
      }
    });

    // Add cash movements
    if (currentSession?.movements) {
      currentSession.movements.forEach(m => {
        const existing = expected.find(e => e.currencyCode === m.currencyCode && e.method === 'cash');
        if (existing) {
          existing.amount += (m.type === 'income' ? m.amount : -m.amount);
        } else {
          expected.push({ 
            currencyCode: m.currencyCode as any, 
            amount: m.type === 'income' ? m.amount : -m.amount,
            exchangeRate: currencies.find(c => c.code === m.currencyCode)?.rateToBase || 1,
            method: 'cash'
          });
        }
      });
    }

    return expected.filter(e => e.amount !== 0);
  }, [currentSession, activeTransactions, currentBranchId, baseCurrency, currencies]);

  const handleReturnItem = async () => {
    if (!returnConfirm) return;
    const { tx, item } = returnConfirm;

    try {
      const returnId = generateId();
      const prodId = typeof (item.product as any) === 'object' ? (item.product?.id || '') : (item.product || '');
      const returnData = {
        id: returnId,
        transactionId: tx.id,
        productId: prodId,
        quantity: item.quantity,
        reason: 'Devolución de cliente',
        date: new Date().toISOString(),
        status: 'pending' as const,
        type: 'refund' as const,
        notes: `Devolución desde historial de ventas. Ticket: ${tx.id}`
      };

      createReturn(returnData);
      const processed = await processReturn(returnId, 'complete');
      if (!processed) {
        setPosError("La devolución no fue confirmada. El producto no se marcó como devuelto.");
        return;
      }

      setPosSuccess("Producto devuelto y stock actualizado correctamente");
      setReturnConfirm(null);
      setTimeout(() => setPosSuccess(""), 3000);
    } catch (err) {
      console.error("Error processing return:", err);
      setPosError("Error al procesar la devolución");
      setTimeout(() => setPosError(""), 3000);
    }
  };

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentSession && !isClosingSession) {
      const finalBalances: Payment[] = Object.entries(closingBalances)
        .filter(([_, amount]) => (amount as number) > 0)
        .map(([key, amount]) => {
          const [code, method] = key.split('-');
          const currency = currencies.find(c => c.code === code)!;
          return {
            currencyCode: code as any,
            amount: amount as number,
            exchangeRate: getSafeRateToBase(p.code),
            method: method as any
          };
        });

      let hasDiscrepancy = false;
      expectedBalances.forEach(eb => {
        const actual = finalBalances.find(fb => fb.currencyCode === eb.currencyCode && fb.method === eb.method)?.amount || 0;
        if (Math.abs(actual - eb.amount) > 0.01) {
          hasDiscrepancy = true;
        }
      });
      finalBalances.forEach(fb => {
        const exp = expectedBalances.find(eb => fb.currencyCode === eb.currencyCode && fb.method === eb.method)?.amount || 0;
        if (Math.abs(fb.amount - exp) > 0.01) {
          hasDiscrepancy = true;
        }
      });

      if (hasDiscrepancy) {
        setFinalBalancesToClose(finalBalances);
        setShowDiscrepancyModal(true);
      } else {
        const ok = await processClose(finalBalances);
        if (ok) {
          setPosSuccess("Caja cerrada y confirmada correctamente.");
          setTimeout(() => setPosSuccess(""), 3000);
        }
      }
    }
  };

  const processClose = async (balances: Payment[], discrepancyDeduction?: number, sessionMeta?: Partial<CashRegisterSession>) => {
    if (!currentSession || isClosingSession) return false;

    setIsClosingSession(true);
    setPosError("");
    try {
      let finalClosingDate = new Date().toISOString();
      if (sessionClosingDate) {
        const parts = sessionClosingDate.split('-');
        if (parts.length === 3) {
          const d = new Date();
          d.setFullYear(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          finalClosingDate = d.toISOString();
        }
      }

      const sessionToClose: CashRegisterSession = {
        ...currentSession,
        status: 'closed' as const,
        closedAt: finalClosingDate,
        closingBalances: balances,
        workerName: sessionWorkerName || currentSession.workerName,
        closingDate: finalClosingDate,
        ...(sessionMeta || {})
      };

      const confirmed = await closeSession(
        currentSession.id,
        balances,
        sessionWorkerName || currentSession.workerName,
        finalClosingDate,
        discrepancyDeduction,
        sessionMeta
      );

      if (!confirmed) {
        setPosError("El cierre no fue confirmado por la base de datos. El turno permanece abierto y protegido.");
        return false;
      }

      setLastClosedSession(sessionToClose);
      void handlePrintClosureThermal(sessionToClose);
      setClosingBalances({});
      setSessionWorkerName("");
      setSessionPassword("");
      setActiveSessionId(null);
      setSessionClosingDate(new Date().toISOString().split('T')[0]);
      setShowCashManagementModal(false);
      setShowSalarySummary(true);
      setShowOpenShiftModal(false);
      return true;
    } catch (err: any) {
      console.error("[POS] Error confirmando cierre:", err);
      setPosError(err?.message || "No se pudo confirmar el cierre del turno.");
      return false;
    } finally {
      setIsClosingSession(false);
    }
  };

  const confirmClose = async () => {
    if (currentSession) {
      let totalDeduction = 0;
      if (deductFromSalary) {
        expectedBalances.forEach(eb => {
          const actual = finalBalancesToClose.find(fb => fb.currencyCode === eb.currencyCode && fb.method === eb.method)?.amount || 0;
          const diff = actual - eb.amount;
          if (diff < 0) {
            // Convert to base currency
            const currency = currencies.find(c => c.code === eb.currencyCode);
            totalDeduction += Math.abs(diff) * (currency?.rateToBase || 1);
          }
        });
      }

      // Build discrepancy details
      const discrepancyDetails: {
        currencyCode: string;
        method: 'cash' | 'transfer';
        expected: number;
        actual: number;
        difference: number;
      }[] = [];

      expectedBalances.forEach(eb => {
        const actual = finalBalancesToClose.find(fb => fb.currencyCode === eb.currencyCode && fb.method === eb.method)?.amount || 0;
        const diff = actual - eb.amount;
        if (Math.abs(diff) > 0.01) {
          discrepancyDetails.push({
            currencyCode: eb.currencyCode,
            method: eb.method as any,
            expected: eb.amount,
            actual,
            difference: diff
          });
        }
      });

      finalBalancesToClose.forEach(fb => {
        if (!expectedBalances.some(eb => eb.currencyCode === fb.currencyCode && eb.method === fb.method)) {
          discrepancyDetails.push({
            currencyCode: fb.currencyCode,
            method: fb.method as any,
            expected: 0,
            actual: fb.amount,
            difference: fb.amount
          });
        }
      });

      const matchingProductsAnalysis = discrepancyDetails.map(dd => {
        const matchedProducts = products
          .filter(p => Math.abs(p.price - Math.abs(dd.difference)) < 1)
          .slice(0, 3)
          .map(p => ({ id: p.id, name: p.name, price: p.price }));
        return {
          currencyCode: dd.currencyCode,
          difference: dd.difference,
          matchedProducts
        };
      }).filter(m => m.matchedProducts.length > 0);

      const sessionMeta: Partial<CashRegisterSession> = {
        isForcedClose: true,
        hasDiscrepancy: discrepancyDetails.length > 0,
        discrepancyDetails,
        discrepancyDeductionApplied: totalDeduction,
        deductedFromSalary: deductFromSalary,
        matchingProductsAnalysis,
        auditStatus: 'pending_review',
        notes: `Cierre forzado con descuadre. Deducción salarial: ${totalDeduction > 0 ? `${totalDeduction} CUP` : 'No aplicada'}.`
      };

      const ok = await processClose(finalBalancesToClose, totalDeduction, sessionMeta);
      if (!ok) return;
      setShowDiscrepancyModal(false);
      setDeductFromSalary(false);
      setFinalBalancesToClose([]);
      setPosSuccess("Caja cerrada. Se registraron los datos para la auditoría de descuadres en Reportes.");
      setTimeout(() => setPosSuccess(""), 3500);
    }
  };

  const handleAddMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;
    const amt = parseFloat(movementData.amount);
    if (isNaN(amt) || amt <= 0) return;

    addCashMovement(currentSession.id, {
      id: crypto.randomUUID(),
      sessionId: currentSession.id,
      branchId: currentSession.branchId || currentBranchId,
      workerName: currentSession.workerName || sessionWorkerName || currentUser?.name || 'Vendedor',
      type: movementData.type,
      amount: amt,
      currencyCode: movementData.currencyCode,
      description: movementData.description,
      date: new Date().toISOString()
    });

    addNotification(`Movimiento de ${movementData.type === 'income' ? 'entrada' : 'salida'} registrado: ${formatMoney(amt, movementData.currencyCode)}`, 'success');
    setMovementData({ type: 'expense', amount: '', currencyCode: 'CUP', description: '' });
  };

  // Barcode scanner moved lower

  const subtotalBase = cart.reduce((sum, item) => {
    const price = typeof (item.product as any) === 'object' && item.product !== null ? (item.product.price ?? item.price ?? 0) : (item.price ?? 0);
    return sum + (price * item.quantity);
  }, 0);
  const taxBase = 0; // Configurable tax if needed
  const rawTotalBase = subtotalBase + taxBase;
  const isCupBase = baseCurrency.code === 'CUP' || baseCurrency.code === 'MN';
  const totalBase = isCupBase ? Math.round(rawTotalBase) : Math.round(rawTotalBase * 100) / 100;

  // Todos los importes del checkout se convierten a la moneda base con una
  // tasa válida. La moneda base siempre vale 1, incluso si la configuración
  // remota llega momentáneamente sin rateToBase.
  const getSafeRateToBase = (code: string) => {
    if (code === baseCurrency.code) return 1;
    const rate = Number(currencies.find(c => c.code === code)?.rateToBase);
    return Number.isFinite(rate) && rate > 0 ? rate : 1;
  };

  const toBaseAmount = (amount: number, code: string) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value * getSafeRateToBase(code);
  };

  const roundBaseAmount = (amount: number) => {
    const value = Number(amount) || 0;
    return isCupBase ? Math.round(value) : Math.round(value * 100) / 100;
  };

  const totalPaidBase = roundBaseAmount(paymentLines.reduce(
    (sum, line) => sum + toBaseAmount(line.amount, line.code),
    0
  ));

  const balanceBase = roundBaseAmount(totalBase - totalPaidBase);
  const remainingBase = Math.max(0, balanceBase);
  const changeBase = Math.max(0, -balanceBase);
  const isPaid = remainingBase <= (isCupBase ? 0 : 0.01) && totalBase > 0;

  const generateSerial = () => {
    const randomSN = `SN-${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
    setConfigData({ ...configData, serialNumber: randomSN });
  };

  const getProductStock = (productId: string, variantLabel?: string) => {
    return (inventory || []).reduce((total, item) => {
      const stockBranchId = currentSession?.branchId || currentBranchId;
      if (item.branchId !== stockBranchId || item.productId !== productId) return total;
      if (variantLabel) return item.variantLabel === variantLabel ? total + item.quantity : total;
      return total + item.quantity;
    }, 0);
  };

  const getCartQuantity = (productId: string, variantLabel?: string) => {
    return cart
      .filter(item => {
        const pId = typeof (item.product as any) === 'object' && item.product !== null ? item.product.id : item.product;
        return pId === productId && (item.variantLabel || '') === (variantLabel || '');
      })
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  useBarcodeScanner((barcode) => {
    const normCode = normalizeSemanticText(barcode);
    const scannedProduct = (products || []).find(p => {
      if (!p) return false;
      return (
        p.id === barcode ||
        normalizeSemanticText(p.sku) === normCode ||
        normalizeSemanticText(p.barcode) === normCode ||
        p.sku === barcode ||
        p.barcode === barcode
      );
    });

    if (scannedProduct) {
       const totalAvailable = getProductStock(scannedProduct.id);
       if (totalAvailable > 0) {
          const needsConfig = scannedProduct.hasSerial || (scannedProduct.availableSizes?.length) || (scannedProduct.availableColors?.length);
          if (needsConfig) {
             setSelectedProduct(scannedProduct);
             setShowConfigModal(true);
          } else {
             addToCart(scannedProduct);
             setPosSuccess(`¡Producto "${scannedProduct.name}" detectado y agregado al carrito!`);
             setTimeout(() => setPosSuccess(""), 2000);
          }
       } else {
          setPosError(`El producto "${scannedProduct.name}" no tiene existencias suficientes en este almacén.`);
          setTimeout(() => setPosError(""), 3000);
       }
    } else {
      setPosError(`No se encontró ningún producto con el código "${barcode}".`);
      setTimeout(() => setPosError(""), 2500);
    }
  });

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    let cancelled = false;

    if (showCameraScanner) {
      void import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
        if (cancelled) return;

        scanner = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );

        scanner.render((decodedText) => {
        // On successful scan
        const scannedProduct = products.find(p => p.sku === decodedText || p.id === decodedText || p.barcode === decodedText);
        if (scannedProduct) {
          const totalAvailable = getProductStock(scannedProduct.id);
          if (totalAvailable > 0) {
            const needsConfig = scannedProduct.hasSerial || (scannedProduct.availableSizes?.length) || (scannedProduct.availableColors?.length);
            if (needsConfig) {
              setSelectedProduct(scannedProduct);
              setShowConfigModal(true);
            } else {
              addToCart(scannedProduct);
              setPosSuccess("Producto escaneado");
              setTimeout(() => setPosSuccess(""), 1500);
            }
          } else {
            setPosError("Sin existencias");
            setTimeout(() => setPosError(""), 1500);
          }
        } else {
          // Check if it's an order payload from the customer shop
          if (decodedText.startsWith("APP_ORDER:")) {
            try {
              const payloadStr = decodedText.replace("APP_ORDER:", "");
              const payload = JSON.parse(payloadStr);
              if (payload && payload.i && Array.isArray(payload.i)) {
                clearCart();
                payload.i.forEach((item: any) => {
                  const p = products.find(prod => prod.id === item.id);
                  if (p) {
                    for(let i=0; i<item.q; i++) {
                      addToCart(p);
                    }
                  }
                });
                setPosSuccess("Carrito de cliente cargado exitosamente.");
                setTimeout(() => setPosSuccess(""), 3000);
              }
            } catch(e) {
              setPosError("Código de orden inválido");
              setTimeout(() => setPosError(""), 1500);
            }
          } else {
            // Check if it's a legacy pending order (by ID)
            const order = pendingOrders.find(o => o.id === decodedText && o.status === 'pending');
            if (order) {
              clearCart();
              order.items.forEach(item => {
                const prodObj = typeof (item.product as any) === 'object' && item.product !== null ? item.product : products.find(p => p.id === (item.product as any));
                if (prodObj) {
                  for(let i=0; i<item.quantity; i++){
                    addToCart(prodObj, item.serialNumber);
                  }
                }
              });
              removePendingOrder(order.id);
              setPosSuccess("Orden cargada exitosamente.");
              setTimeout(() => setPosSuccess(""), 3000);
            } else {
              setPosError("Código no reconocido");
              setTimeout(() => setPosError(""), 1500);
            }
          }
        }
          setShowCameraScanner(false);
        }, (error) => {
          // Handle scan errors silently
        });
      });
    }

    return () => {
      cancelled = true;
      if (scanner) {
        scanner.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
        });
      }
    };
  }, [showCameraScanner, products, inventory, currentBranchId]);

  const handleProductClick = useCallback((product: Product) => {
    setPosError("");
    setSelectedProduct(product);
    const autoSN = product.hasSerial ? `SN-${Math.floor(Math.random() * 100000000).toString().padStart(8, "0")}` : "";
    setConfigData({
      selectedSize: product.availableSizes?.[0],
      selectedColor: product.availableColors?.[0],
      serialNumber: autoSN
    });
    setShowConfigModal(true);
  }, []);

  const handleCatalogOutOfStock = useCallback(() => {
    setPosError("Sin existencias en esta sucursal.");
    setTimeout(() => setPosError(""), 3000);
  }, []);

  const handleConfigSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPosError("");
    if (selectedProduct) {
      const variantLabel = configData.selectedSize || configData.selectedColor;
      if (getCartQuantity(selectedProduct.id, variantLabel) >= getProductStock(selectedProduct.id, variantLabel)) {
        setPosError(`No hay suficiente stock para la variante ${variantLabel || 'seleccionada'}.`);
        setTimeout(() => setPosError(""), 3000);
        return;
      }
      addToCart({
        ...selectedProduct,
      }, configData.serialNumber, { size: configData.selectedSize, color: configData.selectedColor, variantLabel });
      
      setShowConfigModal(false);
      setSelectedProduct(null);
      setConfigData({});
    }
  };

  const formatMoney = (amount: number, symbol: string) => {
    // Determine decimals: CUP/MN/CUC should be integer
    const isCup = symbol === 'CUP' || symbol === 'MN' || symbol === 'CUC' || symbol === '₱';
    const decimals = isCup ? 0 : 2;
    const formatted = amount.toLocaleString('es-CU', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
    return `${symbol} ${formatted}`;
  };

  const addPaymentLine = () => {
    const newId = crypto.randomUUID();
    const curr = currencies.find(c => c.code === baseCurrency.code);
    let fillAmount = 0;
    if (remainingBase > 0) {
      const rawAmount = remainingBase / (curr?.rateToBase || 1);
      fillAmount = curr?.code === 'CUP' ? Math.round(rawAmount) : Math.round(rawAmount * 100) / 100;
    }
    const defaultBank = bankCards.find(c => c.currency === baseCurrency.code) || bankCards[0];
    setPaymentLines(prev => [...prev, { id: newId, code: baseCurrency.code, amount: fillAmount, method: 'cash', bankCardId: defaultBank?.id }]);
    setActivePaymentLineId(newId);
  };

  const updatePaymentLine = (id: string, field: keyof PaymentLine, value: any) => {
    const isCupSymbol = (s: string) => s === 'CUP' || s === 'MN' || s === 'CUC' || s === '₱';

    setPaymentLines(prev => {
      let nextLines = prev.map(p => {
        if (p.id !== id) return p;
        const updated = { ...p, [field]: value };

        // Handle currency conversion when code changes
        if (field === 'code' && value !== p.code) {
          const oldCurrency = currencies.find(c => c.code === p.code);
          const newCurrency = currencies.find(c => c.code === value);
          if (oldCurrency && newCurrency) {
            const amountInBase = p.amount * oldCurrency.rateToBase;
            const convertedAmount = amountInBase / newCurrency.rateToBase;
            // If new currency is CUP-like, round to integer, otherwise keep 2 decimals
            updated.amount = isCupSymbol(value) ? Math.round(convertedAmount) : Math.round(convertedAmount * 100) / 100;
          }
        }

        // If amount is directly edited and it's CUP, round to integer
        if (field === 'amount' && isCupSymbol(updated.code)) {
          updated.amount = Math.round(updated.amount);
        }

        if (field === 'method' && value === 'transfer') {
          // If transfer is selected, force CUP if not already
          if (updated.code !== 'CUP') {
            const oldCurrency = currencies.find(c => c.code === updated.code);
            const cupCurrency = currencies.find(c => c.code === 'CUP');
            if (oldCurrency && cupCurrency) {
              const amountInBase = updated.amount * oldCurrency.rateToBase;
              updated.amount = Math.round(amountInBase / cupCurrency.rateToBase);
            }
            updated.code = 'CUP';
          }
          
          if (!updated.bankCardId) {
            const matchingCard = bankCards.find(c => c.currency === updated.code) || bankCards[0];
            if (matchingCard) {
              updated.bankCardId = matchingCard.id;
            }
          }
        }

        // Ensure that if it's CUP, it's ALWAYS an integer regardless of the field being changed
        if (isCupSymbol(updated.code)) {
          updated.amount = Math.round(updated.amount);
        }

        if (field === 'code' && updated.method === 'transfer') {
          const matchingCard = bankCards.find(c => c.currency === value) || bankCards[0];
          if (matchingCard) {
            updated.bankCardId = matchingCard.id;
          }
        }
        return updated;
      });
      return nextLines;
    });
  };

  const removePaymentLine = (id: string) => {
    setPaymentLines(prev => {
      const filtered = prev.filter(p => p.id !== id);
      if (activePaymentLineId === id && filtered.length > 0) {
        setActivePaymentLineId(filtered[0].id);
      }
      return filtered;
    });
  };

  const autoFillRemaining = (id: string) => {
    const line = paymentLines.find(p => p.id === id);
    if (!line) return;
    const currency = currencies.find(c => c.code === line.code);
    if (!currency || !Number.isFinite(currency.rateToBase) || currency.rateToBase <= 0) return;

    // Completa exactamente lo que falta. No se suma al importe existente,
    // porque eso podía duplicar el importe al volver a pulsar "Total a cobrar".
    const paidByOtherLines = paymentLines.reduce((sum, p) => {
      if (p.id === id) return sum;
      return sum + toBaseAmount(p.amount, p.code);
    }, 0);
    const missingBase = Math.max(0, roundBaseAmount(totalBase - paidByOtherLines));
    const amountNeededInCurrency = missingBase / getSafeRateToBase(line.code);
    const roundedAmount = (line.code === 'CUP' || line.code === 'MN' || line.code === 'CUC')
      ? Math.round(amountNeededInCurrency)
      : Math.round(amountNeededInCurrency * 100) / 100;

    updatePaymentLine(id, 'amount', roundedAmount);
  };

  const splitUsdPayment = (id: string) => {
    const line = paymentLines.find(p => p.id === id);
    if (!line || line.code !== 'USD') return;
    
    const usdCurrency = currencies.find(c => c.code === 'USD');
    const cupCurrency = currencies.find(c => c.code === 'CUP');
    if (!usdCurrency || !cupCurrency) return;

    // Take the integer part of the CURRENT amount in this line
    const integerPart = Math.floor(line.amount);
    
    // Calculate base currency covered by OTHER lines
    const coveredByOthers = paymentLines.reduce((sum, p) => {
      if (p.id === id) return sum;
      const curr = currencies.find(c => c.code === p.code);
      return sum + (p.amount * (curr?.rateToBase || 0));
    }, 0);

    // Calculate base currency covered by the integer USD part
    const coveredByUsdInteger = integerPart * usdCurrency.rateToBase;
    
    // The exact remainder needed in base currency to reach totalBase
    const remainderBase = totalBase - (coveredByOthers + coveredByUsdInteger);
    
    // Convert to CUP and round to integer
    const remainderCup = Math.max(0, Math.round(remainderBase / cupCurrency.rateToBase));

    // 1. Update current line to integer USD
    updatePaymentLine(id, 'amount', integerPart);

    // 2. Add or Update CUP line
    // Search for any existing CUP cash line that is NOT the current line
    const existingCupLine = paymentLines.find(p => (p.code === 'CUP' || p.code === 'MN') && p.method === 'cash' && p.id !== id);
    
    if (existingCupLine) {
      updatePaymentLine(existingCupLine.id, 'amount', existingCupLine.amount + remainderCup);
      setActivePaymentLineId(existingCupLine.id);
    } else if (remainderCup > 0) {
      const newId = crypto.randomUUID();
      const defaultCupBank = bankCards.find(c => c.currency === 'CUP') || bankCards[0];
      setPaymentLines(prev => [...prev, { 
        id: newId, 
        code: 'CUP', 
        amount: remainderCup, 
        method: 'cash', 
        bankCardId: defaultCupBank?.id 
      }]);
      setActivePaymentLineId(newId);
    }
  };

  const openCheckout = () => {
    if (!currentSession) {
      setPosError("No hay un turno de caja abierto en esta sucursal. Por favor, abre un turno para comenzar a cobrar.");
      setShowOpenShiftModal(true);
      return;
    }
    const newId = crypto.randomUUID();
    const defaultBank = bankCards.find(c => c.currency === baseCurrency.code) || bankCards[0];
    setPaymentLines([
      {
        id: newId,
        code: baseCurrency.code,
        amount: totalBase,
        method: 'cash',
        bankCardId: defaultBank?.id
      }
    ]);
    setActivePaymentLineId(newId);
    setShowCheckoutModal(true);
  };

  const handlePairBluetooth = async () => {
    setIsConnectingPrinter(true);
    setPrinterStatusMsg("Buscando impresora Bluetooth...");
    try {
      const device = await connectBluetoothPrinter();
      setConnectedPrinterName(device.name || "Impresora Bluetooth 58mm");
      setPosSuccess(`Impresora "${device.name || 'Bluetooth'}" conectada`);
      setPrinterStatusMsg(`Conectado a ${device.name || 'Bluetooth'}`);
      setTimeout(() => setPosSuccess(""), 3000);
    } catch (err: any) {
      console.warn("Bluetooth connection error:", err);
      setPosError(err.message || "No se pudo conectar la impresora Bluetooth");
      setPrinterStatusMsg(err.message || "Error al conectar");
      setTimeout(() => setPosError(""), 4000);
    } finally {
      setIsConnectingPrinter(false);
    }
  };

  const handleConnectUsb = async () => {
    setIsConnectingPrinter(true);
    setPrinterStatusMsg("Buscando impresora USB...");
    try {
      await connectPrinter();
      setConnectedPrinterName("Impresora USB (Serie)");
      setPosSuccess("Impresora USB conectada correctamente");
      setPrinterStatusMsg("Impresora USB conectada");
      setTimeout(() => setPosSuccess(""), 3000);
    } catch (err: any) {
      console.warn("USB connection error:", err);
      setPosError(err.message || "No se pudo conectar la impresora USB");
      setPrinterStatusMsg(err.message || "Error al conectar");
      setTimeout(() => setPosError(""), 4000);
    } finally {
      setIsConnectingPrinter(false);
    }
  };

  const getTransactionReceiptLines = (tx: import("../types").Transaction): string[] => {
    const receiptConfig = useStore.getState().receiptConfig;
    const lines: string[] = [];
    
    if (receiptConfig.showLogo !== false && receiptConfig.businessName) {
      lines.push(`CENTER|BOLD|${receiptConfig.businessName}`);
    }
    if (receiptConfig.showAddress && receiptConfig.businessAddress) lines.push(`CENTER|${receiptConfig.businessAddress}`);
    if (receiptConfig.showPhone && receiptConfig.businessPhone) lines.push(`CENTER|${receiptConfig.businessPhone}`);
    
    lines.push("---");
    lines.push(`Ticket ID: ${tx.id}`);
    lines.push(`Fecha: ${new Date(tx.date).toLocaleDateString()} ${new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    const sellerDisplay = tx.cashierName || (currentSession?.workerName) || users.find(u => u.id === tx.userId)?.name || 'Vendedor';
    lines.push(`Vendedor: ${sellerDisplay.toUpperCase()}`);
    const customer = useStore.getState().customers.find(c => c.id === tx.customerId);
    lines.push(`Cliente: ${(customer?.name || 'Consumidor Final').slice(0, 22)}`);
    lines.push("---");
    
    tx.items.forEach(item => {
      const prodName = typeof (item.product as any) === 'object' ? ((item.product as any)?.name || 'Producto') : (products.find(p => p.id === (item.product as any))?.name || (item.product as any) || 'Producto');
      const prodPrice = typeof (item.product as any) === 'object' ? ((item.product as any)?.price || 0) : (products.find(p => p.id === (item.product as any))?.price || item.price || 0);
      const prodWarranty = typeof (item.product as any) === 'object' ? ((item.product as any)?.warrantyDays || 0) : (products.find(p => p.id === (item.product as any))?.warrantyDays || 0);
      const itemName = `${item.quantity}x ${prodName}`;
      const itemPrice = formatMoney(prodPrice * item.quantity, baseCurrency.symbol);
      const dots = Math.max(1, 32 - itemName.length - itemPrice.length);
      lines.push(`${itemName}${" ".repeat(dots)}${itemPrice}`);
      if (item.serialNumber) {
        lines.push(`  S/N: ${item.serialNumber}`);
      }
      if (item.warrantyCode) {
        lines.push(`  Gda: ${item.warrantyCode} (${prodWarranty}d)`);
      }
    });
    
    lines.push("---");
    const totLabel = "TOTAL:";
    const totVal = formatMoney(tx.total, baseCurrency.symbol);
    const totDots = Math.max(1, 32 - totLabel.length - totVal.length);
    lines.push(`BOLD|${totLabel}${" ".repeat(totDots)}${totVal}`);
    lines.push("---");
    
    lines.push("BOLD|Pagos recibidos:");
    (tx.payments || []).forEach(p => {
      const symbol = currencies.find(c => c.code === p.currencyCode)?.symbol || '';
      const method = p.method === 'cash' ? 'Efectivo' : 'Transf';
      const label = `  ${method} (${p.currencyCode}):`;
      const val = formatMoney(p.amount, symbol);
      const sp = Math.max(1, 32 - label.length - val.length);
      lines.push(`${label}${" ".repeat(sp)}${val}`);
    });
    
    if (tx.changePayments && tx.changePayments.length > 0) {
      lines.push("BOLD|Vuelto entregado:");
      tx.changePayments.forEach(cp => {
        const symbol = currencies.find(c => c.code === cp.currencyCode)?.symbol || '';
        const label = `  Efectivo (${cp.currencyCode}):`;
        const val = formatMoney(cp.amount, symbol);
        const sp = Math.max(1, 32 - label.length - val.length);
        lines.push(`${label}${" ".repeat(sp)}${val}`);
      });
    } else if (tx.changeGiven && tx.changeGiven > 0) {
      const label = "Vuelto:";
      const val = formatMoney(tx.changeGiven, baseCurrency.symbol);
      const sp = Math.max(1, 32 - label.length - val.length);
      lines.push(`${label}${" ".repeat(sp)}${val}`);
    }
    
    if (receiptConfig.showFooter && receiptConfig.footerText) {
      lines.push("---");
      lines.push(`CENTER|${receiptConfig.footerText}`);
    }

    return lines;
  };

  const getClosureReceiptLines = (session: CashRegisterSession): string[] => {
    const receiptConfig = useStore.getState().receiptConfig;
    const sessionTx = activeTransactions.filter(t => 
      t.sessionId === session.id && !t.deletedAt
    );

    const soldMap: { [name: string]: { name: string, qty: number, total: number } } = {};
    sessionTx.forEach(tx => {
      tx.items.forEach(item => {
        const name = typeof item.product === 'string' ? item.product : (item.product?.name || 'Producto');
        if (!soldMap[name]) soldMap[name] = { name, qty: 0, total: 0 };
        const price = typeof item.product === 'object' ? (item.product?.price || 0) : 0;
        soldMap[name].qty += item.quantity;
        soldMap[name].total += (price * item.quantity);
      });
    });
    const soldList = Object.values(soldMap);
    const totalSales = sessionTx.reduce((sum, tx) => sum + tx.total, 0);

    const commissions = sessionTx.reduce((sum, tx) => {
      return sum + tx.items.reduce((s, item) => {
        const prodId = typeof item.product === 'string' ? item.product : item.product.id;
        const prod = products.find(p => p.id === prodId);
        if (!prod) return s;
        const commValue = prod.commissionValue || 0;
        return s + (commValue * item.quantity);
      }, 0);
    }, 0);

    const employee = users.find(u => u.id === session.userId || u.name === session.workerName) || users.find(u => u.name?.toLowerCase() === session.workerName?.toLowerCase()) || users.find(u => u.role === 'employee') || currentUser;
    const isIndependent = employee?.isIndependent || false;

    // Calculate total cost for shop (what the independent seller owes the shop)
    const totalShopCost = sessionTx.reduce((sum, tx) => {
      return sum + tx.items.reduce((s, item) => {
        const prodId = typeof item.product === 'string' ? item.product : item.product.id;
        const prod = products.find(p => p.id === prodId);
        const cost = typeof item.product === 'object' ? (item.product?.costPrice || 0) : (prod?.costPrice || 0);
        return s + (cost * item.quantity);
      }, 0);
    }, 0);

    const baseSalary = isIndependent ? 0 : (employee?.baseSalary || 0);
    const totalSalary = isIndependent ? 0 : (baseSalary + commissions);

    const lines: string[] = [];
    lines.push(`CENTER|BOLD|${receiptConfig.businessName || 'MARÉ POS'}`);
    if (receiptConfig.showAddress && receiptConfig.businessAddress) lines.push(`CENTER|${receiptConfig.businessAddress}`);
    if (receiptConfig.showPhone && receiptConfig.businessPhone) lines.push(`CENTER|${receiptConfig.businessPhone}`);
    lines.push("---");
    lines.push("CENTER|BOLD|CIERRE DE CAJA / TURNO");
    lines.push(`TURNO: ${session.id}`);
    lines.push(`FECHA: ${new Date(session.closingDate || session.closedAt || new Date()).toLocaleDateString()}`);
    lines.push(`HORA: ${new Date(session.closingDate || session.closedAt || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    lines.push(`VENDEDOR: ${(session.workerName || 'VENDEDOR').toUpperCase()}${isIndependent ? ' (IND)' : ''}`);
    lines.push(`SUCURSAL: ${(branches.find(b => b.id === session.branchId)?.name || 'Central').slice(0, 18)}`);
    lines.push("---");
    lines.push("BOLD|PRODUCTOS VENDIDOS:");
    if (soldList.length === 0) {
      lines.push("Sin ventas registradas");
    } else {
      soldList.forEach(p => {
        const label = `${p.qty}x ${p.name.slice(0, 16)}`;
        const val = formatMoney(p.total, baseCurrency.symbol);
        const sp = Math.max(1, 32 - label.length - val.length);
        lines.push(`${label}${" ".repeat(sp)}${val}`);
      });
    }
    lines.push("---");
    const totSLabel = "TOTAL VENTAS:";
    const totSVal = formatMoney(totalSales, baseCurrency.symbol);
    lines.push(`BOLD|${totSLabel}${" ".repeat(Math.max(1, 32 - totSLabel.length - totSVal.length))}${totSVal}`);
    lines.push(`ITEMS TOTALES: ${soldList.reduce((s, i) => s + i.qty, 0)}`);
    lines.push("---");

    if (isIndependent) {
      lines.push("BOLD|LIQUIDACION INDEPENDIENTE:");
      const shopLabel = "Costo Fijo Tienda:";
      const shopVal = formatMoney(totalShopCost, baseCurrency.symbol);
      lines.push(`${shopLabel}${" ".repeat(Math.max(1, 32 - shopLabel.length - shopVal.length))}${shopVal}`);
} else {
      lines.push("BOLD|NOMINA / COMISIONES:");
      const salLabel = "Salario Base:";
      const salVal = formatMoney(baseSalary, baseCurrency.symbol);
      lines.push(`${salLabel}${" ".repeat(Math.max(1, 32 - salLabel.length - salVal.length))}${salVal}`);
      
      const comLabel = "Comisiones:";
      const comVal = formatMoney(commissions, baseCurrency.symbol);
      lines.push(`${comLabel}${" ".repeat(Math.max(1, 32 - comLabel.length - comVal.length))}${comVal}`);
      
      const netLabel = "Total a Pagar:";
      const netVal = formatMoney(totalSalary, baseCurrency.symbol);
      lines.push(`BOLD|${netLabel}${" ".repeat(Math.max(1, 32 - netLabel.length - netVal.length))}${netVal}`);
      
      const settlement = useStore.getState().salarySettlements.find(s => s.sessionId === session.id);
      if (settlement && settlement.discrepancyDeduction && settlement.discrepancyDeduction > 0) {
        const dedLabel = "(-) Descuento:";
        const dedVal = formatMoney(settlement.discrepancyDeduction, baseCurrency.symbol);
        lines.push(`${dedLabel}${" ".repeat(Math.max(1, 32 - dedLabel.length - dedVal.length))}${dedVal}`);
        
        const finalLabel = "NETO RECIBIR:";
        const finalVal = formatMoney(settlement.total, baseCurrency.symbol);
        lines.push(`BOLD|${finalLabel}${" ".repeat(Math.max(1, 32 - finalLabel.length - finalVal.length))}${finalVal}`);
      }
    }
    lines.push("---");
    lines.push("BOLD|COBROS POR METODO/MONEDA:");
    
    // Aggregate payments by currency and method
    const paymentTotals: { [key: string]: { code: string, method: string, amount: number } } = {};
    sessionTx.forEach(tx => {
      (tx.payments || []).forEach(p => {
        const key = `${p.currencyCode}-${p.method}`;
        if (!paymentTotals[key]) {
          paymentTotals[key] = { code: p.currencyCode, method: p.method, amount: 0 };
        }
        paymentTotals[key].amount += p.amount;
      });
    });

    const paymentKeys = Object.keys(paymentTotals);
    if (paymentKeys.length === 0) {
      lines.push("Sin cobros registrados");
    } else {
      paymentKeys.forEach(k => {
        const pt = paymentTotals[k];
        const methodLabel = pt.method === 'transfer' ? 'Transf' : 'Efec';
        const sym = currencies.find(c => c.code === pt.code)?.symbol || '';
        const label = `${methodLabel} (${pt.code}):`;
        const val = formatMoney(pt.amount, sym);
        const sp = Math.max(1, 32 - label.length - val.length);
        lines.push(`${label}${" ".repeat(sp)}${val}`);
      });
    }

    lines.push("---");
    lines.push("BOLD|ARQUEO DE FONDOS:");
    const fondoLabel = "Fondo Inicial:";
    const fondoVal = formatMoney(session.openingBalance, baseCurrency.symbol);
    lines.push(`${fondoLabel}${" ".repeat(Math.max(1, 32 - fondoLabel.length - fondoVal.length))}${fondoVal}`);
    lines.push("---");
    lines.push("BOLD|LIQUIDACION SALARIO:");
    const baseLabel = "Salario Base:";
    const baseVal = formatMoney(baseSalary, baseCurrency.symbol);
    lines.push(`${baseLabel}${" ".repeat(Math.max(1, 32 - baseLabel.length - baseVal.length))}${baseVal}`);
    const comLabel = "Comisiones:";
    const comVal = `+${formatMoney(commissions, baseCurrency.symbol)}`;
    lines.push(`${comLabel}${" ".repeat(Math.max(1, 32 - comLabel.length - comVal.length))}${comVal}`);
    const totSalLabel = "TOTAL SALARIO:";
    const totSalVal = formatMoney(totalSalary, baseCurrency.symbol);
    lines.push(`BOLD|${totSalLabel}${" ".repeat(Math.max(1, 32 - totSalLabel.length - totSalVal.length))}${totSalVal}`);
    lines.push("---");
    lines.push("CENTER|Firma: _________________");
    lines.push("CENTER|MARÉ SISTEMA POS");

    return lines;
  };

  const handleThermalPrint = async (tx: import("../types").Transaction, options?: { silent?: boolean }) => {
    try {
      const lines = getTransactionReceiptLines(tx);
      await printThermalReceipt({
        lines,
        openDrawer: receiptConfig.openDrawer ?? true,
        width: (receiptConfig.printerWidth || '58mm') as '58mm' | '80mm',
        onSuccess: (method) => {
          if (!options?.silent) {
            setPosSuccess(`Ticket enviado a impresora (${method === 'bluetooth' ? 'Bluetooth' : 'USB/Serie'})`);
            setTimeout(() => setPosSuccess(""), 2500);
          }
        },
        onError: (error) => {
          if (!options?.silent) {
            setPosError(error?.message || "Sin conexión activa con impresora");
            setTimeout(() => setPosError(""), 3500);
          }
        }
      });
    } catch (err: any) {
      console.warn("Thermal print:", err);
      if (!options?.silent) {
        setPosError(err?.message || "No se pudo imprimir el ticket");
        setTimeout(() => setPosError(""), 3500);
      }
    }
  };

  const handlePrintClosureThermal = async (session: CashRegisterSession | null, options?: { silent?: boolean }) => {
    if (!session) return;
    try {
      const lines = getClosureReceiptLines(session);
      await printThermalReceipt({
        lines,
        openDrawer: false,
        width: (receiptConfig.printerWidth || '58mm') as '58mm' | '80mm',
        onSuccess: (method) => {
          if (!options?.silent) {
            setPosSuccess(`Cierre impreso (${method === 'bluetooth' ? 'Bluetooth' : 'USB/Serie'})`);
            setTimeout(() => setPosSuccess(""), 2500);
          }
        },
        onError: (error) => {
          if (!options?.silent) {
            setPosError(error?.message || "Sin conexión a impresora");
            setTimeout(() => setPosError(""), 3500);
          }
        }
      });
    } catch (err: any) {
      console.error('Error al imprimir comprobante de cierre:', err);
      if (!options?.silent) {
        setPosError(err?.message || "No se pudo imprimir el comprobante de cierre");
        setTimeout(() => setPosError(""), 3500);
      }
    }
  };

  const handleWhatsAppReceipt = (tx: Transaction) => {
    let phone = "";
    const customer = useStore.getState().customers.find(c => c.id === tx.customerId);
    if (customer?.phone) {
      phone = String(customer.phone || '').replace(/\D/g,'');
    } else {
      const input = window.prompt("Ingrese el número de WhatsApp del cliente:");
      if (!input) return;
      phone = String(input || '').replace(/\D/g,'');
    }
    
    if (!phone) {
      addNotification("Número de teléfono inválido.", 'error');
      return;
    }
    
    const storeName = useStore.getState().storeConfig.storeName;
    let itemsText = (tx.items || []).map(i => {
      const pName = typeof (i.product as any) === 'object' ? ((i.product as any)?.name || 'Producto') : (products.find(p => p.id === (i.product as any))?.name || (i.product as any) || 'Producto');
      const pPrice = typeof (i.product as any) === 'object' ? ((i.product as any)?.price || 0) : (products.find(p => p.id === (i.product as any))?.price || i.price || 0);
      return `${i.quantity}x ${pName} - ${formatMoney(pPrice * i.quantity, baseCurrency.symbol)}`;
    }).join('%0A');
    const text = `Hola, gracias por tu compra en *${storeName}*.%0A%0A*Detalle del recibo ${tx.id}:*%0A${itemsText}%0A%0A*Total:* ${formatMoney(tx.total, baseCurrency.symbol)}%0A%0A¡Vuelve pronto!`;
    const url = `https://wa.me/${phone}?text=${text}`;
    window.open(url, '_blank');
  };

  const handleEmailReceipt = (tx: Transaction) => {
    const customer = useStore.getState().customers.find(c => c.id === tx.customerId);
    if (!customer?.email) {
      addNotification("El cliente no tiene un correo registrado.", 'warning');
      return;
    }
    const storeName = useStore.getState().storeConfig.storeName;
    const subject = `Tu Recibo de Compra - ${storeName}`;
    const body = `Hola ${customer?.name || 'Cliente'},\n\nGracias por tu compra. Tu recibo es ${tx.id} por un total de ${formatMoney(tx.total, baseCurrency.symbol)}.\n\nSaludos,\n${storeName}`;
    const url = `mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  };

  const handleCheckout = async () => {
    if (isSubmittingCheckout) return;
    if (!currentSession) {
      setPosError('No existe un turno de caja activo para registrar esta venta.');
      setShowOpenShiftModal(true);
      return;
    }
    if (!Number.isFinite(totalBase) || totalBase <= 0) {
      setPosError('El total de la venta no es válido.');
      return;
    }
    if (remainingBase > (isCupBase ? 0 : 0.01)) {
      setPosError(`Falta por cobrar ${formatMoney(remainingBase, baseCurrency.symbol)}.`);
      return;
    }
    const invalidTransfer = paymentLines.some(l =>
      l.method === 'transfer' &&
      (!l.bankCardId || !bankCards.some(c => c.id === l.bankCardId && (c.currency === l.code || (l.code === 'MN' && c.currency === 'CUP'))))
    );
    if (invalidTransfer) {
      setPosError('Seleccione una cuenta bancaria válida para cada pago por transferencia.');
      return;
    }
    setIsSubmittingCheckout(true);
    setPosError("");
    setPosSuccess("");
    try {
      // Final payments with rounded USD
    const finalizedPayments: import('../types').Payment[] = paymentLines
      .filter(p => Number.isFinite(p.amount) && p.amount > 0)
      .map(p => {
        const currency = currencies.find(c => c.code === p.code);
        // La moneda base siempre tiene tasa 1. No exigimos rateToBase remoto
        // para la moneda base, evitando bloquear cobros correctamente configurados.
        const isPaymentBaseCurrency = p.code === baseCurrency.code || (p.code === 'MN' && baseCurrency.code === 'CUP');
        const configuredRate = Number(currency?.rateToBase);
        const exchangeRate = isPaymentBaseCurrency
          ? 1
          : (Number.isFinite(configuredRate) && configuredRate > 0 ? configuredRate : null);
        if (exchangeRate === null) {
          throw new Error('No existe una tasa de cambio válida para ' + p.code + '. Actualiza las monedas antes de cobrar.');
        }
        let amount = p.amount;
        if (p.code === 'CUP') {
          amount = Math.round(amount);
        } else if (p.code === 'USD' && p.method === 'cash') {
          amount = Math.round(amount * 100) / 100;
        }
        return {
          currencyCode: p.code as any,
          amount: amount,
          exchangeRate,
Effect, useRef, useMemo, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { Search, Wifi, WifiOff, RefreshCw, Plus, Minus, CreditCard, Receipt, Trash2, ShoppingCart, ShieldCheck, DollarSign, Banknote, QrCode, ArrowLeftRight, UserPlus, X, Lock, Unlock, Camera, AlertCircle, TrendingUp, Wallet, MessageSquare, Mail, HelpCircle, Calculator, ArrowRight, Package, User, RotateCcw, Printer, Bluetooth, Usb, Smartphone, Send, Copy, Check, CheckCircle, Share2, Store, ChevronDown, ChevronUp, Filter } from "lucide-react";
import type { Html5QrcodeScanner } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import { cn, generateId } from "../lib/utils";
import {
  connectBluetoothPrinter,
  connectPrinter,
  getConnectedDeviceName,
  printThermalReceipt
} from "../lib/escpos";
import { useStore } from "../store/useStore";
import { Product, Payment, Transaction, CashRegisterSession } from "../types";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { InfoTooltip } from "../components/InfoTooltip";
import { getOfflineQueueCount, getOfflineConflictCount } from "../services/offlineQueue";
import { normalizeSemanticText } from "../utils/textUtils";
import { POSCatalog } from "../components/POSCatalog";
const CheckoutModal = lazy(() => import("../components/pos/CheckoutModal"));

const POSReceiptModal = lazy(() => import("../components/POSReceiptModal"));
const POSPrinterSetupModal = lazy(() => import("../components/POSPrinterSetupModal"));

const EMPTY_TRANSACTIONS: Transaction[] = [];
const EMPTY_CASH_SESSIONS: CashRegisterSession[] = [];

export default function POS() {
  const [showCashManagementModal, setShowCashManagementModal] = useState(false);
  const [lastClosedSession, setLastClosedSession] = useState<CashRegisterSession | null>(null);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const { categories, products, cart, addToCart, updateCartQty, clearCart, processTransaction, branches, currentBranchId, setCurrentBranch, activeSessionId, setActiveSessionId, currencies, getBaseCurrency, currentCustomerId, setCartCustomer, currentUser, pendingOrders, removePendingOrder, getCurrentSession, openSession, closeSession, addCashMovement, removeCashMovement, inventory, addCustomer, bankCards, addBankTransaction, customers, users, logout, createReturn, processReturn, receiptConfig, idnSettlementPrices, addIDNSettlementPrice, updateIDNSettlementPrice, deleteIDNSettlementPrice, setInventoryQuantity, addNotification, joinOpenSession, salarySettlements } = useStore(useShallow((state) => ({ categories: state.categories, products: state.products, cart: state.cart, addToCart: state.addToCart, updateCartQty: state.updateCartQty, clearCart: state.clearCart, processTransaction: state.processTransaction, branches: state.branches, currentBranchId: state.currentBranchId, setCurrentBranch: state.setCurrentBranch, activeSessionId: state.activeSessionId, setActiveSessionId: state.setActiveSessionId, currencies: state.currencies, getBaseCurrency: state.getBaseCurrency, currentCustomerId: state.currentCustomerId, setCartCustomer: state.setCartCustomer, currentUser: state.currentUser, pendingOrders: state.pendingOrders, removePendingOrder: state.removePendingOrder, getCurrentSession: state.getCurrentSession, openSession: state.openSession, closeSession: state.closeSession, addCashMovement: state.addCashMovement, removeCashMovement: state.removeCashMovement, inventory: state.inventory, addCustomer: state.addCustomer, bankCards: state.bankCards, addBankTransaction: state.addBankTransaction, customers: state.customers, users: state.users, logout: state.logout, createReturn: state.createReturn, processReturn: state.processReturn, receiptConfig: state.receiptConfig, idnSettlementPrices: state.idnSettlementPrices, addIDNSettlementPrice: state.addIDNSettlementPrice, updateIDNSettlementPrice: state.updateIDNSettlementPrice, deleteIDNSettlementPrice: state.deleteIDNSettlementPrice, setInventoryQuantity: state.setInventoryQuantity, addNotification: state.addNotification, joinOpenSession: state.joinOpenSession, salarySettlements: state.salarySettlements })));


  // Heavy administrative collections subscribe only while their UI is visible.
  // Normal sales therefore do not re-render because a transaction/session changed elsewhere.
  const needsTransactions = showCashManagementModal || !!lastClosedSession;
  const transactions = useStore((state) => needsTransactions ? state.transactions : EMPTY_TRANSACTIONS);
  // cash_sessions es un conjunto pequeño y crítico para el selector/apertura.
  // Debe permanecer reactivo para mostrar inmediatamente qué trabajador ya tiene turno abierto.
  const cashSessions = useStore((state) => state.cashSessions);
  const activeCashSessions = useMemo(() => cashSessions.filter(s => !s.deletedAt), [cashSessions]);
  const openSessionForWorker = useCallback((workerId: string) => {
    return activeCashSessions.find(s =>
      s.status === 'open' &&
      (s.userId === workerId || s.workingEmployeeIds?.includes(workerId))
    ) || null;
  }, [activeCashSessions]);
  const activeTransactions = useMemo(() => transactions.filter(t => !t.deletedAt), [transactions]);
  const [idnFilter, setIdnFilter] = useState("");
  const [debouncedIdnFilter, setDebouncedIdnFilter] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedIdnFilter(idnFilter);
    }, 200);
    return () => clearTimeout(timer);
  }, [idnFilter]);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [idnPhysicalCounts, setIdnPhysicalCounts] = useState<{ [productId: string]: number }>({});
  const [isProcessingIDN, setIsProcessingIDN] = useState(false);
  const [idnSelectedProductFilter, setIdnSelectedProductFilter] = useState("all");

  const [showIDNReceiptModal, setShowIDNReceiptModal] = useState<{
    tx: Transaction;
    details: any[];
    workerName: string;
    branchName: string;
    totalToPay: number;
    publicSales: number;
    date: string;
  } | null>(null);

  const [showSetSettlementPriceModal, setShowSetSettlementPriceModal] = useState(false);
  const [idnPriceFormProduct, setIdnPriceFormProduct] = useState("");
  const [idnPriceFormAmount, setIdnPriceFormAmount] = useState("");


  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(getOfflineQueueCount());
  const [offlineConflictCount, setOfflineConflictCount] = useState(getOfflineConflictCount());
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);

  useEffect(() => {
    const updateCount = () => {
      setPendingOfflineCount(getOfflineQueueCount());
      setOfflineConflictCount(getOfflineConflictCount());
    };
    const handleOnline = () => {
      setIsOnline(true);
      updateCount();
    };
    const handleOffline = () => {
      setIsOnline(false);
      updateCount();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline_queue_updated', updateCount);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline_queue_updated', updateCount);
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline) {
      addNotification('No hay conexión a internet actualmente.', 'warning');
      return;
    }
    setIsSyncingOffline(true);
    try {
      const { processOfflineQueue } = await import("../services/offlineSync");
      const res = await processOfflineQueue();
      setPendingOfflineCount(res.remaining);
      setOfflineConflictCount(getOfflineConflictCount());
      if (res.remaining > 0 || getOfflineConflictCount() > 0) {
        addNotification(`Sincronización incompleta: ${res.processed} operaciones procesadas y ${res.remaining} siguen pendientes.`, 'warning');
      } else if (res.processed > 0) {
        addNotification(`Sincronización manual completada: ${res.processed} operaciones confirmadas.`, 'success');
      } else if (getOfflineConflictCount() > 0) {
        addNotification('La cola tiene ' + getOfflineConflictCount() + ' conflicto(s) que requieren revisión.', 'warning');
      } else {
        addNotification('Todo está al día y sincronizado con Supabase.', 'info');
      }
    } finally {
      setIsSyncingOffline(false);
    }
  };
  
  // Cash Management State
  const [cashManagementTab, setCashManagementTab] = useState<'movements' | 'close' | 'sales'>('movements');
  const [closingBalances, setClosingBalances] = useState<{ [key: string]: number }>({});
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);
  const [finalBalancesToClose, setFinalBalancesToClose] = useState<Payment[]>([]);
  const [movementData, setMovementData] = useState({ type: 'expense' as 'income' | 'expense', amount: '', currencyCode: 'CUP', description: '' });

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', taxId: '' });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [configData, setConfigData] = useState<{ serialNumber?: string, selectedSize?: string, selectedColor?: string }>({});
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [isBottomBarMinimized, setIsBottomBarMinimized] = useState(false);
  
  const queryParams = new URLSearchParams(window.location.search);
  
  
  const navigate = useNavigate();
  const fallbackSessionBranchId = currentBranchId || (currentUser?.branchId || currentUser?.assignedBranchId || branches[0]?.id || '');
  const currentSession = useMemo(() => {
    if (activeSessionId) {
      const active = cashSessions.find(s => s.id === activeSessionId && s.status === 'open' && !s.deletedAt);
      if (active) return active;
    }
    // Recuperación automática para cuentas que son propietarias del turno.
    return getCurrentSession(fallbackSessionBranchId, currentUser?.id || '');
  }, [activeSessionId, cashSessions, fallbackSessionBranchId, currentUser?.id, getCurrentSession]);

  useEffect(() => {
    if (activeSessionId) return;
    if (!currentUser?.id) return;
    const own = getCurrentSession(fallbackSessionBranchId, currentUser.id);
    if (own?.id && activeSessionId !== own.id) setActiveSessionId(own.id);
  }, [activeSessionId, currentUser?.id, fallbackSessionBranchId, cashSessions, getCurrentSession, setActiveSessionId]);

  // Al entrar al POS/volver al foco, actualizar operaciones de caja y catálogo.
  // Esto evita que un selector abierto durante horas conserve una lista vieja.
  useEffect(() => {
    if (!currentUser || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    const run = async () => {
      try {
        await useStore.getState().refreshGlobalCatalogData();
        await useStore.getState().refreshBranchOperationalData();
      } catch (error) {
        console.warn('[POS] No se pudo refrescar el estado operativo al entrar:', error);
      }
    };
    void run();
  }, [currentUser?.id, fallbackSessionBranchId]);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showSalarySummary, setShowSalarySummary] = useState(false);
  const [connectedPrinterName, setConnectedPrinterName] = useState<string | null>(null);
  const [showPrinterSetupModal, setShowPrinterSetupModal] = useState(false);
  const [isConnectingPrinter, setIsConnectingPrinter] = useState(false);
  const [printerStatusMsg, setPrinterStatusMsg] = useState("");

  useEffect(() => {
    import('../lib/escpos').then(async ({ getConnectedDeviceName }) => {
      const name = await getConnectedDeviceName();
      if (name) setConnectedPrinterName(name);
    }).catch(() => {});
  }, []);
  
  type PaymentLine = { id: string, code: string, amount: number, method: 'cash' | 'transfer', bankCardId?: string };
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);
  const [showReceiptModal, setShowReceiptModal] = useState<Transaction | null>(null);
  const [returnConfirm, setReturnConfirm] = useState<{ tx: Transaction, item: any } | null>(null);

  const [activePaymentLineId, setActivePaymentLineId] = useState<string | null>(null);

  const [salesFilter, setSalesFilter] = useState<'all' | 'usd' | 'transfer' | 'cash_cup' | 'mixed'>('all');
  const [salesSubTab, setSalesSubTab] = useState<'tickets' | 'products'>('tickets');

  const [posError, setPosError] = useState("");
  const [posSuccess, setPosSuccess] = useState("");
  const [openingAmount, setOpeningAmount] = useState("");
  const [sessionWorkerName, setSessionWorkerName] = useState("");
  const [sessionWorkerId, setSessionWorkerId] = useState("");
  // La identidad del trabajador debe reconstruirse desde la sesión persistida
  // después de cambiar de módulo, recargar la página o rehidratar Zustand.
  useEffect(() => {
    // Mantener la selección manual del vendedor mientras se prepara la apertura.
    // No hay sesión abierta todavía, por lo que currentSession es null y no debe
    // borrar sessionWorkerName justo después de que el usuario lo selecciona.
    if (!currentSession) return;
    if (sessionWorkerName !== (currentSession.workerName || "")) {
      setSessionWorkerName(currentSession.workerName || "");
    }
    if (sessionWorkerId !== (currentSession.userId || "")) {
      setSessionWorkerId(currentSession.userId || "");
    }
    if (currentBranchId !== currentSession.branchId) {
      setCurrentBranch(currentSession.branchId);
    }
  }, [currentSession?.id, currentSession?.userId, currentSession?.workerName, currentSession?.branchId, sessionWorkerName, sessionWorkerId, currentBranchId, setCurrentBranch]);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [employeePickerSearch, setEmployeePickerSearch] = useState("");
  const employeePickerRef = useRef<HTMLDivElement>(null);
  const [sessionPassword, setSessionPassword] = useState("");

  useEffect(() => {
    if (!employeePickerOpen) return;

    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && employeePickerRef.current?.contains(target)) return;
      setEmployeePickerOpen(false);
      setEmployeePickerSearch("");
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setEmployeePickerOpen(false);
      setEmployeePickerSearch("");
    };

    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [employeePickerOpen]);
  const [isOpeningSession, setIsOpeningSession] = useState(false);
  const [isClosingSession, setIsClosingSession] = useState(false);

  const [joiningSessionPassword, setJoiningSessionPassword] = useState("");
  const [isNewEmployee, setIsNewEmployee] = useState(false);

  // Worker detection for shift opening and branch locking
  const detectedWorker = React.useMemo(() => {
    if (sessionWorkerId) {
      const byId = (users || []).find(u => u.id === sessionWorkerId);
      if (byId) return byId;
    }
    const trimmed = (sessionWorkerName || '').toLowerCase().trim();
    if (trimmed) {
      return (users || []).find(u => (u.name || '').toLowerCase() === trimmed) || null;
    }
    return null;
  }, [sessionWorkerId, sessionWorkerName, users]);

  const isWorkerIndependent = detectedWorker?.isIndependent === true;
  const workerAssignedBranchId = detectedWorker?.assignedBranchId || (
    detectedWorker?.allowedBranches && detectedWorker.allowedBranches.length === 1 ? detectedWorker.allowedBranches[0] : null
  );

  const [posViewMode, setPosViewMode] = useState<'standard' | 'idn'>('standard');
  const [selectedAdminIDNUserId, setSelectedAdminIDNUserId] = useState<string>('');

  const isCurrentUserIndependent = currentUser?.isIndependent === true;
  const currentSessionWorker = currentSession ? (
    (users || []).find(u => u.id === currentSession.userId || (u.name && currentSession.workerName && u.name.toLowerCase() === currentSession.workerName.toLowerCase()))
  ) : null;
  const isSessionIndependent = currentSessionWorker?.isIndependent === true;

  const independentUsers = (users || []).filter(u => u.isIndependent);

  useEffect(() => {
    if (!selectedAdminIDNUserId && independentUsers.length > 0) {
      setSelectedAdminIDNUserId(independentUsers[0].id);
    }
  }, [independentUsers, selectedAdminIDNUserId]);

  // When a shift is opened for an independent worker or current user is independent, default view to 'idn'
  useEffect(() => {
    if (isSessionIndependent || isCurrentUserIndependent) {
      setPosViewMode('idn');
    }
  }, [isSessionIndependent, isCurrentUserIndependent]);

  const shouldShowIDNView = isCurrentUserIndependent || isSessionIndependent || posViewMode === 'idn';

  const activeIDNWorker = React.useMemo(() => {
    // En la vista administrativa, la selección explícita del vendedor siempre
    // tiene prioridad. Así el selector no pierde el valor al cambiar de vendedor.
    if (currentUser?.role === 'admin' && selectedAdminIDNUserId) {
      const selected = (users || []).find(u => u.id === selectedAdminIDNUserId && u.isIndependent);
      if (selected) return selected;
    }
    if (isCurrentUserIndependent) return currentUser;
    if (isSessionIndependent) return currentSessionWorker;
    return (users || []).find(u => u.isIndependent) || currentUser;
  }, [currentUser?.role, isCurrentUserIndependent, isSessionIndependent, selectedAdminIDNUserId, users, currentUser, currentSessionWorker]);

  const activeIDNBranchId = activeIDNWorker?.assignedBranchId || activeIDNWorker?.branchId || currentBranchId;

  // Auto-lock sessionBranchId if worker has an assigned branch
  useEffect(() => {
    if (workerAssignedBranchId) {
      setSessionBranchId(workerAssignedBranchId);
    }
  }, [workerAssignedBranchId]);

  useEffect(() => {
    if (sessionWorkerName) {
      const exists = users.find(u => (u.name || '').toLowerCase() === sessionWorkerName.toLowerCase().trim());
      setIsNewEmployee(!exists);
    } else {
      setIsNewEmployee(false);
    }
  }, [sessionWorkerName, users]);
  
  const isBranchLocked = Boolean(
    workerAssignedBranchId ||
    (currentUser?.role !== 'admin' && currentUser?.assignedBranchId) ||
    (currentSession && ((users || []).find(u => u.id === currentSession.userId)?.assignedBranchId))
  );

  const allowedBranches = React.useMemo(() => {
    // Administradores pueden operar todas las sucursales.
    if (currentUser?.role === 'admin') return branches || [];

    // En el flujo trabajador -> seleccionar empleado -> contraseña, el alcance
    // de sucursal debe corresponder al trabajador seleccionado, no a la cuenta
    // que inició sesión.
    const scopeUser = detectedWorker || currentUser;
    const assignedId = scopeUser?.assignedBranchId || scopeUser?.branchId;
    if (assignedId) {
      return (branches || []).filter(b => b.id === assignedId);
    }
    if (scopeUser?.allowedBranches && scopeUser.allowedBranches.length > 0) {
      return (branches || []).filter(b => scopeUser.allowedBranches!.includes(b.id));
    }
    return [];
  }, [currentUser, detectedWorker, branches, workerAssignedBranchId]);
    
  const [showConfirmIDNModal, setShowConfirmIDNModal] = useState(false);

  const [sessionBranchId, setSessionBranchId] = useState<string>(
    currentBranchId || ((allowedBranches || []).length > 0 ? allowedBranches[0].id : "")
  );

  const handleCloseIDNAccount = () => {
    const targetWorker = activeIDNWorker;
    const branchId = activeIDNBranchId;
    if (!targetWorker) {
      setPosError("No se ha seleccionado ningún vendedor independiente.");
      return;
    }
    if (!branchId) {
      setPosError("El vendedor no tiene un almacén asignado para liquidar.");
      return;
    }
    setShowConfirmIDNModal(true);
  };

  const handleExecuteIDNSettlement = async () => {
    const targetWorker = activeIDNWorker;
    const branchId = activeIDNBranchId;
    if (!targetWorker || !branchId) {
      setShowConfirmIDNModal(false);
      return;
    }

    setIsProcessingIDN(true);
    try {
      const settlementDetails: any[] = [];
      let totalToPay = 0;

      const branchInventory = (inventory || []).filter(i => i.branchId === branchId);
      
      for (const invItem of branchInventory) {
        const product = (products || []).find(p => p.id === invItem.productId);
        if (!product) continue;

        const settlementPrice = (idnSettlementPrices || []).find(
          sp => sp.userId === targetWorker.id && sp.productId === product.id
        )?.settlementPrice || product.costPrice || 0;

        const physicalCount = idnPhysicalCounts[product.id] ?? invItem.quantity;
        const soldQty = Math.max(0, invItem.quantity - physicalCount);

        if (soldQty > 0) {
          const subtotal = soldQty * settlementPrice;
          totalToPay += subtotal;
          settlementDetails.push({
            productId: product.id,
            name: product.name,
            sku: product.sku,
            qty: soldQty,
            publicPrice: product.price || 0,
            price: settlementPrice,
            subtotal
          });
        } else if (physicalCount > invItem.quantity) {
          // If physical count was manually increased above system stock without sales, update stock directly
          setInventoryQuantity(product.id, branchId, physicalCount);
        }
      }

      // Permitir liquidación con 0 ventas o 0 CUP de acuerdo a la solicitud del usuario
      const currentTransactions = useStore.getState().transactions.filter(t => !t.deletedAt);
      const maxIdnNum = currentTransactions.reduce((max, t) => {
        const match = t.id?.match(/LIQ-IDN-(\d+)/i);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 0);
      let nextIdnNum = Math.max(currentTransactions.length, maxIdnNum) + 1;
      let idnTxId = `LIQ-IDN-${nextIdnNum.toString().padStart(2, '0')}`;
      if (currentTransactions.some(t => t.id === idnTxId)) {
        const wSuffix = targetWorker.name?.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase() || 'W';
        idnTxId = `LIQ-IDN-${nextIdnNum.toString().padStart(2, '0')}-${wSuffix}`;
      }

      const transaction: Transaction = {
        id: idnTxId,
        items: settlementDetails.map(d => ({
          id: crypto.randomUUID(),
          product: (products || []).find(p => p.id === d.productId) || {
            id: d.productId,
            name: d.name,
            price: d.publicPrice,
            costPrice: d.price,
            sku: d.sku || 'IDN'
          } as any,
          quantity: d.qty,
          price: d.price,
          total: d.subtotal
        })),
        total: totalToPay,
        date: new Date().toISOString(),
        paymentMethod: 'cash',
        payments: [{
          method: 'cash',
          amount: totalToPay,
          currencyCode: baseCurrency.code,
          exchangeRate: 1
        }],
        branchId: branchId,
        userId: targetWorker.id,
        cashierName: targetWorker.name,
        sessionId: currentSession?.id,
        notes: 'LIQUIDACION_IDN',
        status: 'completed'
      };

      // La liquidación IDN debe quedar confirmada o durablemente encolada
      // antes de mostrar éxito y, especialmente, antes de cerrar el turno.
      const saved = await useStore.getState().processTransaction(transaction);
      if (!saved) {
        setPosError('La liquidación IDN no fue confirmada. El turno permanece abierto y la operación sigue protegida para reintento.');
        return;
      }

      const branchName = branches.find(b => b.id === branchId)?.name || 'Almacén Asignado';
      const totalPublicSales = settlementDetails.reduce((sum, d) => sum + ((d.publicPrice || d.price) * d.qty), 0);
      const receiptData = {
        tx: transaction,
        details: settlementDetails,
        workerName: targetWorker.name || 'Vendedor IDN',
        branchName: branchName,
        totalToPay: totalToPay,
        publicSales: totalPublicSales,
        date: transaction.date
      };

      setShowIDNReceiptModal(receiptData);
      setIdnPhysicalCounts({});
      setPosSuccess(`Liquidación de ${targetWorker.name} procesada correctamente.`);
      setTimeout(() => setPosSuccess(""), 3500);
      setShowConfirmIDNModal(false);
    } catch (err) {
      console.error("Error in IDN settlement:", err);
      setPosError("Error al procesar la liquidación.");
    } finally {
      setIsProcessingIDN(false);
    }
  };

  const handlePrintIDNThermal = async (data: typeof showIDNReceiptModal) => {
    if (!data) return;
    try {
      const lines: string[] = [
        `CENTER|BOLD|${receiptConfig.businessName || 'MARÉ'}`,
        "CENTER|VALE DE LIQUIDACION IDN",
        `VENDEDOR: ${(data.workerName || 'VENDEDOR').toUpperCase()}`,
        `ALMACEN: ${(data.branchName || 'ALMACEN').toUpperCase()}`,
        `FECHA: ${new Date(data.date).toLocaleString()}`,
        "---",
        "BOLD|DETALLE DE VENTAS (CUP):",
      ];
      (data.details || []).forEach(d => {
        const label = `${d.qty}x ${(d.name || '').slice(0, 16)}`;
        const val = `${baseCurrency.symbol}${d.subtotal.toLocaleString()} CUP`;
        const spaceCount = Math.max(1, 32 - label.length - val.length);
        lines.push(`${label}${" ".repeat(spaceCount)}${val}`);
      });
      lines.push("---");
      lines.push(`BOLD|TOTAL LIQUIDAR: ${baseCurrency.symbol}${data.totalToPay.toLocaleString()} CUP`);
      lines.push("---");
      lines.push("CENTER|CUADRE REALIZADO CON EXITO");
      await printThermalReceipt({
        lines,
        width: (receiptConfig.printerWidth || '58mm') as '58mm' | '80mm'
      });
      setPosSuccess("Vale de liquidación enviado a la impresora.");
      setTimeout(() => setPosSuccess(""), 3000);
    } catch (printErr: any) {
      console.warn("Thermal print error:", printErr);
      setPosError(printErr?.message || "No se pudo imprimir el ticket.");
      setTimeout(() => setPosError(""), 3500);
    }
  };

  const [deductFromSalary, setDeductFromSalary] = useState(false);

  const [showCancelShiftModal, setShowCancelShiftModal] = useState(false);
  const [cancelShiftPassword, setCancelShiftPassword] = useState("");
  const [isCancellingShift, setIsCancellingShift] = useState(false);
  const [isExitingIDN, setIsExitingIDN] = useState(false);
  const [isFinishingIDN, setIsFinishingIDN] = useState(false);

  const handleCancelShift = async () => {
    if (!currentSession || isCancellingShift) return;

    const worker = users.find(u =>
      u.id === currentSession.userId ||
      (u.name && currentSession.workerName && u.name.toLowerCase() === currentSession.workerName.toLowerCase())
    );

    const isAdminAuthorized =
      currentUser?.role === 'admin' &&
      !!currentUser.password &&
      cancelShiftPassword === currentUser.password;

    const isWorkerAuthorized =
      currentUser?.role !== 'admin' &&
      !!worker?.password &&
      cancelShiftPassword === worker.password &&
      worker.isActive !== false;

    if (!isAdminAuthorized && !isWorkerAuthorized) {
      setPosError(
        currentUser?.role === 'admin'
          ? "Contraseña de administrador incorrecta."
          : `Debes ingresar la contraseña del trabajador del turno (${worker?.name || 'trabajador'}).`
      );
      setTimeout(() => setPosError(""), 3000);
      return;
    }

    setIsCancellingShift(true);
    setPosError("");
    try {
      const sessionId = currentSession.id;
      const ok = await useStore.getState().cancelSession(sessionId);
      if (!ok) {
        setPosError("No se pudo cancelar el turno. La operación no fue confirmada; el turno sigue abierto.");
        return;
      }

      setShowCancelShiftModal(false);
      setCancelShiftPassword("");
      setShowCashManagementModal(false);
      setShowDiscrepancyModal(false);
      setClosingBalances({});
      setFinalBalancesToClose([]);
      setCashManagementTab('movements');
      setDeductFromSalary(false);
      setShowOpenShiftModal(false);
      setJoiningSessionId(null);
      setJoiningSessionPassword("");
      setLastClosedSession(null);
      setActiveSessionId(null);
      clearCart();

      setPosSuccess(
        isOnline
          ? "Turno cancelado correctamente. Regresando al selector de empleado."
          : "Turno cancelado localmente. La cancelación quedó guardada y se sincronizará al recuperar la conexión."
      );
      setTimeout(() => setPosSuccess(""), 3500);
    } catch (err: any) {
      console.error("[POS] Error cancelando turno:", err);
      setPosError(err?.message || "No se pudo cancelar el turno. El turno permanece abierto.");
    } finally {
      setIsCancellingShift(false);
    }
  };

  const handleFinishIDNAndGoHome = async () => {
    if (isFinishingIDN) return;
    setIsFinishingIDN(true);
    setPosError("");

    try {
      if (currentSession) {
        const closingBalances: Payment[] = [
          { currencyCode: baseCurrency.code, amount: showIDNReceiptModal?.totalToPay || 0, method: 'cash', exchangeRate: 1 }
        ];

        const ok = await closeSession(
          currentSession.id,
          closingBalances,
          activeIDNWorker?.name || currentSession.workerName
        );

        if (!ok) {
          setPosError("El cierre no fue confirmado. El turno permanece abierto para proteger las ventas.");
          return;
        }

        setLastClosedSession({
          ...currentSession,
          closedAt: new Date().toISOString(),
          closingDate: new Date().toISOString(),
          status: 'closed',
          closingBalances
        });
      }

      setShowIDNReceiptModal(null);
      setIdnPhysicalCounts({});
      setShowConfirmIDNModal(false);
      setPosViewMode('standard');
      setActiveSessionId(null);
      setSessionWorkerName(""); setSessionWorkerId("");
      setSessionPassword("");
      setPosSuccess("Liquidación completada. Sesión cerrada.");
      setTimeout(() => setPosSuccess(""), 3000);
    } catch (err: any) {
      console.error("[POS] Error finalizando liquidación IDN:", err);
      setPosError(err?.message || "No se pudo finalizar la liquidación.");
    } finally {
      setIsFinishingIDN(false);
    }
  };

  const handleCancelAndReturnToEmployeeSelector = async () => {
    if (isExitingIDN) return;

    setIsExitingIDN(true);
    setPosError("");

    try {
      const session = currentSession || (
        activeSessionId
          ? (useStore.getState().cashSessions || []).find(s => s.id === activeSessionId)
          : undefined
      );

      // "Cancelar / Salir" del flujo IDN cancela el turno únicamente cuando
      // todavía no existen ventas confirmadas. Nunca se deben borrar ventas
      // silenciosamente desde este botón.
      const sessionTransactions = session
        ? (useStore.getState().transactions || []).filter(
            tx => tx.sessionId === session.id && !tx.deletedAt
          )
        : [];

      if (session && sessionTransactions.length > 0) {
        setPosError("Este turno ya tiene ventas registradas. No se puede cancelar silenciosamente desde aquí; usa Cerrar Caja o Cancelar Turno.");
        return;
      }

      if (session) {
        const cancelled = await useStore.getState().cancelSession(
          session.id,
          'Cancelación del POS IDN antes de registrar ventas'
        );
        if (!cancelled) {
          setPosError("No se pudo cancelar el turno. La operación no fue confirmada.");
          return;
        }
      }

      setIdnPhysicalCounts({});
      clearCart();
      setIdnFilter("");
      setDebouncedIdnFilter("");
      setIdnSelectedProductFilter("all");
      setShowConfirmIDNModal(false);
      setShowIDNReceiptModal(null);
      setShowCheckoutModal(false);
      setShowMobileCart(false);
      setPosViewMode('standard');
      setActiveSessionId(null);
      setSessionWorkerName("");
      setSessionPassword("");
      setSelectedAdminIDNUserId("");
      setJoiningSessionId(null);
      setJoiningSessionPassword("");
      setLastClosedSession(null);
      setPosSuccess("Punto de venta cancelado. Turno cancelado correctamente. Regresando al selector de empleado.");
      setTimeout(() => setPosSuccess(""), 3000);
    } catch (err: any) {
      console.error("[POS] Error al cancelar/salir del flujo IDN:", err);
      setPosError(err?.message || "No se pudo cancelar y salir del punto de venta.");
    } finally {
      setIsExitingIDN(false);
    }
  };

  const handleSaveIDNSettlementPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIDNWorker?.id || !idnPriceFormProduct) {
      setPosError("Seleccione un producto");
      return;
    }
    const val = parseFloat(idnPriceFormAmount);
    if (isNaN(val) || val < 0) {
      setPosError("Ingrese un precio válido");
      return;
    }

    const existing = (idnSettlementPrices || []).find(
      p => p.userId === activeIDNWorker.id && p.productId === idnPriceFormProduct
    );

    if (existing) {
      updateIDNSettlementPrice(existing.id, { settlementPrice: val });
    } else {
      addIDNSettlementPrice({
        id: generateId('SP'),
        userId: activeIDNWorker.id,
        productId: idnPriceFormProduct,
        settlementPrice: val
      });
    }

    setShowSetSettlementPriceModal(false);
    setPosSuccess("Precio de liquidación actualizado.");
    setTimeout(() => setPosSuccess(""), 3000);
  };

  const baseCurrency = getBaseCurrency();
  const expectedBalances = React.useMemo(() => {
    if (!currentSession) return [];
    
    // Start with opening balance as cash in base currency
    const expected: Payment[] = [
      { currencyCode: baseCurrency.code as any, amount: currentSession.openingBalance, exchangeRate: 1, method: 'cash' }
    ];

    // Add all transaction payments from this session
    const sessionTxs = activeTransactions.filter(t => 
      t.branchId === currentBranchId && 
      t.sessionId === currentSession.id
    );

    sessionTxs.forEach(tx => {
      (tx.payments || []).forEach(p => {
        const existing = expected.find(e => e.currencyCode === p.currencyCode && e.method === p.method);
        if (existing) {
          existing.amount += p.amount;
        } else {
          expected.push({ ...p });
        }
      });
      
      // Subtract change given in each currency
      if (tx.changePayments && tx.changePayments.length > 0) {
        tx.changePayments.forEach(cp => {
          const existing = expected.find(e => e.currencyCode === cp.currencyCode && e.method === cp.method);
          if (existing) {
            existing.amount -= cp.amount;
          } else {
            expected.push({ ...cp, amount: -cp.amount });
          }
        });
      } else if (tx.changeGiven && tx.changeGiven > 0) {
        // Fallback for activeTransactions with only changeGiven in base currency
        const existing = expected.find(e => e.currencyCode === baseCurrency.code && e.method === 'cash');
        if (existing) {
          existing.amount -= tx.changeGiven;
        } else {
          expected.push({ 
            currencyCode: baseCurrency.code as any, 
            amount: -tx.changeGiven, 
            exchangeRate: 1, 
            method: 'cash' 
          });
        }
      }
    });

    // Add cash movements
    if (currentSession?.movements) {
      currentSession.movements.forEach(m => {
        const existing = expected.find(e => e.currencyCode === m.currencyCode && e.method === 'cash');
        if (existing) {
          existing.amount += (m.type === 'income' ? m.amount : -m.amount);
        } else {
          expected.push({ 
            currencyCode: m.currencyCode as any, 
            amount: m.type === 'income' ? m.amount : -m.amount,
            exchangeRate: currencies.find(c => c.code === m.currencyCode)?.rateToBase || 1,
            method: 'cash'
          });
        }
      });
    }

    return expected.filter(e => e.amount !== 0);
  }, [currentSession, activeTransactions, currentBranchId, baseCurrency, currencies]);

  const handleReturnItem = async () => {
    if (!returnConfirm) return;
    const { tx, item } = returnConfirm;

    try {
      const returnId = generateId();
      const prodId = typeof (item.product as any) === 'object' ? (item.product?.id || '') : (item.product || '');
      const returnData = {
        id: returnId,
        transactionId: tx.id,
        productId: prodId,
        quantity: item.quantity,
        reason: 'Devolución de cliente',
        date: new Date().toISOString(),
        status: 'pending' as const,
        type: 'refund' as const,
        notes: `Devolución desde historial de ventas. Ticket: ${tx.id}`
      };

      createReturn(returnData);
      const processed = await processReturn(returnId, 'complete');
      if (!processed) {
        setPosError("La devolución no fue confirmada. El producto no se marcó como devuelto.");
        return;
      }

      setPosSuccess("Producto devuelto y stock actualizado correctamente");
      setReturnConfirm(null);
      setTimeout(() => setPosSuccess(""), 3000);
    } catch (err) {
      console.error("Error processing return:", err);
      setPosError("Error al procesar la devolución");
      setTimeout(() => setPosError(""), 3000);
    }
  };

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentSession && !isClosingSession) {
      const finalBalances: Payment[] = Object.entries(closingBalances)
        .filter(([_, amount]) => (amount as number) > 0)
        .map(([key, amount]) => {
          const [code, method] = key.split('-');
          const currency = currencies.find(c => c.code === code)!;
          return {
            currencyCode: code as any,
            amount: amount as number,
            exchangeRate: getSafeRateToBase(p.code),
            method: method as any
          };
        });

      let hasDiscrepancy = false;
      expectedBalances.forEach(eb => {
        const actual = finalBalances.find(fb => fb.currencyCode === eb.currencyCode && fb.method === eb.method)?.amount || 0;
        if (Math.abs(actual - eb.amount) > 0.01) {
          hasDiscrepancy = true;
        }
      });
      finalBalances.forEach(fb => {
        const exp = expectedBalances.find(eb => fb.currencyCode === eb.currencyCode && fb.method === eb.method)?.amount || 0;
        if (Math.abs(fb.amount - exp) > 0.01) {
          hasDiscrepancy = true;
        }
      });

      if (hasDiscrepancy) {
        setFinalBalancesToClose(finalBalances);
        setShowDiscrepancyModal(true);
      } else {
        const ok = await processClose(finalBalances);
        if (ok) {
          setPosSuccess("Caja cerrada y confirmada correctamente.");
          setTimeout(() => setPosSuccess(""), 3000);
        }
      }
    }
  };

  const processClose = async (balances: Payment[], discrepancyDeduction?: number, sessionMeta?: Partial<CashRegisterSession>) => {
    if (!currentSession || isClosingSession) return false;

    setIsClosingSession(true);
    setPosError("");
    try {
      let finalClosingDate = new Date().toISOString();
      if (sessionClosingDate) {
        const parts = sessionClosingDate.split('-');
        if (parts.length === 3) {
          const d = new Date();
          d.setFullYear(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          finalClosingDate = d.toISOString();
        }
      }

      const sessionToClose: CashRegisterSession = {
        ...currentSession,
        status: 'closed' as const,
        closedAt: finalClosingDate,
        closingBalances: balances,
        workerName: sessionWorkerName || currentSession.workerName,
        closingDate: finalClosingDate,
        ...(sessionMeta || {})
      };

      const confirmed = await closeSession(
        currentSession.id,
        balances,
        sessionWorkerName || currentSession.workerName,
        finalClosingDate,
        discrepancyDeduction,
        sessionMeta
      );

      if (!confirmed) {
        setPosError("El cierre no fue confirmado por la base de datos. El turno permanece abierto y protegido.");
        return false;
      }

      setLastClosedSession(sessionToClose);
      void handlePrintClosureThermal(sessionToClose);
      setClosingBalances({});
      setSessionWorkerName("");
      setSessionPassword("");
      setActiveSessionId(null);
      setSessionClosingDate(new Date().toISOString().split('T')[0]);
      setShowCashManagementModal(false);
      setShowSalarySummary(true);
      setShowOpenShiftModal(false);
      return true;
    } catch (err: any) {
      console.error("[POS] Error confirmando cierre:", err);
      setPosError(err?.message || "No se pudo confirmar el cierre del turno.");
      return false;
    } finally {
      setIsClosingSession(false);
    }
  };

  const confirmClose = async () => {
    if (currentSession) {
      let totalDeduction = 0;
      if (deductFromSalary) {
        expectedBalances.forEach(eb => {
          const actual = finalBalancesToClose.find(fb => fb.currencyCode === eb.currencyCode && fb.method === eb.method)?.amount || 0;
          const diff = actual - eb.amount;
          if (diff < 0) {
            // Convert to base currency
            const currency = currencies.find(c => c.code === eb.currencyCode);
            totalDeduction += Math.abs(diff) * (currency?.rateToBase || 1);
          }
        });
      }

      // Build discrepancy details
      const discrepancyDetails: {
        currencyCode: string;
        method: 'cash' | 'transfer';
        expected: number;
        actual: number;
        difference: number;
      }[] = [];

      expectedBalances.forEach(eb => {
        const actual = finalBalancesToClose.find(fb => fb.currencyCode === eb.currencyCode && fb.method === eb.method)?.amount || 0;
        const diff = actual - eb.amount;
        if (Math.abs(diff) > 0.01) {
          discrepancyDetails.push({
            currencyCode: eb.currencyCode,
            method: eb.method as any,
            expected: eb.amount,
            actual,
            difference: diff
          });
        }
      });

      finalBalancesToClose.forEach(fb => {
        if (!expectedBalances.some(eb => eb.currencyCode === fb.currencyCode && eb.method === fb.method)) {
          discrepancyDetails.push({
            currencyCode: fb.currencyCode,
            method: fb.method as any,
            expected: 0,
            actual: fb.amount,
            difference: fb.amount
          });
        }
      });

      const matchingProductsAnalysis = discrepancyDetails.map(dd => {
        const matchedProducts = products
          .filter(p => Math.abs(p.price - Math.abs(dd.difference)) < 1)
          .slice(0, 3)
          .map(p => ({ id: p.id, name: p.name, price: p.price }));
        return {
          currencyCode: dd.currencyCode,
          difference: dd.difference,
          matchedProducts
        };
      }).filter(m => m.matchedProducts.length > 0);

      const sessionMeta: Partial<CashRegisterSession> = {
        isForcedClose: true,
        hasDiscrepancy: discrepancyDetails.length > 0,
        discrepancyDetails,
        discrepancyDeductionApplied: totalDeduction,
        deductedFromSalary: deductFromSalary,
        matchingProductsAnalysis,
        auditStatus: 'pending_review',
        notes: `Cierre forzado con descuadre. Deducción salarial: ${totalDeduction > 0 ? `${totalDeduction} CUP` : 'No aplicada'}.`
      };

      const ok = await processClose(finalBalancesToClose, totalDeduction, sessionMeta);
      if (!ok) return;
      setShowDiscrepancyModal(false);
      setDeductFromSalary(false);
      setFinalBalancesToClose([]);
      setPosSuccess("Caja cerrada. Se registraron los datos para la auditoría de descuadres en Reportes.");
      setTimeout(() => setPosSuccess(""), 3500);
    }
  };

  const handleAddMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;
    const amt = parseFloat(movementData.amount);
    if (isNaN(amt) || amt <= 0) return;

    addCashMovement(currentSession.id, {
      id: crypto.randomUUID(),
      sessionId: currentSession.id,
      branchId: currentSession.branchId || currentBranchId,
      workerName: currentSession.workerName || sessionWorkerName || currentUser?.name || 'Vendedor',
      type: movementData.type,
      amount: amt,
      currencyCode: movementData.currencyCode,
      description: movementData.description,
      date: new Date().toISOString()
    });

    addNotification(`Movimiento de ${movementData.type === 'income' ? 'entrada' : 'salida'} registrado: ${formatMoney(amt, movementData.currencyCode)}`, 'success');
    setMovementData({ type: 'expense', amount: '', currencyCode: 'CUP', description: '' });
  };

  // Barcode scanner moved lower

  const subtotalBase = cart.reduce((sum, item) => {
    const price = typeof (item.product as any) === 'object' && item.product !== null ? (item.product.price ?? item.price ?? 0) : (item.price ?? 0);
    return sum + (price * item.quantity);
  }, 0);
  const taxBase = 0; // Configurable tax if needed
  const rawTotalBase = subtotalBase + taxBase;
  const isCupBase = baseCurrency.code === 'CUP' || baseCurrency.code === 'MN';
  const totalBase = isCupBase ? Math.round(rawTotalBase) : Math.round(rawTotalBase * 100) / 100;

  // Todos los importes del checkout se convierten a la moneda base con una
  // tasa válida. La moneda base siempre vale 1, incluso si la configuración
  // remota llega momentáneamente sin rateToBase.
  const getSafeRateToBase = (code: string) => {
    if (code === baseCurrency.code) return 1;
    const rate = Number(currencies.find(c => c.code === code)?.rateToBase);
    return Number.isFinite(rate) && rate > 0 ? rate : 1;
  };

  const toBaseAmount = (amount: number, code: string) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value * getSafeRateToBase(code);
  };

  const roundBaseAmount = (amount: number) => {
    const value = Number(amount) || 0;
    return isCupBase ? Math.round(value) : Math.round(value * 100) / 100;
  };

  const totalPaidBase = roundBaseAmount(paymentLines.reduce(
    (sum, line) => sum + toBaseAmount(line.amount, line.code),
    0
  ));

  const balanceBase = roundBaseAmount(totalBase - totalPaidBase);
  const remainingBase = Math.max(0, balanceBase);
  const changeBase = Math.max(0, -balanceBase);
  const isPaid = remainingBase <= (isCupBase ? 0 : 0.01) && totalBase > 0;

  const generateSerial = () => {
    const randomSN = `SN-${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
    setConfigData({ ...configData, serialNumber: randomSN });
  };

  const getProductStock = (productId: string, variantLabel?: string) => {
    return (inventory || []).reduce((total, item) => {
      const stockBranchId = currentSession?.branchId || currentBranchId;
      if (item.branchId !== stockBranchId || item.productId !== productId) return total;
      if (variantLabel) return item.variantLabel === variantLabel ? total + item.quantity : total;
      return total + item.quantity;
    }, 0);
  };

  const getCartQuantity = (productId: string, variantLabel?: string) => {
    return cart
      .filter(item => {
        const pId = typeof (item.product as any) === 'object' && item.product !== null ? item.product.id : item.product;
        return pId === productId && (item.variantLabel || '') === (variantLabel || '');
      })
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  useBarcodeScanner((barcode) => {
    const normCode = normalizeSemanticText(barcode);
    const scannedProduct = (products || []).find(p => {
      if (!p) return false;
      return (
        p.id === barcode ||
        normalizeSemanticText(p.sku) === normCode ||
        normalizeSemanticText(p.barcode) === normCode ||
        p.sku === barcode ||
        p.barcode === barcode
      );
    });

    if (scannedProduct) {
       const totalAvailable = getProductStock(scannedProduct.id);
       if (totalAvailable > 0) {
          const needsConfig = scannedProduct.hasSerial || (scannedProduct.availableSizes?.length) || (scannedProduct.availableColors?.length);
          if (needsConfig) {
             setSelectedProduct(scannedProduct);
             setShowConfigModal(true);
          } else {
             addToCart(scannedProduct);
             setPosSuccess(`¡Producto "${scannedProduct.name}" detectado y agregado al carrito!`);
             setTimeout(() => setPosSuccess(""), 2000);
          }
       } else {
          setPosError(`El producto "${scannedProduct.name}" no tiene existencias suficientes en este almacén.`);
          setTimeout(() => setPosError(""), 3000);
       }
    } else {
      setPosError(`No se encontró ningún producto con el código "${barcode}".`);
      setTimeout(() => setPosError(""), 2500);
    }
  });

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    let cancelled = false;

    if (showCameraScanner) {
      void import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
        if (cancelled) return;

        scanner = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );

        scanner.render((decodedText) => {
        // On successful scan
        const scannedProduct = products.find(p => p.sku === decodedText || p.id === decodedText || p.barcode === decodedText);
        if (scannedProduct) {
          const totalAvailable = getProductStock(scannedProduct.id);
          if (totalAvailable > 0) {
            const needsConfig = scannedProduct.hasSerial || (scannedProduct.availableSizes?.length) || (scannedProduct.availableColors?.length);
            if (needsConfig) {
              setSelectedProduct(scannedProduct);
              setShowConfigModal(true);
            } else {
              addToCart(scannedProduct);
              setPosSuccess("Producto escaneado");
              setTimeout(() => setPosSuccess(""), 1500);
            }
          } else {
            setPosError("Sin existencias");
            setTimeout(() => setPosError(""), 1500);
          }
        } else {
          // Check if it's an order payload from the customer shop
          if (decodedText.startsWith("APP_ORDER:")) {
            try {
              const payloadStr = decodedText.replace("APP_ORDER:", "");
              const payload = JSON.parse(payloadStr);
              if (payload && payload.i && Array.isArray(payload.i)) {
                clearCart();
                payload.i.forEach((item: any) => {
                  const p = products.find(prod => prod.id === item.id);
                  if (p) {
                    for(let i=0; i<item.q; i++) {
                      addToCart(p);
                    }
                  }
                });
                setPosSuccess("Carrito de cliente cargado exitosamente.");
                setTimeout(() => setPosSuccess(""), 3000);
              }
            } catch(e) {
              setPosError("Código de orden inválido");
              setTimeout(() => setPosError(""), 1500);
            }
          } else {
            // Check if it's a legacy pending order (by ID)
            const order = pendingOrders.find(o => o.id === decodedText && o.status === 'pending');
            if (order) {
              clearCart();
              order.items.forEach(item => {
                const prodObj = typeof (item.product as any) === 'object' && item.product !== null ? item.product : products.find(p => p.id === (item.product as any));
                if (prodObj) {
                  for(let i=0; i<item.quantity; i++){
                    addToCart(prodObj, item.serialNumber);
                  }
                }
              });
              removePendingOrder(order.id);
              setPosSuccess("Orden cargada exitosamente.");
              setTimeout(() => setPosSuccess(""), 3000);
            } else {
              setPosError("Código no reconocido");
              setTimeout(() => setPosError(""), 1500);
            }
          }
        }
          setShowCameraScanner(false);
        }, (error) => {
          // Handle scan errors silently
        });
      });
    }

    return () => {
      cancelled = true;
      if (scanner) {
        scanner.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
        });
      }
    };
  }, [showCameraScanner, products, inventory, currentBranchId]);

  const handleProductClick = useCallback((product: Product) => {
    setPosError("");
    setSelectedProduct(product);
    const autoSN = product.hasSerial ? `SN-${Math.floor(Math.random() * 100000000).toString().padStart(8, "0")}` : "";
    setConfigData({
      selectedSize: product.availableSizes?.[0],
      selectedColor: product.availableColors?.[0],
      serialNumber: autoSN
    });
    setShowConfigModal(true);
  }, []);

  const handleCatalogOutOfStock = useCallback(() => {
    setPosError("Sin existencias en esta sucursal.");
    setTimeout(() => setPosError(""), 3000);
  }, []);

  const handleConfigSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPosError("");
    if (selectedProduct) {
      const variantLabel = configData.selectedSize || configData.selectedColor;
      if (getCartQuantity(selectedProduct.id, variantLabel) >= getProductStock(selectedProduct.id, variantLabel)) {
        setPosError(`No hay suficiente stock para la variante ${variantLabel || 'seleccionada'}.`);
        setTimeout(() => setPosError(""), 3000);
        return;
      }
      addToCart({
        ...selectedProduct,
      }, configData.serialNumber, { size: configData.selectedSize, color: configData.selectedColor, variantLabel });
      
      setShowConfigModal(false);
      setSelectedProduct(null);
      setConfigData({});
    }
  };

  const formatMoney = (amount: number, symbol: string) => {
    // Determine decimals: CUP/MN/CUC should be integer
    const isCup = symbol === 'CUP' || symbol === 'MN' || symbol === 'CUC' || symbol === '₱';
    const decimals = isCup ? 0 : 2;
    const formatted = amount.toLocaleString('es-CU', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
    return `${symbol} ${formatted}`;
  };

  const addPaymentLine = () => {
    const newId = crypto.randomUUID();
    const curr = currencies.find(c => c.code === baseCurrency.code);
    let fillAmount = 0;
    if (remainingBase > 0) {
      const rawAmount = remainingBase / (curr?.rateToBase || 1);
      fillAmount = curr?.code === 'CUP' ? Math.round(rawAmount) : Math.round(rawAmount * 100) / 100;
    }
    const defaultBank = bankCards.find(c => c.currency === baseCurrency.code) || bankCards[0];
    setPaymentLines(prev => [...prev, { id: newId, code: baseCurrency.code, amount: fillAmount, method: 'cash', bankCardId: defaultBank?.id }]);
    setActivePaymentLineId(newId);
  };

  const updatePaymentLine = (id: string, field: keyof PaymentLine, value: any) => {
    const isCupSymbol = (s: string) => s === 'CUP' || s === 'MN' || s === 'CUC' || s === '₱';

    setPaymentLines(prev => {
      let nextLines = prev.map(p => {
        if (p.id !== id) return p;
        const updated = { ...p, [field]: value };

        // Handle currency conversion when code changes
        if (field === 'code' && value !== p.code) {
          const oldCurrency = currencies.find(c => c.code === p.code);
          const newCurrency = currencies.find(c => c.code === value);
          if (oldCurrency && newCurrency) {
            const amountInBase = p.amount * oldCurrency.rateToBase;
            const convertedAmount = amountInBase / newCurrency.rateToBase;
            // If new currency is CUP-like, round to integer, otherwise keep 2 decimals
            updated.amount = isCupSymbol(value) ? Math.round(convertedAmount) : Math.round(convertedAmount * 100) / 100;
          }
        }

        // If amount is directly edited and it's CUP, round to integer
        if (field === 'amount' && isCupSymbol(updated.code)) {
          updated.amount = Math.round(updated.amount);
        }

        if (field === 'method' && value === 'transfer') {
          // If transfer is selected, force CUP if not already
          if (updated.code !== 'CUP') {
            const oldCurrency = currencies.find(c => c.code === updated.code);
            const cupCurrency = currencies.find(c => c.code === 'CUP');
            if (oldCurrency && cupCurrency) {
              const amountInBase = updated.amount * oldCurrency.rateToBase;
              updated.amount = Math.round(amountInBase / cupCurrency.rateToBase);
            }
            updated.code = 'CUP';
          }
          
          if (!updated.bankCardId) {
            const matchingCard = bankCards.find(c => c.currency === updated.code) || bankCards[0];
            if (matchingCard) {
              updated.bankCardId = matchingCard.id;
            }
          }
        }

        // Ensure that if it's CUP, it's ALWAYS an integer regardless of the field being changed
        if (isCupSymbol(updated.code)) {
          updated.amount = Math.round(updated.amount);
        }

        if (field === 'code' && updated.method === 'transfer') {
          const matchingCard = bankCards.find(c => c.currency === value) || bankCards[0];
          if (matchingCard) {
            updated.bankCardId = matchingCard.id;
          }
        }
        return updated;
      });
      return nextLines;
    });
  };

  const removePaymentLine = (id: string) => {
    setPaymentLines(prev => {
      const filtered = prev.filter(p => p.id !== id);
      if (activePaymentLineId === id && filtered.length > 0) {
        setActivePaymentLineId(filtered[0].id);
      }
      return filtered;
    });
  };

  const autoFillRemaining = (id: string) => {
    const line = paymentLines.find(p => p.id === id);
    if (!line) return;
    const currency = currencies.find(c => c.code === line.code);
    if (!currency || !Number.isFinite(currency.rateToBase) || currency.rateToBase <= 0) return;

    // Completa exactamente lo que falta. No se suma al importe existente,
    // porque eso podía duplicar el importe al volver a pulsar "Total a cobrar".
    const paidByOtherLines = paymentLines.reduce((sum, p) => {
      if (p.id === id) return sum;
      return sum + toBaseAmount(p.amount, p.code);
    }, 0);
    const missingBase = Math.max(0, roundBaseAmount(totalBase - paidByOtherLines));
    const amountNeededInCurrency = missingBase / getSafeRateToBase(line.code);
    const roundedAmount = (line.code === 'CUP' || line.code === 'MN' || line.code === 'CUC')
      ? Math.round(amountNeededInCurrency)
      : Math.round(amountNeededInCurrency * 100) / 100;

    updatePaymentLine(id, 'amount', roundedAmount);
  };

  const splitUsdPayment = (id: string) => {
    const line = paymentLines.find(p => p.id === id);
    if (!line || line.code !== 'USD') return;
    
    const usdCurrency = currencies.find(c => c.code === 'USD');
    const cupCurrency = currencies.find(c => c.code === 'CUP');
    if (!usdCurrency || !cupCurrency) return;

    // Take the integer part of the CURRENT amount in this line
    const integerPart = Math.floor(line.amount);
    
    // Calculate base currency covered by OTHER lines
    const coveredByOthers = paymentLines.reduce((sum, p) => {
      if (p.id === id) return sum;
      const curr = currencies.find(c => c.code === p.code);
      return sum + (p.amount * (curr?.rateToBase || 0));
    }, 0);

    // Calculate base currency covered by the integer USD part
    const coveredByUsdInteger = integerPart * usdCurrency.rateToBase;
    
    // The exact remainder needed in base currency to reach totalBase
    const remainderBase = totalBase - (coveredByOthers + coveredByUsdInteger);
    
    // Convert to CUP and round to integer
    const remainderCup = Math.max(0, Math.round(remainderBase / cupCurrency.rateToBase));

    // 1. Update current line to integer USD
    updatePaymentLine(id, 'amount', integerPart);

    // 2. Add or Update CUP line
    // Search for any existing CUP cash line that is NOT the current line
    const existingCupLine = paymentLines.find(p => (p.code === 'CUP' || p.code === 'MN') && p.method === 'cash' && p.id !== id);
    
    if (existingCupLine) {
      updatePaymentLine(existingCupLine.id, 'amount', existingCupLine.amount + remainderCup);
      setActivePaymentLineId(existingCupLine.id);
    } else if (remainderCup > 0) {
      const newId = crypto.randomUUID();
      const defaultCupBank = bankCards.find(c => c.currency === 'CUP') || bankCards[0];
      setPaymentLines(prev => [...prev, { 
        id: newId, 
        code: 'CUP', 
        amount: remainderCup, 
        method: 'cash', 
        bankCardId: defaultCupBank?.id 
      }]);
      setActivePaymentLineId(newId);
    }
  };

  const openCheckout = () => {
    if (!currentSession) {
      setPosError("No hay un turno de caja abierto en esta sucursal. Por favor, abre un turno para comenzar a cobrar.");
      setShowOpenShiftModal(true);
      return;
    }
    const newId = crypto.randomUUID();
    const defaultBank = bankCards.find(c => c.currency === baseCurrency.code) || bankCards[0];
    setPaymentLines([
      {
        id: newId,
        code: baseCurrency.code,
        amount: totalBase,
        method: 'cash',
        bankCardId: defaultBank?.id
      }
    ]);
    setActivePaymentLineId(newId);
    setShowCheckoutModal(true);
  };

  const handlePairBluetooth = async () => {
    setIsConnectingPrinter(true);
    setPrinterStatusMsg("Buscando impresora Bluetooth...");
    try {
      const device = await connectBluetoothPrinter();
      setConnectedPrinterName(device.name || "Impresora Bluetooth 58mm");
      setPosSuccess(`Impresora "${device.name || 'Bluetooth'}" conectada`);
      setPrinterStatusMsg(`Conectado a ${device.name || 'Bluetooth'}`);
      setTimeout(() => setPosSuccess(""), 3000);
    } catch (err: any) {
      console.warn("Bluetooth connection error:", err);
      setPosError(err.message || "No se pudo conectar la impresora Bluetooth");
      setPrinterStatusMsg(err.message || "Error al conectar");
      setTimeout(() => setPosError(""), 4000);
    } finally {
      setIsConnectingPrinter(false);
    }
  };

  const handleConnectUsb = async () => {
    setIsConnectingPrinter(true);
    setPrinterStatusMsg("Buscando impresora USB...");
    try {
      await connectPrinter();
      setConnectedPrinterName("Impresora USB (Serie)");
      setPosSuccess("Impresora USB conectada correctamente");
      setPrinterStatusMsg("Impresora USB conectada");
      setTimeout(() => setPosSuccess(""), 3000);
    } catch (err: any) {
      console.warn("USB connection error:", err);
      setPosError(err.message || "No se pudo conectar la impresora USB");
      setPrinterStatusMsg(err.message || "Error al conectar");
      setTimeout(() => setPosError(""), 4000);
    } finally {
      setIsConnectingPrinter(false);
    }
  };

  const getTransactionReceiptLines = (tx: import("../types").Transaction): string[] => {
    const receiptConfig = useStore.getState().receiptConfig;
    const lines: string[] = [];
    
    if (receiptConfig.showLogo !== false && receiptConfig.businessName) {
      lines.push(`CENTER|BOLD|${receiptConfig.businessName}`);
    }
    if (receiptConfig.showAddress && receiptConfig.businessAddress) lines.push(`CENTER|${receiptConfig.businessAddress}`);
    if (receiptConfig.showPhone && receiptConfig.businessPhone) lines.push(`CENTER|${receiptConfig.businessPhone}`);
    
    lines.push("---");
    lines.push(`Ticket ID: ${tx.id}`);
    lines.push(`Fecha: ${new Date(tx.date).toLocaleDateString()} ${new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    const sellerDisplay = tx.cashierName || (currentSession?.workerName) || users.find(u => u.id === tx.userId)?.name || 'Vendedor';
    lines.push(`Vendedor: ${sellerDisplay.toUpperCase()}`);
    const customer = useStore.getState().customers.find(c => c.id === tx.customerId);
    lines.push(`Cliente: ${(customer?.name || 'Consumidor Final').slice(0, 22)}`);
    lines.push("---");
    
    tx.items.forEach(item => {
      const prodName = typeof (item.product as any) === 'object' ? ((item.product as any)?.name || 'Producto') : (products.find(p => p.id === (item.product as any))?.name || (item.product as any) || 'Producto');
      const prodPrice = typeof (item.product as any) === 'object' ? ((item.product as any)?.price || 0) : (products.find(p => p.id === (item.product as any))?.price || item.price || 0);
      const prodWarranty = typeof (item.product as any) === 'object' ? ((item.product as any)?.warrantyDays || 0) : (products.find(p => p.id === (item.product as any))?.warrantyDays || 0);
      const itemName = `${item.quantity}x ${prodName}`;
      const itemPrice = formatMoney(prodPrice * item.quantity, baseCurrency.symbol);
      const dots = Math.max(1, 32 - itemName.length - itemPrice.length);
      lines.push(`${itemName}${" ".repeat(dots)}${itemPrice}`);
      if (item.serialNumber) {
        lines.push(`  S/N: ${item.serialNumber}`);
      }
      if (item.warrantyCode) {
        lines.push(`  Gda: ${item.warrantyCode} (${prodWarranty}d)`);
      }
    });
    
    lines.push("---");
    const totLabel = "TOTAL:";
    const totVal = formatMoney(tx.total, baseCurrency.symbol);
    const totDots = Math.max(1, 32 - totLabel.length - totVal.length);
    lines.push(`BOLD|${totLabel}${" ".repeat(totDots)}${totVal}`);
    lines.push("---");
    
    lines.push("BOLD|Pagos recibidos:");
    (tx.payments || []).forEach(p => {
      const symbol = currencies.find(c => c.code === p.currencyCode)?.symbol || '';
      const method = p.method === 'cash' ? 'Efectivo' : 'Transf';
      const label = `  ${method} (${p.currencyCode}):`;
      const val = formatMoney(p.amount, symbol);
      const sp = Math.max(1, 32 - label.length - val.length);
      lines.push(`${label}${" ".repeat(sp)}${val}`);
    });
    
    if (tx.changePayments && tx.changePayments.length > 0) {
      lines.push("BOLD|Vuelto entregado:");
      tx.changePayments.forEach(cp => {
        const symbol = currencies.find(c => c.code === cp.currencyCode)?.symbol || '';
        const label = `  Efectivo (${cp.currencyCode}):`;
        const val = formatMoney(cp.amount, symbol);
        const sp = Math.max(1, 32 - label.length - val.length);
        lines.push(`${label}${" ".repeat(sp)}${val}`);
      });
    } else if (tx.changeGiven && tx.changeGiven > 0) {
      const label = "Vuelto:";
      const val = formatMoney(tx.changeGiven, baseCurrency.symbol);
      const sp = Math.max(1, 32 - label.length - val.length);
      lines.push(`${label}${" ".repeat(sp)}${val}`);
    }
    
    if (receiptConfig.showFooter && receiptConfig.footerText) {
      lines.push("---");
      lines.push(`CENTER|${receiptConfig.footerText}`);
    }

    return lines;
  };

  const getClosureReceiptLines = (session: CashRegisterSession): string[] => {
    const receiptConfig = useStore.getState().receiptConfig;
    const sessionTx = activeTransactions.filter(t => 
      t.sessionId === session.id && !t.deletedAt
    );

    const soldMap: { [name: string]: { name: string, qty: number, total: number } } = {};
    sessionTx.forEach(tx => {
      tx.items.forEach(item => {
        const name = typeof item.product === 'string' ? item.product : (item.product?.name || 'Producto');
        if (!soldMap[name]) soldMap[name] = { name, qty: 0, total: 0 };
        const price = typeof item.product === 'object' ? (item.product?.price || 0) : 0;
        soldMap[name].qty += item.quantity;
        soldMap[name].total += (price * item.quantity);
      });
    });
    const soldList = Object.values(soldMap);
    const totalSales = sessionTx.reduce((sum, tx) => sum + tx.total, 0);

    const commissions = sessionTx.reduce((sum, tx) => {
      return sum + tx.items.reduce((s, item) => {
        const prodId = typeof item.product === 'string' ? item.product : item.product.id;
        const prod = products.find(p => p.id === prodId);
        if (!prod) return s;
        const commValue = prod.commissionValue || 0;
        return s + (commValue * item.quantity);
      }, 0);
    }, 0);

    const employee = users.find(u => u.id === session.userId || u.name === session.workerName) || users.find(u => u.name?.toLowerCase() === session.workerName?.toLowerCase()) || users.find(u => u.role === 'employee') || currentUser;
    const isIndependent = employee?.isIndependent || false;

    // Calculate total cost for shop (what the independent seller owes the shop)
    const totalShopCost = sessionTx.reduce((sum, tx) => {
      return sum + tx.items.reduce((s, item) => {
        const prodId = typeof item.product === 'string' ? item.product : item.product.id;
        const prod = products.find(p => p.id === prodId);
        const cost = typeof item.product === 'object' ? (item.product?.costPrice || 0) : (prod?.costPrice || 0);
        return s + (cost * item.quantity);
      }, 0);
    }, 0);

    const baseSalary = isIndependent ? 0 : (employee?.baseSalary || 0);
    const totalSalary = isIndependent ? 0 : (baseSalary + commissions);

    const lines: string[] = [];
    lines.push(`CENTER|BOLD|${receiptConfig.businessName || 'MARÉ POS'}`);
    if (receiptConfig.showAddress && receiptConfig.businessAddress) lines.push(`CENTER|${receiptConfig.businessAddress}`);
    if (receiptConfig.showPhone && receiptConfig.businessPhone) lines.push(`CENTER|${receiptConfig.businessPhone}`);
    lines.push("---");
    lines.push("CENTER|BOLD|CIERRE DE CAJA / TURNO");
    lines.push(`TURNO: ${session.id}`);
    lines.push(`FECHA: ${new Date(session.closingDate || session.closedAt || new Date()).toLocaleDateString()}`);
    lines.push(`HORA: ${new Date(session.closingDate || session.closedAt || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    lines.push(`VENDEDOR: ${(session.workerName || 'VENDEDOR').toUpperCase()}${isIndependent ? ' (IND)' : ''}`);
    lines.push(`SUCURSAL: ${(branches.find(b => b.id === session.branchId)?.name || 'Central').slice(0, 18)}`);
    lines.push("---");
    lines.push("BOLD|PRODUCTOS VENDIDOS:");
    if (soldList.length === 0) {
      lines.push("Sin ventas registradas");
    } else {
      soldList.forEach(p => {
        const label = `${p.qty}x ${p.name.slice(0, 16)}`;
        const val = formatMoney(p.total, baseCurrency.symbol);
        const sp = Math.max(1, 32 - label.length - val.length);
        lines.push(`${label}${" ".repeat(sp)}${val}`);
      });
    }
    lines.push("---");
    const totSLabel = "TOTAL VENTAS:";
    const totSVal = formatMoney(totalSales, baseCurrency.symbol);
    lines.push(`BOLD|${totSLabel}${" ".repeat(Math.max(1, 32 - totSLabel.length - totSVal.length))}${totSVal}`);
    lines.push(`ITEMS TOTALES: ${soldList.reduce((s, i) => s + i.qty, 0)}`);
    lines.push("---");

    if (isIndependent) {
      lines.push("BOLD|LIQUIDACION INDEPENDIENTE:");
      const shopLabel = "Costo Fijo Tienda:";
      const shopVal = formatMoney(totalShopCost, baseCurrency.symbol);
      lines.push(`${shopLabel}${" ".repeat(Math.max(1, 32 - shopLabel.length - shopVal.length))}${shopVal}`);
} else {
      lines.push("BOLD|NOMINA / COMISIONES:");
      const salLabel = "Salario Base:";
      const salVal = formatMoney(baseSalary, baseCurrency.symbol);
      lines.push(`${salLabel}${" ".repeat(Math.max(1, 32 - salLabel.length - salVal.length))}${salVal}`);
      
      const comLabel = "Comisiones:";
      const comVal = formatMoney(commissions, baseCurrency.symbol);
      lines.push(`${comLabel}${" ".repeat(Math.max(1, 32 - comLabel.length - comVal.length))}${comVal}`);
      
      const netLabel = "Total a Pagar:";
      const netVal = formatMoney(totalSalary, baseCurrency.symbol);
      lines.push(`BOLD|${netLabel}${" ".repeat(Math.max(1, 32 - netLabel.length - netVal.length))}${netVal}`);
      
      const settlement = useStore.getState().salarySettlements.find(s => s.sessionId === session.id);
      if (settlement && settlement.discrepancyDeduction && settlement.discrepancyDeduction > 0) {
        const dedLabel = "(-) Descuento:";
        const dedVal = formatMoney(settlement.discrepancyDeduction, baseCurrency.symbol);
        lines.push(`${dedLabel}${" ".repeat(Math.max(1, 32 - dedLabel.length - dedVal.length))}${dedVal}`);
        
        const finalLabel = "NETO RECIBIR:";
        const finalVal = formatMoney(settlement.total, baseCurrency.symbol);
        lines.push(`BOLD|${finalLabel}${" ".repeat(Math.max(1, 32 - finalLabel.length - finalVal.length))}${finalVal}`);
      }
    }
    lines.push("---");
    lines.push("BOLD|COBROS POR METODO/MONEDA:");
    
    // Aggregate payments by currency and method
    const paymentTotals: { [key: string]: { code: string, method: string, amount: number } } = {};
    sessionTx.forEach(tx => {
      (tx.payments || []).forEach(p => {
        const key = `${p.currencyCode}-${p.method}`;
        if (!paymentTotals[key]) {
          paymentTotals[key] = { code: p.currencyCode, method: p.method, amount: 0 };
        }
        paymentTotals[key].amount += p.amount;
      });
    });

    const paymentKeys = Object.keys(paymentTotals);
    if (paymentKeys.length === 0) {
      lines.push("Sin cobros registrados");
    } else {
      paymentKeys.forEach(k => {
        const pt = paymentTotals[k];
        const methodLabel = pt.method === 'transfer' ? 'Transf' : 'Efec';
        const sym = currencies.find(c => c.code === pt.code)?.symbol || '';
        const label = `${methodLabel} (${pt.code}):`;
        const val = formatMoney(pt.amount, sym);
        const sp = Math.max(1, 32 - label.length - val.length);
        lines.push(`${label}${" ".repeat(sp)}${val}`);
      });
    }

    lines.push("---");
    lines.push("BOLD|ARQUEO DE FONDOS:");
    const fondoLabel = "Fondo Inicial:";
    const fondoVal = formatMoney(session.openingBalance, baseCurrency.symbol);
    lines.push(`${fondoLabel}${" ".repeat(Math.max(1, 32 - fondoLabel.length - fondoVal.length))}${fondoVal}`);
    lines.push("---");
    lines.push("BOLD|LIQUIDACION SALARIO:");
    const baseLabel = "Salario Base:";
    const baseVal = formatMoney(baseSalary, baseCurrency.symbol);
    lines.push(`${baseLabel}${" ".repeat(Math.max(1, 32 - baseLabel.length - baseVal.length))}${baseVal}`);
    const comLabel = "Comisiones:";
    const comVal = `+${formatMoney(commissions, baseCurrency.symbol)}`;
    lines.push(`${comLabel}${" ".repeat(Math.max(1, 32 - comLabel.length - comVal.length))}${comVal}`);
    const totSalLabel = "TOTAL SALARIO:";
    const totSalVal = formatMoney(totalSalary, baseCurrency.symbol);
    lines.push(`BOLD|${totSalLabel}${" ".repeat(Math.max(1, 32 - totSalLabel.length - totSalVal.length))}${totSalVal}`);
    lines.push("---");
    lines.push("CENTER|Firma: _________________");
    lines.push("CENTER|MARÉ SISTEMA POS");

    return lines;
  };

  const handleThermalPrint = async (tx: import("../types").Transaction, options?: { silent?: boolean }) => {
    try {
      const lines = getTransactionReceiptLines(tx);
      await printThermalReceipt({
        lines,
        openDrawer: receiptConfig.openDrawer ?? true,
        width: (receiptConfig.printerWidth || '58mm') as '58mm' | '80mm',
        onSuccess: (method) => {
          if (!options?.silent) {
            setPosSuccess(`Ticket enviado a impresora (${method === 'bluetooth' ? 'Bluetooth' : 'USB/Serie'})`);
            setTimeout(() => setPosSuccess(""), 2500);
          }
        },
        onError: (error) => {
          if (!options?.silent) {
            setPosError(error?.message || "Sin conexión activa con impresora");
            setTimeout(() => setPosError(""), 3500);
          }
        }
      });
    } catch (err: any) {
      console.warn("Thermal print:", err);
      if (!options?.silent) {
        setPosError(err?.message || "No se pudo imprimir el ticket");
        setTimeout(() => setPosError(""), 3500);
      }
    }
  };

  const handlePrintClosureThermal = async (session: CashRegisterSession | null, options?: { silent?: boolean }) => {
    if (!session) return;
    try {
      const lines = getClosureReceiptLines(session);
      await printThermalReceipt({
        lines,
        openDrawer: false,
        width: (receiptConfig.printerWidth || '58mm') as '58mm' | '80mm',
        onSuccess: (method) => {
          if (!options?.silent) {
            setPosSuccess(`Cierre impreso (${method === 'bluetooth' ? 'Bluetooth' : 'USB/Serie'})`);
            setTimeout(() => setPosSuccess(""), 2500);
          }
        },
        onError: (error) => {
          if (!options?.silent) {
            setPosError(error?.message || "Sin conexión a impresora");
            setTimeout(() => setPosError(""), 3500);
          }
        }
      });
    } catch (err: any) {
      console.error('Error al imprimir comprobante de cierre:', err);
      if (!options?.silent) {
        setPosError(err?.message || "No se pudo imprimir el comprobante de cierre");
        setTimeout(() => setPosError(""), 3500);
      }
    }
  };

  const handleWhatsAppReceipt = (tx: Transaction) => {
    let phone = "";
    const customer = useStore.getState().customers.find(c => c.id === tx.customerId);
    if (customer?.phone) {
      phone = String(customer.phone || '').replace(/\D/g,'');
    } else {
      const input = window.prompt("Ingrese el número de WhatsApp del cliente:");
      if (!input) return;
      phone = String(input || '').replace(/\D/g,'');
    }
    
    if (!phone) {
      addNotification("Número de teléfono inválido.", 'error');
      return;
    }
    
    const storeName = useStore.getState().storeConfig.storeName;
    let itemsText = (tx.items || []).map(i => {
      const pName = typeof (i.product as any) === 'object' ? ((i.product as any)?.name || 'Producto') : (products.find(p => p.id === (i.product as any))?.name || (i.product as any) || 'Producto');
      const pPrice = typeof (i.product as any) === 'object' ? ((i.product as any)?.price || 0) : (products.find(p => p.id === (i.product as any))?.price || i.price || 0);
      return `${i.quantity}x ${pName} - ${formatMoney(pPrice * i.quantity, baseCurrency.symbol)}`;
    }).join('%0A');
    const text = `Hola, gracias por tu compra en *${storeName}*.%0A%0A*Detalle del recibo ${tx.id}:*%0A${itemsText}%0A%0A*Total:* ${formatMoney(tx.total, baseCurrency.symbol)}%0A%0A¡Vuelve pronto!`;
    const url = `https://wa.me/${phone}?text=${text}`;
    window.open(url, '_blank');
  };

  const handleEmailReceipt = (tx: Transaction) => {
    const customer = useStore.getState().customers.find(c => c.id === tx.customerId);
    if (!customer?.email) {
      addNotification("El cliente no tiene un correo registrado.", 'warning');
      return;
    }
    const storeName = useStore.getState().storeConfig.storeName;
    const subject = `Tu Recibo de Compra - ${storeName}`;
    const body = `Hola ${customer?.name || 'Cliente'},\n\nGracias por tu compra. Tu recibo es ${tx.id} por un total de ${formatMoney(tx.total, baseCurrency.symbol)}.\n\nSaludos,\n${storeName}`;
    const url = `mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  };

  const handleCheckout = async () => {
    if (isSubmittingCheckout) return;
    if (!currentSession) {
      setPosError('No existe un turno de caja activo para registrar esta venta.');
      setShowOpenShiftModal(true);
      return;
    }
    if (!Number.isFinite(totalBase) || totalBase <= 0) {
      setPosError('El total de la venta no es válido.');
      return;
    }
    if (remainingBase > (isCupBase ? 0 : 0.01)) {
      setPosError(`Falta por cobrar ${formatMoney(remainingBase, baseCurrency.symbol)}.`);
      return;
    }
    const invalidTransfer = paymentLines.some(l =>
      l.method === 'transfer' &&
      (!l.bankCardId || !bankCards.some(c => c.id === l.bankCardId && (c.currency === l.code || (l.code === 'MN' && c.currency === 'CUP'))))
    );
    if (invalidTransfer) {
      setPosError('Seleccione una cuenta bancaria válida para cada pago por transferencia.');
      return;
    }
    setIsSubmittingCheckout(true);
    setPosError("");
    setPosSuccess("");
    try {
      // Final payments with rounded USD
    const finalizedPayments: import('../types').Payment[] = paymentLines
      .filter(p => Number.isFinite(p.amount) && p.amount > 0)
      .map(p => {
        const currency = currencies.find(c => c.code === p.code);
        // La moneda base siempre tiene tasa 1. No exigimos rateToBase remoto
        // para la moneda base, evitando bloquear cobros correctamente configurados.
        const isPaymentBaseCurrency = p.code === baseCurrency.code || (p.code === 'MN' && baseCurrency.code === 'CUP');
        const configuredRate = Number(currency?.rateToBase);
        const exchangeRate = isPaymentBaseCurrency
          ? 1
          : (Number.isFinite(configuredRate) && configuredRate > 0 ? configuredRate : null);
        if (exchangeRate === null) {
          throw new Error('No existe una tasa de cambio válida para ' + p.code + '. Actualiza las monedas antes de cobrar.');
        }
        let amount = p.amount;
        if (p.code === 'CUP') {
          amount = Math.round(amount);
        } else if (p.code === 'USD' && p.method === 'cash') {
          amount = Math.round(amount * 100) / 100;
        }
        return {
          currencyCode: p.code as any,
          amount: amount,
