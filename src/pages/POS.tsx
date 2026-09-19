import React, { useState, useEffect, useRef } from "react";
import { Search, Wifi, WifiOff, RefreshCw, Plus, Minus, CreditCard, Receipt, Trash2, ShoppingCart, ShieldCheck, DollarSign, QrCode, ArrowLeftRight, UserPlus, X, Lock, Unlock, Camera, AlertCircle, TrendingUp, Wallet, MessageSquare, Mail, HelpCircle, Calculator, ArrowRight, Package, User, RotateCcw, Printer, Bluetooth, Usb, Smartphone } from "lucide-react";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import { cn, generateId } from "../lib/utils";
import { useStore } from "../store/useStore";
import { Product, Payment, Transaction, CashRegisterSession } from "../types";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { InfoTooltip } from "../components/InfoTooltip";

export default function POS() {
  const { categories, products, cart, addToCart, updateCartQty, clearCart, processTransaction, branches, currentBranchId, setCurrentBranch, currencies, getBaseCurrency, currentCustomerId, setCartCustomer, currentUser, pendingOrders, removePendingOrder, getCurrentSession, openSession, closeSession, addCashMovement, transactions, inventory, addCustomer, bankCards, addBankTransaction, customers, isOffline, setOfflineStatus, syncQueue, processSyncQueue, users, logout, createReturn, processReturn, receiptConfig } = useStore();
  const [activeCategoryId, setActiveCategoryId] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Network Event Listeners
  useEffect(() => {
    const handleOnline = () => {
      setOfflineStatus(false);
      processSyncQueue();
    };
    const handleOffline = () => setOfflineStatus(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOfflineStatus, processSyncQueue]);
  
  // Cash Management State
  const [showCashManagementModal, setShowCashManagementModal] = useState(false);
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
  
  const queryParams = new URLSearchParams(window.location.search);
  
  
  const navigate = useNavigate();
  const currentSession = getCurrentSession(currentBranchId || '', currentUser?.id || '');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showSalarySummary, setShowSalarySummary] = useState(false);
  const [lastClosedSession, setLastClosedSession] = useState<CashRegisterSession | null>(null);
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

  const [posError, setPosError] = useState("");
  const [posSuccess, setPosSuccess] = useState("");
  const [openingAmount, setOpeningAmount] = useState("");
  const [sessionWorkerName, setSessionWorkerName] = useState("");
  
  const allowedBranches = currentUser?.role === 'admin' 
    ? branches 
    : branches.filter(b => currentUser?.allowedBranches?.includes(b.id) ?? true);
    
  const [sessionBranchId, setSessionBranchId] = useState<string>(
    currentBranchId || (allowedBranches.length > 0 ? allowedBranches[0].id : "")
  );

  const baseCurrency = getBaseCurrency();
  const expectedBalances = React.useMemo(() => {
    if (!currentSession) return [];
    
    // Start with opening balance as cash in base currency
    const expected: Payment[] = [
      { currencyCode: baseCurrency.code as any, amount: currentSession.openingBalance, exchangeRate: 1, method: 'cash' }
    ];

    // Add all transaction payments from this session
    const sessionTxs = transactions.filter(t => 
      t.branchId === currentBranchId && 
      (
        t.sessionId 
          ? t.sessionId === currentSession.id
          : (new Date(t.date).getTime() >= new Date(currentSession.openedAt).getTime() &&
             (!currentSession.closedAt || new Date(t.date).getTime() <= new Date(currentSession.closedAt).getTime()))
      )
    );

    sessionTxs.forEach(tx => {
      tx.payments.forEach(p => {
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
        // Fallback for transactions with only changeGiven in base currency
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
    if (currentSession.movements) {
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
  }, [currentSession, transactions, currentBranchId, baseCurrency, currencies]);

  const handleReturnItem = async () => {
    if (!returnConfirm) return;
    const { tx, item } = returnConfirm;

    try {
      const returnId = generateId();
      const returnData = {
        id: returnId,
        transactionId: tx.id,
        productId: item.product.id,
        quantity: item.quantity,
        reason: 'Devolución de cliente',
        date: new Date().toISOString(),
        status: 'pending' as const,
        type: 'refund' as const,
        notes: `Devolución desde historial de ventas. Ticket: ${tx.id}`
      };

      createReturn(returnData);
      processReturn(returnId, 'complete');
      
      setPosSuccess("Producto devuelto y stock actualizado correctamente");
      setReturnConfirm(null);
      setTimeout(() => setPosSuccess(""), 3000);
    } catch (err) {
      console.error("Error processing return:", err);
      setPosError("Error al procesar la devolución");
      setTimeout(() => setPosError(""), 3000);
    }
  };

  const handleClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentSession) {
      const finalBalances: Payment[] = Object.entries(closingBalances)
        .filter(([_, amount]) => (amount as number) > 0)
        .map(([key, amount]) => {
          const [code, method] = key.split('-');
          const currency = currencies.find(c => c.code === code)!;
          return {
            currencyCode: code as any,
            amount: amount as number,
            exchangeRate: currency.rateToBase,
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
        processClose(finalBalances);
        setPosSuccess("Caja cerrada exitosamente.");
        setTimeout(() => setPosSuccess(""), 3000);
      }
    }
  };

  const processClose = (balances: Payment[]) => {
    if (!currentSession) return;
    let finalClosingDate = new Date().toISOString();
    if (sessionClosingDate) {
      const parts = sessionClosingDate.split('-');
      if (parts.length === 3) {
        const d = new Date();
        d.setFullYear(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        finalClosingDate = d.toISOString();
      }
    }
    const sessionToClose = { 
      ...currentSession, 
      status: 'closed' as const, 
      closedAt: finalClosingDate, 
      closingBalances: balances, 
      workerName: sessionWorkerName || currentSession.workerName,
      closingDate: finalClosingDate
    };
    closeSession(currentSession.id, balances, sessionWorkerName || currentSession.workerName, finalClosingDate);
    setLastClosedSession(sessionToClose);
    setClosingBalances({});
    setSessionWorkerName("");
    setSessionClosingDate(new Date().toISOString().split('T')[0]);
    setShowCashManagementModal(false);
    setShowSalarySummary(true);
  };

  const confirmClose = () => {
    if (currentSession) {
      processClose(finalBalancesToClose);
      setShowDiscrepancyModal(false);
      setFinalBalancesToClose([]);
      setPosSuccess("Caja cerrada con discrepancia.");
      setTimeout(() => setPosSuccess(""), 3000);
    }
  };

  const handleAddMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;
    const amt = parseFloat(movementData.amount);
    if (isNaN(amt) || amt <= 0) return;

    addCashMovement(currentSession.id, {
      id: crypto.randomUUID(),
      type: movementData.type,
      amount: amt,
      currencyCode: movementData.currencyCode,
      description: movementData.description,
      date: new Date().toISOString()
    });

    setMovementData({ type: 'expense', amount: '', currencyCode: 'CUP', description: '' });
  };

  // Barcode scanner moved lower

  const filteredProducts = products.filter(p => {
    // Filtrar por búsqueda
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const matchesSearch = p.name.toLowerCase().includes(query) || 
                            p.sku?.toLowerCase().includes(query) || 
                            p.barcode?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Filtrar por categoría
    const matchesCategory = activeCategoryId === "Todos" || p.categoryId === activeCategoryId;
    if (!matchesCategory) return false;

    // Filtrar por existencia en la sucursal actual
    const branchStockTotal = inventory
      .filter(i => i.productId === p.id && i.branchId === currentBranchId)
      .reduce((sum, curr) => sum + curr.quantity, 0);
    return branchStockTotal > 0;
  }).sort((a, b) => a.name.localeCompare(b.name));

  const subtotalBase = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const taxBase = 0; // Configurable tax if needed
  const totalBase = subtotalBase + taxBase;

  // Calcula cuánto se ha pagado en moneda base
  const totalPaidBase = paymentLines.reduce((sum, line) => {
    const currency = currencies.find(c => c.code === line.code);
    if (!currency || !line.amount) return sum;
    return sum + (line.amount * currency.rateToBase);
  }, 0);

  const balanceBase = Math.round((totalBase - totalPaidBase) * 100) / 100;
  const remainingBase = Math.max(0, balanceBase);
  const changeBase = Math.abs(Math.min(0, balanceBase));
  const isPaid = remainingBase === 0 && totalBase > 0;

  const generateSerial = () => {
    const randomSN = `SN-${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
    setConfigData({ ...configData, serialNumber: randomSN });
  };

  const getProductStock = (productId: string, variantLabel?: string) => {
    if (variantLabel) {
      const variantStock = inventory.find(i => i.productId === productId && i.branchId === currentBranchId && (i.variantLabel || '') === (variantLabel || ''));
      return variantStock ? variantStock.quantity : 0;
    }
    // Si no hay variante, sumamos todo el stock del producto en la sucursal
    return inventory
      .filter(i => i.productId === productId && i.branchId === currentBranchId)
      .reduce((sum, i) => sum + i.quantity, 0);
  };

  const getCartQuantity = (productId: string, variantLabel?: string) => {
    return cart
      .filter(item => item.product.id === productId && (item.variantLabel || '') === (variantLabel || ''))
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  useBarcodeScanner((barcode) => {
    const scannedProduct = products.find(p => p.sku === barcode || p.id === barcode || p.barcode === barcode);
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
    }
  });

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    
    if (showCameraScanner) {
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
                for(let i=0; i<item.quantity; i++){
                  addToCart(item.product, item.serialNumber);
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
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
        });
      }
    };
  }, [showCameraScanner, products, inventory, currentBranchId]);

  const handleProductClick = (product: Product) => {
    setPosError("");
    const totalAvailable = getProductStock(product.id);
    if (totalAvailable <= 0) {
      setPosError("Sin existencias en esta sucursal.");
      setTimeout(() => setPosError(""), 3000);
      return;
    }

    const needsConfig = product.hasSerial || (product.availableSizes?.length) || (product.availableColors?.length);
    if (needsConfig) {
      setSelectedProduct(product);
      // Pre-generar serie automáticamente si el producto lo requiere
      const autoSN = product.hasSerial ? `SN-${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}` : "";
      setConfigData({
        selectedSize: product.availableSizes?.[0],
        selectedColor: product.availableColors?.[0],
        serialNumber: autoSN
      });
      setShowConfigModal(true);
    } else {
      addToCart(product);
    }
  };

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
    const formatted = amount.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${symbol} ${formatted}`;
  };

  const addPaymentLine = () => {
    const newId = crypto.randomUUID();
    const curr = currencies.find(c => c.code === baseCurrency.code);
    const fillAmount = remainingBase > 0 ? Math.round((remainingBase / (curr?.rateToBase || 1)) * 100) / 100 : 0;
    const defaultBank = bankCards.find(c => c.currency === baseCurrency.code) || bankCards[0];
    setPaymentLines(prev => [...prev, { id: newId, code: baseCurrency.code, amount: fillAmount, method: 'cash', bankCardId: defaultBank?.id }]);
    setActivePaymentLineId(newId);
  };

  const updatePaymentLine = (id: string, field: keyof PaymentLine, value: any) => {
    setPaymentLines(prev => prev.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, [field]: value };
      if (field === 'method' && value === 'transfer' && !updated.bankCardId) {
        const matchingCard = bankCards.find(c => c.currency === updated.code) || bankCards[0];
        if (matchingCard) {
          updated.bankCardId = matchingCard.id;
        }
      }
      if (field === 'code' && updated.method === 'transfer') {
        const matchingCard = bankCards.find(c => c.currency === value) || bankCards[0];
        if (matchingCard) {
          updated.bankCardId = matchingCard.id;
        }
      }
      return updated;
    }));
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
    if (!currency) return;
    
    const amountNeededInCurrency = remainingBase / currency.rateToBase;
    updatePaymentLine(id, 'amount', Math.round((line.amount + amountNeededInCurrency) * 100) / 100);
  };

  const openCheckout = () => {
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
      const { connectBluetoothPrinter } = await import('../lib/escpos');
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
      const { connectPrinter } = await import('../lib/escpos');
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
    
    lines.push(`CENTER|BOLD|${receiptConfig.businessName || 'MARÉ POS'}`);
    if (receiptConfig.showAddress && receiptConfig.businessAddress) lines.push(`CENTER|${receiptConfig.businessAddress}`);
    if (receiptConfig.showPhone && receiptConfig.businessPhone) lines.push(`CENTER|${receiptConfig.businessPhone}`);
    
    lines.push("---");
    lines.push(`Ticket ID: ${tx.id}`);
    lines.push(`Fecha: ${new Date(tx.date).toLocaleDateString()} ${new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    const customer = useStore.getState().customers.find(c => c.id === tx.customerId);
    lines.push(`Cliente: ${(customer?.name || 'Consumidor Final').slice(0, 22)}`);
    lines.push("---");
    
    tx.items.forEach(item => {
      const itemName = `${item.quantity}x ${item.product.name}`;
      const itemPrice = formatMoney(item.product.price * item.quantity, baseCurrency.symbol);
      const dots = Math.max(1, 32 - itemName.length - itemPrice.length);
      lines.push(`${itemName}${" ".repeat(dots)}${itemPrice}`);
      if (item.serialNumber) {
        lines.push(`  S/N: ${item.serialNumber}`);
      }
      if (item.warrantyCode) {
        lines.push(`  Gda: ${item.warrantyCode} (${item.product.warrantyDays || 0}d)`);
      }
    });
    
    lines.push("---");
    const totLabel = "TOTAL:";
    const totVal = formatMoney(tx.total, baseCurrency.symbol);
    const totDots = Math.max(1, 32 - totLabel.length - totVal.length);
    lines.push(`BOLD|${totLabel}${" ".repeat(totDots)}${totVal}`);
    lines.push("---");
    
    lines.push("BOLD|Pagos recibidos:");
    tx.payments.forEach(p => {
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
    const sessionTx = transactions.filter(t => 
      t.branchId === session.branchId && 
      new Date(t.date) >= new Date(session.openedAt) && 
      (session.closedAt ? new Date(t.date) <= new Date(session.closedAt) : true)
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
        const commValue = prod.commissionType === 'percentage' 
          ? (prod.price * (prod.commissionValue || 0) / 100)
          : (prod.commissionValue || 0);
        return s + (commValue * item.quantity);
      }, 0);
    }, 0);

    const employee = users.find(u => u.id === session.userId || u.name === session.workerName) || users.find(u => u.name?.toLowerCase() === session.workerName?.toLowerCase()) || users.find(u => u.role === 'employee') || currentUser;
    const baseSalary = employee?.baseSalary || 0;
    const totalSalary = baseSalary + commissions;

    const lines: string[] = [];
    lines.push(`CENTER|BOLD|${receiptConfig.businessName || 'MARÉ POS'}`);
    if (receiptConfig.showAddress && receiptConfig.businessAddress) lines.push(`CENTER|${receiptConfig.businessAddress}`);
    if (receiptConfig.showPhone && receiptConfig.businessPhone) lines.push(`CENTER|${receiptConfig.businessPhone}`);
    lines.push("---");
    lines.push("CENTER|BOLD|CIERRE DE CAJA / TURNO");
    lines.push(`TURNO: ${session.id}`);
    lines.push(`FECHA: ${new Date(session.closingDate || session.closedAt || new Date()).toLocaleDateString()}`);
    lines.push(`HORA: ${new Date(session.closingDate || session.closedAt || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    lines.push(`VENDEDOR: ${(session.workerName || 'VENDEDOR').toUpperCase()}`);
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
    lines.push(`${totSLabel}${" ".repeat(Math.max(1, 32 - totSLabel.length - totSVal.length))}${totSVal}`);
    lines.push(`ITEMS TOTALES: ${soldList.reduce((s, i) => s + i.qty, 0)}`);
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

  const handleThermalPrint = async (tx: import("../types").Transaction, options?: { preferRawBT?: boolean }) => {
    try {
      const { printThermalReceipt, isPrinterConnected } = await import('../lib/escpos');
      const lines = getTransactionReceiptLines(tx);
      const isConnected = await isPrinterConnected();

      if (options?.preferRawBT) {
        await printThermalReceipt({
          lines,
          openDrawer: receiptConfig.openDrawer ?? true,
          width: '58mm',
          preferRawBT: true,
          onSuccess: () => {
            setPosSuccess("Enviado a impresora (RawBT)");
            setTimeout(() => setPosSuccess(""), 2500);
          }
        });
        return;
      }

      if (!isConnected) {
        // Direct attempt via printThermalReceipt (will use Bluetooth/Serial/RawBT)
        const printed = await printThermalReceipt({
          lines,
          openDrawer: receiptConfig.openDrawer ?? true,
          width: '58mm',
          onSuccess: (method) => {
            setPosSuccess(`Ticket enviado (${method === 'bluetooth' ? 'Bluetooth' : method === 'rawbt' ? 'RawBT' : 'USB'})`);
            setTimeout(() => setPosSuccess(""), 2500);
          },
          onError: () => {
            setShowPrinterSetupModal(true);
          }
        });
        if (!printed) {
          setShowPrinterSetupModal(true);
        }
      } else {
        await printThermalReceipt({
          lines,
          openDrawer: receiptConfig.openDrawer ?? true,
          width: '58mm',
          onSuccess: (method) => {
            setPosSuccess(`Ticket impreso (${method === 'bluetooth' ? 'Bluetooth' : 'USB'})`);
            setTimeout(() => setPosSuccess(""), 2500);
          }
        });
      }
    } catch (err: any) {
      console.error(err);
      setShowPrinterSetupModal(true);
    }
  };

  const handlePrintClosureThermal = async (session: CashRegisterSession | null, options?: { preferRawBT?: boolean }) => {
    if (!session) return;
    try {
      const { printThermalReceipt, isPrinterConnected } = await import('../lib/escpos');
      const lines = getClosureReceiptLines(session);
      const isConnected = await isPrinterConnected();

      setLastClosedSession(session);

      if (options?.preferRawBT) {
        await printThermalReceipt({
          lines,
          openDrawer: false,
          width: '58mm',
          preferRawBT: true,
          onSuccess: () => {
            setPosSuccess("Cierre enviado a impresora (RawBT)");
            setTimeout(() => setPosSuccess(""), 2500);
          }
        });
        return;
      }

      if (!isConnected) {
        const printed = await printThermalReceipt({
          lines,
          openDrawer: false,
          width: '58mm',
          onSuccess: (method) => {
            setPosSuccess(`Comprobante impreso (${method === 'bluetooth' ? 'Bluetooth' : method === 'rawbt' ? 'RawBT' : 'USB'})`);
            setTimeout(() => setPosSuccess(""), 2500);
          },
          onError: () => {
            setShowPrinterSetupModal(true);
          }
        });
        if (!printed) {
          setShowPrinterSetupModal(true);
        }
      } else {
        await printThermalReceipt({
          lines,
          openDrawer: false,
          width: '58mm',
          onSuccess: (method) => {
            setPosSuccess(`Comprobante impreso (${method === 'bluetooth' ? 'Bluetooth' : 'USB'})`);
            setTimeout(() => setPosSuccess(""), 2500);
          }
        });
      }
    } catch (err: any) {
      console.error('Error al imprimir comprobante:', err);
      setLastClosedSession(session);
      setShowPrinterSetupModal(true);
    }
  };

  const handleWhatsAppReceipt = (tx: Transaction) => {
    let phone = "";
    const customer = useStore.getState().customers.find(c => c.id === tx.customerId);
    if (customer?.phone) {
      phone = customer.phone.replace(/\D/g,'');
    } else {
      const input = window.prompt("Ingrese el número de WhatsApp del cliente:");
      if (!input) return;
      phone = input.replace(/\D/g,'');
    }
    
    if (!phone) {
      alert("Número de teléfono inválido.");
      return;
    }
    
    const storeName = useStore.getState().storeConfig.storeName;
    let itemsText = tx.items.map(i => `${i.quantity}x ${i.product.name} - ${formatMoney(i.product.price * i.quantity, baseCurrency.symbol)}`).join('%0A');
    const text = `Hola, gracias por tu compra en *${storeName}*.%0A%0A*Detalle del recibo ${tx.id}:*%0A${itemsText}%0A%0A*Total:* ${formatMoney(tx.total, baseCurrency.symbol)}%0A%0A¡Vuelve pronto!`;
    const url = `https://wa.me/${phone}?text=${text}`;
    window.open(url, '_blank');
  };

  const handleEmailReceipt = (tx: Transaction) => {
    const customer = useStore.getState().customers.find(c => c.id === tx.customerId);
    if (!customer?.email) {
      alert("El cliente no tiene un correo registrado.");
      return;
    }
    const storeName = useStore.getState().storeConfig.storeName;
    const subject = `Tu Recibo de Compra - ${storeName}`;
    const body = `Hola ${customer.name},\n\nGracias por tu compra. Tu recibo es ${tx.id} por un total de ${formatMoney(tx.total, baseCurrency.symbol)}.\n\nSaludos,\n${storeName}`;
    const url = `mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  };

  const handleCheckout = () => {
    // Final payments with rounded USD
    const finalizedPayments: import('../types').Payment[] = paymentLines
      .filter(p => p.amount > 0)
      .map(p => {
        const currency = currencies.find(c => c.code === p.code)!;
        let amount = p.amount;
        if (p.code === 'USD' && p.method === 'cash') {
          amount = Math.round(amount * 100) / 100;
        }
        return {
          currencyCode: p.code as any,
          amount: amount,
          exchangeRate: currency.rateToBase,
          method: p.method,
          bankCardId: p.bankCardId
        };
      });

    const txCount = transactions.length;
    const ticketNum = (txCount + 1).toString().padStart(2, '0');
    const txId = `TIKECT ID-MARE${ticketNum}`;

    const tx: import('../types').Transaction = {
      id: txId,
      branchId: currentBranchId,
      userId: currentUser?.id || 'u1',
      sellerEmployeeIds: [currentUser?.id || 'u1'],
      date: new Date().toISOString(),
      subtotal: subtotalBase,
      tax: taxBase,
      total: totalBase,
      items: cart,
      payments: finalizedPayments,
      status: 'completed',
      customerId: currentCustomerId,
      changeGiven: changeBase,
      changePayments: [],
      sessionId: currentSession?.id
    };

    // Generate NCF if customer is selected or if config requires it
    const nextNcf = useStore.getState().getNextNCF('B01'); // Default to Factura de Crédito Fiscal if needed, or B02
    if (nextNcf) {
      tx.ncf = nextNcf;
      tx.ncfType = 'B01';
    }

    processTransaction(tx);
    
    // Register bank transactions
    finalizedPayments.forEach(p => {
      if (p.method === 'transfer' && p.bankCardId) {
        const itemDetails = cart.map(item => `${item.quantity}x ${item.product.name}`).join(', ');
        addBankTransaction({
          id: generateId('BTX'),
          cardId: p.bankCardId,
          type: 'payment_received',
          amount: p.amount * p.exchangeRate,
          date: tx.date,
          reference: tx.id,
          description: `Venta ${tx.id}: ${itemDetails.substring(0, 100)}${itemDetails.length > 100 ? '...' : ''}`,
          transactionId: tx.id
        });
      }
    });

    // Close all checkout and mobile cart drawers cleanly
    setShowCheckoutModal(false);
    setShowMobileCart(false);
    clearCart();
    setPosSuccess(`Venta ${tx.id} registrada correctamente.`);
    setTimeout(() => setPosSuccess(""), 3000);

    // Show receipt modal so cashier gets receipt details & print option
    setShowReceiptModal(tx);

    if (useStore.getState().receiptConfig.autoPrint) {
      handleThermalPrint(tx).catch(console.error);
    }
  };

  const [sessionClosingDate, setSessionClosingDate] = useState(new Date().toISOString().split('T')[0]);

  const handleOpenSession = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(openingAmount);
    
    if (!sessionBranchId) {
      setPosError("Debes seleccionar una sucursal");
      setTimeout(() => setPosError(""), 3000);
      return;
    }

    if (!isNaN(val)) {
      setCurrentBranch(sessionBranchId);
      openSession({
        id: crypto.randomUUID(),
        branchId: sessionBranchId,
        openedAt: new Date().toISOString(),
        openingBalance: val,
        status: "open",
        userId: currentUser?.id || "u1",
        workerName: sessionWorkerName,
        workingEmployeeIds: [currentUser?.id || "u1"]
      });
      setOpeningAmount("");
      setSessionWorkerName("");
    }
  };

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const id = generateId('CST');
    addCustomer({ id, ...newCustomer });
    setCartCustomer(id);
    setShowAddCustomerModal(false);
    setNewCustomer({ name: '', phone: '', email: '', taxId: '' });
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 relative">
      {(posError || posSuccess) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4">
          {posError && (
            <div className="bg-red-500 text-white px-6 py-3 rounded-full shadow-lg font-bold text-sm tracking-wide">
              {posError}
            </div>
          )}
          {posSuccess && (
            <div className="bg-emerald-500 text-white px-6 py-3 rounded-full shadow-lg font-bold text-sm tracking-wide">
              {posSuccess}
            </div>
          )}
        </div>
      )}
      {!currentSession && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[2rem] shadow-2xl text-center max-w-sm w-full animate-in zoom-in-95 border border-white/20">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <DollarSign className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-3">Apertura de Caja</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">Fondo Inicial del Turno</p>
            
            <form onSubmit={handleOpenSession} className="space-y-4">
              <div className="text-left">
                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre del Vendedor / Turno</label>
                <input 
                  type="text" 
                  value={sessionWorkerName}
                  onChange={e => setSessionWorkerName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="Ej: Juan Pérez"
                />
              </div>

              {allowedBranches.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-left">
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Sucursal a Operar</label>
                    <select 
                      value={sessionBranchId}
                      onChange={(e) => setSessionBranchId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                    >
                      {allowedBranches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="text-left">
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Fondo Inicial ({baseCurrency.symbol})</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-slate-400 font-bold">{baseCurrency.symbol}</span>
                      </div>
                      <input 
                        type="number" 
                        min="0"
                        step="0.01"
                        required
                        value={openingAmount}
                        onChange={e => setOpeningAmount(e.target.value)}
                        className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-xl text-xl font-black text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                    <div className="space-y-3 pt-2">
                    <button 
                      type="submit"
                      className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
                    >
                      Abrir Caja y Comenzar
                    </button>
                    {currentUser?.role === 'admin' ? (
                      <button 
                        type="button"
                        onClick={() => navigate('/')}
                        className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                      >
                        Volver al Menú
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => logout()}
                        className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                      >
                        Cerrar Sesión
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 space-y-4">
                  <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold">
                    No tienes sucursales asignadas.
                  </div>
                  {currentUser?.role === 'admin' ? (
                    <button 
                      type="button"
                      onClick={() => navigate('/')}
                      className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                    >
                      Volver al Menú
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => logout()}
                      className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                    >
                      Cerrar Sesión
                    </button>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Checkout Modal - Compact & Linear Redesign */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[98vh] border border-white/20">
            
            {/* Header: Total Summary (Compact) */}
            <div className="bg-slate-900 text-white p-4 sm:p-6 relative">
              <button 
                onClick={() => { setShowCheckoutModal(false); setPaymentLines([]); setActivePaymentLineId(null); }}
                className="absolute right-3 top-3 sm:right-4 sm:top-4 p-1.5 hover:bg-white/10 rounded-full transition-colors"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
              
              <div className="text-center">
                <p className="text-slate-400 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] mb-0.5 sm:mb-1">Total a Cobrar</p>
                <h3 className="text-2xl sm:text-4xl font-black tracking-tight">{formatMoney(totalBase, baseCurrency.symbol)}</h3>
                <div className="mt-1 sm:mt-2 flex flex-wrap justify-center gap-1.5 sm:gap-2">
                  {currencies.filter(c => !c.isBase).map(c => (
                    <span key={c.code} className="text-[8px] sm:text-[9px] font-black bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-slate-300">
                      {c.code}: {formatMoney(totalBase / c.rateToBase, c.symbol)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2 sm:space-y-3">
              {/* Status Bar (Compact) */}
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-50 border border-slate-100 p-2 sm:p-3 rounded-xl sm:rounded-2xl">
                  <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest">Pagado</p>
                  <p className="text-sm sm:text-base font-black text-slate-900">{formatMoney(totalPaidBase, baseCurrency.symbol)}</p>
                </div>
                <div className={cn(
                  "flex-1 p-2 sm:p-3 rounded-xl sm:rounded-2xl border transition-colors",
                  remainingBase > 0 ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100"
                )}>
                  <p className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-slate-400">
                    {remainingBase > 0 ? "Faltante" : "Vuelto"}
                  </p>
                  <p className={cn(
                    "text-sm sm:text-base font-black",
                    remainingBase > 0 ? "text-rose-600" : "text-emerald-600"
                  )}>
                    {formatMoney(remainingBase > 0 ? remainingBase : changeBase, baseCurrency.symbol)}
                  </p>
                </div>
              </div>

              {changeBase > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                  <p className="text-[10px] font-black text-emerald-900 uppercase tracking-widest mb-1">Vuelto a entregar</p>
                  <p className="text-2xl font-black text-emerald-600">{formatMoney(changeBase, baseCurrency.symbol)}</p>
                  <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-tight mt-1">Entregar en {baseCurrency.code}</p>
                </div>
              )}

              {/* Linear Payment Inputs (Compact) */}
              <div className="space-y-1.5">
                {paymentLines.map((line) => (
                  <div 
                    key={line.id} 
                    onClick={() => setActivePaymentLineId(line.id)}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-2xl border-2 transition-all cursor-pointer group",
                      activePaymentLineId === line.id ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-wider",
                          line.method === 'cash' ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
                        )}>
                          {line.method === 'cash' ? 'EFECTIVO' : 'TRANSF.'}
                        </span>
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{line.code}</span>
                      </div>
                      <div className="text-lg font-black text-slate-900 leading-none">
                        {formatMoney(line.amount, currencies.find(c => c.code === line.code)?.symbol || '')}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); removePaymentLine(line.id); }}
                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                
                <button 
                  onClick={addPaymentLine} 
                  className="w-full py-2 bg-slate-50 border-2 border-dashed border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-100 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-3 h-3" /> Agregar Pago
                </button>
              </div>

              {activePaymentLineId && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="flex gap-2 mb-4">
                    <div className="flex-1 grid grid-cols-2 gap-1 p-1 bg-white rounded-xl border border-slate-100">
                      <button
                        onClick={() => updatePaymentLine(activePaymentLineId, 'method', 'cash')}
                        className={cn(
                          "py-2 rounded-lg text-[9px] font-black uppercase transition-all",
                          paymentLines.find(l => l.id === activePaymentLineId)?.method === 'cash' ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:bg-slate-50"
                        )}
                      >Efectivo</button>
                      <button
                        onClick={() => {
                          updatePaymentLine(activePaymentLineId, 'method', 'transfer');
                        }}
                        className={cn(
                          "py-2 rounded-lg text-[9px] font-black uppercase transition-all",
                          paymentLines.find(l => l.id === activePaymentLineId)?.method === 'transfer' ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:bg-slate-50"
                        )}
                      >Transf.</button>
                    </div>
                    <div className="flex-[1.2] flex gap-1 p-1 bg-white rounded-xl border border-slate-100 overflow-x-auto scrollbar-hide">
                      {currencies.map(c => (
                        <button
                          key={c.code}
                          onClick={() => {
                            const line = paymentLines.find(l => l.id === activePaymentLineId);
                            if (line) {
                              updatePaymentLine(line.id, 'code', c.code);
                            }
                          }}
                          className={cn(
                            "flex-1 py-2 px-3 rounded-lg text-[9px] font-black transition-all",
                            paymentLines.find(l => l.id === activePaymentLineId)?.code === c.code ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:bg-slate-50 disabled:opacity-30"
                          )}
                        >{c.code}</button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {paymentLines.find(l => l.id === activePaymentLineId)?.method === 'transfer' && (
                      <div className="p-4 bg-blue-600 text-white rounded-2xl border border-blue-500 shadow-lg animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-white/20 backdrop-blur-md text-white rounded-xl flex items-center justify-center shadow-inner">
                            <CreditCard className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-[12px] font-black uppercase tracking-widest leading-none mb-1">Cuenta de Destino</h4>
                            <p className="text-[9px] font-bold text-blue-200 uppercase tracking-tight">Venta por Transferencia</p>
                          </div>
                        </div>
                        <select
                          value={paymentLines.find(l => l.id === activePaymentLineId)?.bankCardId || ''}
                          onChange={(e) => updatePaymentLine(activePaymentLineId, 'bankCardId', e.target.value)}
                          className="w-full px-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl focus:ring-2 focus:ring-white outline-none text-[10px] font-black uppercase text-white shadow-inner placeholder:text-blue-200"
                        >
                          <option value="" className="text-slate-900">Seleccionar Banco Receptor...</option>
                          {(() => {
                            const activeLineCode = paymentLines.find(l => l.id === activePaymentLineId)?.code;
                            const matchedCards = bankCards.filter(c => c.currency === activeLineCode);
                            const cardsToRender = matchedCards.length > 0 ? matchedCards : bankCards;
                            return cardsToRender.map(card => (
                              <option key={card.id} value={card.id} className="text-slate-900">
                                {card.name} - {card.bank} ({card.currency})
                              </option>
                            ));
                          })()}
                        </select>
                      </div>
                    )}

                    <div className="flex justify-between items-end mb-1 px-1">
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Monto a recibir</label>
                      {remainingBase > 0 && (
                        <button 
                          onClick={() => autoFillRemaining(activePaymentLineId)}
                          className={cn(
                            "px-3 py-1 rounded-full transition-all uppercase tracking-tighter animate-bounce shadow-lg flex items-center gap-1.5",
                            paymentLines.find(l => l.id === activePaymentLineId)?.method === 'transfer' 
                              ? "bg-blue-600 text-white text-[11px] font-black ring-4 ring-blue-100" 
                              : "bg-indigo-50 text-indigo-600 text-[9px] font-black"
                          )}
                        >
                          {paymentLines.find(l => l.id === activePaymentLineId)?.method === 'transfer' && <div className="w-2 h-2 rounded-full bg-white animate-ping" />}
                          Total a cobrar: {formatMoney(remainingBase / (currencies.find(c => c.code === paymentLines.find(l => l.id === activePaymentLineId)?.code)?.rateToBase || 1), currencies.find(c => c.code === paymentLines.find(l => l.id === activePaymentLineId)?.code)?.symbol || '')}
                        </button>
                      )}
                    </div>
                    <input 
                      type="number"
                      step="0.01"
                      autoFocus
                      value={(() => {
                        const amt = paymentLines.find(l => l.id === activePaymentLineId)?.amount;
                        return (amt === undefined || Number.isNaN(amt)) ? '' : amt;
                      })()}
                      onChange={(e) => updatePaymentLine(activePaymentLineId, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-2xl font-black text-slate-900 shadow-inner"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100">
              <button 
                disabled={remainingBase > 0.01 || paymentLines.length === 0 || paymentLines.some(l => l.method === 'transfer' && bankCards.length > 0 && !l.bankCardId)}
                onClick={handleCheckout}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-base uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-30 disabled:grayscale disabled:shadow-none active:scale-95"
              >
                CONFIRMAR COBRO
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Cash Management Modal */}
      {showCashManagementModal && currentSession && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 border border-white/20">
            <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-400" />
                <h3 className="text-xs font-black uppercase tracking-widest">Caja y Ventas del Turno</h3>
              </div>
              <button 
                onClick={() => setShowCashManagementModal(false)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex border-b border-slate-100">
              <button
                onClick={() => setCashManagementTab('movements')}
                className={cn(
                  "flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors",
                  cashManagementTab === 'movements' ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Movimientos
              </button>
              <button
                onClick={() => setCashManagementTab('sales')}
                className={cn(
                  "flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors",
                  cashManagementTab === 'sales' ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Ventas
              </button>
              <button
                onClick={() => setCashManagementTab('close')}
                className={cn(
                  "flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors",
                  cashManagementTab === 'close' ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Arqueo y Cierre
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {cashManagementTab === 'movements' ? (
                <div className="space-y-6">
                  <form onSubmit={handleAddMovement} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipo</label>
                        <select 
                          value={movementData.type}
                          onChange={e => setMovementData({...movementData, type: e.target.value as any})}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="expense">Egreso (Gasto)</option>
                          <option value="income">Ingreso (Entrada)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Moneda</label>
                        <select 
                          value={movementData.currencyCode}
                          onChange={e => setMovementData({...movementData, currencyCode: e.target.value})}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Monto</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          required
                          value={movementData.amount}
                          onChange={e => setMovementData({...movementData, amount: e.target.value})}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Descripción</label>
                        <input 
                          type="text" 
                          required
                          value={movementData.description}
                          onChange={e => setMovementData({...movementData, description: e.target.value})}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Ej: Pago de almuerzo"
                        />
                      </div>
                    </div>
                    <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100">
                      Registrar Movimiento
                    </button>
                  </form>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Historial de Turno</h4>
                    {currentSession.movements && currentSession.movements.length > 0 ? (
                      currentSession.movements.map(m => (
                        <div key={m.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center",
                              m.type === 'income' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                            )}>
                              {m.type === 'income' ? <TrendingUp className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{m.description}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase">{new Date(m.date).toLocaleTimeString()}</p>
                            </div>
                          </div>
                          <p className={cn(
                            "text-[11px] font-black",
                            m.type === 'income' ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {m.type === 'income' ? '+' : '-'}{m.amount.toLocaleString('es-CU', { minimumFractionDigits: 2 })} {m.currencyCode}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-4 font-bold">No hay movimientos registrados</p>
                    )}
                  </div>
                </div>
              ) : cashManagementTab === 'sales' ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumen de Ventas del Turno</h4>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Abierto: {new Date(currentSession.openedAt).toLocaleTimeString()}</span>
                  </div>

                  {(() => {
                    const sessionTx = transactions.filter(t => 
                      t.branchId === currentBranchId && 
                      (
                        t.sessionId 
                          ? t.sessionId === currentSession.id
                          : (new Date(t.date).getTime() >= new Date(currentSession.openedAt).getTime() &&
                             (!currentSession.closedAt || new Date(t.date).getTime() <= new Date(currentSession.closedAt).getTime()))
                      )
                    );
                    const productAgg: Record<string, { name: string, quantity: number, unitPrice: number, total: number }> = {};
                    sessionTx.forEach(tx => {
                      tx.items.forEach(item => {
                        const prodObj = typeof item.product === 'object' ? item.product : products.find(p => p.id === (item.product as unknown as string));
                        const name = prodObj?.name || (typeof item.product === 'string' ? item.product : 'Producto');
                        const price = prodObj?.price || 0;
                        const variantStr = item.variantLabel ? ` (${item.variantLabel})` : '';
                        const fullName = `${name}${variantStr}`;

                        if (!productAgg[fullName]) {
                          productAgg[fullName] = { name: fullName, quantity: 0, unitPrice: price, total: 0 };
                        }
                        productAgg[fullName].quantity += item.quantity;
                        productAgg[fullName].total += (price * item.quantity);
                      });
                    });
                    const consolidatedList = Object.values(productAgg);
                    const totalSalesAmount = sessionTx.reduce((sum, tx) => sum + tx.total, 0);

                    return (
                      <div className="space-y-4">
                        {/* Lista Consolidada de Productos Vendidos */}
                        <div className="bg-indigo-50/60 rounded-2xl border border-indigo-100 p-4 space-y-3">
                          <div className="flex justify-between items-center border-b border-indigo-100 pb-2.5">
                            <h5 className="text-[10px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                              <Package className="w-4 h-4 text-indigo-600" />
                              Lista Consolidada de Productos Vendidos
                            </h5>
                            <span className="text-[9px] font-black text-indigo-600 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                              {consolidatedList.reduce((s, p) => s + p.quantity, 0)} u.
                            </span>
                          </div>

                          {consolidatedList.length > 0 ? (
                            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                              {consolidatedList.map((prod, idx) => (
                                <div key={idx} className="bg-white p-3 rounded-xl border border-indigo-100/80 flex items-center justify-between shadow-sm">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <span className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-black text-xs shrink-0">
                                      {prod.quantity}x
                                    </span>
                                    <div className="min-w-0">
                                      <span className="font-black text-slate-900 text-xs uppercase block truncate">{prod.name}</span>
                                      <span className="text-[10px] font-bold text-slate-500 block">
                                        {prod.quantity} {prod.quantity === 1 ? 'unidad' : 'unidades'} por {formatMoney(prod.unitPrice, baseCurrency.symbol)} = <strong className="text-slate-800">{formatMoney(prod.total, baseCurrency.symbol)}</strong>
                                      </span>
                                    </div>
                                  </div>
                                  <span className="font-black text-indigo-600 shrink-0 ml-3 text-sm">
                                    {formatMoney(prod.total, baseCurrency.symbol)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 bg-white rounded-xl border border-dashed border-indigo-100">
                              <Package className="w-8 h-8 text-indigo-200 mx-auto mb-2" />
                              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No hay productos vendidos en este turno</p>
                            </div>
                          )}

                          <div className="pt-2.5 border-t border-indigo-100/80 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-indigo-900">Total General del Turno</span>
                            <span className="text-base font-black text-indigo-700">{formatMoney(totalSalesAmount, baseCurrency.symbol)}</span>
                          </div>
                        </div>

                        {/* Botón para Imprimir Resumen Completo */}
                        <button
                          type="button"
                          onClick={() => handlePrintClosureThermal(currentSession)}
                          className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Printer className="w-4 h-4" />
                          Imprimir Resumen Completo de Ventas (58mm)
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-indigo-50 rounded-2xl p-4 flex justify-between items-center border border-indigo-100">
                    <div>
                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Fondo Inicial</p>
                      <p className="text-lg font-black text-indigo-900">{currentSession.openingBalance.toLocaleString('es-CU', { minimumFractionDigits: 2 })} {baseCurrency.code}</p>
                    </div>
                    <button 
                      onClick={() => {
                        const autoBalances: {[key: string]: number} = {};
                        expectedBalances.forEach(eb => {
                          autoBalances[`${eb.currencyCode}-${eb.method}`] = eb.amount;
                        });
                        setClosingBalances(autoBalances);
                      }}
                      className="text-[9px] font-black uppercase text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-xl transition-all shadow-md shadow-indigo-100 active:scale-95"
                    >
                      Cuadre Perfecto
                    </button>
                  </div>

                  <form onSubmit={handleClose} className="space-y-5">
                    {/* Fecha de Cierre Arriba */}
                    <div className="space-y-3">
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                        <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                          Fecha de Cierre del Turno
                        </label>
                        <input 
                          type="date"
                          required
                          value={sessionClosingDate}
                          onChange={(e) => setSessionClosingDate(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        />
                      </div>

                      {/* Vendedor del Turno (Sin volver a pedir el nombre) */}
                      <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-indigo-600" />
                          <span className="text-[9px] font-black text-indigo-900 uppercase tracking-wider">Vendedor Asignado:</span>
                        </div>
                        <span className="text-xs font-black text-indigo-950 uppercase tracking-tight">
                          {currentSession?.workerName || sessionWorkerName || currentUser?.name || 'Vendedor'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2">Arqueo de Efectivo Físico</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {currencies.map(c => (
                          <div key={c.code} className="bg-slate-50 p-3 rounded-xl border border-slate-100 focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
                            <label className="block text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Efectivo {c.code}</label>
                            <input 
                              type="number" 
                              min="0" step="0.01"
                              value={closingBalances[`${c.code}-cash`] || ''}
                              onChange={(e) => setClosingBalances({ ...closingBalances, [`${c.code}-cash`]: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-transparent border-none focus:ring-0 outline-none font-black text-slate-900 text-sm p-0"
                              placeholder="0.00"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2">Transferencias</h4>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <label className="block text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">Transf. CUP</label>
                        <input 
                          type="number" 
                          min="0" step="0.01"
                          value={closingBalances['CUP-transfer'] || ''}
                          onChange={(e) => setClosingBalances({ ...closingBalances, 'CUP-transfer': parseFloat(e.target.value) || 0 })}
                          className="w-full bg-transparent border-none focus:ring-0 outline-none font-black text-slate-900 text-sm p-0"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button 
                        type="submit"
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95 flex items-center justify-center gap-2"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        Cerrar Turno y Finalizar
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Discrepancy Modal */}
      {showDiscrepancyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 border border-rose-100">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Discrepancia Detectada</h3>
              <p className="text-xs font-bold text-slate-500">Hay diferencias entre el dinero declarado y lo esperado por el sistema. ¿Deseas cerrar la caja asumiendo la pérdida/sobrante?</p>
              
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowDiscrepancyModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors"
                >
                  Revisar
                </button>
                <button 
                  onClick={confirmClose}
                  className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all shadow-md shadow-rose-100"
                >
                  Forzar Cierre
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Configurar Producto */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Configurar Producto</h3>
              <p className="text-slate-500 mb-6">Completa los detalles para <span className="font-semibold text-slate-800">{selectedProduct?.name}</span>.</p>
              
              <form onSubmit={handleConfigSubmit} className="space-y-4">
                {selectedProduct?.hasSerial && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Número de Serie (Opcional)</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        autoFocus
                        placeholder="Ej: SN-123456789" 
                        value={configData.serialNumber || ''}
                        onChange={(e) => setConfigData({...configData, serialNumber: e.target.value})}
                        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                      />
                      <button type="button" onClick={generateSerial} className="px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl font-medium hover:bg-indigo-100 transition-colors">
                        Generar
                      </button>
                    </div>
                  </div>
                )}
                
                {selectedProduct?.availableSizes && selectedProduct.availableSizes.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Talla</label>
                    <select 
                      required
                      value={configData.selectedSize || ''}
                      onChange={(e) => setConfigData({...configData, selectedSize: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                    >
                      {selectedProduct.availableSizes.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}

                {selectedProduct?.availableColors && selectedProduct.availableColors.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
                    <select 
                      required
                      value={configData.selectedColor || ''}
                      onChange={(e) => setConfigData({...configData, selectedColor: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                    >
                      {selectedProduct.availableColors.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => { setShowConfigModal(false); setConfigData({}); }}
                    className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    Agregar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Left Area: Products Grid */}
      <div className={cn(
        "flex-1 flex flex-col min-h-0 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden",
        showMobileCart ? "hidden lg:flex" : "flex"
      )}>
        
        {/* Top Bar: Unified Header */}
        <div className="p-3 border-b border-slate-100 bg-white/50 backdrop-blur-md sticky top-0 z-30">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center">
              {/* Search Section */}
              <div className="flex-1 w-full flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar producto, SKU o código de barras..." 
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-100 border-none rounded-2xl focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm font-bold text-slate-700 placeholder:text-slate-400"
                  />
                </div>
              </div>
              
              {/* Status & Session Area: Standardized Compact Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 w-full xl:w-auto justify-start sm:justify-end">
                {/* Session Status & Quick Actions */}
                  {currentSession ? (
                    <>
                      <div className="h-8 px-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 shadow-sm whitespace-nowrap">
                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />
                        <span>Turno Activo</span>
                      </div>

                      <button
                        onClick={() => {
                          setCashManagementTab('close');
                          setShowCashManagementModal(true);
                        }}
                        className="h-8 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all active:scale-95 shadow-sm whitespace-nowrap"
                        title="Realizar Arqueo y Cerrar Turno"
                      >
                        <Lock className="w-3.5 h-3.5 text-rose-600" />
                        <span>Cerrar Turno</span>
                      </button>

                      <button
                        onClick={() => {
                          setCashManagementTab('sales');
                          setShowCashManagementModal(true);
                        }}
                        className="h-8 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all active:scale-95 shadow-sm whitespace-nowrap"
                        title="Ver ventas realizadas en este turno"
                      >
                        <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Ventas Turno</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setCashManagementTab('open');
                        setShowCashManagementModal(true);
                      }}
                      className="h-8 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all active:scale-95 shadow-sm whitespace-nowrap"
                    >
                      <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Abrir Turno</span>
                    </button>
                  )}

                  {/* Printer Connection Badge */}
                  <button
                    onClick={() => setShowPrinterSetupModal(true)}
                    className={cn(
                      "h-8 px-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 border shrink-0 shadow-sm whitespace-nowrap transition-all active:scale-95",
                      connectedPrinterName 
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" 
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    )}
                    title="Configurar / Vincular Impresora Térmica 58mm"
                  >
                    <Printer className={cn("w-3.5 h-3.5", connectedPrinterName ? "text-indigo-600" : "text-slate-400")} />
                    <span className="max-w-[110px] truncate">{connectedPrinterName ? `Térmica: ${connectedPrinterName}` : 'Impresora 58mm'}</span>
                  </button>

                  {/* Connection Status */}
                  <div 
                    className={cn(
                      "h-8 px-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 border shrink-0 shadow-sm whitespace-nowrap",
                      isOffline ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    )}
                  >
                    <div className={cn("w-1.5 h-1.5 rounded-full", isOffline ? "bg-rose-500" : "bg-emerald-500 animate-pulse")} />
                    <span>{isOffline ? (syncQueue.length > 0 ? `Offline (${syncQueue.length})` : 'Offline') : 'Online'}</span>
                  </div>

                  {/* Branch Selection */}
                  <div className="relative shrink-0">
                    <select 
                      value={currentBranchId}
                      onChange={(e) => setCurrentBranch(e.target.value)}
                      disabled={!!currentSession}
                      className="h-8 pl-2.5 pr-7 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-wider text-slate-700 outline-none focus:ring-1 focus:ring-indigo-200 disabled:opacity-50 disabled:bg-slate-50 transition-all appearance-none shadow-sm cursor-pointer whitespace-nowrap"
                    >
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <TrendingUp className="w-2.5 h-2.5 rotate-180" />
                    </div>
                  </div>

                  {/* Mobile Direct Ticket Toggle Button */}
                  <button
                    onClick={() => setShowMobileCart(true)}
                    className="lg:hidden h-8 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 active:scale-95 shadow-sm whitespace-nowrap"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Ticket ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
                  </button>
                </div>
              </div>

            {/* Categories: Top Horizontal Scroll */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide border-t border-slate-50 pt-2">
              <button 
                onClick={() => setActiveCategoryId("Todos")}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2",
                  activeCategoryId === "Todos" 
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                    : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                )}
              >
                Todos
              </button>
              {categories.map(category => (
                <button 
                  key={category.id}
                  onClick={() => setActiveCategoryId(category.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2",
                    activeCategoryId === category.id 
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                      : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                  )}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-3 pb-28 lg:pb-3 bg-slate-50/50">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className="flex flex-col items-center p-2 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all active:scale-95 bg-white relative overflow-hidden group shadow-sm"
                >
                  {/* Warranty Pill Top-Right */}
                  {(product.warrantyDays ?? 0) > 0 && (
                    <div className="absolute top-1.5 right-1.5 bg-emerald-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full shadow-sm z-20 uppercase tracking-tighter">
                      {product.warrantyDays} días
                    </div>
                  )}

                  {/* Image Area */}
                  <div className="w-full aspect-square bg-slate-50 rounded-xl mb-2 flex items-center justify-center overflow-hidden relative">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                    ) : (
                      <div className={cn("w-full h-full opacity-10", product.color)} />
                    )}
                  </div>

                  <div className="w-full text-center space-y-1.5">
                    <p className="font-black text-slate-900 text-[9px] uppercase tracking-tighter leading-tight line-clamp-1">{product.name}</p>
                    
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex flex-wrap justify-center gap-1">
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                          {categories.find(c => c.id === product.categoryId)?.name}
                        </span>
                      </div>
                      
                      <span className="text-indigo-600 font-black text-[10px] bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                        {formatMoney(product.price, baseCurrency.symbol)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

      {/* Right Area: Ticket / Cart (Compact) */}
      <div className={cn(
        "w-full lg:w-72 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col shrink-0 overflow-hidden",
        !showMobileCart ? "hidden lg:flex" : "flex fixed inset-0 z-50 lg:relative lg:inset-auto"
      )}>
        {showMobileCart && (
          <div className="lg:hidden p-3.5 bg-slate-900 flex justify-between items-center text-white shrink-0 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black uppercase text-xs tracking-wider">Ticket de Venta</h3>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{cart.reduce((s, i) => s + i.quantity, 0)} productos en cola</span>
              </div>
            </div>
            <button 
              onClick={() => setShowMobileCart(false)} 
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <X className="w-4 h-4" />
              <span>Volver</span>
            </button>
          </div>
        )}
        <div className="p-3 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
          <h2 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-500" />
            Ticket
          </h2>
          <button 
            onClick={clearCart}
            className="text-slate-300 hover:text-rose-500 transition-colors p-1"
            title="Vaciar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Customer Selection (Compact) */}
        <div className="p-2 border-b border-slate-50 flex gap-1">
          <select 
            value={currentCustomerId || ""}
            onChange={(e) => setCartCustomer(e.target.value || undefined)}
            className="flex-1 bg-slate-50 border-none rounded-lg px-3 py-1.5 outline-none text-[10px] font-black uppercase tracking-tighter text-slate-600 focus:ring-1 focus:ring-indigo-100"
          >
            <option value="">Consumidor Final</option>
            {useStore.getState().customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button 
            onClick={() => setShowAddCustomerModal(true)}
            className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
            title="Añadir Cliente"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>

        {/* Cart Items (Compact) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-200 space-y-2 opacity-50">
              <ShoppingCart className="w-8 h-8" />
              <p className="text-[10px] font-black uppercase tracking-widest">Vacío</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex flex-col gap-1 group pb-2 border-b border-slate-50 last:border-0">
                <div className="flex justify-between items-start gap-2">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-tighter leading-tight">{item.product.name}</h4>
                  <p className="text-[10px] font-black text-slate-900">{formatMoney(item.product.price * item.quantity, baseCurrency.symbol)}</p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {item.variantLabel && (
                      <span className="text-[8px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-tighter">{item.variantLabel}</span>
                    )}
                    {item.serialNumber && (
                      <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">SN: {item.serialNumber}</span>
                    )}
                    {item.product.warrantyDays && item.product.warrantyDays > 0 ? (
                      <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                        Gda: {item.product.warrantyDays}d
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-100">
                    <button 
                      onClick={() => updateCartQty(item.id, -1)} 
                      className="p-1 rounded-md hover:bg-white text-slate-400 hover:text-slate-600 transition-all"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center text-[10px] font-black">{item.quantity}</span>
                    <button 
                      onClick={() => {
                        if (getCartQuantity(item.product.id, item.variantLabel) >= getProductStock(item.product.id, item.variantLabel)) {
                          setPosError("No hay suficiente stock para aumentar la cantidad.");
                          setTimeout(() => setPosError(""), 3000);
                        } else {
                          updateCartQty(item.id, 1);
                        }
                      }} 
                      disabled={item.product.hasSerial || getCartQuantity(item.product.id, item.variantLabel) >= getProductStock(item.product.id, item.variantLabel)}
                      className="p-1 rounded-md hover:bg-white text-slate-400 hover:text-slate-600 transition-all disabled:opacity-0"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals & Payment (Compact) */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
          <div className="space-y-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="text-slate-600 font-black">{formatMoney(subtotalBase, baseCurrency.symbol)}</span>
            </div>
            <div className="flex justify-between text-slate-900 font-black pt-2 border-t border-slate-100">
              <span className="text-[11px]">Total CUP</span>
              <span className="text-sm">{formatMoney(totalBase, baseCurrency.symbol)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button 
                disabled={cart.length === 0}
                onClick={() => {
                  const lineId = crypto.randomUUID();
                  setPaymentLines([{ id: lineId, code: baseCurrency.code, amount: totalBase, method: 'cash' }]);
                  setActivePaymentLineId(lineId);
                  setShowMobileCart(false);
                  setShowCashManagementModal(false);
                  setShowReceiptModal(null);
                  setShowCheckoutModal(true);
                }}
                className="w-full bg-emerald-600 text-white font-black text-[9px] uppercase tracking-widest py-3 rounded-2xl flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition-all shadow-md shadow-emerald-100 disabled:opacity-30 disabled:grayscale disabled:shadow-none"
              >
                Efectivo
              </button>
              <button 
                disabled={cart.length === 0}
                onClick={() => {
                  const lineId = crypto.randomUUID();
                  setPaymentLines([{ id: lineId, code: baseCurrency.code, amount: totalBase, method: 'transfer' }]);
                  setActivePaymentLineId(lineId);
                  setShowMobileCart(false);
                  setShowCashManagementModal(false);
                  setShowReceiptModal(null);
                  setShowCheckoutModal(true);
                }}
                className="w-full bg-blue-600 text-white font-black text-[9px] uppercase tracking-widest py-3 rounded-2xl flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-100 disabled:opacity-30 disabled:grayscale disabled:shadow-none"
              >
                Transferencia
              </button>
            </div>
            <button 
              disabled={cart.length === 0}
              onClick={() => {
                setShowMobileCart(false);
                setShowCashManagementModal(false);
                setShowReceiptModal(null);
                openCheckout();
              }}
              className="w-full bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-100 disabled:opacity-30 disabled:grayscale disabled:shadow-none"
            >
              Cobro Mixto / Múltiple
            </button>
          </div>
        </div>

      {showReceiptModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
          <div className="bg-white shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 print:w-full print:max-w-none print:shadow-none print:bg-white print:fixed print:inset-0">
            <div className="p-6 text-sm text-center print:p-2" id="print-area">
              <h2 className="text-xl font-bold uppercase">{useStore.getState().receiptConfig.businessName}</h2>
              {useStore.getState().receiptConfig.showAddress && (
                <p className="text-slate-500 text-xs mt-1">{useStore.getState().receiptConfig.businessAddress}</p>
              )}
              {useStore.getState().receiptConfig.showPhone && (
                <p className="text-slate-500 text-xs">{useStore.getState().receiptConfig.businessPhone}</p>
              )}
              
              <div className="border-t border-dashed border-slate-300 my-4"></div>
              
              <div className="flex justify-between text-xs mb-1">
                <span>Fecha: {new Date(showReceiptModal.date).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span>Cliente: {useStore.getState().customers.find(c => c.id === showReceiptModal.customerId)?.name || 'Consumidor Final'}</span>
              </div>
              <div className="flex justify-between text-xs mb-4">
                <span className="font-bold">Ticket ID: {showReceiptModal.id}</span>
              </div>

              <div className="space-y-2 mb-4 text-left">
                {showReceiptModal.items.map(item => (
                  <div key={item.id} className="text-xs">
                    <div className="flex justify-between">
                      <span className="font-semibold">{item.quantity}x {item.product.name}</span>
                      <span className="font-bold">{formatMoney(item.product.price * item.quantity, baseCurrency.symbol)}</span>
                    </div>
                    {item.serialNumber && (
                      <div className="pl-4 text-slate-500 mt-0.5 font-mono text-[10px]">
                        Serie: {item.serialNumber}
                      </div>
                    )}
                    {item.warrantyCode && (
                      <div className="pl-4 text-slate-500 mt-0.5 font-mono text-[10px]">
                        ID Gda: {item.warrantyCode} ({item.product.warrantyDays || 0}d)
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-slate-300 my-4"></div>
              
              <div className="flex justify-between font-bold text-sm">
                <span>TOTAL</span>
                <span>{baseCurrency.symbol}{showReceiptModal.total.toFixed(2)} {baseCurrency.code}</span>
              </div>

              <div className="mt-4 text-left space-y-1">
                <div className="text-xs font-semibold mb-1">Pagos recibidos:</div>
                {showReceiptModal.payments.map((p, i) => (
                  <div key={i} className="text-xs flex justify-between text-slate-600">
                    <span>{p.method === 'cash' ? 'Efectivo' : 'Transferencia'} ({p.currencyCode})</span>
                    <span>{formatMoney(p.amount, currencies.find(c => c.code === p.currencyCode)?.symbol || '')}</span>
                  </div>
                ))}
              </div>

              {showReceiptModal.changePayments && showReceiptModal.changePayments.length > 0 && (
                <div className="mt-4 text-left space-y-1">
                  <div className="text-xs font-semibold mb-1">Vuelto entregado:</div>
                  {showReceiptModal.changePayments.map((p, i) => (
                    <div key={i} className="text-xs flex justify-between text-emerald-600 font-medium">
                      <span>Efectivo ({p.currencyCode})</span>
                      <span>{formatMoney(p.amount, currencies.find(c => c.code === p.currencyCode)?.symbol || '')}</span>
                    </div>
                  ))}
                </div>
              )}

              {(!showReceiptModal.changePayments || showReceiptModal.changePayments.length === 0) && showReceiptModal.changeGiven && showReceiptModal.changeGiven > 0 && (
                <div className="mt-4 text-left space-y-1">
                  <div className="text-xs font-semibold mb-1">Vuelto entregado:</div>
                  <div className="text-xs flex justify-between text-emerald-600 font-medium">
                    <span>Efectivo ({baseCurrency.code})</span>
                    <span>{formatMoney(showReceiptModal.changeGiven, baseCurrency.symbol)}</span>
                  </div>
                </div>
              )}

              <div className="border-t border-dashed border-slate-300 my-4"></div>
              {useStore.getState().receiptConfig.showFooter && (
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight leading-relaxed">
                  {useStore.getState().receiptConfig.footerText}
                </p>
              )}
            </div>
            
            <div className="p-3 bg-slate-50 flex flex-wrap gap-2 print:hidden justify-center items-center">
              <button 
                onClick={() => setShowReceiptModal(null)}
                className="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
              >
                Cerrar
              </button>
              
              <button 
                onClick={() => handleWhatsAppReceipt(showReceiptModal)}
                className="px-3.5 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-200 active:scale-95"
                title="Enviar por WhatsApp"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp
              </button>
              
              <button 
                onClick={() => handleThermalPrint(showReceiptModal, { preferRawBT: true })}
                className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-1.5 shadow-sm shadow-indigo-200 active:scale-95"
                title="Impresión directa para Android con RawBT"
              >
                <Smartphone className="w-3.5 h-3.5" />
                RawBT (Android)
              </button>

              <button 
                onClick={() => handleThermalPrint(showReceiptModal)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                title="Impresión Térmica Directa 58mm (Bluetooth / USB)"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir Térmica 58mm
              </button>
            </div>
          </div>
        </div>
      )}

      {returnConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 border border-rose-100">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-2 animate-bounce">
                <ArrowLeftRight className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">¿Confirmar Devolución?</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed">
                Estás a punto de devolver <span className="text-rose-600">{returnConfirm.item.quantity}x {returnConfirm.item.product.name}</span>. 
                Esto reintegrará el stock a la sucursal actual.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-4">
                <button 
                  onClick={() => setReturnConfirm(null)}
                  className="py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleReturnItem}
                  className="py-3 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 active:scale-95"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showSalarySummary && lastClosedSession && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 border border-indigo-100">
            <div className="p-6 text-center space-y-5">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-1">
                <ShieldCheck className="w-8 h-8" />
              </div>
              
              <div>
                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border border-indigo-100">
                  {lastClosedSession.id}
                </span>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mt-2">Turno Cerrado con Éxito</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {new Date(lastClosedSession.closingDate || lastClosedSession.closedAt || new Date()).toLocaleString()} • {lastClosedSession.workerName || 'Vendedor'}
                </p>
              </div>

              {(() => {
                const sessionTransactions = transactions.filter(t => 
                  t.branchId === lastClosedSession.branchId && 
                  new Date(t.date) >= new Date(lastClosedSession.openedAt) && 
                  (lastClosedSession.closedAt ? new Date(t.date) <= new Date(lastClosedSession.closedAt) : true)
                );

                const commissions = sessionTransactions.reduce((sum, tx) => {
                  return sum + tx.items.reduce((s, item) => {
                    const prodId = typeof item.product === 'string' ? item.product : item.product.id;
                    const prod = products.find(p => p.id === prodId);
                    if (!prod) return s;
                    const commValue = prod.commissionType === 'percentage' 
                      ? (prod.price * (prod.commissionValue || 0) / 100)
                      : (prod.commissionValue || 0);
                    return s + (commValue * item.quantity);
                  }, 0);
                }, 0);

                const employee = users.find(u => u.id === lastClosedSession.userId || u.name === lastClosedSession.workerName) || users.find(u => u.name?.toLowerCase() === lastClosedSession.workerName?.toLowerCase()) || users.find(u => u.role === 'employee') || currentUser;
                const baseSalary = employee?.baseSalary || 0;
                const totalSalary = baseSalary + commissions;
                const totalSales = sessionTransactions.reduce((sum, tx) => sum + tx.total, 0);
                const totalItems = sessionTransactions.reduce((sum, tx) => sum + tx.items.reduce((s, i) => s + i.quantity, 0), 0);

                return (
                  <div className="space-y-3 text-left">
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2.5">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200/60 pb-1.5 flex justify-between">
                        <span>Liquidación Diaria de Salario</span>
                        <span className="text-emerald-600 font-bold">{totalItems} productos vendidos</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-500 uppercase tracking-wider">Salario Base</span>
                        <span className="font-black text-slate-900">{formatMoney(baseSalary, baseCurrency.symbol)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-500 uppercase tracking-wider">Comisiones</span>
                        <span className="font-black text-emerald-600">+{formatMoney(commissions, baseCurrency.symbol)}</span>
                      </div>
                      <div className="pt-2.5 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Total Salario a Pagar</span>
                        <span className="text-xl font-black text-indigo-600">{formatMoney(totalSalary, baseCurrency.symbol)}</span>
                      </div>
                    </div>

                    <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100 flex justify-between items-center text-[10px] font-black uppercase text-indigo-900">
                      <span>Ventas Totales del Turno:</span>
                      <span className="text-sm font-black">{formatMoney(totalSales, baseCurrency.symbol)}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2.5 pt-2">
                <button 
                  onClick={() => handlePrintClosureThermal(lastClosedSession)}
                  className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Cierre Térmico (Directo 58mm)
                </button>

                <button 
                  onClick={() => handlePrintClosureThermal(lastClosedSession, { preferRawBT: true })}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-4 h-4" />
                  Imprimir con RawBT (Android)
                </button>

                <button 
                  onClick={() => {
                    setShowSalarySummary(false);
                    navigate('/');
                  }}
                  className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  Finalizar e Ir al Menú <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xs overflow-hidden animate-in zoom-in-95 border border-white/20">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Nuevo Cliente</h3>
                <button onClick={() => setShowAddCustomerModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={handleAddCustomer} className="space-y-3">
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre Completo</label>
                  <input 
                    required 
                    type="text" 
                    value={newCustomer.name} 
                    onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none text-xs font-bold" 
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Teléfono</label>
                  <input 
                    type="text" 
                    value={newCustomer.phone} 
                    onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none text-xs font-bold" 
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Email (Opcional)</label>
                  <input 
                    type="email" 
                    value={newCustomer.email} 
                    onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none text-xs font-bold" 
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">CI o Pasaporte</label>
                  <input 
                    type="text" 
                    value={newCustomer.taxId} 
                    onChange={e => setNewCustomer({...newCustomer, taxId: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none text-xs font-bold" 
                    placeholder="Número de identidad"
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95">
                  Guardar Cliente
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Cart & Quick Checkout Bottom Bar: Permanently Visible on Mobile */}
      {!showMobileCart && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/98 backdrop-blur-md text-white px-3.5 py-2.5 shadow-[0_-8px_30px_rgba(0,0,0,0.3)] border-t border-slate-800 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2">
          <div 
            onClick={() => setShowMobileCart(true)}
            className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
          >
            <div className="relative shrink-0">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-950">
                <ShoppingCart className="w-4 h-4" />
              </div>
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-slate-900 animate-pulse">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">
                {cart.length === 0 ? "Ticket de Venta" : "Total del Ticket"}
              </div>
              <div className="text-xs sm:text-sm font-black text-white truncate">
                {cart.length === 0 ? "0 productos (Vacío)" : formatMoney(totalBase, baseCurrency.symbol)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowMobileCart(true)}
              className="h-9 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 border border-slate-700 shadow-sm"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-indigo-400" />
              <span>Ver Pedido</span>
            </button>
            <button
              disabled={cart.length === 0}
              onClick={openCheckout}
              className="h-9 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-950 active:scale-95 flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Cobrar</span>
            </button>
          </div>
        </div>
      )}

      {/* Hidden printable area for shift closure thermal receipt */}
      {lastClosedSession && (
        <div id="print-closure-area" className="hidden font-mono text-[11px] leading-tight text-black bg-white p-2">
          {(() => {
            const sessionTx = transactions.filter(t => 
              t.branchId === lastClosedSession.branchId && 
              new Date(t.date) >= new Date(lastClosedSession.openedAt) && 
              (lastClosedSession.closedAt ? new Date(t.date) <= new Date(lastClosedSession.closedAt) : true)
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
                const commValue = prod.commissionType === 'percentage' 
                  ? (prod.price * (prod.commissionValue || 0) / 100)
                  : (prod.commissionValue || 0);
                return s + (commValue * item.quantity);
              }, 0);
            }, 0);

            const employee = users.find(u => u.id === lastClosedSession.userId || u.name === lastClosedSession.workerName) || users.find(u => u.name?.toLowerCase() === lastClosedSession.workerName?.toLowerCase()) || users.find(u => u.role === 'employee') || currentUser;
            const baseSalary = employee?.baseSalary || 0;
            const totalSalary = baseSalary + commissions;

            return (
              <div className="space-y-1">
                <div className="text-center font-black text-sm uppercase">{receiptConfig?.businessName || 'MARÉ POS'}</div>
                {receiptConfig?.showAddress && receiptConfig?.businessAddress && (
                  <div className="text-center text-[9px]">{receiptConfig.businessAddress}</div>
                )}
                {receiptConfig?.showPhone && receiptConfig?.businessPhone && (
                  <div className="text-center text-[9px]">{receiptConfig.businessPhone}</div>
                )}
                <div className="border-t border-dashed border-black my-2"></div>
                <div className="text-center font-black uppercase text-xs">CIERRE DE CAJA / LIQUIDACIÓN</div>
                <div className="flex justify-between text-[10px]">
                  <span>TURNO:</span>
                  <span className="font-bold">{lastClosedSession.id}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>FECHA:</span>
                  <span>{new Date(lastClosedSession.closingDate || lastClosedSession.closedAt || new Date()).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>VENDEDOR:</span>
                  <span className="font-bold uppercase">{lastClosedSession.workerName || 'VENDEDOR'}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>SUCURSAL:</span>
                  <span>{branches.find(b => b.id === lastClosedSession.branchId)?.name || 'Central'}</span>
                </div>
                
                <div className="border-t border-dashed border-black my-2"></div>
                <div className="font-bold text-[10px] uppercase">PRODUCTOS VENDIDOS ({soldList.reduce((s, i) => s + i.qty, 0)}):</div>
                {soldList.length === 0 ? (
                  <div className="text-[10px] italic">Sin ventas registradas en el turno</div>
                ) : (
                  soldList.map((p, i) => (
                    <div key={i} className="flex justify-between text-[10px]">
                      <span className="truncate max-w-[170px]">{p.qty}x {p.name}</span>
                      <span className="font-bold">{formatMoney(p.total, baseCurrency.symbol)}</span>
                    </div>
                  ))
                )}
                <div className="border-t border-dashed border-black my-2"></div>
                <div className="flex justify-between font-black text-xs">
                  <span>VENTA TOTAL:</span>
                  <span>{formatMoney(totalSales, baseCurrency.symbol)}</span>
                </div>

                <div className="border-t border-dashed border-black my-2"></div>
                <div className="font-bold text-[10px] uppercase">ARQUEO DE FONDOS:</div>
                <div className="flex justify-between text-[10px]">
                  <span>Fondo Inicial:</span>
                  <span>{formatMoney(lastClosedSession.openingBalance, baseCurrency.symbol)}</span>
                </div>

                <div className="border-t border-dashed border-black my-2"></div>
                <div className="font-bold text-[10px] uppercase">LIQUIDACIÓN DE SALARIO:</div>
                <div className="flex justify-between text-[10px]">
                  <span>Salario Base:</span>
                  <span>{formatMoney(baseSalary, baseCurrency.symbol)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>Comisiones Productos:</span>
                  <span>+{formatMoney(commissions, baseCurrency.symbol)}</span>
                </div>
                <div className="flex justify-between font-black text-xs pt-1 border-t border-dotted border-black">
                  <span>SALARIO A PAGAR:</span>
                  <span>{formatMoney(totalSalary, baseCurrency.symbol)}</span>
                </div>

                <div className="border-t border-dashed border-black my-4"></div>
                <div className="pt-6 text-center text-[9px] border-t border-black">
                  Firma del Vendedor
                </div>
                <div className="pt-6 text-center text-[9px] border-t border-black">
                  Firma Supervisor / Administrador
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Persistent Mobile Ticket & Checkout Bottom Bar */}
      {!showMobileCart && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => setShowMobileCart(true)}
            className="flex items-center gap-2.5 text-left active:scale-95 transition-transform min-w-0 flex-1"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs shrink-0 relative shadow-sm">
              <ShoppingCart className="w-4 h-4" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-indigo-600 text-white rounded-full text-[8px] font-black flex items-center justify-center shadow-sm">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider truncate">
                {cart.length === 0 ? 'Ticket Vacío' : `${cart.reduce((s, i) => s + i.quantity, 0)} artículos en cola`}
              </div>
              <div className="text-sm font-black text-slate-900 leading-tight truncate">
                {formatMoney(totalBase, baseCurrency.symbol)}
              </div>
            </div>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowMobileCart(true)}
              className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all border border-slate-200"
            >
              <Receipt className="w-3.5 h-3.5 text-indigo-600" />
              <span>Ver Ticket</span>
            </button>
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => {
                if (cart.length > 0) {
                  setPaymentLines([{ id: crypto.randomUUID(), code: baseCurrency.code, amount: totalBase, method: 'cash' }]);
                  setShowCheckoutModal(true);
                }
              }}
              className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-200 disabled:opacity-40 disabled:grayscale"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Cobrar</span>
            </button>
          </div>
        </div>
      )}
      {showPrinterSetupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Impresora Térmica 58mm</h3>
                  <p className="text-[10px] font-bold text-slate-400">Conexión directa Bluetooth, USB y RawBT</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPrinterSetupModal(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Current Status */}
              <div className={cn(
                "p-3 rounded-2xl border flex items-center justify-between",
                connectedPrinterName ? "bg-emerald-50/70 border-emerald-200 text-emerald-900" : "bg-slate-50 border-slate-200 text-slate-700"
              )}>
                <div className="flex items-center gap-2.5">
                  <div className={cn("w-2.5 h-2.5 rounded-full", connectedPrinterName ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Estado actual</div>
                    <div className="text-xs font-black truncate max-w-[170px]">{connectedPrinterName || "Sin conexión activa"}</div>
                  </div>
                </div>
                {connectedPrinterName && (
                  <button 
                    onClick={async () => {
                      const { disconnectPrinter, disconnectBluetoothPrinter } = await import('../lib/escpos');
                      await disconnectPrinter();
                      await disconnectBluetoothPrinter();
                      setConnectedPrinterName(null);
                      setPosSuccess("Impresora desconectada");
                      setTimeout(() => setPosSuccess(""), 2000);
                    }}
                    className="px-2.5 py-1 bg-white border border-rose-200 text-rose-600 rounded-lg text-[10px] font-black uppercase hover:bg-rose-50 transition-all"
                  >
                    Desconectar
                  </button>
                )}
              </div>

              {printerStatusMsg && (
                <p className="text-[10px] font-bold text-indigo-600 text-center animate-pulse">{printerStatusMsg}</p>
              )}

              {/* Connection Actions */}
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isConnectingPrinter}
                  onClick={handlePairBluetooth}
                  className="w-full p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-between transition-all shadow-md shadow-indigo-100 active:scale-95 disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5">
                    <Bluetooth className="w-4 h-4 text-indigo-200" />
                    <span>1. Vincular por Bluetooth</span>
                  </div>
                  <span className="text-[9px] bg-indigo-500/50 px-2 py-0.5 rounded-md text-indigo-100">BLE / Inalámbrico</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const { printThermalReceipt } = await import('../lib/escpos');
                    await printThermalReceipt({
                      lines: [
                        "CENTER|BOLD|MARÉ POS",
                        "CENTER|PRUEBA RAWBT ANDROID",
                        "---",
                        "Conexión exitosa con RawBT",
                        "Impresión térmica 58mm OK",
                        "---"
                      ],
                      width: '58mm',
                      preferRawBT: true
                    });
                    setShowPrinterSetupModal(false);
                  }}
                  className="w-full p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-between transition-all shadow-md shadow-emerald-100 active:scale-95"
                >
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="w-4 h-4 text-emerald-200" />
                    <span>2. Imprimir con App RawBT</span>
                  </div>
                  <span className="text-[9px] bg-emerald-500/50 px-2 py-0.5 rounded-md text-emerald-100">Android</span>
                </button>

                <button
                  type="button"
                  disabled={isConnectingPrinter}
                  onClick={handleConnectUsb}
                  className="w-full p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-between transition-all active:scale-95 disabled:opacity-50 border border-slate-200"
                >
                  <div className="flex items-center gap-2.5">
                    <Usb className="w-4 h-4 text-slate-500" />
                    <span>3. Conectar por Cable USB</span>
                  </div>
                  <span className="text-[9px] bg-slate-200 px-2 py-0.5 rounded-md text-slate-600">Cable OTG</span>
                </button>
              </div>

              {/* Test Ticket */}
              <div className="pt-2 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const { printThermalReceipt } = await import('../lib/escpos');
                    const printed = await printThermalReceipt({
                      lines: [
                        "CENTER|BOLD|MARÉ POS",
                        "CENTER|TICKET DE PRUEBA 58MM",
                        "---",
                        `Fecha: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                        "Estado: Correcto",
                        "---",
                        "CENTER|Impresión Térmica OK"
                      ],
                      openDrawer: true,
                      width: '58mm',
                      onSuccess: (method) => {
                        setPosSuccess(`Prueba enviada (${method})`);
                        setTimeout(() => setPosSuccess(""), 2500);
                      }
                    });
                    if (!printed) {
                      setPosError("No hay impresora conectada");
                      setTimeout(() => setPosError(""), 3000);
                    }
                  }}
                  className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir Prueba
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrinterSetupModal(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all active:scale-95"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
}
