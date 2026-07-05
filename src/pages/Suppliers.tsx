import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Supplier, SupplierOrder } from "../types";
import { 
  Users, 
  Truck, 
  Plus, 
  Search, 
  Star, 
  Phone, 
  Mail, 
  MapPin, 
  History, 
  ChevronRight, 
  ExternalLink, 
  FileText,
  X,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { cn } from "../lib/utils";

export default function Suppliers() {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier, supplierOrders, products, createSupplierOrder, updateSupplierOrder, branches, getBaseCurrency } = useStore();
  const baseCurrency = getBaseCurrency();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  
  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: "",
    email: "",
    phone: "",
    typeOfMerchandise: "",
    rating: 5,
    rnc: "",
    address: ""
  });

  const [editingOrder, setEditingOrder] = useState<SupplierOrder | null>(null);

  const [orderFormData, setOrderFormData] = useState<{
    supplierId: string;
    branchId: string;
    items: { productId: string; variantLabel?: string; quantity: number; cost: number }[];
    transportCost?: number;
    transportDetails?: string;
    expectedDeliveryDate?: string;
  }>({
    supplierId: "",
    branchId: "",
    items: [{ productId: "", quantity: 1, cost: 0 }],
    expectedDeliveryDate: ""
  });

  const handleOpenOrderModal = (order?: SupplierOrder) => {
    if (order) {
      setEditingOrder(order);
      setOrderFormData({
        supplierId: order.supplierId,
        branchId: order.branchId,
        expectedDeliveryDate: order.expectedDeliveryDate || "",
        transportDetails: order.transportDetails || "",
        transportCost: order.transportCost || 0,
        items: order.items.map(i => ({ productId: i.productId, variantLabel: i.variantLabel, quantity: i.quantity, cost: i.cost }))
      });
    } else {
      setEditingOrder(null);
      setOrderFormData({
        supplierId: selectedSupplier ? selectedSupplier.id : "",
        branchId: "",
        expectedDeliveryDate: "",
        transportDetails: "",
        transportCost: 0,
        items: [{ productId: "", quantity: 1, cost: 0 }]
      });
    }
    setShowOrderModal(true);
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.typeOfMerchandise.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSupplier) {
      updateSupplier(selectedSupplier.id, formData);
    } else {
      addSupplier({ id: crypto.randomUUID(), ...formData } as Supplier);
    }
    setShowAddModal(false);
    setSelectedSupplier(null);
    setFormData({ name: "", email: "", phone: "", typeOfMerchandise: "", rating: 5, rnc: "", address: "" });
  };

  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const supplier = suppliers.find(s => s.id === orderFormData.supplierId);
    const total = orderFormData.items.reduce((sum, i) => sum + (i.quantity * i.cost), 0);
    
    const items = orderFormData.items.map(i => ({
      ...i,
      productName: products.find(p => p.id === i.productId)?.name || 'Producto'
    }));

    const transportCost = orderFormData.transportCost || 0;
    const transportDetails = orderFormData.transportDetails || "";

    if (editingOrder) {
      updateSupplierOrder(editingOrder.id, {
        supplierId: orderFormData.supplierId,
        branchId: orderFormData.branchId,
        expectedDeliveryDate: orderFormData.expectedDeliveryDate,
        items,
        total,
        transportCost,
        transportDetails
      });
    } else {
      createSupplierOrder({
        id: crypto.randomUUID(),
        supplierId: orderFormData.supplierId,
        branchId: orderFormData.branchId,
        date: new Date().toISOString(),
        expectedDeliveryDate: orderFormData.expectedDeliveryDate,
        items,
        total,
        status: 'pending',
        transportCost,
        transportDetails
      });
    }
    setShowOrderModal(false);
    setEditingOrder(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Gestión de Proveedores</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Abastecimiento y Órdenes de Compra</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => { setSelectedSupplier(null); setFormData({ name: "", email: "", phone: "", typeOfMerchandise: "", rating: 5, rnc: "", address: "" }); setShowAddModal(true); }}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo Proveedor
          </button>
          <button 
            onClick={() => handleOpenOrderModal()}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
          >
            <Truck className="w-3.5 h-3.5" />
            Nueva Orden
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Proveedores */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o tipo de mercancía..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSuppliers.map(s => (
              <div key={s.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 group hover:border-indigo-200 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-black text-xs">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">{s.name}</h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{s.typeOfMerchandise}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={cn("w-3 h-3", i < s.rating ? "fill-amber-400 text-amber-400" : "text-slate-200")} />
                    ))}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-[10px] text-slate-600 font-bold">
                    <Phone className="w-3 h-3 text-slate-400" /> {s.phone}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-600 font-bold">
                    <Mail className="w-3 h-3 text-slate-400" /> {s.email}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => { setSelectedSupplier(s); setFormData(s); setShowAddModal(true); }}
                    className="flex-1 py-2 bg-slate-50 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                  >
                    Editar
                  </button>
                  <button onClick={() => deleteSupplier(s.id)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-all">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Órdenes Recientes */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Órdenes de Compra</h3>
            </div>
            <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto custom-scrollbar">
              {supplierOrders.map(order => (
                <div key={order.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black text-slate-900 uppercase truncate">{order.id}</div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase truncate">
                        {suppliers.find(s => s.id === order.supplierId)?.name || 'Proveedor'} • {new Date(order.date).toLocaleDateString()}
                      </div>
                    </div>
                    <span className={cn(
                      "shrink-0 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest",
                      order.status === 'pending' ? "bg-amber-100 text-amber-700" :
                      order.status === 'received' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    )}>
                      {order.status === 'pending' ? 'Pendiente' : order.status === 'received' ? 'Recibida' : 'Cancelada'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <div className="text-[9px] font-black text-slate-600 uppercase truncate">
                      {order.items.length} Ptos • CUP {order.total.toLocaleString()}
                    </div>
                    {order.status === 'pending' && (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleOpenOrderModal(order)}
                          title="Editar Orden"
                          className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => updateSupplierOrder(order.id, { status: 'received' })}
                          title="Recibir Mercancía"
                          className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[8px] font-bold text-slate-500 uppercase">
                        <span className="truncate pr-2">{item.quantity}x {item.productName} {item.variantLabel ? `(${item.variantLabel})` : ''}</span>
                        <span className="shrink-0">CUP {(item.quantity * item.cost).toLocaleString()}</span>
                      </div>
                    ))}
                    {order.transportCost ? (
                      <div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase border-t border-slate-100 pt-1 mt-1">
                        <span className="truncate pr-2">Transporte {order.transportDetails ? `(${order.transportDetails})` : ''}</span>
                        <span className="shrink-0">CUP {order.transportCost.toLocaleString()}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {supplierOrders.length === 0 && (
                <div className="p-8 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  No hay órdenes registradas
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Add Supplier */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">{selectedSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nombre de la Empresa</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">RNC / Cédula</label>
                  <input type="text" value={formData.rnc} onChange={e => setFormData({...formData, rnc: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Teléfono</label>
                  <input type="text" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Correo Electrónico</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tipo de Mercancía</label>
                  <input type="text" required value={formData.typeOfMerchandise} onChange={e => setFormData({...formData, typeOfMerchandise: e.target.value})} placeholder="Ej: Electrónicos, Ropa, etc." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" />
                </div>
              </div>
              <button type="submit" className="w-full py-3.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all mt-4">
                {selectedSupplier ? 'Guardar Cambios' : 'Registrar Proveedor'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Purchase Order */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Nueva Orden de Compra</h2>
              <button onClick={() => setShowOrderModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleOrderSubmit} className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Proveedor</label>
                  <select required value={orderFormData.supplierId} onChange={e => setOrderFormData({...orderFormData, supplierId: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none">
                    <option value="">Seleccionar Proveedor</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Sucursal Destino</label>
                  <select required value={orderFormData.branchId} onChange={e => setOrderFormData({...orderFormData, branchId: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none">
                    <option value="">Seleccionar Sucursal</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Detalles de Transporte / Logística</label>
          <input 
            type="text" 
            placeholder="Ej: Camión Placa G-1234, Empresa Logística..."
            value={orderFormData.transportDetails || ""}
            onChange={e => setOrderFormData({...orderFormData, transportDetails: e.target.value})}
            className="w-full bg-transparent border-none text-[10px] font-black focus:ring-0 p-0 text-slate-900 uppercase"
          />
        </div>
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Costo de Transporte ({baseCurrency.code})</label>
          <input 
            type="number" 
            placeholder="0.00"
            value={orderFormData.transportCost || ""}
            onChange={e => setOrderFormData({...orderFormData, transportCost: parseFloat(e.target.value) || 0})}
            className="w-full bg-transparent border-none text-[10px] font-black focus:ring-0 p-0 text-slate-900"
          />
        </div>
      </div>

      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha Esperada de Entrega</label>
        <input 
          type="date" 
          value={orderFormData.expectedDeliveryDate || ""}
          onChange={e => setOrderFormData({...orderFormData, expectedDeliveryDate: e.target.value})}
          className="w-full bg-transparent border-none text-[10px] font-black focus:ring-0 p-0 text-slate-900 uppercase"
        />
      </div>

      <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Productos</h4>
                  <button 
                    type="button"
                    onClick={() => setOrderFormData({...orderFormData, items: [...orderFormData.items, { productId: "", quantity: 1, cost: 0 }]})}
                    className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:bg-indigo-50 px-2 py-1 rounded-lg"
                  >
                    <Plus className="w-3 h-3" /> Añadir Fila
                  </button>
                </div>
                {orderFormData.items.map((item, idx) => {
                  const selectedProductInfo = products.find(p => p.id === item.productId);
                  const hasVariants = selectedProductInfo && ((selectedProductInfo.availableSizes && selectedProductInfo.availableSizes.length > 0) || (selectedProductInfo.availableColors && selectedProductInfo.availableColors.length > 0));
                  
                  return (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-6 flex flex-col gap-2">
                      <select required value={item.productId} onChange={e => {
                        const newItems = [...orderFormData.items];
                        newItems[idx].productId = e.target.value;
                        newItems[idx].variantLabel = undefined;
                        const p = products.find(prod => prod.id === e.target.value);
                        if (p) newItems[idx].cost = p.costPrice;
                        setOrderFormData({...orderFormData, items: newItems});
                      }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none">
                        <option value="">Seleccionar Producto</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      
                      {hasVariants && (
                        <select 
                          required
                          value={item.variantLabel || ""} 
                          onChange={e => {
                            const newItems = [...orderFormData.items];
                            newItems[idx].variantLabel = e.target.value;
                            setOrderFormData({...orderFormData, items: newItems});
                          }} 
                          className="w-full px-3 py-2 bg-slate-50 border border-indigo-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">Seleccionar Variante</option>
                          {selectedProductInfo.availableSizes?.map(s => <option key={`size-${s}`} value={s}>Talla: {s}</option>)}
                          {selectedProductInfo.availableColors?.map(c => <option key={`color-${c}`} value={c}>Color: {c}</option>)}
                        </select>
                      )}
                    </div>
                    <div className="col-span-2">
                      <input type="number" min="1" placeholder="Cant" required value={item.quantity || ""} onChange={e => {
                        const newItems = [...orderFormData.items];
                        newItems[idx].quantity = parseInt(e.target.value) || 0;
                        setOrderFormData({...orderFormData, items: newItems});
                      }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" />
                    </div>
                    <div className="col-span-3">
                      <input type="number" step="0.01" placeholder="Costo" required value={item.cost || ""} onChange={e => {
                        const newItems = [...orderFormData.items];
                        newItems[idx].cost = parseFloat(e.target.value) || 0;
                        setOrderFormData({...orderFormData, items: newItems});
                      }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" />
                    </div>
                    <div className="col-span-1">
                      <button 
                        type="button"
                        onClick={() => setOrderFormData({...orderFormData, items: orderFormData.items.filter((_, i) => i !== idx)})}
                        className="w-full h-[38px] flex items-center justify-center bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Estimado</div>
                <div className="text-xl font-black text-slate-900">CUP {orderFormData.items.reduce((sum, i) => sum + (i.quantity * i.cost), 0).toLocaleString()}</div>
              </div>

              <button type="submit" className="w-full py-3.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                {editingOrder ? 'Guardar Cambios' : 'Crear Orden de Compra'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
