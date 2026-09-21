import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { generateId, cn } from '../lib/utils';
import { CreditCard, Plus, ArrowUpRight, ArrowDownRight, DollarSign, Search, List, Activity, HelpCircle } from 'lucide-react';
import { BankCard, BankTransaction } from '../types';
import { InfoTooltip } from '../components/InfoTooltip';

export default function Banks() {
  const { bankCards, bankTransactions, addBankCard, updateBankCard, deleteBankCard, getBaseCurrency, addBankTransaction } = useStore();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editingCard, setEditingCard] = useState<BankCard | null>(null);
  const [formData, setFormData] = useState<Partial<BankCard>>({
    name: "",
    bank: "BPA",
    accountNumber: "",
    phone: "",
    lastFour: "",
    balance: 0,
    currency: getBaseCurrency().code,
    isActive: true
  });

  const [transferData, setTransferData] = useState({
    fromCardId: "",
    toCardId: "",
    toExternalCard: "",
    toExternalName: "",
    isExternal: false,
    amount: 0,
    reason: ""
  });

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAccount = (formData.accountNumber || '').replace(/\s/g, '');
    const derivedLastFour = cleanAccount.length >= 4 ? cleanAccount.slice(-4) : (formData.lastFour || '');

    const cardPayload: Partial<BankCard> = {
      ...formData,
      accountNumber: cleanAccount,
      lastFour: derivedLastFour
    };

    if (editingCard) {
      updateBankCard(editingCard.id, cardPayload);
    } else {
      addBankCard({
        id: generateId('CRD'),
        ...(cardPayload as BankCard)
      });
    }
    setShowAddModal(false);
    setEditingCard(null);
    setFormData({ name: "", bank: "BPA", accountNumber: "", phone: "", lastFour: "", balance: 0, currency: getBaseCurrency().code, isActive: true });
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const fromCard = bankCards.find(c => c.id === transferData.fromCardId);
    
    if (!fromCard || transferData.amount <= 0) return;

    const date = new Date().toISOString();
    const ref = generateId('TRF');

    if (transferData.isExternal) {
      // Transfer to external card
      addBankTransaction({
        id: generateId('BTX'),
        cardId: fromCard.id,
        type: 'withdrawal',
        amount: transferData.amount,
        date,
        reference: ref,
        description: `Transferencia Externa a ${transferData.toExternalName} (${transferData.toExternalCard}): ${transferData.reason}`
      });
    } else {
      // Transfer between internal cards
      const toCard = bankCards.find(c => c.id === transferData.toCardId);
      if (!toCard) return;

      // Withdrawal from source
      addBankTransaction({
        id: generateId('BTX'),
        cardId: fromCard.id,
        type: 'withdrawal',
        amount: transferData.amount,
        date,
        reference: ref,
        description: `Transferencia a ${toCard.bank} (****${toCard.lastFour}): ${transferData.reason}`
      });

      // Deposit to target
      let targetAmount = transferData.amount;
      if (fromCard.currency !== toCard.currency) {
        const currencies = useStore.getState().currencies;
        const fromRate = currencies.find(c => c.code === fromCard.currency)?.rateToBase || 1;
        const toRate = currencies.find(c => c.code === toCard.currency)?.rateToBase || 1;
        targetAmount = (transferData.amount * fromRate) / toRate;
      }

      addBankTransaction({
        id: generateId('BTX'),
        cardId: toCard.id,
        type: 'deposit',
        amount: targetAmount,
        date,
        reference: ref,
        description: `Transferencia desde ${fromCard.bank} (****${fromCard.lastFour}): ${transferData.reason}`
      });
    }

    setShowTransferModal(false);
    setTransferData({ fromCardId: "", toCardId: "", toExternalCard: "", toExternalName: "", isExternal: false, amount: 0, reason: "" });
  };

  const filteredTransactions = bankTransactions.filter(t => selectedCardId ? t.cardId === selectedCardId : true).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Cuentas Bancarias</h1>
          <InfoTooltip text="Gestiona tus cuentas bancarias y tarjetas. Aquí puedes registrar depósitos, retiros y transferencias entre cuentas para mantener tu saldo actualizado." position="bottom" />
        </div>
        <button
          onClick={() => { setEditingCard(null); setFormData({ name: "", bank: "", lastFour: "", balance: 0, currency: getBaseCurrency().code, isActive: true }); setShowAddModal(true); }}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2"
        >
          <Plus size={16} /> Nueva Cuenta
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {bankCards.map(card => (
          <div key={card.id} onClick={() => setSelectedCardId(card.id)} className={`relative overflow-hidden rounded-2xl p-4 cursor-pointer transition-all duration-300 ${selectedCardId === card.id ? 'ring-4 ring-indigo-500 shadow-2xl scale-[1.02]' : 'hover:shadow-xl hover:-translate-y-1'} bg-gradient-to-br from-slate-800 to-slate-900 text-white`}>
             {/* Background Pattern */}
             <div className="absolute top-0 right-0 -mr-4 -mt-4 w-20 h-20 rounded-full bg-white opacity-5"></div>
             
             <div className="flex justify-between items-start mb-4 relative z-10">
               <div>
                 <h3 className="text-[10px] font-black uppercase tracking-widest opacity-80">{card.bank}</h3>
               </div>
               <div className="flex gap-2">
                 <button onClick={(e) => { e.stopPropagation(); setEditingCard(card); setFormData(card); setShowAddModal(true); }} className="text-white opacity-40 hover:opacity-100 transition-opacity text-[8px] font-black uppercase tracking-widest">Editar</button>
                 <button onClick={(e) => { e.stopPropagation(); setTransferData({...transferData, fromCardId: card.id}); setShowTransferModal(true); }} className="text-emerald-400 hover:text-emerald-300 transition-colors text-[8px] font-black uppercase tracking-widest">Transferir</button>
               </div>
             </div>
             
             <div className="mb-4 relative z-10">
               <div className="w-8 h-6 bg-gradient-to-br from-yellow-200 to-yellow-500 rounded-sm mb-3 opacity-90 shadow-sm"></div>
               <p className="font-mono text-sm tracking-[0.15em] opacity-90 text-slate-100">
                 •••• {card.lastFour || 'XXXX'}
               </p>
             </div>
             
             <div className="flex justify-between items-end relative z-10">
               <div className="min-w-0">
                 <p className="text-[7px] font-black uppercase tracking-widest opacity-50 mb-0.5">Nombre {card.phone ? `• Tel: ${card.phone}` : ''}</p>
                 <p className="text-[10px] font-bold tracking-widest uppercase truncate">{card.name}</p>
               </div>
               <div className="text-right">
                 <p className="text-[7px] font-black uppercase tracking-widest opacity-50 mb-0.5">Saldo</p>
                 <p className="text-sm font-black">{card.balance.toLocaleString()} {card.currency}</p>
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
                      <td className="px-6 py-4 text-sm font-black text-slate-900">{card?.name || card?.bankName || card?.bank || 'Desconocida'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {isIncome ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                          {(t.type || '').replace('_', ' ')}
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
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nombre o Titular de la Cuenta</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                  placeholder="Ej: Titular / Negocio Principal"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Banco Emisor (Cuba)</label>
                  <select
                    value={formData.bank}
                    onChange={e => setFormData({...formData, bank: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                  >
                    <option value="BPA">BPA (Banco Popular de Ahorro)</option>
                    <option value="BANDEC">BANDEC (Banco de Crédito y Comercio)</option>
                    <option value="Banco Metropolitano">Banco Metropolitano (Banmet)</option>
                    <option value="EnZona">EnZona / BFI</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Teléfono de Confirmación</label>
                  <input 
                    type="text" 
                    placeholder="Ej: 5355555555"
                    value={formData.phone || ''}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                  />
                  <p className="text-[8px] text-slate-400 mt-1">Requerido para autollenado en Transfermóvil</p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Número de Tarjeta / Cuenta (16 dígitos)</label>
                <input 
                  type="text" 
                  maxLength={19}
                  placeholder="9202 xxxx xxxx xxxx"
                  value={formData.accountNumber || ''}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
                    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
                    setFormData({
                      ...formData,
                      accountNumber: formatted,
                      lastFour: raw.slice(-4)
                    });
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono font-bold tracking-wider"
                />
                <p className="text-[8px] text-slate-400 mt-1">Número de tarjeta o cuenta para recibir transferencias (Transfermóvil / EnZona)</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Moneda</label>
                  <select 
                    required
                    value={formData.currency}
                    onChange={e => setFormData({...formData, currency: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                  >
                    <option value="CUP">CUP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
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
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Transferir entre Cuentas</h2>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            
            <form onSubmit={handleTransfer} className="p-6 space-y-4">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTransferData({...transferData, isExternal: false})}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                    !transferData.isExternal ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Interna
                </button>
                <button
                  type="button"
                  onClick={() => setTransferData({...transferData, isExternal: true})}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                    transferData.isExternal ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Externa
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Desde Cuenta</label>
                <select 
                  required
                  value={transferData.fromCardId}
                  onChange={e => setTransferData({...transferData, fromCardId: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                >
                  <option value="">Seleccionar cuenta origen</option>
                  {bankCards.map(c => (
                    <option key={c.id} value={c.id}>{c.bank} - ****{c.lastFour} ({c.balance.toLocaleString()} {c.currency})</option>
                  ))}
                </select>
              </div>

              {!transferData.isExternal ? (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Hacia Cuenta</label>
                  <select 
                    required
                    value={transferData.toCardId}
                    onChange={e => setTransferData({...transferData, toCardId: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                  >
                    <option value="">Seleccionar cuenta destino</option>
                    {bankCards.filter(c => c.id !== transferData.fromCardId).map(c => (
                      <option key={c.id} value={c.id}>{c.bank} - ****{c.lastFour} ({c.currency})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Número de Tarjeta Destino</label>
                    <input 
                      type="text"
                      required
                      value={transferData.toExternalCard}
                      onChange={e => setTransferData({...transferData, toExternalCard: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                      placeholder="XXXX XXXX XXXX XXXX"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nombre del Destinatario</label>
                    <input 
                      type="text"
                      required
                      value={transferData.toExternalName}
                      onChange={e => setTransferData({...transferData, toExternalName: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                      placeholder="Ej: Juan Pérez"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Monto a Transferir</label>
                <input 
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={transferData.amount || ''}
                  onChange={e => setTransferData({...transferData, amount: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Motivo / Descripción</label>
                <select
                  required
                  value={transferData.reason}
                  onChange={e => setTransferData({...transferData, reason: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                >
                  <option value="">Seleccionar motivo</option>
                  <option value="Remesa">Remesa</option>
                  <option value="Pago de Servicios">Pago de Servicios</option>
                  <option value="Transferencia Familiar">Transferencia Familiar</option>
                  <option value="Otro">Otro</option>
                </select>
                {transferData.reason === 'Otro' && (
                  <input 
                    type="text"
                    required
                    className="mt-2 w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                    placeholder="Especificar motivo"
                    onChange={e => setTransferData({...transferData, reason: e.target.value})}
                  />
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowTransferModal(false)} className="flex-1 py-3 bg-slate-50 text-slate-600 font-black rounded-2xl hover:bg-slate-100 uppercase text-xs tracking-widest">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 uppercase text-xs tracking-widest">
                  Confirmar Transferencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
