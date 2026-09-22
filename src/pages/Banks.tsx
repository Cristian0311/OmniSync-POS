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
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-black text-primary tracking-tight uppercase">Cuentas Bancarias</h1>
          <InfoTooltip text="Gestiona tus cuentas bancarias y tarjetas. Aquí puedes registrar depósitos, retiros y transferencias entre cuentas para mantener tu saldo actualizado." position="bottom" />
        </div>
        <button
          onClick={() => { setEditingCard(null); setFormData({ name: "", bank: "BPA", lastFour: "", balance: 0, currency: getBaseCurrency().code, isActive: true }); setShowAddModal(true); }}
          className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md active:scale-95 flex items-center gap-1.5"
        >
          <Plus size={13} /> Nueva Cuenta
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {bankCards.map(card => (
          <div key={card.id} onClick={() => setSelectedCardId(card.id)} className={`relative overflow-hidden rounded-xl p-2 sm:p-2.5 cursor-pointer transition-all duration-300 ${selectedCardId === card.id ? 'ring-2 ring-indigo-500 shadow-md scale-[1.01]' : 'hover:shadow-xs hover:-translate-y-0.5'} bg-gradient-to-br from-slate-800 to-slate-900 text-white min-h-[85px] flex flex-col justify-between`}>
             {/* Background Pattern */}
             <div className="absolute top-0 right-0 -mr-4 -mt-4 w-12 h-12 rounded-full bg-white opacity-5"></div>
             
             <div className="flex justify-between items-start mb-1 relative z-10">
               <div>
                 <h3 className="text-[7.5px] font-black uppercase tracking-wider opacity-80">{card.bank}</h3>
               </div>
               <div className="flex gap-1.5">
                 <button onClick={(e) => { e.stopPropagation(); setEditingCard(card); setFormData(card); setShowAddModal(true); }} className="text-white opacity-50 hover:opacity-100 transition-opacity text-[6.5px] font-black uppercase tracking-wider">Editar</button>
                 <button onClick={(e) => { e.stopPropagation(); setTransferData({...transferData, fromCardId: card.id}); setShowTransferModal(true); }} className="text-emerald-400 hover:text-emerald-300 transition-colors text-[6.5px] font-black uppercase tracking-wider">Transferir</button>
               </div>
             </div>
             
             <div className="mb-1 relative z-10 flex items-center justify-between">
               <div className="w-4 h-3 bg-gradient-to-br from-amber-300 to-amber-500 rounded-xs opacity-90 shadow-xs"></div>
               <p className="font-mono text-[10px] sm:text-[11px] tracking-wider opacity-90 text-slate-100">
                 •••• {card.lastFour || 'XXXX'}
               </p>
             </div>
             
             <div className="flex justify-between items-end relative z-10">
               <div className="min-w-0">
                 <p className="text-[6px] font-black uppercase tracking-widest opacity-50 truncate">{card.name}</p>
                 <p className="text-[7.5px] font-bold tracking-tight uppercase truncate">{card.currency}</p>
               </div>
               <div className="text-right">
                 <p className="text-[10px] sm:text-[11px] font-black leading-none">{card.balance.toLocaleString()}</p>
               </div>
             </div>
          </div>
        ))}

        <button
          onClick={() => { setEditingCard(null); setFormData({ name: "", bank: "BPA", lastFour: "", balance: 0, currency: getBaseCurrency().code, isActive: true }); setShowAddModal(true); }}
          className="rounded-xl p-2 sm:p-2.5 border-2 border-dashed border-base hover:border-indigo-500 bg-secondary/60 hover:bg-subtle flex flex-col items-center justify-center gap-1 transition-all group min-h-[85px] cursor-pointer"
        >
          <div className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Plus size={12} />
          </div>
          <span className="text-[7.5px] font-black text-primary uppercase tracking-wider">Agregar Cuenta</span>
        </button>
      </div>

      <div className="bg-secondary rounded-xl border border-base overflow-hidden">
        <div className="p-2.5 sm:p-3 border-b border-base flex justify-between items-center bg-secondary">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-secondary border border-base text-primary rounded-lg flex items-center justify-center">
              <Activity size={12} />
            </div>
            <div>
              <h3 className="text-xs font-black text-primary uppercase tracking-tight">Movimientos</h3>
              <p className="text-[7.5px] font-bold text-muted uppercase">{selectedCardId ? 'Filtrado' : 'Global'}</p>
            </div>
          </div>
          {selectedCardId && (
            <button onClick={() => setSelectedCardId(null)} className="text-[7.5px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">
              Ver Todas
            </button>
          )}
        </div>
        
        {filteredTransactions.length === 0 ? (
          <div className="p-6 text-center">
            <div className="w-10 h-10 bg-secondary border border-base rounded-full flex items-center justify-center mx-auto mb-2 text-muted">
              <List size={18} />
            </div>
            <h4 className="text-xs font-black text-primary mb-0.5">No hay movimientos</h4>
            <p className="text-[10px] font-bold text-muted">Las transferencias y pagos aparecerán aquí</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary border-b border-base">
                <tr>
                  <th className="px-2.5 py-1.5 text-left text-[7.5px] sm:text-[8px] font-black text-muted uppercase tracking-wider">Fecha</th>
                  <th className="px-2.5 py-1.5 text-left text-[7.5px] sm:text-[8px] font-black text-muted uppercase tracking-wider">Cuenta</th>
                  <th className="px-2.5 py-1.5 text-left text-[7.5px] sm:text-[8px] font-black text-muted uppercase tracking-wider">Tipo</th>
                  <th className="px-2.5 py-1.5 text-left text-[7.5px] sm:text-[8px] font-black text-muted uppercase tracking-wider">Descripción</th>
                  <th className="px-2.5 py-1.5 text-right text-[7.5px] sm:text-[8px] font-black text-muted uppercase tracking-wider">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base">
                {filteredTransactions.map(t => {
                  const card = bankCards.find(c => c.id === t.cardId);
                  const isIncome = t.type === 'deposit' || t.type === 'payment_received';
                  return (
                    <tr key={t.id} className="hover:bg-subtle/50 transition-colors">
                      <td className="px-2.5 py-1.5 text-[9px] font-bold text-secondary">{new Date(t.date).toLocaleString()}</td>
                      <td className="px-2.5 py-1.5 text-[9px] font-black text-primary">{card?.name || card?.bankName || card?.bank || 'Desconocida'}</td>
                      <td className="px-2.5 py-1.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[7.5px] font-black uppercase tracking-wider ${isIncome ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400'}`}>
                          {isIncome ? <ArrowDownRight size={8} /> : <ArrowUpRight size={8} />}
                          {(t.type || '').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5 text-[9px] font-bold text-muted truncate max-w-[180px]">{t.description}</td>
                      <td className={`px-2.5 py-1.5 text-[9px] font-black text-right ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-secondary rounded-2xl w-full max-w-xs sm:max-w-sm overflow-hidden shadow-2xl border border-base animate-in zoom-in-95 duration-200">
            <div className="px-3.5 py-2.5 border-b border-base flex justify-between items-center bg-subtle">
              <h2 className="text-xs font-black text-primary uppercase tracking-tight">{editingCard ? 'Editar Cuenta' : 'Nueva Cuenta'}</h2>
              <button onClick={() => setShowAddModal(false)} className="text-muted hover:text-primary font-bold text-xs p-1">✕</button>
            </div>
            
            <form onSubmit={handleSave} className="p-3 space-y-2.5">
              <div>
                <label className="block text-[8px] font-black text-muted uppercase tracking-wider mb-1">Nombre o Titular</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-2.5 py-1.5 bg-primary border border-base rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-[11px] font-bold text-primary"
                  placeholder="Ej: Titular"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[8px] font-black text-muted uppercase tracking-wider mb-1">Banco</label>
                  <select
                    value={formData.bank}
                    onChange={e => setFormData({...formData, bank: e.target.value})}
                    className="w-full px-2.5 py-1.5 bg-primary border border-base rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-[11px] font-bold text-primary"
                  >
                    <option value="BPA">BPA</option>
                    <option value="BANDEC">BANDEC</option>
                    <option value="Banco Metropolitano">Banmet</option>
                    <option value="EnZona">EnZona</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[8px] font-black text-muted uppercase tracking-wider mb-1">Teléfono</label>
                  <input 
                    type="text" 
                    placeholder="Ej: 535..."
                    value={formData.phone || ''}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-2.5 py-1.5 bg-primary border border-base rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-[11px] font-bold text-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[8px] font-black text-muted uppercase tracking-wider mb-1">Número de Tarjeta (16 dígitos)</label>
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
                    });
                  }}
                  className="w-full px-2.5 py-1.5 bg-primary border border-base rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-[11px] font-bold font-mono text-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[8px] font-black text-muted uppercase tracking-wider mb-1">Saldo Inicial</label>
                  <input 
                    type="number" 
                    required
                    value={formData.balance}
                    onChange={e => setFormData({...formData, balance: Number(e.target.value)})}
                    className="w-full px-2.5 py-1.5 bg-primary border border-base rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-[11px] font-bold text-primary"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-muted uppercase tracking-wider mb-1">Moneda</label>
                  <select
                    value={formData.currency}
                    onChange={e => setFormData({...formData, currency: e.target.value})}
                    className="w-full px-2.5 py-1.5 bg-primary border border-base rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-[11px] font-bold text-primary"
                  >
                    {useStore.getState().currencies.map(c => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-1.5">
                <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-xl font-black text-[9px] uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 active:scale-98">
                  {editingCard ? 'Guardar Cambios' : 'Crear Cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-secondary rounded-2xl w-full max-w-xs sm:max-w-sm overflow-hidden shadow-2xl border border-base animate-in zoom-in-95 duration-200">
            <div className="px-3.5 py-2.5 border-b border-base flex justify-between items-center bg-subtle">
              <h2 className="text-xs font-black text-primary uppercase tracking-tight">Transferencia</h2>
              <button onClick={() => setShowTransferModal(false)} className="text-muted hover:text-primary font-bold text-xs p-1">✕</button>
            </div>
            
            <form onSubmit={handleTransfer} className="p-3 space-y-2.5">
              <div className="flex bg-subtle p-0.5 rounded-lg border border-base">
                <button
                  type="button"
                  onClick={() => setTransferData({...transferData, isExternal: false})}
                  className={cn(
                    "flex-1 py-1 text-[8px] font-black uppercase tracking-wider rounded transition-all",
                    !transferData.isExternal ? "bg-primary text-indigo-600 shadow-xs" : "text-muted hover:text-primary"
                  )}
                >
                  Interna
                </button>
                <button
                  type="button"
                  onClick={() => setTransferData({...transferData, isExternal: true})}
                  className={cn(
                    "flex-1 py-1 text-[8px] font-black uppercase tracking-wider rounded transition-all",
                    transferData.isExternal ? "bg-primary text-indigo-600 shadow-xs" : "text-muted hover:text-primary"
                  )}
                >
                  Externa
                </button>
              </div>

              <div>
                <label className="block text-[8px] font-black text-muted uppercase tracking-wider mb-1">Desde</label>
                <select 
                  required
                  value={transferData.fromCardId}
                  onChange={e => setTransferData({...transferData, fromCardId: e.target.value})}
                  className="w-full px-2.5 py-1.5 bg-primary border border-base rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-[11px] font-bold text-primary"
                >
                  <option value="">Seleccionar origen</option>
                  {bankCards.map(c => (
                    <option key={c.id} value={c.id}>{c.bank} - ****{c.lastFour} ({c.balance.toLocaleString()} {c.currency})</option>
                  ))}
                </select>
              </div>

              {!transferData.isExternal ? (
                <div>
                  <label className="block text-[8px] font-black text-muted uppercase tracking-wider mb-1">Hacia</label>
                  <select 
                    required
                    value={transferData.toCardId}
                    onChange={e => setTransferData({...transferData, toCardId: e.target.value})}
                    className="w-full px-2.5 py-1.5 bg-primary border border-base rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-[11px] font-bold text-primary"
                  >
                    <option value="">Seleccionar destino</option>
                    {bankCards.filter(c => c.id !== transferData.fromCardId).map(c => (
                      <option key={c.id} value={c.id}>{c.bank} - ****{c.lastFour} ({c.currency})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[8px] font-black text-muted uppercase tracking-wider mb-1">Tarjeta Destino</label>
                    <input 
                      type="text" 
                      required
                      value={transferData.toExternalCard}
                      onChange={e => setTransferData({...transferData, toExternalCard: e.target.value})}
                      className="w-full px-2.5 py-1.5 bg-primary border border-base rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-[11px] font-bold text-primary"
                      placeholder="9202 XXXX XXXX XXXX"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-muted uppercase tracking-wider mb-1">Nombre Destinatario</label>
                    <input 
                      type="text" 
                      required
                      value={transferData.toExternalName}
                      onChange={e => setTransferData({...transferData, toExternalName: e.target.value})}
                      className="w-full px-2.5 py-1.5 bg-primary border border-base rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-[11px] font-bold text-primary"
                      placeholder="Ej: Juan Pérez"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[8px] font-black text-muted uppercase tracking-wider mb-1">Monto</label>
                <input 
                  type="number" 
                  required
                  min="0.01"
                  step="0.01"
                  value={transferData.amount || ''}
                  onChange={e => setTransferData({...transferData, amount: parseFloat(e.target.value) || 0})}
                  className="w-full px-2.5 py-1.5 bg-primary border border-base rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-[11px] font-bold text-primary"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-[8px] font-black text-muted uppercase tracking-wider mb-1">Motivo</label>
                <input 
                  type="text" 
                  required
                  value={transferData.reason}
                  onChange={e => setTransferData({...transferData, reason: e.target.value})}
                  className="w-full px-2.5 py-1.5 bg-primary border border-base rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-[11px] font-bold text-primary"
                  placeholder="Ej: Reabastecimiento"
                />
              </div>

              <div className="pt-1.5">
                <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded-xl font-black text-[9px] uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20 active:scale-98">
                  Transferir Ahora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
