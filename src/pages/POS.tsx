import React, { useState, useEffect, useRef } from "react";
import { Search, Plus, Minus, CreditCard, Receipt, Trash2, ShoppingCart, ShieldCheck, DollarSign, QrCode, ArrowLeftRight, UserPlus, X, Lock, Camera, MessageSquare, Mail } from "lucide-react";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import { cn, generateId } from "../lib/utils";
import { useStore } from "../store/useStore";
import { Product, Payment, Transaction } from "../types";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";

export default function POS() {
  const { categories, products, cart, addToCart, updateCartQty, clearCart, processTransaction, branches, currentBranchId, setCurrentBranch, currencies, getBaseCurrency, currentCustomerId, setCartCustomer, currentUser, pendingOrders, removePendingOrder, getCurrentSession, inventory, addCustomer, bankCards, addBankTransaction } = useStore();
  const [activeCategoryId, setActiveCategoryId] = useState<string>("Todos");
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', taxId: '' });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [configData, setConfigData] = useState<{ serialNumber?: string, selectedSize?: string, selectedColor?: string }>({});
  
  const currentSession = getCurrentSession(currentBranchId, currentUser?.id || 'u1');
  
  // Checkout Modal State
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  
  type PaymentLine = { id: string, code: string, amount: number, method: 'cash' | 'transfer', bankCardId?: string };
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);
  const [showReceiptModal, setShowReceiptModal] = useState<Transaction | null>(null);

  const [activePaymentLineId, setActivePaymentLineId] = useState<string | null>(null);

  const [qrCodeInput, setQrCodeInput] = useState("");
  const [posError, setPosError] = useState("");
  const [posSuccess, setPosSuccess] = useState("");

  const baseCurrency = getBaseCurrency();

  const handleScanQR = () => {
    if (!qrCodeInput) return;
    setPosError("");
    setPosSuccess("");
    const order = pendingOrders.find(o => o.id === qrCodeInput && o.status === 'pending');
    if (order) {
      clearCart();
      order.items.forEach(item => {
        for(let i=0; i<item.quantity; i++){
          addToCart(item.product, item.serialNumber);
        }
      });
      removePendingOrder(order.id);
      setQrCodeInput("");
      setPosSuccess("Orden cargada exitosamente en el carrito.");
      setTimeout(() => setPosSuccess(""), 3000);
    } else {
      setPosError("Código QR inválido o la orden ya fue procesada.");
      setTimeout(() => setPosError(""), 3000);
    }
  };

  // Barcode scanner moved lower

  const filteredProducts = products.filter(p => {
    // Filtrar por categoría
    const matchesCategory = activeCategoryId === "Todos" || p.categoryId === activeCategoryId;
    if (!matchesCategory) return false;

    // Filtrar por existencia en la sucursal actual
    const branchStockTotal = inventory
      .filter(i => i.productId === p.id && i.branchId === currentBranchId)
      .reduce((sum, curr) => sum + curr.quantity, 0);
    return branchStockTotal > 0;
  });

  const subtotalBase = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const taxBase = 0; // Configurable tax if needed
  const totalBase = subtotalBase + taxBase;

  // Calcula cuánto se ha pagado en moneda base
  const totalPaidBase = paymentLines.reduce((sum, line) => {
    const currency = currencies.find(c => c.code === line.code);
    if (!currency || !line.amount) return sum;
    return sum + (line.amount * currency.rateToBase);
  }, 0);

  const remainingBase = Math.max(0, totalBase - totalPaidBase);
  const isPaid = remainingBase === 0 && totalBase > 0;

  const generateSerial = () => {
    const randomSN = `SN-${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
    setConfigData({ ...configData, serialNumber: randomSN });
  };

  const getProductStock = (productId: string, variantLabel?: string) => {
    if (variantLabel) {
      const variantStock = inventory.find(i => i.productId === productId && i.branchId === currentBranchId && i.variantLabel === variantLabel);
      return variantStock ? variantStock.quantity : 0;
    }
    // Si no hay variante, sumamos todo el stock del producto en la sucursal
    return inventory
      .filter(i => i.productId === productId && i.branchId === currentBranchId)
      .reduce((sum, i) => sum + i.quantity, 0);
  };

  const getCartQuantity = (productId: string, variantLabel?: string) => {
    return cart
      .filter(item => item.product.id === productId && item.variantLabel === variantLabel)
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
    setPaymentLines(prev => [...prev, { id: newId, code: baseCurrency.code, amount: 0, method: 'cash' }]);
    setActivePaymentLineId(newId);
  };

  const updatePaymentLine = (id: string, field: keyof PaymentLine, value: any) => {
    setPaymentLines(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
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
    
    // Si hay remainingBase (CUP), lo dividimos por la tasa de la moneda
    const amountNeededInCurrency = remainingBase / currency.rateToBase;
    updatePaymentLine(id, 'amount', line.amount + amountNeededInCurrency);
  };

  const openCheckout = () => {
    // No pre-llenamos el monto, dejamos que el usuario lo haga manual
    setPaymentLines([]);
    setActivePaymentLineId(null);
    setShowCheckoutModal(true);
  };

  const handleThermalPrint = async (tx: Transaction) => {
    try {
      const { printReceiptOverSerial } = await import('../lib/escpos');
      const receiptConfig = useStore.getState().receiptConfig;
      
      const lines: string[] = [];
      const divider = receiptConfig.printerWidth === '58mm' ? "---" : "===";
      
      if (receiptConfig.showLogo) {
        lines.push(`CENTER|BOLD|${receiptConfig.businessName}`);
      } else {
        lines.push(`CENTER|BOLD|${useStore.getState().storeConfig.storeName}`);
      }
      
      if (receiptConfig.showAddress) lines.push(`CENTER|${receiptConfig.businessAddress}`);
      if (receiptConfig.showPhone) lines.push(`CENTER|${receiptConfig.businessPhone}`);
      
      lines.push("");
      lines.push(`Recibo: ${tx.id}`);
      lines.push(`Fecha: ${new Date(tx.date).toLocaleString()}`);
      if (receiptConfig.showNCF && tx.customerId) {
        const customer = useStore.getState().customers.find(c => c.id === tx.customerId);
        if (customer && customer.taxId) {
          lines.push(`CI/Pasaporte: ${customer.taxId}`);
        }
      }
      lines.push("");
      
      lines.push(divider);
      
      tx.items.forEach(item => {
         const name = receiptConfig.printerWidth === '58mm' ? item.product.name.substring(0, 15) : item.product.name.substring(0, 20);
         lines.push(`${item.quantity}x ${name}`);
         lines.push(`  ${formatMoney(item.product.price * item.quantity, baseCurrency.symbol)}`);
      });
      
      lines.push(divider);
      lines.push(`BOLD|TOTAL: ${formatMoney(tx.total, baseCurrency.symbol)}`);
      lines.push("");
      
      if (receiptConfig.showFooter) {
         lines.push(`CENTER|${receiptConfig.footerText}`);
      }
      
      await printReceiptOverSerial(lines, receiptConfig.openDrawer ?? true);
      setPosSuccess("Impresión enviada correctamente");
      setTimeout(() => setPosSuccess(""), 2000);
    } catch (err: any) {
      console.error(err);
      setPosError(err.message || "Error al conectar con la impresora térmica.");
      setTimeout(() => setPosError(""), 3000);
    }
  };

  const handleWhatsAppReceipt = (tx: Transaction) => {
    const customer = useStore.getState().customers.find(c => c.id === tx.customerId);
    if (!customer?.phone) {
      alert("El cliente no tiene un número de teléfono registrado.");
      return;
    }
    const storeName = useStore.getState().storeConfig.storeName;
    const text = `Hola ${customer.name}, gracias por tu compra en ${storeName}. Tu recibo es ${tx.id} por un total de ${formatMoney(tx.total, baseCurrency.symbol)}.`;
    const url = `https://wa.me/${customer.phone.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`;
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
    const finalizedPayments: import('../types').Payment[] = paymentLines
      .filter(p => p.amount > 0)
      .map(p => {
        const currency = currencies.find(c => c.code === p.code)!;
        return {
          currencyCode: p.code as any,
          amount: p.amount,
          exchangeRate: currency.rateToBase,
          method: p.method,
          bankCardId: p.bankCardId
        };
      });

    const tx: import('../types').Transaction = {
      id: generateId('TKT'),
      branchId: currentBranchId,
      userId: currentUser?.id || 'u1',
      date: new Date().toISOString(),
      subtotal: subtotalBase,
      tax: taxBase,
      total: totalBase,
      items: cart,
      payments: finalizedPayments,
      status: 'completed',
      customerId: currentCustomerId
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
        addBankTransaction({
          id: generateId('BTX'),
          cardId: p.bankCardId,
          type: 'payment_received',
          amount: p.amount * p.exchangeRate, // Convert to base currency or use the actual currency if needed? Wait, the bank account has a currency. Let's just use base currency for now if it's mixed. Wait, bank cards have their own currency. Let's convert to Bank Card Currency.
          date: tx.date,
          reference: tx.id,
          description: `Cobro de Ticket ${tx.id}`,
          transactionId: tx.id
        });
      }
    });

    setShowCheckoutModal(false);
    setShowReceiptModal(tx);

    // Auto-print WebSerial si está configurado
    if (useStore.getState().receiptConfig.useWebSerial) {
      handleThermalPrint(tx).catch(console.error);
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
        <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm z-40 flex items-center justify-center rounded-2xl">
          <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Caja Cerrada</h3>
            <p className="text-slate-500 mb-6">Debes abrir el turno en el módulo de caja antes de poder realizar ventas.</p>
          </div>
        </div>
      )}

      {/* Checkout Modal - Compact & Linear Redesign */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[95vh] border border-white/20">
            
            {/* Header: Total Summary (Compact) */}
            <div className="bg-slate-900 text-white p-6 relative">
              <button 
                onClick={() => { setShowCheckoutModal(false); setPaymentLines([]); setActivePaymentLineId(null); }}
                className="absolute right-4 top-4 p-1.5 hover:bg-white/10 rounded-full transition-colors"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
              
              <div className="text-center">
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Total a Cobrar</p>
                <h3 className="text-4xl font-black tracking-tight">{formatMoney(totalBase, baseCurrency.symbol)}</h3>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {currencies.filter(c => !c.isBase).map(c => (
                    <span key={c.code} className="text-[9px] font-black bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-slate-300">
                      {c.code}: {formatMoney(totalBase / c.rateToBase, c.symbol)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {/* Status Bar (Compact) */}
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Pagado</p>
                  <p className="text-base font-black text-slate-900">{formatMoney(totalPaidBase, baseCurrency.symbol)}</p>
                </div>
                <div className={cn(
                  "flex-1 p-3 rounded-2xl border transition-colors",
                  remainingBase > 0 ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100"
                )}>
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                    {remainingBase > 0 ? "Faltante" : "Vuelto"}
                  </p>
                  <p className={cn(
                    "text-base font-black",
                    remainingBase > 0 ? "text-rose-600" : "text-emerald-600"
                  )}>
                    {formatMoney(Math.abs(remainingBase), baseCurrency.symbol)}
                  </p>
                </div>
              </div>

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
                        onClick={() => updatePaymentLine(activePaymentLineId, 'method', 'transfer')}
                        className={cn(
                          "py-2 rounded-lg text-[9px] font-black uppercase transition-all",
                          paymentLines.find(l => l.id === activePaymentLineId)?.method === 'transfer' ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:bg-slate-50 disabled:opacity-20"
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
                              const newMethod = line.method;
                              updatePaymentLine(line.id, 'code', c.code);
                              updatePaymentLine(line.id, 'method', newMethod);
                            }
                          }}
                          className={cn(
                            "flex-1 py-2 px-3 rounded-lg text-[9px] font-black transition-all",
                            paymentLines.find(l => l.id === activePaymentLineId)?.code === c.code ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:bg-slate-50"
                          )}
                        >{c.code}</button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-end mb-1 px-1">
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Monto a recibir</label>
                      {remainingBase > 0 && (
                        <button 
                          onClick={() => autoFillRemaining(activePaymentLineId)}
                          className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg hover:bg-indigo-100 transition-all uppercase tracking-tighter"
                        >
                          Sugerido: {formatMoney(remainingBase / (currencies.find(c => c.code === paymentLines.find(l => l.id === activePaymentLineId)?.code)?.rateToBase || 1), currencies.find(c => c.code === paymentLines.find(l => l.id === activePaymentLineId)?.code)?.symbol || '')}
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

                  {paymentLines.find(l => l.id === activePaymentLineId)?.method === 'transfer' && (
                    <div className="mt-3">
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">Cuenta de Destino</label>
                      <select
                        value={paymentLines.find(l => l.id === activePaymentLineId)?.bankCardId || ''}
                        onChange={(e) => updatePaymentLine(activePaymentLineId, 'bankCardId', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-[10px] font-black uppercase text-slate-700"
                      >
                        <option value="">Seleccionar Cuenta...</option>
                        {bankCards.filter(c => c.currency === paymentLines.find(l => l.id === activePaymentLineId)?.code).map(card => (
                          <option key={card.id} value={card.id}>{card.name} - Saldo: ${card.balance}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100">
              <button 
                disabled={remainingBase > 0 || paymentLines.some(l => l.method === 'transfer' && !l.bankCardId)}
                onClick={handleCheckout}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-base uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-30 disabled:grayscale disabled:shadow-none active:scale-95"
              >
                CONFIRMAR COBRO
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Camera Scanner Modal */}
      {showCameraScanner && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="flex justify-between items-center p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Camera className="w-5 h-5" /> Escanear Código
              </h3>
              <button 
                onClick={() => setShowCameraScanner(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-4">
              <div id="qr-reader" className="w-full rounded-xl overflow-hidden"></div>
              <p className="text-center text-xs text-slate-500 mt-4">Apunta la cámara al código de barras o QR del producto u orden.</p>
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
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        
        {/* Top Bar: Search & Categories (Compact) */}
        <div className="p-3 border-b border-slate-100 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Producto o barras..." 
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-200 outline-none transition-all text-xs font-medium"
              />
            </div>
            
            <div className="flex gap-2">
              <select 
                value={currentBranchId}
                onChange={(e) => setCurrentBranch(e.target.value)}
                className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 outline-none text-[10px] font-black uppercase tracking-widest text-slate-600 focus:ring-1 focus:ring-indigo-200"
              >
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <div className="relative w-40">
                <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                <input 
                  type="text" 
                  value={qrCodeInput}
                  onChange={(e) => setQrCodeInput(e.target.value)}
                  placeholder="QR..." 
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-200 outline-none uppercase text-xs font-black"
                />
              </div>
              <button 
                onClick={handleScanQR}
                className="px-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
              >
                OK
              </button>
              <button
                onClick={() => setShowCameraScanner(true)}
                className="px-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors"
                title="Escanear con cámara"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setActiveCategoryId("Todos")}
              className={cn(
                "px-3 py-1 rounded-lg whitespace-nowrap text-[10px] font-black uppercase tracking-widest transition-all",
                activeCategoryId === "Todos" 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              )}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={cn(
                  "px-3 py-1 rounded-lg whitespace-nowrap text-[10px] font-black uppercase tracking-widest transition-all",
                  activeCategoryId === cat.id 
                    ? "bg-indigo-600 text-white shadow-sm" 
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid (Compact) */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => handleProductClick(product)}
                className="flex flex-col items-center p-2 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all active:scale-95 bg-white relative overflow-hidden group shadow-sm"
              >
                {/* Warranty Pill Top-Right */}
                {product.warrantyDays && (
                  <div className="absolute top-1.5 right-1.5 bg-emerald-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full shadow-sm z-20 uppercase tracking-tighter">
                    {product.warrantyDays} días
                  </div>
                )}

                {/* Image Area */}
                <div className="w-full aspect-square bg-slate-50 rounded-xl mb-2 flex items-center justify-center overflow-hidden relative">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
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
                      <span className="text-[7px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                        Stock: {inventory.filter(i => i.productId === product.id && i.branchId === currentBranchId).reduce((s, c) => s + c.quantity, 0)}
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
      <div className="w-full lg:w-72 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col shrink-0 overflow-hidden">
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

          <button 
            disabled={cart.length === 0}
            onClick={openCheckout}
            className="w-full bg-indigo-600 text-white font-black text-[11px] uppercase tracking-widest py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-100 disabled:opacity-30 disabled:grayscale disabled:shadow-none"
          >
            Pagar Ticket
          </button>
        </div>
      </div>

      {showReceiptModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 print:w-full print:max-w-none print:shadow-none print:bg-white print:fixed print:inset-0">
            <div className="p-6 text-sm text-center print:p-2" id="print-area">
              {useStore.getState().receiptConfig.showLogo && (
                <>
                  <h2 className="text-xl font-bold uppercase">{useStore.getState().receiptConfig.businessName}</h2>
                  {useStore.getState().receiptConfig.showAddress && (
                    <p className="text-slate-500 text-xs mt-1">{useStore.getState().receiptConfig.businessAddress}</p>
                  )}
                  {useStore.getState().receiptConfig.showPhone && (
                    <p className="text-slate-500 text-xs">{useStore.getState().receiptConfig.businessPhone}</p>
                  )}
                </>
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
              
              {useStore.getState().receiptConfig.showNCF && showReceiptModal.customerId && (
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 mb-4 text-left">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-tight">
                    <span className="text-slate-400">CI o Pasaporte:</span>
                    <span className="text-slate-900">{useStore.getState().customers.find(c => c.id === showReceiptModal.customerId)?.taxId || 'N/A'}</span>
                  </div>
                </div>
              )}

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

              <div className="border-t border-dashed border-slate-300 my-4"></div>
              {useStore.getState().receiptConfig.showFooter && (
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight leading-relaxed">
                  {useStore.getState().receiptConfig.footerText}
                </p>
              )}
            </div>
            
            <div className="p-4 bg-slate-50 flex gap-2 print:hidden overflow-x-auto custom-scrollbar">
              <button 
                onClick={() => setShowReceiptModal(null)}
                className="flex-1 py-2 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                Cerrar
              </button>
              {showReceiptModal.customerId && (
                <>
                  <button 
                    onClick={() => handleWhatsAppReceipt(showReceiptModal)}
                    className="flex-1 py-2 px-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                    title="Enviar por WhatsApp"
                  >
                    <MessageSquare className="w-4 h-4" />
                    WA
                  </button>
                  <button 
                    onClick={() => handleEmailReceipt(showReceiptModal)}
                    className="flex-1 py-2 px-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                    title="Enviar por Correo"
                  >
                    <Mail className="w-4 h-4" />
                    Email
                  </button>
                </>
              )}
              <button 
                onClick={() => handleThermalPrint(showReceiptModal)}
                className="flex-1 py-2 px-3 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-900 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                title="Impresión Térmica USB (Abre Gaveta)"
              >
                <Receipt className="w-4 h-4" />
                USB
              </button>
              <button 
                onClick={() => window.print()}
                className="flex-1 py-2 px-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                title="Impresión del Sistema"
              >
                <Receipt className="w-4 h-4" />
                Sys
              </button>
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

    </div>
  );
}
