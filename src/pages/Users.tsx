import React, { useState } from "react";
import { Shield, UserPlus, DollarSign, X, Eye, Calculator, Package, Clock, MapPin } from "lucide-react";
import { useStore } from "../store/useStore";
import { User, CashRegisterSession, Transaction } from "../types";
import { InfoTooltip } from "../components/InfoTooltip";
import { cn } from "../lib/utils";

export default function Users() {
  const { users, transactions, getBaseCurrency, addUser, cashSessions, branches, currencies, salarySettlements, updateSalarySettlement } = useStore();
  const baseCurrency = getBaseCurrency();
  const [showAddModal, setShowAddModal] = useState(false);
  const [auditingUser, setAuditingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState<Partial<User>>({
    name: "",
    email: "",
    password: "",
    role: "cashier",
    baseSalary: 0,
    commissionRate: 0,
    phone: "",
    branchId: ""
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const todayTransactions = transactions.filter(t => t.date.startsWith(todayStr) && t.status === 'completed');

  const formatMoney = (amount: number, code: string = baseCurrency.code) => {
    const symbol = currencies.find(c => c.code === code)?.symbol || baseCurrency.symbol;
    const formatted = amount.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${symbol} ${formatted}`;
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addUser({
      ...formData,
      id: `u-${Date.now()}`
    } as User);
    setShowAddModal(false);
    setFormData({ name: "", email: "", password: "", role: "cashier", baseSalary: 0, commissionRate: 0, phone: "", branchId: "" });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
            Empleados
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accesos y Comisiones</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95">
          <UserPlus className="w-4 h-4" />
          Añadir Empleado
        </button>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Empleado</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rol / Sucursal</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Salario (Día)</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ventas Hoy</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Comisión Hoy</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pago Total</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Auditoría</th>
              </tr>
            </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => {
              const userTx = todayTransactions.filter(t => t.userId === user.id);
              const totalVentas = userTx.reduce((sum, t) => sum + t.total, 0);
              
              // Calcular comisiones por producto
              const comision = userTx.reduce((sum, t) => {
                const txComission = t.items.reduce((itemSum, item) => {
                  const p = item.product;
                  if (p.commissionType === 'fixed') {
                    return itemSum + ((p.commissionValue || 0) * item.quantity);
                  } else {
                    return itemSum + ((p.price * ((p.commissionValue || 0) / 100)) * item.quantity);
                  }
                }, 0);
                return sum + txComission;
              }, 0);

              const pagoTotalHoy = (user.baseSalary || 0) + comision;

                return (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs uppercase">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <span className="text-xs font-black text-slate-900 uppercase tracking-tighter">{user.name}</span>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          "w-fit px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                          user.role === 'admin' ? "bg-slate-900 text-white" : "bg-blue-100 text-blue-700"
                        )}>
                          {user.role}
                        </span>
                        {user.branchId && (
                          <span className="text-[7px] font-black text-indigo-500 uppercase flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5" />
                            {branches.find(b => b.id === user.branchId)?.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-900 text-xs">{formatMoney(user.baseSalary || 0)}</td>
                    <td className="px-6 py-4 font-black text-slate-900 text-xs">{formatMoney(totalVentas)}</td>
                    <td className="px-6 py-4 font-black text-emerald-600 text-xs">{formatMoney(comision)}</td>
                    <td className="px-6 py-4 font-black text-indigo-600 text-xs">{formatMoney(pagoTotalHoy)}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setAuditingUser(user)}
                        className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-slate-100 shadow-sm"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {auditingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 border border-white/20 flex flex-col max-h-[90vh]">
            <div className="p-6 bg-indigo-600 text-white flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Reportes de {auditingUser.name}</h3>
                  <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-tight">Auditoría de turnos y ventas</p>
                </div>
              </div>
              <button onClick={() => setAuditingUser(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {/* Nueva sección: Historial de Pagos de Salario */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <DollarSign className="w-4 h-4 text-indigo-500" />
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Historial de Liquidaciones</h4>
                </div>
                
                {salarySettlements.filter(s => s.userId === auditingUser.id).length === 0 ? (
                  <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No hay liquidaciones registradas</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {salarySettlements
                      .filter(s => s.userId === auditingUser.id)
                      .map(settlement => (
                        <div key={settlement.id} className="bg-white border border-slate-100 rounded-2xl p-3 flex items-center justify-between hover:border-indigo-100 transition-colors group">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => updateSalarySettlement(settlement.id, { status: settlement.status === 'paid' ? 'cancelled' : 'paid' })}
                              className={cn(
                                "w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105",
                                settlement.status === 'paid' ? "bg-emerald-50 text-emerald-600" : 
                                settlement.status === 'cancelled' ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                              )}
                              title={settlement.status === 'paid' ? 'Marcar como Cancelado' : 'Marcar como Pagado'}
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                            <div>
                              <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">
                                {formatMoney(settlement.total)}
                              </p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase">
                                {new Date(settlement.date).toLocaleDateString()} • {settlement.status === 'paid' ? 'Pagado' : settlement.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Sueldo + Comis</p>
                            <p className="text-[9px] font-bold text-slate-500">
                              {formatMoney(settlement.baseSalary)} + {formatMoney(settlement.commissions)}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="h-px bg-slate-100 mx-1" />

              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Historial de Turnos</h4>
                </div>
              {cashSessions.filter(s => s.userId === auditingUser.id).length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No se encontraron turnos registrados</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cashSessions
                    .filter(s => s.userId === auditingUser.id)
                    .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())
                    .map(session => {
                      const sessionTxs = transactions.filter(t => 
                        t.userId === auditingUser.id && 
                        t.branchId === session.branchId &&
                        new Date(t.date) >= new Date(session.openedAt) &&
                        (!session.closedAt || new Date(t.date) <= new Date(session.closedAt))
                      );

                      return (
                        <div key={session.id} className="border border-slate-100 rounded-2xl overflow-hidden">
                          <div className="bg-slate-50 p-4 flex justify-between items-center">
                            <div>
                              <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">Turno #{session.id.slice(-6)}</p>
                              <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase">
                                <MapPin className="w-3 h-3" />
                                {branches.find(b => b.id === session.branchId)?.name}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest",
                                session.status === 'open' ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                              )}>
                                {session.status === 'open' ? 'En Curso' : 'Cerrado'}
                              </span>
                              <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">
                                {new Date(session.openedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-indigo-50/30 p-2 rounded-xl">
                                <p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">Total Ventas</p>
                                <p className="text-xs font-black text-indigo-600">{formatMoney(sessionTxs.reduce((s,t)=>s+t.total,0))}</p>
                              </div>
                              <div className="bg-emerald-50/30 p-2 rounded-xl">
                                <p className="text-[7px] font-black text-emerald-400 uppercase tracking-widest">Fondo Inicial</p>
                                <p className="text-xs font-black text-emerald-600">{formatMoney(session.openingBalance)}</p>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Transacciones ({sessionTxs.length})</p>
                              {sessionTxs.map(tx => (
                                <div key={tx.id} className="text-[9px] border-l-2 border-indigo-100 pl-3 py-1">
                                  <div className="flex justify-between">
                                    <span className="font-black text-slate-700 uppercase">Ticket {tx.id.slice(-6)}</span>
                                    <span className="font-bold text-indigo-600">{formatMoney(tx.total)}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {tx.items.map((it, idx) => (
                                      <span key={idx} className="text-[7px] bg-slate-50 text-slate-400 px-1 rounded">{it.quantity}x {it.product?.name || (typeof (it.product as any) === 'string' ? useStore.getState().products.find(p => p.id === (it.product as any))?.name || it.product : 'Desconocido')}</span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">Nuevo Empleado</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email / Usuario</label>
                  <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                <input type="text" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                  <select required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as 'admin'|'cashier'})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="cashier">Cajero / Vendedor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sucursal Asignada</label>
                  <select required value={formData.branchId} onChange={e => setFormData({...formData, branchId: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">Cualquier Sucursal</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Salario Base (Día)</label>
                <input type="number" required value={formData.baseSalary} onChange={e => setFormData({...formData, baseSalary: parseFloat(e.target.value)})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>

              <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">Las comisiones por venta se configuran individualmente en cada producto (Inventario {'>'} Nuevo Producto).</p>

              <button type="submit" className="w-full mt-6 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors">
                Guardar Empleado
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
