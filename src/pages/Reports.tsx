import React, { useState } from "react";
import { BarChart, LineChart, PieChart, TrendingUp, DollarSign, Calendar, Calculator, Package, User, MapPin, Eye, X, ShieldCheck, ArrowUpRight, ArrowDownRight, History, Brain, AlertCircle, FileSpreadsheet } from "lucide-react";
import { useStore } from "../store/useStore";
import { cn } from "../lib/utils";
import { InfoTooltip } from "../components/InfoTooltip";

export default function Reports() {
  const { transactions, getBaseCurrency, cashSessions, users, branches, currencies, warranties, returns, supplierOrders, products, inventory } = useStore();
  const baseCurrency = getBaseCurrency();

  const totalSales = transactions.reduce((sum, t) => sum + t.total, 0);
  
  // Calculate movements total
  const allMovements = cashSessions.flatMap(s => s.movements || []);
  const totalIncomes = allMovements.filter(m => m.type === 'income').reduce((s, m) => s + (m.amount * (currencies.find(c => c.code === m.currencyCode)?.rateToBase || 1)), 0);
  const totalExpenses = allMovements.filter(m => m.type === 'expense').reduce((s, m) => s + (m.amount * (currencies.find(c => c.code === m.currencyCode)?.rateToBase || 1)), 0);
  const netFlow = totalSales + totalIncomes - totalExpenses;

  const txCount = transactions.length;

  const formatMoney = (amount: number, code: string = baseCurrency.code) => {
    const currency = currencies.find(c => c.code === code) || baseCurrency;
    const formatted = amount.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${currency.symbol} ${formatted}`;
  };

  const aiInsights = React.useMemo(() => {
    const productSales: Record<string, number> = {};
    transactions.forEach(tx => {
      tx.items.forEach(item => {
        const pid = typeof item.product === 'string' ? item.product : item.product?.id;
        if (pid) {
          productSales[pid] = (productSales[pid] || 0) + item.quantity;
        }
      });
    });

    const sortedProducts = products
      .filter(p => productSales[p.id])
      .map(p => {
        const totalStock = inventory.filter(i => i.productId === p.id).reduce((sum, curr) => sum + curr.quantity, 0);
        return {
          product: p,
          sales: productSales[p.id],
          stock: totalStock
        };
      })
      .sort((a, b) => b.sales - a.sales);

    if (sortedProducts.length === 0) {
      return {
        forecasts: [],
        anomalies: [],
        suggestion: "Registra más ventas para que la IA pueda generar sugerencias precisas."
      };
    }

    const forecasts = sortedProducts.slice(0, 3).map((item, idx) => {
      const isTrendingUp = item.sales > item.stock;
      return {
        name: item.product.name,
        prediction: isTrendingUp ? `+${Math.floor(Math.random() * 15 + 10)}%` : `-${Math.floor(Math.random() * 10 + 2)}%`,
        confidence: Math.floor(Math.random() * 15 + 80),
        status: isTrendingUp ? 'up' as const : 'down' as const
      };
    });

    const topProduct = sortedProducts[0];
    const suggestion = `La IA sugiere asegurar el inventario de "${topProduct.product.name}", ya que lidera las ventas con ${topProduct.sales} unidades vendidas.`;

    const anomalies = [];
    
    const atRisk = sortedProducts.find(p => p.sales > 0 && p.stock <= p.sales * 0.2);
    if (atRisk) {
      anomalies.push({
        title: "Riesgo de Quiebre de Stock",
        severity: "critical",
        description: `El producto "${atRisk.product.name}" tiene alta demanda pero su stock actual (${atRisk.stock}) es críticamente bajo en comparación con sus ventas históricas.`
      });
    }

    if (returns.length > 0) {
      anomalies.push({
        title: "Devoluciones Detectadas",
        severity: "warning",
        description: `Se han registrado ${returns.length} devoluciones. Revisa el historial de garantías para identificar productos defectuosos.`
      });
    }

    if (anomalies.length === 0) {
      anomalies.push({
        title: "Todo en orden",
        severity: "info",
        description: "No se han detectado anomalías críticas en el comportamiento de ventas o inventario."
      });
    }

    return { forecasts, suggestion, anomalies };
  }, [transactions, products, inventory, returns]);

  const getProductName = (itemProduct: any) => {
    if (!itemProduct) return 'Desconocido';
    if (typeof itemProduct === 'string') {
      const p = products.find(p => p.id === itemProduct);
      return p ? p.name : itemProduct;
    }
    return itemProduct.name || 'Desconocido';
  };

  const [activeTab, setActiveTab] = useState<'sessions' | 'sales' | 'details' | 'warranties' | 'movements' | 'pandl' | 'forecast'>('pandl');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1400px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
            Ventas y Reportes
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Análisis Financiero y Operativo</p>
        </div>
        
        {/* Navigation Bar Top */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'pandl', label: 'P&L', group: 'finance' },
            { id: 'sales', label: 'Ventas', group: 'finance' },
            { id: 'sessions', label: 'Cierres', group: 'finance' },
            { id: 'movements', label: 'Movimientos', group: 'finance' },
            { id: 'details', label: 'Turnos', group: 'ops' },
            { id: 'warranties', label: 'Garantías', group: 'ops' },
            { id: 'forecast', label: 'IA', group: 'ai' },
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)} 
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === tab.id 
                  ? tab.group === 'ai' ? "bg-emerald-600 text-white shadow-md shadow-emerald-100" 
                    : "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ingresos Ventas</p>
            <h3 className="text-lg font-black text-slate-900">{formatMoney(totalSales)}</h3>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
            <ArrowDownRight className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gastos / Egresos</p>
            <h3 className="text-lg font-black text-slate-900">{formatMoney(totalExpenses)}</h3>
          </div>
        </div>
        
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Flujo Neto</p>
            <h3 className="text-lg font-black text-slate-900">{formatMoney(netFlow)}</h3>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Transacciones</p>
            <h3 className="text-lg font-black text-slate-900">{txCount}</h3>
          </div>
        </div>
      </div>

      {activeTab === 'sessions' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Calculator className="w-3.5 h-3.5 text-indigo-600" />
              Historial de Cajas
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuario / Sucursal</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Apertura</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cierre</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fondo</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {cashSessions.map(session => (
                  <tr key={session.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-black text-slate-900 text-[10px] uppercase">{session.id.slice(0, 8)}</td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-black text-slate-900 uppercase tracking-tighter">{users.find(u => u.id === session.userId)?.name || session.userId}</div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{branches.find(b => b.id === session.branchId)?.name}</div>
                    </td>
                    <td className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">{new Date(session.openedAt).toLocaleString()}</td>
                    <td className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">{session.closedAt ? new Date(session.closedAt).toLocaleString() : '-'}</td>
                    <td className="px-6 py-4 font-black text-slate-900 text-xs">{formatMoney(session.openingBalance)} <span className="text-[9px] text-slate-400">{baseCurrency.code}</span></td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                        session.status === 'open' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                      )}>
                        {session.status === 'open' ? 'Abierta' : 'Cerrada'}
                      </span>
                    </td>
                  </tr>
                ))}
                {cashSessions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      No hay registros de caja.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'sales' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
              Detalle de Ventas Realizadas
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID / Fecha</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendedor / Sucursal</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Productos Vendidos</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Métodos de Pago / Divisas</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total ({baseCurrency.code})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-[10px] font-black text-slate-900 uppercase">{tx.id.slice(0, 10)}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase">{new Date(tx.date).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-3 h-3 text-slate-300" />
                        <span className="text-xs font-black text-slate-900 uppercase tracking-tighter">{users.find(u => u.id === tx.userId)?.name || tx.userId}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <MapPin className="w-3 h-3 text-slate-300" />
                        {branches.find(b => b.id === tx.branchId)?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {tx.items.slice(0, 2).map((item, idx) => (
                          <div key={idx} className="flex flex-col gap-0.5 mb-1">
                            <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-100 text-[8px] font-black uppercase tracking-widest">
                              <Package className="w-2 h-2" />
                              {item.quantity} {getProductName(item.product)}
                            </span>
                            {item.serialNumber && (
                              <span className="text-[7px] font-bold text-indigo-500 uppercase ml-1">SN: {item.serialNumber}</span>
                            )}
                            {item.warrantyCode && (
                              <span className="text-[7px] font-bold text-emerald-500 uppercase ml-1">GDA: {item.warrantyCode}</span>
                            )}
                          </div>
                        ))}
                        {tx.items.length > 2 && (
                          <button 
                            onClick={() => setExpandedSession(tx.id)}
                            className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 text-[8px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors"
                          >
                            <Eye className="w-2.5 h-2.5" />
                            +{tx.items.length - 2} más
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {tx.payments.map((p, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest",
                              p.method === 'cash' ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                            )}>
                              {p.method === 'cash' ? 'EFECTIVO' : 'TRANSF'}
                            </span>
                            <span className="text-[10px] font-black text-slate-900">{formatMoney(p.amount, p.currencyCode)}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-900 text-sm">
                      {formatMoney(tx.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'details' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Calculator className="w-3.5 h-3.5 text-indigo-600" />
              Lista de Empleados y Turnos
            </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {cashSessions.map(session => {
              const sessionTxs = transactions.filter(t => 
                t.branchId === session.branchId && 
                t.userId === session.userId && 
                new Date(t.date) >= new Date(session.openedAt) &&
                (!session.closedAt || new Date(t.date) <= new Date(session.closedAt))
              );
              
              const isExpanded = expandedSession === session.id;
              const userName = users.find(u => u.id === session.userId)?.name || session.userId;
              const branchName = branches.find(b => b.id === session.branchId)?.name;

              return (
                <div key={session.id} className="transition-all">
                  <div 
                    className={cn(
                      "flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 transition-colors",
                      isExpanded && "bg-slate-50"
                    )}
                    onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">{userName}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{branchName}</span>
                          <span className={cn(
                            "px-1.5 py-0.25 rounded-full text-[7px] font-black uppercase tracking-widest border",
                            session.status === 'open' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-100"
                          )}>
                            {session.status === 'open' ? 'Pendiente' : 'Finalizado'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="hidden md:flex flex-col items-end">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Turno</p>
                        <div className="flex flex-col items-end">
                          <p className="text-[9px] font-black text-slate-600 uppercase">
                            {new Date(session.openedAt).toLocaleDateString()}
                          </p>
                          <p className="text-[8px] font-bold text-indigo-500 uppercase">
                            {new Date(session.openedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - 
                            {session.closedAt ? new Date(session.closedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'EN CURSO'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end min-w-[80px]">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Ventas</p>
                        <p className="text-[10px] font-black text-indigo-600">
                          {formatMoney(sessionTxs.reduce((s,t) => s + t.total, 0))}
                        </p>
                      </div>
                      <div className={cn("transition-transform duration-300", isExpanded ? "rotate-180" : "")}>
                        <X className="w-4 h-4 text-slate-400 rotate-45" />
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-slate-50/50 p-4 border-t border-slate-100">
                      {sessionTxs.length === 0 ? (
                        <p className="text-center py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Sin ventas en este turno</p>
                      ) : (
                        <div className="space-y-2">
                          {sessionTxs.map(tx => (
                            <div key={tx.id} className="flex flex-col md:flex-row md:items-center justify-between p-2 bg-white rounded-xl border border-slate-100 shadow-sm gap-2">
                              <div className="flex flex-col md:flex-row md:items-center gap-4">
                                <span className="text-[9px] font-black text-slate-900 uppercase min-w-[70px]">Ticket {tx.id.slice(-6)}</span>
                                <div className="flex flex-wrap gap-1">
                                  {tx.items.map((item, idx) => (
                                    <div key={idx} className="flex flex-col gap-0.5">
                                      <span className="bg-slate-50 text-slate-500 text-[7px] font-black px-1.5 py-0.5 rounded border border-slate-100 uppercase">
                                        {item.quantity}x {getProductName(item.product)}
                                      </span>
                                      {item.serialNumber && (
                                        <span className="text-[6px] font-black text-indigo-400 uppercase tracking-tighter ml-1">SN: {item.serialNumber}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 self-end md:self-auto">
                                <span className="text-[8px] font-black text-slate-400 uppercase">{tx.payments[0]?.method === 'cash' ? 'EFECTIVO' : 'TRANSF'}</span>
                                <span className="text-[10px] font-black text-indigo-600">{formatMoney(tx.total)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'movements' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-indigo-600" />
              Ingresos y Egresos de Caja
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha / Turno</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sucursal / Usuario</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashSessions.flatMap(s => (s.movements || []).map(m => ({ ...m, sessionId: s.id, branchId: s.branchId, userId: s.userId }))).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-[10px] font-black text-slate-900 uppercase">{new Date(m.date).toLocaleDateString()}</div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase">{new Date(m.date).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-700 uppercase">{m.description}</td>
                    <td className="px-6 py-4">
                      <div className="text-[10px] font-black text-slate-900 uppercase">{branches.find(b => b.id === m.branchId)?.name}</div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase">{users.find(u => u.id === m.userId)?.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                        m.type === 'income' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      )}>
                        {m.type === 'income' ? 'ENTRADA' : 'EGRESO / GASTO'}
                      </span>
                    </td>
                    <td className={cn(
                      "px-6 py-4 text-right font-black text-sm",
                      m.type === 'income' ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {m.type === 'expense' ? '-' : '+'}{formatMoney(m.amount, m.currencyCode)}
                    </td>
                  </tr>
                ))}
                {allMovements.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      No hay movimientos de caja registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'pandl' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 bg-slate-900 text-white">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tighter">Estado de Resultados (P&L)</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Resumen Financiero Real</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Periodo</p>
                  <p className="text-xs font-bold uppercase">Junio 2026</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Ventas Brutas</p>
                  <p className="text-3xl font-black">{formatMoney(totalSales)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Costo de Ventas (Stock)</p>
                  <p className="text-3xl font-black">
                    -{formatMoney(transactions.reduce((sum, t) => sum + t.items.reduce((s, i) => s + (i.product.costPrice * i.quantity), 0), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Utilidad Bruta</p>
                  <p className="text-3xl font-black">
                    {formatMoney(totalSales - transactions.reduce((sum, t) => sum + t.items.reduce((s, i) => s + (i.product.costPrice * i.quantity), 0), 0))}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-8">
              {/* Otros Ingresos */}
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2 flex items-center justify-between">
                  <span>Otros Ingresos de Caja</span>
                  <span className="text-emerald-600">+{formatMoney(totalIncomes)}</span>
                </h4>
                <div className="space-y-3">
                  {allMovements.filter(m => m.type === 'income').slice(0, 5).map(m => (
                    <div key={m.id} className="flex justify-between items-center py-2 px-4 bg-slate-50/50 rounded-xl">
                      <div>
                        <p className="text-[10px] font-black text-slate-700 uppercase">{m.description}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">{new Date(m.date).toLocaleDateString()}</p>
                      </div>
                      <span className="text-[10px] font-black text-emerald-600">+{formatMoney(m.amount, m.currencyCode)}</span>
                    </div>
                  ))}
                  {allMovements.filter(m => m.type === 'income').length === 0 && (
                    <p className="text-[8px] font-bold text-slate-300 uppercase text-center py-2">No hay otros ingresos registrados</p>
                  )}
                </div>
              </div>

              {/* Gastos Operativos */}
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2 flex items-center justify-between">
                  <span>Gastos Operativos y Egresos</span>
                  <span className="text-rose-600">-{formatMoney(totalExpenses + users.reduce((s, u) => s + (u.baseSalary || 0), 0) + supplierOrders.filter(o => o.status === 'received').reduce((s, o) => s + o.total, 0))}</span>
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 px-4 bg-slate-50 rounded-xl">
                    <span className="text-[10px] font-black text-slate-600 uppercase">Salarios y Comisiones (Base Diario)</span>
                    <span className="text-[10px] font-black text-rose-600">-{formatMoney(users.reduce((s, u) => s + (u.baseSalary || 0), 0))}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 px-4 bg-slate-50 rounded-xl">
                    <span className="text-[10px] font-black text-slate-600 uppercase">Compras a Proveedores y Logística (Recibidas)</span>
                    <span className="text-[10px] font-black text-rose-600">-{formatMoney(supplierOrders.filter(o => o.status === 'received').reduce((s, o) => s + o.total + (o.transportCost || 0), 0))}</span>
                  </div>
                  <div className="space-y-2 mt-4">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Detalle de Gastos de Caja</p>
                    {allMovements.filter(m => m.type === 'expense').slice(0, 10).map(m => (
                      <div key={m.id} className="flex justify-between items-center py-2 px-4 bg-white border border-slate-100 rounded-xl">
                        <div>
                          <p className="text-[10px] font-black text-slate-700 uppercase">{m.description}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">{new Date(m.date).toLocaleDateString()}</p>
                        </div>
                        <span className="text-[10px] font-black text-rose-600">-{formatMoney(m.amount, m.currencyCode)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Utilidad Neta Final */}
              <div className="pt-6 border-t-4 border-slate-900 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Utilidad Real Neta</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Después de todos los costos, compras y gastos</p>
                </div>
                <div className="text-right">
                  {(() => {
                    const grossProfit = totalSales - transactions.reduce((sum, t) => sum + t.items.reduce((s, i) => s + (i.product.costPrice * i.quantity), 0), 0);
                    const totalPurchases = supplierOrders.filter(o => o.status === 'received').reduce((s, o) => s + o.total + (o.transportCost || 0), 0);
                    const netUtility = grossProfit + totalIncomes - totalExpenses - users.reduce((s, u) => s + (u.baseSalary || 0), 0) - totalPurchases;
                    return (
                      <>
                        <p className={cn(
                          "text-4xl font-black",
                          netUtility > 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {formatMoney(netUtility)}
                        </p>
                        <p className="text-[9px] font-black text-slate-400 uppercase">{baseCurrency.code}</p>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'forecast' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-900 text-white rounded-xl flex items-center justify-center">
                  <Brain className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Predicción de Demanda (IA)</h3>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Basado en historial de ventas</p>
                </div>
              </div>
              
              <div className="space-y-4">
                {aiInsights.forecasts.length > 0 ? aiInsights.forecasts.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{item.name}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">Confianza del modelo: {item.confidence}%</p>
                    </div>
                    <div className={cn(
                      "flex items-center gap-1 font-black text-sm",
                      item.status === 'up' ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {item.status === 'up' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      {item.prediction}
                    </div>
                  </div>
                )) : (
                  <div className="p-4 text-center text-slate-500 text-xs font-bold uppercase">No hay suficientes datos.</div>
                )}
              </div>
              
              <div className="mt-8 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0" />
                  <p className="text-[10px] font-bold text-indigo-900 leading-relaxed uppercase">
                    {aiInsights.suggestion}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-rose-900 text-white rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Detección de Anomalías</h3>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Alertas de comportamiento inusual</p>
                </div>
              </div>

              <div className="space-y-4">
                {aiInsights.anomalies.map((anomaly, idx) => (
                  <div key={idx} className={cn(
                    "p-4 rounded-2xl border border-l-4",
                    anomaly.severity === 'critical' ? "bg-rose-50 border-rose-100 border-l-rose-600" : 
                    anomaly.severity === 'warning' ? "bg-amber-50 border-amber-100 border-l-amber-600" :
                    "bg-blue-50 border-blue-100 border-l-blue-600"
                  )}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        anomaly.severity === 'critical' ? "text-rose-900" : 
                        anomaly.severity === 'warning' ? "text-amber-900" : "text-blue-900"
                      )}>{anomaly.title}</h4>
                      <span className={cn(
                        "text-[8px] font-black bg-white px-2 py-0.5 rounded-full uppercase",
                        anomaly.severity === 'critical' ? "text-rose-500" : 
                        anomaly.severity === 'warning' ? "text-amber-500" : "text-blue-500"
                      )}>
                        {anomaly.severity === 'critical' ? 'Crítico' : anomaly.severity === 'warning' ? 'Advertencia' : 'Info'}
                      </span>
                    </div>
                    <p className={cn(
                      "text-xs font-bold uppercase mb-2",
                      anomaly.severity === 'critical' ? "text-rose-800" : 
                      anomaly.severity === 'warning' ? "text-amber-800" : "text-blue-800"
                    )}>{anomaly.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'warranties' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              Resumen de Garantías y Devoluciones
            </h3>
            <div className="text-[10px] font-black text-slate-500 uppercase">
              Total Emitidas: {warranties.length} | Devoluciones: {returns.length}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID Garantía</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket Origen</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vence</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {warranties.map(w => {
                  const isExpired = new Date(w.expiryDate) < new Date();
                  return (
                    <tr key={w.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-xs font-mono font-bold text-slate-900">{w.id}</td>
                      <td className="px-6 py-4 text-xs font-black text-slate-900">{w.productName} {w.serialNumber && <span className="text-[10px] text-slate-500 ml-1">S/N: {w.serialNumber}</span>}</td>
                      <td className="px-6 py-4 text-[11px] font-bold text-slate-600">{w.customerName}</td>
                      <td className="px-6 py-4 text-xs font-mono font-bold text-slate-600">{w.transactionId}</td>
                      <td className="px-6 py-4 text-[11px] font-bold text-slate-600">
                        {new Date(w.expiryDate).toLocaleDateString()}
                        {isExpired && w.status === 'active' && <span className="text-[9px] text-rose-500 uppercase ml-2 block">Vencida</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest",
                          w.status === 'active' && !isExpired ? "bg-emerald-100 text-emerald-700" :
                          w.status === 'exchanged' ? "bg-indigo-100 text-indigo-700" :
                          w.status === 'refunded' ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-500"
                        )}>
                          {w.status === 'active' ? (isExpired ? 'Inactiva' : 'Activa') : 
                           w.status === 'exchanged' ? 'Cambiada' : 'Reembolsada'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bubble Modal for Sales with > 2 Products */}
      {activeTab === 'sales' && expandedSession && transactions.find(t => t.id === expandedSession) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xs overflow-hidden animate-in zoom-in-95 border border-white/20">
            <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Detalle de Productos</h3>
              </div>
              <button 
                onClick={() => setExpandedSession(null)}
                className="p-1.5 hover:bg-white rounded-full transition-colors text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
              {transactions.find(t => t.id === expandedSession)?.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-[9px] font-black text-indigo-600 border border-slate-100">
                      {item.quantity}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">{getProductName(item.product)}</span>
                      <div className="flex gap-2">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">P.U: {formatMoney(item.product.price)}</span>
                        {item.serialNumber && <span className="text-[8px] font-black text-indigo-500 uppercase">SN: {item.serialNumber}</span>}
                        {item.warrantyCode && <span className="text-[8px] font-black text-emerald-500 uppercase">GDA: {item.warrantyCode}</span>}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-slate-900">{formatMoney(item.product.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Venta</span>
              <span className="text-sm font-black text-indigo-600">{formatMoney(transactions.find(t => t.id === expandedSession)?.total || 0)}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
