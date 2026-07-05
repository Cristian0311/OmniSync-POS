import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { InventoryAudit, Product } from "../types";
import { 
  ClipboardCheck, 
  Plus, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  Eye, 
  X, 
  ArrowRight,
  TrendingDown,
  TrendingUp,
  History,
  Lock,
  Unlock
} from "lucide-react";
import { cn } from "../lib/utils";

export default function InventoryAuditPage() {
  const { products, inventory, inventoryAudits, createInventoryAudit, completeInventoryAudit, branches, currentBranchId, currentUser } = useStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<InventoryAudit | null>(null);
  const [auditStep, setAuditStep] = useState<'setup' | 'counting'>('setup');
  
  // State for new audit
  const [auditBranchId, setAuditBranchId] = useState(currentBranchId);
  const [auditItems, setAuditItems] = useState<{ productId: string; productName: string; expected: number; counted: number }[]>([]);

  const activeAudit = useMemo(() => inventoryAudits.find(a => a.status === 'pending' && a.branchId === auditBranchId), [inventoryAudits, auditBranchId]);

  const handleStartAudit = () => {
    // Initialize items with all products in that branch
    const items = inventory
      .filter(i => i.branchId === auditBranchId)
      .map(i => ({
        productId: i.productId,
        productName: products.find(p => p.id === i.productId)?.name || 'Producto',
        expected: i.quantity,
        counted: i.quantity // Initialize with expected for convenience, user will edit
      }));

    const newAudit: InventoryAudit = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      branchId: auditBranchId,
      userId: currentUser?.id || 'system',
      status: 'pending',
      items: items.map(i => ({ ...i, difference: 0 }))
    };

    createInventoryAudit(newAudit);
    setAuditStep('counting');
    setAuditItems(items);
  };

  const handleComplete = () => {
    if (!activeAudit) return;
    
    const finalItems = auditItems.map(i => ({
      ...i,
      difference: i.counted - i.expected
    }));

    completeInventoryAudit(activeAudit.id, finalItems, "Auditoría de inventario rutinaria");
    setShowAddModal(false);
    setAuditStep('setup');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Auditoría de Inventario</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ajustes y Cuentas Ciegas</p>
        </div>
        {!activeAudit ? (
          <button 
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva Auditoría
          </button>
        ) : (
          <button 
            onClick={() => { setSelectedAudit(activeAudit); setAuditItems(activeAudit.items); setAuditStep('counting'); setShowAddModal(true); }}
            className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-100 flex items-center justify-center gap-2"
          >
            <Unlock className="w-3.5 h-3.5" />
            Continuar Auditoría
          </button>
        )}
      </header>

      {/* Historial de Auditorías */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600" />
          <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Historial de Ajustes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID / Fecha</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sucursal</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Items</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Discrepancias</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {inventoryAudits.map(audit => {
                const totalDiff = audit.items.reduce((sum, i) => sum + Math.abs(i.difference), 0);
                return (
                  <tr key={audit.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-[10px] font-black text-slate-900 uppercase">{audit.id}</div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase">{new Date(audit.date).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[10px] font-black text-slate-900 uppercase">{branches.find(b => b.id === audit.branchId)?.name}</div>
                    </td>
                    <td className="px-6 py-4 text-[10px] font-black text-slate-600">{audit.items.length}</td>
                    <td className="px-6 py-4">
                      {totalDiff > 0 ? (
                        <div className="flex items-center gap-1.5 text-rose-600 font-black text-[10px] uppercase">
                          <AlertTriangle className="w-3 h-3" />
                          {totalDiff} faltantes/sobrantes
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-600 font-black text-[10px] uppercase">
                          <CheckCircle2 className="w-3 h-3" />
                          Cuadrado
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                        audit.status === 'completed' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {audit.status === 'completed' ? 'Finalizado' : 'En Progreso'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => { setSelectedAudit(audit); setShowAddModal(true); setAuditStep('counting'); setAuditItems(audit.items); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {inventoryAudits.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    No hay auditorías registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Auditoría */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  {auditStep === 'setup' ? 'Iniciar Nueva Auditoría' : 'Contando Inventario'}
                </h2>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {auditStep === 'setup' ? 'Configura la sucursal y parámetros' : `Sucursal: ${branches.find(b => b.id === auditBranchId)?.name}`}
                </p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {auditStep === 'setup' ? (
                <div className="space-y-6 max-w-md mx-auto py-8">
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-4">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <p className="text-[10px] font-bold text-amber-800 leading-relaxed uppercase">
                      Al iniciar una auditoría, se tomará una captura del stock actual. Al finalizar, el sistema ajustará automáticamente las diferencias encontradas.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Sucursal a Auditar</label>
                    <select 
                      value={auditBranchId}
                      onChange={e => setAuditBranchId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <button 
                    onClick={handleStartAudit}
                    className="w-full py-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                  >
                    Iniciar Proceso
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Buscar producto en la auditoría..." className="bg-transparent border-none text-xs font-bold w-full focus:ring-0 outline-none" />
                  </div>

                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Producto</th>
                          <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Esperado</th>
                          <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Contado</th>
                          <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Diferencia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {auditItems.map((item, idx) => {
                          const diff = item.counted - item.expected;
                          return (
                            <tr key={item.productId} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="text-[10px] font-black text-slate-900 uppercase">{item.productName}</div>
                              </td>
                              <td className="px-4 py-3 text-center text-[10px] font-black text-slate-400">{item.expected}</td>
                              <td className="px-4 py-3 text-center">
                                <input 
                                  type="number" 
                                  value={item.counted}
                                  disabled={selectedAudit?.status === 'completed'}
                                  onChange={e => {
                                    const newItems = [...auditItems];
                                    newItems[idx].counted = parseInt(e.target.value) || 0;
                                    setAuditItems(newItems);
                                  }}
                                  className="w-16 px-2 py-1 bg-white border border-slate-200 rounded text-center text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={cn(
                                  "text-[10px] font-black uppercase",
                                  diff === 0 ? "text-slate-400" : diff > 0 ? "text-emerald-600" : "text-rose-600"
                                )}>
                                  {diff > 0 ? '+' : ''}{diff}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {auditStep === 'counting' && selectedAudit?.status !== 'completed' && (
              <div className="p-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center bg-slate-50 gap-4">
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase">Items</p>
                    <p className="text-sm font-black text-slate-900">{auditItems.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase">Diferencias</p>
                    <p className={cn("text-sm font-black", auditItems.some(i => i.counted !== i.expected) ? "text-rose-600" : "text-emerald-600")}>
                      {auditItems.filter(i => i.counted !== i.expected).length}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase">Valor Neto Ajuste</p>
                    <p className="text-sm font-black text-slate-900">
                      CUP {auditItems.reduce((sum, i) => {
                        const p = products.find(prod => prod.id === i.productId);
                        return sum + ((i.counted - i.expected) * (p?.costPrice || 0));
                      }, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleComplete}
                  className="w-full sm:w-auto px-8 py-3 bg-indigo-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-800 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Finalizar y Ajustar Stock
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
