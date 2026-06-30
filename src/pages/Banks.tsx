import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { generateId } from '../lib/utils';
import { CreditCard, Plus, ArrowUpRight, ArrowDownRight, DollarSign, Search, List, Activity } from 'lucide-react';
import { BankCard, BankTransaction } from '../types';

export default function Banks() {
  const { bankCards, bankTransactions, addBankCard, updateBankCard, deleteBankCard, getBaseCurrency } = useStore();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCard, setEditingCard] = useState<BankCard | null>(null);
  const [formData, setFormData] = useState<Partial<BankCard>>({
    name: "",
    bank: "",
    lastFour: "",
    balance: 0,
    currency: getBaseCurrency().code,
    isActive: true
  });

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCard) {
      updateBankCard(editingCard.id, formData);
    } else {
      addBankCard({
        id: generateId('CRD'),
        ...(formData as BankCard)
      });
    }
    setShowAddModal(false);
    setEditingCard(null);
    setFormData({ name: "", bank: "", lastFour: "", balance: 0, currency: getBaseCurrency().code, isActive: true });
  };

  const filteredTransactions = bankTransactions.filter(t => selectedCardId ? t.cardId === selectedCardId : true).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Cuentas Bancarias</h1>
          <p className="text-sm font-bold text-slate-400">Gestiona tus tarjetas y cuentas para transferencias</p>
        </div>
        <button
          onClick={() => { setEditingCard(null); setFormData({ name: "", bank: "", lastFour: "", balance: 0, currency: getBaseCurrency().code, isActive: true }); setShowAddModal(true); }}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2"
        >
          <Plus size={16} /> Nueva Cuenta
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bankCards.map(card => (
          <div key={card.id} onClick={() => setSelectedCardId(card.id)} className={`relative overflow-hidden rounded-2xl p-6 cursor-pointer transition-all duration-300 ${selectedCardId === card.id ? 'ring-4 ring-indigo-500 shadow-2xl scale-[1.02]' : 'hover:shadow-xl hover:-translate-y-1'} bg-gradient-to-br from-slate-800 to-slate-900 text-white`}>
             {/* Background Pattern */}
             <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-5"></div>
             <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-white opacity-5"></div>
             
             <div className="flex justify-between items-start mb-8 relative z-10">
               <div>
                 <h3 className="text-xs font-black uppercase tracking-widest opacity-80">{card.bank}</h3>
               </div>
               <div className="flex gap-2">
                 <button onClick={(e) => { e.stopPropagation(); setEditingCard(card); setFormData(card); setShowAddModal(true); }} className="text-white opacity-50 hover:opacity-100 transition-opacity text-xs font-bold uppercase tracking-widest">Editar</button>
               </div>
             </div>
             
             <div className="mb-8 relative z-10">
               <div className="w-10 h-8 bg-gradient-to-br from-yellow-200 to-yellow-500 rounded-md mb-4 opacity-90 shadow-sm relative overflow-hidden">
                  <div className="absolute inset-0 bg-black opacity-10 flex items-center justify-center">
                     <div className="w-full h-[1px] bg-black"></div>
                     <div className="w-[1px] h-full bg-black absolute"></div>
                  </div>
               </div>
               <p className="font-mono text-xl tracking-[0.2em] opacity-90 text-slate-100 drop-shadow-md">
                 •••• •••• •••• {card.lastFour || 'XXXX'}
               </p>
             </div>
             
             <div className="flex justify-between items-end relative z-10">
               <div>
                 <p className="text-[8px] font-black uppercase tracking-widest opacity-50 mb-1">Titular / Nombre</p>
                 <p className="text-sm font-bold tracking-widest uppercase truncate max-w-[150px]">{card.name}</p>
               </div>
               <div className="text-right">
                 <p className="text-[8px] font-black uppercase tracking-widest opacity-50 mb-1">Saldo Disponible</p>
                 <p className="text-lg font-black">{card.currency} ${card.balance.toLocaleString()}</p>
               </div>
             </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center">
              <Activity size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 uppercase tracking-tight">Historial de Movimientos</h3>
              <p className="text-xs font-bold text-slate-400">{selectedCardId ? 'Filtrado por cuenta' : 'Todas las cuentas'}</p>
            </div>
          </div>
          {selectedCardId && (
            <button onClick={() => setSelectedCardId(null)} className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-xl">
              Ver Todas
            </button>
          )}
        </div>
        
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <List size={32} />
            </div>
            <h4 className="text-lg font-black text-slate-900 mb-2">No hay movimientos</h4>
            <p className="text-sm font-bold text-slate-400">Las transferencias y pagos aparecerán aquí</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cuenta</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map(t => {
                  const card = bankCards.find(c => c.id === t.cardId);
                  const isIncome = t.type === 'deposit' || t.type === 'payment_received';
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 text-sm font-bold text-slate-600">{new Date(t.date).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm font-black text-slate-900">{card?.name || 'Desconocida'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {isIncome ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                          {t.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-500">{t.description}</td>
                      <td className={`px-6 py-4 text-sm font-black text-right ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isIncome ? '+' : '-'}${t.amount.toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">{editingCard ? 'Editar Cuenta' : 'Nueva Cuenta'}</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nombre de la Cuenta / Tarjeta</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                  placeholder="Ej: Cuenta BHD Principal"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Banco</label>
                <input 
                  type="text" 
                  required
                  value={formData.bank}
                  onChange={e => setFormData({...formData, bank: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                  placeholder="Ej: Banco BHD"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Últimos 4 Dígitos</label>
                  <input 
                    type="text"
                    maxLength={4}
                    value={formData.lastFour}
                    onChange={e => setFormData({...formData, lastFour: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                    placeholder="Ej: 4567"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Saldo Inicial</label>
                  <input 
                    type="number"
                    min="0"
                    required
                    value={formData.balance}
                    onChange={e => setFormData({...formData, balance: parseFloat(e.target.value) || 0})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-slate-50 text-slate-600 font-black rounded-2xl hover:bg-slate-100 uppercase text-xs tracking-widest">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 uppercase text-xs tracking-widest">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
