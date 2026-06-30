import React, { useMemo } from "react";
import { TrendingUp, Users, DollarSign, Package, ShoppingBag, ArrowUpRight, ArrowDownRight, Clock, MapPin, AlertCircle } from "lucide-react";
import { useStore } from "../store/useStore";
import { cn } from "../lib/utils";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function Dashboard() {
  const { branches, currentBranchId, setCurrentBranch, transactions, getBaseCurrency, currencies, inventory, products, customers } = useStore();
  const baseCurrency = getBaseCurrency();

  const formatMoney = (amount: number, symbol: string = baseCurrency.symbol) => {
    const formatted = amount.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${symbol} ${formatted}`;
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayTransactions = useMemo(() => 
    transactions.filter(t => t.date.startsWith(todayStr) && t.branchId === currentBranchId),
    [transactions, todayStr, currentBranchId]
  );

  const totalSalesToday = todayTransactions.reduce((sum, t) => sum + t.total, 0);
  const lowStockCount = inventory.filter(i => i.branchId === currentBranchId && i.quantity <= i.minQuantity).length;

  // Chart Data: Sales last 7 days
  const last7DaysData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      const dayTotal = transactions
        .filter(t => t.date.startsWith(dayStr) && t.branchId === currentBranchId)
        .reduce((sum, t) => sum + t.total, 0);
      data.push({
        name: d.toLocaleDateString('es-DO', { weekday: 'short' }),
        total: dayTotal
      });
    }
    return data;
  }, [transactions, currentBranchId]);

  // Sales by Currency Today
  const salesByCurrency = useMemo(() => {
    const totals: { [key: string]: number } = {};
    todayTransactions.forEach(tx => {
      tx.payments.forEach(p => {
        totals[p.currencyCode] = (totals[p.currencyCode] || 0) + p.amount;
      });
    });
    return Object.entries(totals).map(([code, amount]) => ({
      code,
      amount,
      symbol: currencies.find(c => c.code === code)?.symbol || ''
    }));
  }, [todayTransactions, currencies]);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard</h2>
          <div className="flex items-center gap-2 text-slate-400 mt-0.5">
            <MapPin className="w-3 h-3" />
            <p className="text-[9px] font-black uppercase tracking-widest">{branches.find(b => b.id === currentBranchId)?.name}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <select 
            value={currentBranchId}
            onChange={(e) => setCurrentBranch(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 px-3 py-1.5 focus:ring-1 focus:ring-indigo-100 outline-none cursor-pointer uppercase tracking-widest"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Metrics Grid (Compact) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard 
          title="Ventas Hoy" 
          value={formatMoney(totalSalesToday)} 
          icon={TrendingUp} 
          trend="Hoy" 
          positive={true}
          color="bg-indigo-600"
        />
        <MetricCard 
          title="Tickets" 
          value={todayTransactions.length.toString()} 
          icon={ShoppingBag} 
          trend="Hoy" 
          positive={true}
          color="bg-emerald-600"
        />
        <MetricCard 
          title="Stock Bajo" 
          value={lowStockCount.toString()} 
          icon={Package} 
          trend={lowStockCount > 0 ? "Revisar" : "OK"} 
          positive={lowStockCount === 0}
          color="bg-rose-600"
        />
        <MetricCard 
          title="Clientes" 
          value={customers.length.toString()} 
          icon={Users} 
          trend="Total" 
          positive={true}
          color="bg-blue-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales Chart (Compact) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Evolución Semanal</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">{todayStr}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-indigo-600">{formatMoney(last7DaysData.reduce((sum, d) => sum + d.total, 0))}</p>
            </div>
          </div>
          
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last7DaysData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 8, fontWeight: 900}} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: '900'}}
                  formatter={(value: number) => [`${formatMoney(value)}`, 'Ventas']}
                />
                <Area type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Currency Breakdown (Compact) */}
        <div className="bg-slate-900 p-5 rounded-3xl text-white flex flex-col">
          <h3 className="text-xs font-black uppercase tracking-widest mb-4">Por Moneda</h3>
          
          <div className="space-y-2 flex-1">
            {salesByCurrency.length > 0 ? salesByCurrency.map(sale => (
              <div key={sale.code} className="bg-white/5 p-3 rounded-2xl border border-white/5 flex items-center justify-between group hover:bg-white/10 transition-all">
                <div>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{sale.code}</p>
                  <p className="text-lg font-black">{formatMoney(sale.amount, sale.symbol)}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center font-black text-[9px] text-slate-400">
                  {sale.code}
                </div>
              </div>
            )) : (
              <div className="flex-1 flex flex-col items-center justify-center opacity-10 py-8">
                <DollarSign className="w-8 h-8" />
              </div>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="flex justify-between items-center">
              <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Total Hoy</p>
              <p className="text-base font-black text-indigo-400">{formatMoney(totalSalesToday)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Branch Performance (Enterprise Feature) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm col-span-1 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Desempeño por Sucursal</h3>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Últimos 7 días</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {branches.map(branch => {
              const branchTx = transactions.filter(t => t.branchId === branch.id);
              const branchTotal = branchTx.reduce((sum, t) => sum + t.total, 0);
              const branchSalesCount = branchTx.length;
              
              return (
                <div key={branch.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                      <MapPin className="w-3 h-3" />
                    </div>
                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{branch.name}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-end">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ventas Totales</p>
                      <p className="text-sm font-black text-indigo-600">{formatMoney(branchTotal)}</p>
                    </div>
                    <div className="flex justify-between items-end">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Transacciones</p>
                      <p className="text-[10px] font-black text-slate-900">{branchSalesCount}</p>
                    </div>
                  </div>
                  <div className="mt-4 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${(branchTotal / (transactions.reduce((s,t) => s+t.total, 0) || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Sales (Compact) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Últimas Ventas</h3>
            <button className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Ver Todo</button>
          </div>
          <div className="space-y-2">
            {todayTransactions.slice(0, 4).map(tx => (
              <div key={tx.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl transition-all">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-slate-300" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">#{tx.id.slice(-6)}</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase">{new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-900">{formatMoney(tx.total)}</p>
                  <p className="text-[7px] font-black text-emerald-500 uppercase tracking-widest">OK</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock (Compact) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest text-rose-600">Stock Crítico</h3>
          </div>
          <div className="space-y-2">
            {inventory
              .filter(i => i.branchId === currentBranchId && i.quantity <= i.minQuantity)
              .slice(0, 4)
              .map(item => {
                const product = products.find(p => p.id === item.productId);
                return (
                  <div key={`${item.branchId}-${item.productId}`} className="flex items-center gap-3 p-2 bg-rose-50/30 rounded-xl border border-rose-50/50">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter line-clamp-1">{product?.name}</p>
                      <p className="text-[8px] font-black text-rose-600 uppercase tracking-widest">Actual: {item.quantity}</p>
                    </div>
                    <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-rose-500" 
                        style={{width: `${(item.quantity / (item.minQuantity || 1)) * 100}%`}}
                      ></div>
                    </div>
                  </div>
                );
              })}
            {lowStockCount === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-slate-200">
                <Package className="w-8 h-8 opacity-20" />
                <p className="text-[8px] font-black uppercase tracking-widest mt-2">Inventario OK</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, trend, positive, color }: any) {
  return (
    <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-3">
        <div className={cn("p-2 rounded-xl text-white", color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className={cn(
          "px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest",
          positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
        )}>
          {trend}
        </div>
      </div>
      <div>
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{title}</p>
        <h4 className="text-lg font-black text-slate-900 tracking-tight">{value}</h4>
      </div>
    </div>
  );
}
