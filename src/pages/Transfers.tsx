import React, { useState, useEffect } from "react";
import { 
  ArrowLeftRight, 
  Search, 
  Plus, 
  Package, 
  MapPin, 
  ArrowRight, 
  History, 
  CheckCircle, 
  Clock, 
  HelpCircle,
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Boxes,
  Building2,
  X
} from "lucide-react";
import { useStore } from "../store/useStore";
import { InfoTooltip } from "../components/InfoTooltip";

export default function Transfers() {
  const { 
    branches, 
    products, 
    inventory, 
    transferInventoryBatch, 
    transfers, 
    currentBranchId, 
    fetchProductStockRealtime 
  } = useStore();

  const [showAddModal, setShowAddModal] = useState(false);
  
  const [formData, setFormData] = useState({
    productId: '',
    fromBranchId: currentBranchId || (branches[0]?.id || ''),
    toBranchId: '',
  });
  const [variantQuantities, setVariantQuantities] = useState<{ [key: string]: number }>({});
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingRealtimeStock, setIsCheckingRealtimeStock] = useState(false);
  const [realtimeCheckSuccess, setRealtimeCheckSuccess] = useState(false);

  const effectiveFromBranchId = formData.fromBranchId || (branches.length > 0 ? branches[0].id : '');
  const effectiveToBranchId = formData.toBranchId;

  const selectedProduct = products.find(p => p.id === formData.productId);
  const fromBranch = branches.find(b => b.id === effectiveFromBranchId);
  const toBranch = branches.find(b => b.id === effectiveToBranchId);

  // Trigger real-time stock refresh when product or branch changes in modal
  const refreshProductStock = async (prodId: string) => {
    if (!prodId) return;
    setIsCheckingRealtimeStock(true);
    setRealtimeCheckSuccess(false);
    try {
      await fetchProductStockRealtime(prodId);
      setRealtimeCheckSuccess(true);
      setTimeout(() => setRealtimeCheckSuccess(false), 2000);
    } catch (e) {
      console.error("Error refreshing realtime stock:", e);
    } finally {
      setIsCheckingRealtimeStock(false);
    }
  };

  useEffect(() => {
    if (showAddModal && formData.productId) {
      refreshProductStock(formData.productId);
    }
  }, [showAddModal, formData.productId, effectiveFromBranchId]);

  // Calculate live available stock in source branch
  const hasVariants = (selectedProduct?.availableSizes?.length || 0) + (selectedProduct?.availableColors?.length || 0) > 0;
  const variantsList: string[] = hasVariants 
    ? Array.from(new Set([...(selectedProduct?.availableSizes || []), ...(selectedProduct?.availableColors || [])]))
    : [''];

  const getSourceStockForVariant = (variantLabel: string = ''): number => {
    if (!selectedProduct || !effectiveFromBranchId) return 0;
    const item = inventory.find(
      i => i.productId === selectedProduct.id && 
           i.branchId === effectiveFromBranchId && 
           (i.variantLabel || '') === (variantLabel || '')
    );
    return item ? Number(item.quantity) : 0;
  };

  const getTargetStockForVariant = (variantLabel: string = ''): number => {
    if (!selectedProduct || !effectiveToBranchId) return 0;
    const item = inventory.find(
      i => i.productId === selectedProduct.id && 
           i.branchId === effectiveToBranchId && 
           (i.variantLabel || '') === (variantLabel || '')
    );
    return item ? Number(item.quantity) : 0;
  };

  const totalSourceStock: number = variantsList.reduce((acc: number, v: string) => acc + getSourceStockForVariant(v), 0);
  const totalTargetStock: number = effectiveToBranchId 
    ? variantsList.reduce((acc: number, v: string) => acc + getTargetStockForVariant(v), 0) 
    : 0;

  const totalTransferring: number = Object.keys(variantQuantities).reduce((acc: number, key: string) => {
    const val = Number(variantQuantities[key]);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!effectiveFromBranchId || !effectiveToBranchId) {
      setError("Debes seleccionar tanto la sucursal de origen como la de destino.");
      return;
    }

    if (effectiveFromBranchId === effectiveToBranchId) {
      setError("La sucursal de origen y destino no pueden ser la misma.");
      return;
    }

    if (!selectedProduct) {
      setError("Debes seleccionar un producto válido.");
      return;
    }

    const variantsToTransfer: [string, number][] = hasVariants 
      ? Object.entries(variantQuantities)
          .map(([v, qty]): [string, number] => [v, Number(qty) || 0])
          .filter(([_, qty]) => qty > 0) 
      : [['', Number(variantQuantities['']) || 0]];

    if (variantsToTransfer.length === 0 || variantsToTransfer.every(([_, qty]) => qty <= 0)) {
      setError("Debes ingresar una cantidad mayor a 0 para transferir.");
      return;
    }

    // Live verification: Check that no variant exceeds current source stock
    for (const [variant, qty] of variantsToTransfer) {
      const available = getSourceStockForVariant(variant);
      if (qty > available) {
        setError(`No hay suficiente stock en origen para ${variant ? `la variante "${variant}"` : 'este producto'}. Disponible: ${available} uds, intentas transferir: ${qty} uds.`);
        return;
      }
    }

    setIsSubmitting(true);
    const variantsPayload = variantsToTransfer.map(([v, q]) => ({ variantLabel: v, quantity: q }));

    const result = await transferInventoryBatch(
      formData.productId,
      effectiveFromBranchId,
      effectiveToBranchId,
      variantsPayload
    );

    setIsSubmitting(false);

    if (result.success) {
      setShowAddModal(false);
      setFormData({ ...formData, productId: '' });
      setVariantQuantities({});
      setError("");
    } else {
      setError(result.error || "No se pudo completar la transferencia. Revisa el stock disponible.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 p-4 sm:p-6 max-w-full overflow-x-hidden">
      
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">Transferencias de Stock</h2>
          <InfoTooltip text="Mueve stock entre sucursales en tiempo real con verificación atómica para prevenir inventario negativo." position="bottom" />
        </div>
        
        <div className="flex items-center gap-2.5 flex-wrap">
          <button 
            type="button"
            onClick={() => {
              setShowAddModal(true);
              setError("");
              if (products.length > 0 && !formData.productId) {
                setFormData(prev => ({ ...prev, productId: products[0].id }));
              }
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-tight hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Nueva Transferencia
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Transfer History */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Historial de Transferencias</h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                {transfers.length} registros
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-3.5">Fecha</th>
                    <th className="px-6 py-3.5">Producto</th>
                    <th className="px-6 py-3.5">Ruta de Transferencia</th>
                    <th className="px-6 py-3.5 text-right">Cantidad</th>
                    <th className="px-6 py-3.5 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transfers.length > 0 ? transfers.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-slate-900">{new Date(t.date).toLocaleDateString()}</div>
                        <div className="text-[10px] font-mono text-slate-400">{new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-black text-slate-900 uppercase tracking-tight">{t.productName}</div>
                        {t.variantLabel && (
                          <div className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                            {t.variantLabel}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-700 uppercase bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80">
                            {t.fromBranchName}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="text-[10px] font-black text-indigo-700 uppercase bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                            {t.toBranchName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-md">
                          {t.quantity} uds
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          Completado
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-300">
                          <ArrowLeftRight className="w-12 h-12 mb-3 text-slate-200" />
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Sin registros de transferencia</p>
                          <p className="text-xs text-slate-400 mt-1 max-w-xs">Usa el botón "Nueva Transferencia" para mover stock entre tus almacenes de manera segura.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: System Status & Diagnostic Summary */}
        <div className="space-y-4">
          <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl">
            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-300 mb-4 flex items-center justify-between">
              <span>Estado del Sistema</span>
              <Activity className="w-4 h-4 text-indigo-400" />
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                  <Package className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-2xl font-black leading-none">{transfers.length}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Movimientos Totales</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-black leading-none">{branches.length}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Sucursales Activas</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Boxes className="w-4 h-4 text-indigo-600" />
              Garantía de Integridad
            </h3>
            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex gap-2.5 items-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">
                  <strong className="text-slate-900">Verificación en Tiempo Real:</strong> El stock en el almacén de origen se consulta directamente en Supabase antes de validar el envío.
                </p>
              </div>
              <div className="flex gap-2.5 items-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">
                  <strong className="text-slate-900">Protección Anti-Stock Negativo:</strong> El sistema bloquea transferencias que superen el stock disponible.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Modal with Real-time Stock Inspector */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 animate-in zoom-in-95 my-auto">
            
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">Nueva Transferencia de Stock</h3>
                  <p className="text-xs text-slate-400">Verificación y balance en tiempo real</p>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              
              {/* Error Alert */}
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-black flex items-start gap-2.5 animate-in shake">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p>{error}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleTransfer} className="space-y-5">
                
                {/* Branch Selection Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Almacén Origen (Desde)
                    </label>
                    <select 
                      required
                      value={effectiveFromBranchId}
                      onChange={e => {
                        setFormData({ ...formData, fromBranchId: e.target.value });
                        setVariantQuantities({});
                        setError("");
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-900"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-wider">
                      Almacén Destino (Hacia)
                    </label>
                    <select 
                      required
                      value={effectiveToBranchId}
                      onChange={e => {
                        setFormData({ ...formData, toBranchId: e.target.value });
                        setError("");
                      }}
                      className="w-full px-3.5 py-2.5 bg-indigo-50/50 border border-indigo-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-indigo-950"
                    >
                      <option value="">Selecciona Almacén Destino...</option>
                      {branches.filter(b => b.id !== effectiveFromBranchId).map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Product Selection */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Producto a Transferir
                    </label>
                    {selectedProduct && (
                      <button
                        type="button"
                        onClick={() => refreshProductStock(selectedProduct.id)}
                        disabled={isCheckingRealtimeStock}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        <RefreshCw className={`w-3 h-3 ${isCheckingRealtimeStock ? 'animate-spin' : ''}`} />
                        {isCheckingRealtimeStock ? 'Verificando en Supabase...' : 'Actualizar Stock en Vivo'}
                      </button>
                    )}
                  </div>

                  <select 
                    required
                    value={formData.productId}
                    onChange={e => {
                      setFormData({ ...formData, productId: e.target.value });
                      setVariantQuantities({});
                      setError("");
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-900"
                  >
                    <option value="">Selecciona Producto...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.sku ? `(SKU: ${p.sku})` : ''} - ${p.price}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Live Real-time Stock Inspector Card */}
                {selectedProduct && (
                  <div className="p-4 bg-gradient-to-r from-slate-50 via-slate-50 to-indigo-50/40 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Boxes className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-black uppercase text-slate-800">
                          Inspector de Stock en Tiempo Real
                        </span>
                      </div>
                      
                      {realtimeCheckSuccess && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Supabase sincronizado
                        </span>
                      )}
                    </div>

                    {/* Stock Metrics Row */}
                    <div className="grid grid-cols-2 gap-3">
                      
                      {/* Origin Stock */}
                      <div className={`p-3 rounded-xl border ${
                        totalSourceStock > 0 
                          ? 'bg-white border-emerald-200' 
                          : 'bg-rose-50/80 border-rose-200'
                      }`}>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">
                          Origen ({fromBranch?.name || 'Sucursal'})
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className={`text-xl font-black ${
                            totalSourceStock > 0 ? 'text-emerald-700' : 'text-rose-600'
                          }`}>
                            {totalSourceStock}
                          </span>
                          <span className="text-xs font-bold text-slate-500">uds disponibles</span>
                        </div>
                        {totalSourceStock === 0 && (
                          <span className="text-[9px] font-black text-rose-600 block mt-0.5">
                            ⚠️ Sin stock en este almacén
                          </span>
                        )}
                      </div>

                      {/* Destination Stock */}
                      <div className="p-3 rounded-xl bg-white border border-indigo-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">
                          Destino ({toBranch?.name || 'Seleccionar'})
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-xl font-black text-indigo-700">
                            {effectiveToBranchId ? totalTargetStock : '-'}
                          </span>
                          <span className="text-xs font-bold text-slate-500">uds actuales</span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 block mt-0.5">
                          {effectiveToBranchId ? `Recibirá: +${totalTransferring} uds` : 'Elige destino'}
                        </span>
                      </div>

                    </div>

                    {/* Live Transfer Simulation Preview */}
                    {effectiveToBranchId && totalTransferring > 0 && (
                      <div className="p-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <TrendingDown className="w-3.5 h-3.5 text-rose-300" />
                          <span>Origen queda en: <strong>{Math.max(0, totalSourceStock - totalTransferring)} uds</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Destino queda en: <strong>{totalTargetStock + totalTransferring} uds</strong></span>
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* Variant Quantity Inputs OR Single Product Input */}
                {selectedProduct && hasVariants ? (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Variantes de Producto (Indica cantidad para cada una)
                    </label>
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {variantsList.map(variant => {
                        const currentStock = getSourceStockForVariant(variant);
                        const isOutOfStock = currentStock <= 0;

                        return (
                          <div 
                            key={variant} 
                            className={`flex justify-between items-center p-3 rounded-2xl border transition-all ${
                              isOutOfStock 
                                ? 'bg-slate-100/70 border-slate-200 opacity-60' 
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div>
                              <span className="text-xs font-black text-slate-800 block">
                                {variant}
                              </span>
                              <span className={`text-[10px] font-bold ${
                                isOutOfStock ? 'text-rose-600' : 'text-slate-500'
                              }`}>
                                Disponible en origen: <strong>{currentStock} uds</strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <input 
                                type="number" 
                                min="0"
                                max={currentStock}
                                disabled={isOutOfStock}
                                value={variantQuantities[variant] ?? ''}
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 0;
                                  setVariantQuantities({
                                    ...variantQuantities,
                                    [variant]: Math.min(currentStock, Math.max(0, val))
                                  });
                                  setError("");
                                }}
                                className="w-20 px-3 py-1.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-black text-center disabled:bg-slate-200"
                                placeholder="0"
                              />
                              {!isOutOfStock && currentStock > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setVariantQuantities({
                                    ...variantQuantities,
                                    [variant]: currentStock
                                  })}
                                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[9px] font-black uppercase"
                                >
                                  Max
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : selectedProduct && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Cantidad a Transferir
                      </label>
                      <span className="text-[10px] font-bold text-slate-500">
                        Máximo permitido: <strong className="text-indigo-700">{totalSourceStock} uds</strong>
                      </span>
                    </div>

                    <div className="relative flex items-center gap-2">
                      <input 
                        type="number" 
                        min="1"
                        max={totalSourceStock}
                        disabled={totalSourceStock <= 0}
                        required
                        value={variantQuantities[''] ?? ''}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          setVariantQuantities({
                            ...variantQuantities,
                            '': Math.min(totalSourceStock, Math.max(0, val))
                          });
                          setError("");
                        }}
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-black text-slate-900 disabled:bg-slate-100 disabled:opacity-50"
                        placeholder={totalSourceStock <= 0 ? "Sin stock disponible" : "0"}
                      />

                      {totalSourceStock > 0 && (
                        <button
                          type="button"
                          onClick={() => setVariantQuantities({ '': totalSourceStock })}
                          className="px-3 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black rounded-2xl text-xs uppercase"
                        >
                          Transferir Todo ({totalSourceStock})
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-50 active:scale-95 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting || totalSourceStock <= 0 || totalTransferring <= 0 || !effectiveToBranchId}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Transfiriendo en Supabase...
                      </>
                    ) : (
                      <>
                        <ArrowLeftRight className="w-4 h-4" />
                        Confirmar Envío ({totalTransferring} uds)
                      </>
                    )}
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
