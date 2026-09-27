import React, { useState, useMemo } from "react";
import { Calculator, Lock, Unlock, TrendingUp, DollarSign, Clock, AlertCircle, List } from "lucide-react";
import { useStore } from "../store/useStore";
import { Payment } from "../types";
import { InfoTooltip } from "../components/InfoTooltip";
import { cn } from "../lib/utils";

export default function CashRegister() {
  const { branches, currentBranchId, setCurrentBranch, getCurrentSession, openSession, closeSession, getBaseCurrency, currencies, currentUser, transactions, users, salarySettlements, updateSalarySettlement } = useStore();
  const session = getCurrentSession(currentBranchId, currentUser?.id || 'u1');
  const baseCurrency = getBaseCurrency();
  const currentBranch = branches.find(b => b.id === currentBranchId);

  const pendingSettlement = useMemo(() => 
    salarySettlements.find(s => s.status === 'pending'), 
  [salarySettlements]);

  const [openingAmount, setOpeningAmount] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(currentUser ? [currentUser.id] : []);
  
  const branchStaff = useMemo(() => {
    return users.filter(u => u.branchId === currentBranchId || u.role === 'admin');
  }, [users, currentBranchId]);

  const [closingBalances, setClosingBalances] = useState<{ [key: string]: number }>({});
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);
  const [finalBalancesToClose, setFinalBalancesToClose] = useState<Payment[]>([]);

  // Movement Form State
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [movementData, setMovementData] = useState({ type: 'expense' as 'income' | 'expense', amount: '', currencyCode: 'CUP', description: '' });

  const formatMoney = (amount: number, symbol: string) => {
    const formatted = amount.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${symbol} ${formatted}`;
  };

  const handleOpen = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(openingAmount);
    if (!isNaN(val)) {
      openSession({
        id: crypto.randomUUID(),
        branchId: currentBranchId,
        openedAt: new Date().toISOString(),
        openingBalance: val,
        status: 'open',
        userId: currentUser?.id || 'u1',
        workingEmployeeIds: selectedEmployeeIds.length > 0 ? selectedEmployeeIds : [currentUser?.id || 'u1']
      });
      setOpeningAmount("");
    }
  };

  // Calculate expected balances
  const expectedBalances = useMemo(() => {
    if (!session) return [];
    
    // Start with opening balance as cash in base currency
    const expected: Payment[] = [
      { currencyCode: baseCurrency.code, amount: session.openingBalance, exchangeRate: 1, method: 'cash' }
    ];

    const sessionTx = transactions.filter(
      t => t.branchId === currentBranchId && t.userId === session.userId && new Date(t.date) >= new Date(session.openedAt)
    );

    sessionTx.forEach(tx => {
      tx.payments.forEach(p => {
        const exItem = expected.find(e => e.currencyCode === p.currencyCode && e.method === p.method);
        if (exItem) {
          exItem.amount += p.amount;
        } else {
          expected.push({ currencyCode: p.currencyCode, amount: p.amount, exchangeRate: p.exchangeRate, method: p.method });
        }
      });
    });

    // Add movements
    if (session.movements) {
      session.movements.forEach(m => {
        const exItem = expected.find(e => e.currencyCode === m.currencyCode && e.method === 'cash');
        const multiplier = m.type === 'income' ? 1 : -1;
        if (exItem) {
          exItem.amount += (m.amount * multiplier);
        } else {
          const currency = currencies.find(c => c.code === m.currencyCode);
          expected.push({ 
            currencyCode: m.currencyCode as any, 
            amount: m.amount * multiplier, 
            exchangeRate: currency?.rateToBase || 1, 
            method: 'cash' 
          });
        }
      });
    }

    return expected;
  }, [session, transactions, currentBranchId, baseCurrency, currencies]);

  const sessionProducts = useMemo(() => {
    if (!session) return [];
    
    const sessionTx = transactions.filter(
      t => t.branchId === currentBranchId && t.userId === session.userId && new Date(t.date) >= new Date(session.openedAt)
    );

    const productMap: { [key: string]: { name: string, quantity: number, total: number, currency: string } } = {};

    sessionTx.forEach(tx => {
      tx.items.forEach(item => {
        const key = `${item.product.id}-${tx.payments[0]?.currencyCode || baseCurrency.code}`;
        const itemTotal = item.product.price * item.quantity;
        if (productMap[key]) {
          productMap[key].quantity += item.quantity;
          productMap[key].total += itemTotal;
        } else {
          productMap[key] = {
            name: item.product.name,
            quantity: item.quantity,
            total: itemTotal,
            currency: tx.payments[0]?.currencyCode || baseCurrency.code
          };
        }
      });
    });

    return Object.values(productMap).sort((a, b) => b.quantity - a.quantity);
  }, [session, transactions, currentBranchId, baseCurrency]);

  const handleClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (session) {
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

      // Check discrepancies
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
        alert("Caja cerrada exitosamente.");
      }
    }
  };

  const processClose = (balances: Payment[]) => {
    if (!session) return;
    
    // Todas las transacciones de la sucursal durante el turno
    const sessionTxs = transactions.filter(t => {
      const isAfterOpen = new Date(t.date) >= new Date(session.openedAt);
      if (!isAfterOpen) return false;
      return t.branchId === currentBranchId;
    });

    const employeeCommissions: Record<string, number> = {};

    sessionTxs.forEach(tx => {
      const sellers = tx.sellerEmployeeIds && tx.sellerEmployeeIds.length > 0 ? tx.sellerEmployeeIds : [tx.userId];
      const splitFactor = sellers.length;

      tx.items.forEach(item => {
        let itemComm = 0;
        if (item.product.commissionType === 'fixed') {
          itemComm = (item.product.commissionValue || 0) * item.quantity;
        } else {
          itemComm = (item.product.price * ((item.product.commissionValue || 0) / 100)) * item.quantity;
        }
        
        const splitComm = itemComm / splitFactor;
        
        sellers.forEach(sellerId => {
          if (!employeeCommissions[sellerId]) employeeCommissions[sellerId] = 0;
          employeeCommissions[sellerId] += splitComm;
        });
      });
    });

    // Determinar quién recibe pago (los que trabajaron en el turno o ganaron comisión)
    const employeesToSettle = new Set<string>();
    if (session.workingEmployeeIds) {
      session.workingEmployeeIds.forEach(id => employeesToSettle.add(id));
    }
    Object.keys(employeeCommissions).forEach(id => employeesToSettle.add(id));
    
    if (employeesToSettle.size === 0) employeesToSettle.add(session.userId);

    employeesToSettle.forEach(empId => {
      const emp = users.find(u => u.id === empId);
      // Skip if not found, or if it's an admin
      if (!emp || emp.role === 'admin') return;

      const baseSalary = emp.baseSalary || 0;
      const comm = employeeCommissions[empId] || 0;
      
      useStore.getState().addSalarySettlement({
        id: crypto.randomUUID(),
        userId: empId,
        userName: emp.name || 'Usuario',
        sessionId: session.id,
        baseSalary,
        commissions: comm,
        total: baseSalary + comm,
        date: new Date().toISOString(),
        status: 'pending'
      });
    });

    closeSession(session.id, balances);
    setClosingBalances({});
  };

  const handleAddMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const amt = parseFloat(movementData.amount);
    if (isNaN(amt) || amt <= 0) return;

    useStore.getState().addCashMovement(session.id, {
      id: crypto.randomUUID(),
      type: movementData.type,
      amount: amt,
      currencyCode: movementData.currencyCode,
      description: movementData.description,
      date: new Date().toISOString()
    });

    setMovementData({ type: 'expense', amount: '', currencyCode: 'CUP', description: '' });
    setShowMovementForm(false);
  };

  const confirmClose = () => {
    if (session) {
      processClose(finalBalancesToClose);
      setShowDiscrepancyModal(false);
      setFinalBalancesToClose([]);
      alert("Caja cerrada con discrepancia.");
    }
  };

  const getMethodName = (method: string) => {
    if (method === 'cash') return 'Efectivo';
    if (method === 'transfer') return 'Transferencia';
    return method;
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-3xl mx-auto pb-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
            <Calculator className="w-5 h-5 text-indigo-600" />
            Gestión de Caja
          </h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Turnos y Arqueo</p>
        </div>
      </header>

      {!session ? (
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 p-4 sm:p-5 text-center w-full max-w-[min(94vw,420px)] mx-auto mt-4 sm:mt-6 animate-in zoom-in-95">
          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <Lock className="w-6 h-6 text-slate-300" />
          </div>
          <h3 className="text-sm font-black text-slate-900 mb-1 uppercase tracking-widest">Caja Cerrada</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Abre el turno para operar</p>

          <div className="my-6 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Sucursal Activa</p>
            {currentUser?.role === 'admin' ? (
              <select
                value={currentBranchId}
                onChange={(e) => setCurrentBranch(e.target.value)}
                className="w-full bg-white border border-indigo-200 text-indigo-900 rounded-xl px-3 py-2 text-sm font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500 mt-1 mb-2"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-black text-indigo-900 uppercase break-words whitespace-normal leading-tight">{currentBranch?.name}</p>
            )}
            <p className="text-[10px] font-bold text-indigo-500 uppercase mt-1">Usuario: {currentUser?.name || 'Vendedor'}</p>
          </div>
          
          <form onSubmit={handleOpen} className="space-y-3">
            <div className="text-left bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Fondo Inicial ({baseCurrency.code})</label>
              <div className="relative mb-4">
                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-base font-black text-slate-300">$</span>
                <input 
                  type="number" 
                  required
                  min="0"
                  step="0.01"
                  autoFocus
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  className="w-full pl-6 pr-4 py-0.5 text-2xl bg-transparent border-none focus:ring-0 outline-none font-black text-slate-900 placeholder:text-slate-200"
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2 mt-4 pt-4 border-t border-slate-200">
                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  Empleados en este turno
                </label>
                <div className="flex flex-col gap-2 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                  {branchStaff.map(staff => (
                    <label key={staff.id} className="flex items-start gap-2 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300 transition-colors min-w-0">
                      <input 
                        type="checkbox" 
                        className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-100 border-slate-300 w-4 h-4"
                        checked={selectedEmployeeIds.includes(staff.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmployeeIds([...selectedEmployeeIds, staff.id]);
                          } else {
                            setSelectedEmployeeIds(selectedEmployeeIds.filter(id => id !== staff.id));
                          }
                        }}
                      />
                      <span className="text-[10px] font-black text-slate-700 uppercase whitespace-normal break-words leading-tight flex-1 min-w-0">{staff.name}</span>
                      <span className="ml-auto shrink-0 text-[8px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded-md">
                        {staff.role}
                      </span>
                    </label>
                  ))}
                  {branchStaff.length === 0 && (
                    <p className="text-[10px] text-slate-400 font-bold text-center py-2">No hay empleados asignados a esta sucursal.</p>
                  )}
                </div>
              </div>
            </div>
            <button 
              type="submit"
              className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 active:scale-95"
            >
              <Unlock className="w-4 h-4" />
              ABRIR TURNO
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active Session Status - Compact Header */}
          <div className="bg-slate-900 rounded-[1.5rem] p-4 text-white shadow-xl flex flex-wrap items-center justify-between gap-4 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/20">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest leading-none">HOLA {currentUser?.name || 'USER'}</h3>
                <p className="text-emerald-400 text-[8px] font-black uppercase tracking-widest mt-1">TURNO ABIERTO • {new Date(session.openedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-[8px] font-black uppercase tracking-[0.2em] mb-0.5">Fondo Inicial</p>
              <p className="text-lg font-black tracking-tight">{formatMoney(session.openingBalance, baseCurrency.symbol)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              {/* Arqueo - Linear Design */}
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Arqueo de Caja</h3>
                  <button 
                    type="button"
                    onClick={() => {
                      const autoBalances: {[key: string]: number} = {};
                      expectedBalances.forEach(eb => {
                        autoBalances[`${eb.currencyCode}-${eb.method}`] = eb.amount;
                      });
                      setClosingBalances(autoBalances);
                    }}
                    className="text-[8px] font-black uppercase text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded-lg transition-colors border border-indigo-100"
                  >
                    Auto-completar
                  </button>
                </div>

                <form onSubmit={handleClose} className="p-5 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currencies.map(c => (
                      <div key={`cash-${c.code}`} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 focus-within:border-indigo-200 transition-colors">
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Efectivo {c.code}</label>
                        <div className="relative">
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xs font-black text-slate-300">{c.symbol}</span>
                          <input 
                            type="number" 
                            min="0"
                            step="0.01"
                            value={closingBalances[`${c.code}-cash`] || ''}
                            onChange={(e) => setClosingBalances({ ...closingBalances, [`${c.code}-cash`]: parseFloat(e.target.value) || 0 })}
                            className="w-full pl-6 py-0.5 bg-transparent border-none focus:ring-0 outline-none font-black text-slate-900 text-sm placeholder:text-slate-200"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    ))}
                    
                    <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 focus-within:border-blue-300 transition-colors">
                      <label className="block text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Transferencia CUP</label>
                      <div className="relative">
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xs font-black text-blue-200">CUP</span>
                        <input 
                          type="number" 
                          min="0"
                          step="0.01"
                          value={closingBalances[`CUP-transfer`] || ''}
                          onChange={(e) => setClosingBalances({ ...closingBalances, [`CUP-transfer`]: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-8 py-0.5 bg-transparent border-none focus:ring-0 outline-none font-black text-blue-900 text-sm placeholder:text-blue-100"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    type="submit"
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95"
                  >
                    CERRAR TURNO Y FINALIZAR
                  </button>
                </form>
              </div>

              {/* Movimientos de Caja */}
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Movimientos de Caja</h3>
                  <button 
                    onClick={() => setShowMovementForm(!showMovementForm)}
                    className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    {showMovementForm ? <Lock className="w-3.5 h-3.5 rotate-45" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="p-5">
                  {showMovementForm && (
                    <form onSubmit={handleAddMovement} className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 animate-in slide-in-from-top-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipo</label>
                          <select 
                            value={movementData.type}
                            onChange={e => setMovementData({...movementData, type: e.target.value as any})}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none"
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
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none"
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
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Descripción</label>
                          <input 
                            type="text" 
                            required
                            value={movementData.description}
                            onChange={e => setMovementData({...movementData, description: e.target.value})}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black outline-none"
                            placeholder="Ej: Pago de almuerzo"
                          />
                        </div>
                      </div>
                      <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">
                        Registrar Movimiento
                      </button>
                    </form>
                  )}

                  <div className="space-y-2">
                    {session.movements && session.movements.length > 0 ? (
                      session.movements.map(m => (
                        <div key={m.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
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
                            {m.type === 'income' ? '+' : '-'}{formatMoney(m.amount, currencies.find(c => c.code === m.currencyCode)?.symbol || '')}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest">No hay movimientos registrados</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Expected Balances Sidebar */}
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Saldos Esperados</h3>
                  <Clock className="w-4 h-4 text-slate-300" />
                </div>
                <div className="p-4 space-y-3">
                  {expectedBalances.map((eb, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{getMethodName(eb.method)}</p>
                        <p className="text-[10px] font-black text-slate-900">{eb.currencyCode}</p>
                      </div>
                      <p className="text-xs font-black text-indigo-600">{formatMoney(eb.amount, eb.currencyCode)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Products Sold Sidebar */}
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Productos Vendidos</h3>
                  <List className="w-4 h-4 text-slate-300" />
                </div>
                <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {sessionProducts.length > 0 ? (
                    sessionProducts.map((sp, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter truncate max-w-[120px]">{sp.name}</p>
                          <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-lg uppercase">{sp.currency}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{sp.quantity} unidad(es)</p>
                          <p className="text-[10px] font-black text-slate-700">
                            {formatMoney(sp.total, currencies.find(c => c.code === sp.currency)?.symbol || '')}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest">No hay ventas registradas</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historial de Turnos Recientes */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Historial de Turnos (Últimos 10)</h3>
          <Clock className="w-4 h-4 text-slate-300" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="px-5 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Turno</th>
                <th className="px-5 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Apertura / Cierre</th>
                <th className="px-5 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Fondo Inic.</th>
                <th className="px-5 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Efectivo Final</th>
                <th className="px-5 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {useStore.getState().cashSessions
                .filter(s => s.branchId === currentBranchId)
                .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())
                .slice(0, 10)
                .map(s => {
                  const finalCash = s.closingBalances?.find(b => b.currencyCode === baseCurrency.code && b.method === 'cash')?.amount || 0;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-black uppercase tracking-wider">
                          {s.turnNumber ? `Turno-${s.turnNumber}` : s.id}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">
                          {new Date(s.openedAt).toLocaleDateString()}
                        </p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                          {new Date(s.openedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - 
                          {s.closedAt ? new Date(s.closedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '...'}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <p className="text-[10px] font-black text-slate-600">{formatMoney(s.openingBalance, baseCurrency.symbol)}</p>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <p className={cn(
                          "text-[10px] font-black",
                          s.status === 'open' ? "text-slate-300" : "text-emerald-600"
                        )}>
                          {s.status === 'open' ? 'EN CURSO' : formatMoney(finalCash, baseCurrency.symbol)}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn(
                          "text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest",
                          s.status === 'open' ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                        )}>
                          {s.status === 'open' ? 'Abierto' : 'Cerrado'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {showDiscrepancyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 border border-white/20 flex flex-col max-h-[90vh]">
            <div className="p-6 bg-rose-50 border-b border-rose-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-200 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-rose-900 uppercase tracking-widest">Discrepancia Detectada</h3>
                <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight">Los montos ingresados no coinciden con lo esperado</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* Discrepancy Table */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Resumen de Arqueo</h4>
                <div className="space-y-2">
                  {expectedBalances.map((eb, idx) => {
                    const actual = finalBalancesToClose.find(fb => fb.currencyCode === eb.currencyCode && fb.method === eb.method)?.amount || 0;
                    const diff = actual - eb.amount;
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                          <p className="text-[9px] font-black text-slate-900 uppercase tracking-tighter">{getMethodName(eb.method)} {eb.currencyCode}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Esperado: {formatMoney(eb.amount, eb.currencyCode)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-900">{formatMoney(actual, eb.currencyCode)}</p>
                          <p className={cn("text-[9px] font-black uppercase tracking-tighter", diff >= 0 ? (diff < 0.01 ? "text-slate-400" : "text-emerald-600") : "text-rose-600")}>
                            {diff > 0 ? "+" : ""}{formatMoney(diff, eb.currencyCode)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Transactions Audit */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Auditoría de Ventas (Turno)</h4>
                <div className="space-y-2">
                  {transactions
                    .filter(t => t.branchId === currentBranchId && t.userId === session.userId && new Date(t.date) >= new Date(session.openedAt))
                    .map(tx => (
                      <div key={tx.id} className="p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-200 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-[9px] font-black text-slate-900 uppercase tracking-tighter">{tx.id.slice(0, 10)}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">{new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          <p className="text-xs font-black text-slate-900">{formatMoney(tx.total, baseCurrency.symbol)}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {tx.items.map((item, idx) => (
                            <span key={idx} className="text-[7px] font-black bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-widest border border-slate-100">
                              {item.quantity}x {item.product?.name || (typeof (item.product as any) === 'string' ? useStore.getState().products.find(p => p.id === (item.product as any))?.name || item.product : 'Desconocido')}
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                          {tx.payments.map((p, idx) => (
                            <span key={idx} className="text-[7px] font-black text-indigo-600 uppercase tracking-[0.1em]">
                              • {getMethodName(p.method)} {p.currencyCode}: {formatMoney(p.amount, p.currencyCode)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => setShowDiscrepancyModal(false)}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95"
              >
                Corregir Montos
              </button>
              <button 
                onClick={confirmClose}
                className="flex-1 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-100 active:scale-95"
              >
                Confirmar Cierre
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Centered Salary Settlement Modal */}
      {pendingSettlement && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-white/20 w-full max-w-sm overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
            <div className="p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 mx-auto">
                <DollarSign className="w-8 h-8" />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pago de Salario Pendiente</h3>
                <p className="text-xl font-black text-slate-900 uppercase tracking-tight">{pendingSettlement.userName}</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-500">
                  <span>Sueldo Base</span>
                  <span className="text-slate-900">{formatMoney(pendingSettlement.baseSalary, baseCurrency.symbol)}</span>
                </div>
                <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-500">
                  <span>Comisiones</span>
                  <span className="text-slate-900">{formatMoney(pendingSettlement.commissions, baseCurrency.symbol)}</span>
                </div>
                <div className="h-px bg-slate-200" />
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Total a Pagar</span>
                  <span className="text-lg font-black text-indigo-600">{formatMoney(pendingSettlement.total, baseCurrency.symbol)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                  onClick={() => {
                    updateSalarySettlement(pendingSettlement.id, { status: 'paid' });
                  }}
                  className="py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
                >
                  PAGAR SALARIO
                </button>
                <button 
                  onClick={() => {
                    updateSalarySettlement(pendingSettlement.id, { status: 'waiting' });
                  }}
                  className="py-4 bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 transition-all shadow-xl shadow-amber-100 active:scale-95"
                >
                  ESPERAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
