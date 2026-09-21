import React, { useState } from "react";
import { Users, Search, Plus, Star, Phone, Mail, Edit, Trash2, History, X, Package, Clock, DollarSign, ShoppingBag, HelpCircle } from "lucide-react";
import { useStore } from "../store/useStore";
import { Customer, Transaction } from "../types";
import { cn } from "../lib/utils";
import { InfoTooltip } from "../components/InfoTooltip";

export default function Customers() {
  const { customers, addCustomer, updateCustomer, deleteCustomer, transactions, getBaseCurrency } = useStore();
  const baseCurrency = getBaseCurrency();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", email: "", phone: "", taxId: "" });

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery)
  );

  const getCustomerTransactions = (customerId: string) => {
    return transactions.filter(t => t.customerId === customerId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const formatMoney = (amount: number) => {
    return `${baseCurrency.symbol} ${amount.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      updateCustomer(editingCustomer.id, {
        name: newCustomer.name,
        email: newCustomer.email,
        phone: newCustomer.phone,
        taxId: newCustomer.taxId
      });
    } else {
      addCustomer({
        id: crypto.randomUUID(),
        name: newCustomer.name,
        email: newCustomer.email,
        phone: newCustomer.phone,
        taxId: newCustomer.taxId
      });
    }
    setShowAddModal(false);
    setEditingCustomer(null);
    setNewCustomer({ name: "", email: "", phone: "", taxId: "" });
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 lg:h-full flex flex-col pb-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Directorio de Clientes</h2>
          <InfoTooltip text="Gestiona tu base de datos de clientes. Registra sus datos para facturación, seguimiento de ventas y programas de fidelidad." position="bottom" />
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
        >
          <Plus className="w-3 h-3" />
          Nuevo Cliente
        </button>
      </header>

      <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Buscar por nombre, correo o teléfono..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none transition-all text-xs font-medium"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex-1 flex flex-col min-h-[400px]">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Contacto</th>
                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredCustomers.map(customer => (
                <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black">
                        {customer.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-[11px] font-black text-slate-900 uppercase tracking-tighter">{customer.name}</div>
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ID: {customer.id.slice(-6)}</div>
                        {customer.taxId && <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">CI/Pasaporte: {customer.taxId}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-[10px] font-medium text-slate-600">
                        <Mail className="w-3 h-3 text-slate-300" />
                        {customer.email || 'N/A'}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-medium text-slate-600">
                        <Phone className="w-3 h-3 text-slate-300" />
                        {customer.phone || 'N/A'}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={() => setViewingHistory(customer)}
                        className="text-slate-500 hover:text-emerald-600 transition-colors p-1.5 hover:bg-emerald-50 rounded-lg border border-slate-100 shadow-sm"
                        title="Ver Historial"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingCustomer(customer);
                          setNewCustomer({ name: customer.name, email: customer.email || "", phone: customer.phone || "", taxId: customer.taxId || "" });
                          setShowAddModal(true);
                        }}
                        className="text-slate-500 hover:text-indigo-600 transition-colors p-1.5 hover:bg-indigo-50 rounded-lg border border-slate-100 shadow-sm"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => window.confirm("¿Eliminar cliente?") && deleteCustomer(customer.id)}
                        className="text-slate-500 hover:text-rose-600 transition-colors p-1.5 hover:bg-rose-50 rounded-lg border border-slate-100 shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* History Sidebar/Modal */}
      {viewingHistory && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50 flex justify-end animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">Historial de Compras</h3>
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{viewingHistory.name}</p>
              </div>
              <button onClick={() => setViewingHistory(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {getCustomerTransactions(viewingHistory.id).length > 0 ? (
                getCustomerTransactions(viewingHistory.id).map(tx => (
                  <div key={tx.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-indigo-100 transition-colors">
                    <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-50">
                      <div>
                        <div className="text-[10px] font-black text-slate-900 uppercase">#{tx.id.slice(-8)}</div>
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(tx.date).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-black text-emerald-600">{formatMoney(tx.total)}</div>
                        <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{tx.payments.map(p => p.method).join(' / ')}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {tx.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Package className="w-3 h-3 text-slate-300" />
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{item.quantity}x {item.product.name}</span>
                          </div>
                          <span className="text-[9px] font-bold text-slate-400">{formatMoney(item.product.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                  <ShoppingBag className="w-12 h-12 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Sin transacciones registradas</p>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Acumulado</span>
                <span className="text-base font-black text-slate-900">
                  {formatMoney(getCustomerTransactions(viewingHistory.id).reduce((sum, t) => sum + t.total, 0))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Frecuencia</span>
                <span className="text-[10px] font-black text-indigo-600 uppercase">
                  {getCustomerTransactions(viewingHistory.id).length} Visitas
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Agregar Cliente (Compact) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 border border-white/20">
            <div className="p-6">
              <h3 className="text-sm font-black text-slate-900 mb-4 uppercase tracking-widest">{editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}</h3>
              <form onSubmit={handleAddCustomer} className="space-y-3">
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre Completo *</label>
                  <input 
                    required
                    type="text" 
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">CI o Pasaporte</label>
                  <input 
                    type="text" 
                    value={newCustomer.taxId}
                    onChange={(e) => setNewCustomer({...newCustomer, taxId: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Correo Electrónico (Opcional)</label>
                  <input 
                    type="email" 
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Teléfono</label>
                  <input 
                    type="tel" 
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none text-xs font-bold"
                  />
                </div>
                <div className="flex gap-2 mt-6">
                  <button 
                    type="button" 
                    onClick={() => { setShowAddModal(false); setEditingCustomer(null); setNewCustomer({ name: "", email: "", phone: "", taxId: "" }); }}
                    className="flex-1 py-3 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    Guardar
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
