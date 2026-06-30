import React, { useState } from "react";
import { ArrowLeftRight, Search, Plus, Package, MapPin, ArrowRight, History, CheckCircle, Clock } from "lucide-react";
import { useStore } from "../store/useStore";
import { cn, generateId } from "../lib/utils";
import { InventoryTransfer } from "../types";

export default function Transfers() {
  const { branches, products, inventory, transferInventory, transfers, addTransfer, currentBranchId, currentUser } = useStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    fromBranchId: currentBranchId,
    toBranchId: '',
  });
  const [variantQuantities, setVariantQuantities] = useState<{ [key: string]: number }>({});
  const [error, setError] = useState("");

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.fromBranchId === formData.toBranchId) {
      setError("La sucursal de origen y destino no pueden ser la misma.");
      return;
    }

    const selectedProduct = products.find(p => p.id === formData.productId);
    if (!selectedProduct) return;

    const hasVariants = (selectedProduct.availableSizes?.length || 0) + (selectedProduct.availableColors?.length || 0) > 0;
    const variantsToTransfer = hasVariants ? Object.entries(variantQuantities).filter(([_, qty]) => (qty as number) > 0) : [['', variantQuantities[''] || 0]];

    if (variantsToTransfer.length === 0 || variantsToTransfer.every(([_, qty]) => qty === 0)) {
      setError("Debes ingresar una cantidad para al menos una variante.");
      return;
    }

    let allSuccess = true;
    let someSuccess = false;

    for (const [variant, qty] of variantsToTransfer) {
      if (qty <= 0) continue;
      const success = transferInventory(
        formData.productId,
        formData.fromBranchId,
        formData.toBranchId,
        qty,
        variant
      );

      if (success) {
        someSuccess = true;
        const fromBranch = branches.find(b => b.id === formData.fromBranchId);
        const toBranch = branches.find(b => b.id === formData.toBranchId);

        addTransfer({
          id: generateId('TRF'),
          productId: formData.productId,
          productName: selectedProduct.name,
          fromBranchId: formData.fromBranchId,
          fromBranchName: fromBranch?.name || 'Origen',
          toBranchId: formData.toBranchId,
          toBranchName: toBranch?.name || 'Destino',
          quantity: qty,
          date: new Date().toISOString(),
          status: 'completed',
          variantLabel: variant,
          userId: currentUser?.id || 'u1'
        });
      } else {
        allSuccess = false;
      }
    }

    if (someSuccess) {
      if (!allSuccess) {
        alert("Algunas transferencias fallaron por falta de stock. Las demás se completaron.");
      }
      setShowAddModal(false);
      setFormData({ ...formData, productId: '' });
      setVariantQuantities({});
    } else {
      setError("No hay suficiente stock en la sucursal de origen para realizar la transferencia.");
    }
  };

  const selectedProduct = products.find(p => p.id === formData.productId);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-8">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Transferencias</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Movimiento de Stock entre Sucursales</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nueva Transferencia
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Historial de Movimientos</h3>
              <History className="w-4 h-4 text-slate-300" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Producto</th>
                    <th className="px-6 py-4">Origen {'->'} Destino</th>
                    <th className="px-6 py-4 text-right">Cant.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transfers.length > 0 ? transfers.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="text-[10px] font-bold text-slate-900">{new Date(t.date).toLocaleDateString()}</div>
                        <div className="text-[8px] font-black text-slate-400 uppercase">{new Date(t.date).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{t.productName}</div>
                        {t.variantLabel && (
                          <div className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">VAR: {t.variantLabel}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{t.fromBranchName}</span>
                          <ArrowRight className="w-3 h-3 text-slate-300" />
                          <span className="text-[9px] font-black text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{t.toBranchName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-[10px] font-black text-slate-900">{t.quantity} uds</span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center opacity-20 grayscale">
                          <ArrowLeftRight className="w-12 h-12 mb-4" />
                          <p className="text-[10px] font-black uppercase tracking-widest">Sin registros de transferencia</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl">
            <h3 className="text-xs font-black uppercase tracking-widest mb-4">Estado del Sistema</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center">
                  <Package className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-2xl font-black leading-none">{transfers.length}</p>
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mt-1">Movimientos Totales</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-black leading-none">{transfers.filter(t => t.status === 'completed').length}</p>
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mt-1">Completados Hoy</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">Próximos Pasos</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <p className="text-[10px] font-bold text-slate-600 leading-relaxed uppercase tracking-tight">Recuerda verificar el stock físico antes de confirmar el movimiento en el sistema.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <p className="text-[10px] font-bold text-slate-600 leading-relaxed uppercase tracking-tight">Las transferencias son instantáneas y afectan el inventario de ambas sucursales.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 border border-white/20">
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Nueva Transferencia</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Selecciona producto y destino</p>
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <form onSubmit={handleTransfer} className="space-y-5">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Producto</label>
                    <select 
                      required
                      value={formData.productId}
                      onChange={e => {
                        setFormData({ ...formData, productId: e.target.value });
                        setVariantQuantities({});
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-[11px] font-black uppercase"
                    >
                      <option value="">Seleccionar Producto...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>

                  {selectedProduct && (selectedProduct.availableSizes?.length || 0) + (selectedProduct.availableColors?.length || 0) > 0 ? (
                    <div className="space-y-2">
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Variantes (Cantidades a transferir)</label>
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {/* We merge sizes and colors for this view as variants */}
                        {Array.from(new Set([...(selectedProduct.availableSizes || []), ...(selectedProduct.availableColors || [])])).map(variant => {
                          const currentStock = inventory.find(i => i.productId === selectedProduct.id && i.branchId === formData.fromBranchId && i.variantLabel === variant)?.quantity || 0;
                          return (
                            <div key={variant} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                              <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight ml-2">{variant} <span className="text-slate-400 ml-1 font-bold">(Stock: {currentStock})</span></span>
                              <input 
                                type="number" 
                                min="0"
                                max={currentStock}
                                value={variantQuantities[variant] || ''}
                                onChange={e => setVariantQuantities({ ...variantQuantities, [variant]: parseInt(e.target.value) || 0 })}
                                className="w-20 px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-black text-center"
                                placeholder="0"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : selectedProduct && (
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Cantidad a Transferir</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          min="1"
                          required
                          value={variantQuantities[''] || ''}
                          onChange={e => setVariantQuantities({ ...variantQuantities, '': parseInt(e.target.value) || 0 })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-xl font-black text-slate-900"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">Stock actual: {inventory.find(i => i.productId === selectedProduct.id && i.branchId === formData.fromBranchId && !i.variantLabel)?.quantity || 0}</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Origen</label>
                      <select 
                        required
                        value={formData.fromBranchId}
                        onChange={e => setFormData({ ...formData, fromBranchId: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-[11px] font-black uppercase"
                      >
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Destino</label>
                      <select 
                        required
                        value={formData.toBranchId}
                        onChange={e => setFormData({ ...formData, toBranchId: e.target.value })}
                        className="w-full px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-[11px] font-black uppercase text-indigo-900"
                      >
                        <option value="">Seleccionar...</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 bg-white border border-slate-200 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95 transition-all"
                  >
                    Confirmar Envío
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
