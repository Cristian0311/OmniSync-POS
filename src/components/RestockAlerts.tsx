import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { AlertTriangle, Clock, TrendingUp, Calendar, AlertCircle, HelpCircle } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

export function RestockAlerts() {
  const { products, inventory, transactions, currentBranchId } = useStore();

  const restockData = useMemo(() => {
    // Calcular ventas por día en los últimos 30 días
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentTx = transactions.filter(t => new Date(t.date) >= thirtyDaysAgo && t.status === 'completed');

    const salesByProduct: Record<string, number> = {};
    recentTx.forEach(tx => {
      tx.items.forEach(item => {
        salesByProduct[item.product.id] = (salesByProduct[item.product.id] || 0) + item.quantity;
      });
    });

    return products.map(product => {
      const stock = inventory.filter(i => i.productId === product.id).reduce((sum, i) => sum + i.quantity, 0);
      const soldLast30Days = salesByProduct[product.id] || 0;
      const dailySalesRate = soldLast30Days / 30;
      
      let daysUntilStockout = Infinity;
      if (dailySalesRate > 0) {
        daysUntilStockout = Math.floor(stock / dailySalesRate);
      }

      const isLow = stock <= (product.minStockAlert || 5);
      const isCritical = daysUntilStockout <= 7;

      return {
        product,
        stock,
        dailySalesRate,
        daysUntilStockout,
        isLow,
        isCritical
      };
    }).filter(p => p.isLow || p.isCritical).sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);

  }, [products, inventory, transactions]);

  if (restockData.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center">
        <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={32} />
        </div>
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Todo en Orden</h3>
        <p className="text-slate-500 font-bold text-sm">No hay productos en riesgo de agotarse pronto según el ritmo de ventas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-rose-50 border-2 border-rose-100 p-6 rounded-3xl">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <h3 className="font-black text-rose-900 uppercase tracking-widest text-xs">Crítico (&lt; 7 días)</h3>
          </div>
          <p className="text-3xl font-black text-rose-600">{restockData.filter(d => d.isCritical).length}</p>
        </div>
        <div className="bg-amber-50 border-2 border-amber-100 p-6 rounded-3xl">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <h3 className="font-black text-amber-900 uppercase tracking-widest text-xs">Stock Bajo</h3>
          </div>
          <p className="text-3xl font-black text-amber-600">{restockData.filter(d => !d.isCritical && d.isLow).length}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Sugerencias de Compra</h2>
          <InfoTooltip text="Calcula cuánto tiempo durará tu inventario actual basándose en el ritmo de ventas diario de los últimos 30 días. Ayuda a evitar quiebres de stock." position="bottom" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</th>
                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Actual</th>
                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Ventas Diarias</th>
                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Se agota en</th>
                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {restockData.map((data, idx) => (
                <tr key={data.product.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-black text-sm text-slate-900">{data.product.name}</div>
                    <div className="text-xs font-bold text-slate-400">SKU: {data.product.sku}</div>
                  </td>
                  <td className="px-6 py-4 text-center font-black text-slate-700">{data.stock}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex items-center justify-center gap-1 bg-slate-100 px-2 py-1 rounded-lg text-xs font-bold text-slate-600">
                      <TrendingUp className="w-3 h-3 text-indigo-500" />
                      {data.dailySalesRate.toFixed(1)} / día
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex items-center justify-center gap-1 bg-slate-100 px-2 py-1 rounded-lg text-xs font-bold text-slate-600">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {data.daysUntilStockout === Infinity ? 'N/A' : `${data.daysUntilStockout} días`}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {data.isCritical ? (
                      <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest inline-block whitespace-nowrap">
                        Comprar Ya
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest inline-block whitespace-nowrap">
                        Alerta
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
