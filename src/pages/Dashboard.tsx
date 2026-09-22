import React, { useMemo } from "react";
import { TrendingUp, Users, DollarSign, Package, ShoppingBag, ArrowUpRight, ArrowDownRight, Clock, MapPin, AlertCircle } from "lucide-react";
import { useStore } from "../store/useStore";
import { cn } from "../lib/utils";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function Dashboard() {
  const { branches, currentBranchId, setCurrentBranch, transactions, getBaseCurrency, currencies, inventory, products, customers } = useStore();
  const baseCurrency = getBaseCurrency();

  const isCupCode = (code: string) => code === 'CUP' || code === 'MN' || code === 'CUC' || code === '₱';

  const formatMoney = (amount: number, symbol: string = baseCurrency.symbol, code: string = baseCurrency.code) => {
    const isCup = isCupCode(code) || isCupCode(symbol);
    const formatted = isCup
      ? Math.round(amount).toLocaleString('es-CU')
      : amount.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${symbol} ${formatted}`;
  };

  const isToday = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  };

  const todayTransactions = useMemo(() => 
    transactions.filter(t => isToday(t.date) && t.branchId === currentBranchId),
    [transactions, currentBranchId]
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
          <h2 className="text-2xl font-black text-primary tracking-tight">Dashboard</h2>
          <div className="flex items-center gap-2 text-muted mt-0.5">
            <MapPin className="w-3 h-3" />
            <p className="text-[9px] font-black uppercase tracking-widest">{branches.find(b => b.id === currentBranchId)?.name}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              if (window.confirm("¿Estás seguro de que deseas limpiar TODOS los datos locales y empezar de cero? Esta acción no se puede deshacer.")) {
                useStore.getState().clearAllData().then(() => {
                  window.location.reload();
                });
              }
            }}
            className="bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors border border-rose-100 dark:border-rose-900/50"
          >
            Limpiar Todo
          </button>
          <select 
            value={currentBranchId}
            onChange={(e) => setCurrentBranch(e.target.value)}
            className="bg-secondary border border-base rounded-xl text-[10px] font-black text-primary px-3 py-1.5 focus:ring-1 focus:ring-indigo-100 outline-none cursor-pointer uppercase tracking-widest transition-colors"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id} className="bg-secondary">{b.name}</option>
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
        <div className="lg:col-span-2 bg-secondary p-5 rounded-3xl border border-base shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-sm font-black text-primary uppercase tracking-widest">Evolución Semanal</h3>
              <p className="text-[9px] font-bold text-muted uppercase tracking-[0.2em]">Últimos 7 días</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{formatMoney(last7DaysData.reduce((sum, d) => sum + d.total, 0))}</p>
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-base)" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 8, fontWeight: 900}} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '12px', 
                    border: '1px solid var(--border-base)', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', 
                    fontSize: '10px', 
                    fontWeight: '900',
                    color: 'var(--text-primary)'
                  }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  labelStyle={{ color: 'var(--text-muted)', marginBottom: '4px' }}
                  formatter={(value: number) => [`${formatMoney(value)}`, 'Ventas']}
                />
                <Area type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Currency Breakdown (Compact) */}
        <div className="bg-secondary p-5 rounded-3xl border border-base flex flex-col shadow-xs">
          <h3 className="text-xs font-black uppercase tracking-widest mb-4 text-muted">Por Moneda</h3>
          
          <div className="space-y-2 flex-1">
            {salesByCurrency.length > 0 ? salesByCurrency.map(sale => (
              <div key={sale.code} className="bg-subtle p-3 rounded-2xl border border-base flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                <div>
                  <p className="text-[8px] font-black text-muted uppercase tracking-widest">{sale.code}</p>
                  <p className="text-base sm:text-lg font-black text-primary">{formatMoney(sale.amount, sale.symbol, sale.code)}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-secondary border border-base flex items-center justify-center font-black text-[9px] text-muted">
                  {sale.code}
                </div>
              </div>
            )) : (
              <div className="flex-1 flex flex-col items-center justify-center opacity-20 py-8 text-muted">
                <DollarSign className="w-8 h-8" />
              </div>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-base">
            <div className="flex justify-between items-center">
              <p className="text-[8px] font-black uppercase text-muted tracking-widest">Total Hoy</p>
              <p className="text-base font-black text-indigo-600 dark:text-indigo-400">{formatMoney(totalSalesToday)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Branch Performance (Enterprise Feature) */}
        <div className="bg-secondary p-5 rounded-3xl border border-base shadow-sm col-span-1 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-primary uppercase tracking-widest">Desempeño por Sucursal</h3>
            <span className="text-[8px] font-black text-muted uppercase tracking-widest">Últimos 7 días</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {branches.map(branch => {
              const branchTx = transactions.filter(t => t.branchId === branch.id);
              const branchTotal = branchTx.reduce((sum, t) => sum + t.total, 0);
              const branchSalesCount = branchTx.length;
              
              return (
                <div key={branch.id} className="p-4 bg-subtle rounded-2xl border border-base group hover:border-indigo-500/50 transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center">
                      <MapPin className="w-3 h-3" />
                    </div>
                    <p className="text-[10px] font-black text-primary uppercase tracking-tight">{branch.name}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-end">
                      <p className="text-[8px] font-black text-muted uppercase tracking-widest">Ventas Totales</p>
                      <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{formatMoney(branchTotal)}</p>
                    </div>
                    <div className="flex justify-between items-end">
                      <p className="text-[8px] font-black text-muted uppercase tracking-widest">Transacciones</p>
                      <p className="text-[10px] font-black text-primary">{branchSalesCount}</p>
                    </div>
                  </div>
                  <div className="mt-4 h-1.5 bg-secondary border border-base rounded-full overflow-hidden">
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
        <div className="bg-secondary p-5 rounded-3xl border border-base shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-primary uppercase tracking-widest">Últimas Ventas</h3>
            <button className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Ver Todo</button>
          </div>
          <div className="space-y-2">
            {todayTransactions.slice(0, 4).map(tx => (
              <div key={tx.id} className="flex items-center gap-3 p-2 hover:bg-subtle rounded-xl transition-all">
                <div className="w-8 h-8 rounded-lg bg-subtle flex items-center justify-center">
                  <Clock className="w-4 h-4 text-muted" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-primary uppercase tracking-tighter">#{tx.id.slice(-6)}</p>
                  <p className="text-[8px] font-black text-muted uppercase">{new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-primary">{formatMoney(tx.total)}</p>
                  <p className="text-[7px] font-black text-emerald-500 uppercase tracking-widest">OK</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock (Compact) */}
        <div className="bg-secondary p-5 rounded-3xl border border-base shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Stock Crítico</h3>
          </div>
          <div className="space-y-2">
            {inventory
              .filter(i => i.branchId === currentBranchId && i.quantity <= i.minQuantity)
              .slice(0, 4)
              .map(item => {
                const product = products.find(p => p.id === item.productId);
                return (
                  <div key={`${item.branchId}-${item.productId}`} className="flex items-center gap-3 p-2 bg-rose-50/30 dark:bg-rose-950/20 rounded-xl border border-rose-100/50 dark:border-rose-900/30">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-primary uppercase tracking-tighter line-clamp-1">{product?.name}</p>
                      <p className="text-[8px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Actual: {item.quantity}</p>
                    </div>
                    <div className="w-12 h-1 bg-secondary border border-base rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-rose-500" 
                        style={{width: `${(item.quantity / (item.minQuantity || 1)) * 100}%`}}
                      ></div>
                    </div>
                  </div>
                );
              })}
            {lowStockCount === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-muted">
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
    <div className="bg-secondary p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-base shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-w-0 overflow-hidden">
      <div className="flex justify-between items-start mb-2 sm:mb-3 gap-1">
        <div className={cn("p-1.5 sm:p-2 rounded-xl text-white shrink-0 shadow-sm", color)}>
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
        <div className={cn(
          "px-1.5 sm:px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest shrink-0",
          positive ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400"
        )}>
          {trend}
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[8px] font-black text-muted uppercase tracking-widest mb-0.5 truncate">{title}</p>
        <h4 className="text-sm sm:text-base lg:text-lg font-black text-primary tracking-tight truncate">{value}</h4>
      </div>
    </div>
  );
}
