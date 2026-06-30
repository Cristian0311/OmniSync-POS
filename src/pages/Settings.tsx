import { useState } from "react";
import { Settings as SettingsIcon, Save, DollarSign, Building2, Users, Plus, Trash2, Edit, LayoutGrid, Store } from "lucide-react";
import { useStore } from "../store/useStore";
import { InfoTooltip } from "../components/InfoTooltip";
import { Branch, Category } from "../types";

export default function Settings() {
  const { 
    currencies, updateCurrencyRate, 
    storeConfig, updateStoreConfig, 
    branches, addBranch, updateBranch, deleteBranch,
    categories, addCategory, updateCategory, deleteCategory,
    receiptConfig, updateReceiptConfig
  } = useStore();

  const [rates, setRates] = useState<{ [code: string]: number }>(
    currencies.reduce((acc, c) => ({ ...acc, [c.code]: c.rateToBase }), {})
  );

  const [config, setConfig] = useState(storeConfig);
  const [ticketConfig, setTicketConfig] = useState(receiptConfig);
  const [newBranchName, setNewBranchName] = useState("");
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  const [newCategory, setNewCategory] = useState({ name: "", department: "" });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const handleSaveRates = () => {
    Object.entries(rates).forEach(([code, rate]) => {
      updateCurrencyRate(code, rate as number);
    });
    alert("Tasas de cambio actualizadas.");
  };

  const handleSaveConfig = () => {
    updateStoreConfig(config);
    alert("Datos actualizados.");
  };

  const handleSaveTicket = () => {
    updateReceiptConfig(ticketConfig);
    alert("Configuración de ticket guardada.");
  };

  const handleAddBranch = () => {
    if (newBranchName) {
      if (editingBranch) {
        updateBranch(editingBranch.id, { name: newBranchName });
        setEditingBranch(null);
      } else {
        addBranch({ id: `b${Date.now()}`, name: newBranchName });
      }
      setNewBranchName("");
    }
  };

  const handleAddCategory = () => {
    if (newCategory.name && newCategory.department) {
      if (editingCategory) {
        updateCategory(editingCategory.id, newCategory);
        setEditingCategory(null);
      } else {
        addCategory({ id: `c${Date.now()}`, ...newCategory });
      }
      setNewCategory({ name: "", department: "" });
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-5xl mx-auto pb-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
            <SettingsIcon className="w-5 h-5 text-indigo-600" />
            Configuración
          </h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ajustes del Sistema</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tasas de Cambio (Compact) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
            <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Tasas de Cambio</h3>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Referencia vs CUP</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {currencies.map(currency => (
              <div key={currency.code} className="flex items-center justify-between gap-4 bg-slate-50 p-2 rounded-xl border border-slate-100">
                <div className="flex-1">
                  <div className="text-[10px] font-black text-slate-900 uppercase">{currency.name}</div>
                  <div className="text-[8px] font-bold text-slate-400 uppercase">{currency.code}</div>
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    value={rates[currency.code] || ''}
                    disabled={currency.isBase}
                    onChange={(e) => setRates({ ...rates, [currency.code]: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-900 focus:ring-1 focus:ring-indigo-100 outline-none disabled:opacity-30"
                  />
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={handleSaveRates}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2"
          >
            <Save className="w-3 h-3" />
            Guardar Tasas
          </button>
        </div>

        {/* Categorías (Compact) - NEW */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
            <div className="bg-amber-50 p-2 rounded-lg text-amber-600">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Categorías</h3>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Clasificación de Inventario</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
              {categories.map(cat => (
                <div key={cat.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100 group">
                  <div>
                    <div className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{cat.name}</div>
                    <div className="text-[7px] font-bold text-slate-400 uppercase">{cat.department}</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingCategory(cat); setNewCategory({ name: cat.name, department: cat.department }); }} className="p-1 text-slate-300 hover:text-indigo-600 rounded-md transition-colors"><Edit className="w-3 h-3" /></button>
                    <button onClick={() => confirm("¿Eliminar?") && deleteCategory(cat.id)} className="p-1 text-slate-300 hover:text-rose-500 rounded-md transition-colors"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newCategory.name}
                  onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="Categoría"
                  className="flex-[2] px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-100" 
                />
                <input 
                  type="text" 
                  value={newCategory.department}
                  onChange={e => setNewCategory({ ...newCategory, department: e.target.value })}
                  placeholder="Dpto"
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-100" 
                />
                <button onClick={handleAddCategory} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 transition-all">
                  {editingCategory ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sucursales (Branches) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
            <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Sucursales</h3>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Gestión de Ubicaciones</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {branches.map(branch => (
                <div key={branch.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100 group">
                  <div className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{branch.name}</div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingBranch(branch); setNewBranchName(branch.name); }} className="p-1 text-slate-300 hover:text-indigo-600 rounded-md transition-colors"><Edit className="w-3 h-3" /></button>
                    {branches.length > 1 && (
                      <button onClick={() => confirm("¿Eliminar sucursal?") && deleteBranch(branch.id)} className="p-1 text-slate-300 hover:text-rose-500 rounded-md transition-colors"><Trash2 className="w-3 h-3" /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newBranchName}
                  onChange={e => setNewBranchName(e.target.value)}
                  placeholder="Nombre de Sucursal"
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-100" 
                />
                <button onClick={handleAddBranch} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 transition-all">
                  {editingBranch ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Configuración de Ticket / Recibo */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4 lg:col-span-3">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
            <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Configuración de Ticket</h3>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Personaliza lo que ve el cliente</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-1">Configuración Hardware</h4>
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-[10px] font-bold text-slate-600 uppercase group-hover:text-slate-900 transition-colors">Abrir Gaveta</span>
                  <div className="relative inline-flex items-center">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={ticketConfig.openDrawer ?? true}
                      onChange={e => setTicketConfig({...ticketConfig, openDrawer: e.target.checked})}
                    />
                    <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                  </div>
                </label>
                
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <span className="text-[10px] font-bold text-slate-600 uppercase group-hover:text-slate-900 transition-colors block">Impresión Nativa (WebSerial)</span>
                    <span className="text-[7px] text-slate-400 font-medium">Imprime en segundo plano sin ventana del navegador. Requiere Chrome/Edge.</span>
                  </div>
                  <div className="relative inline-flex items-center ml-2 shrink-0">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={ticketConfig.useWebSerial ?? false}
                      onChange={e => setTicketConfig({...ticketConfig, useWebSerial: e.target.checked})}
                    />
                    <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                  </div>
                </label>
                {ticketConfig.useWebSerial && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const { connectPrinter } = await import('../lib/escpos');
                        await connectPrinter();
                        alert('Impresora conectada correctamente.');
                      } catch (error: any) {
                        alert(error.message);
                      }
                    }}
                    className="w-full py-2 bg-indigo-50 text-indigo-700 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors"
                  >
                    Vincular Impresora USB
                  </button>
                )}

                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Tamaño Papel (Térmica)</label>
                  <select 
                    value={ticketConfig.printerWidth || '80mm'}
                    onChange={e => setTicketConfig({...ticketConfig, printerWidth: e.target.value as '58mm' | '80mm'})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-100"
                  >
                    <option value="58mm">58 mm (Pequeña)</option>
                    <option value="80mm">80 mm (Estándar)</option>
                  </select>
                </div>
              </div>
              
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-1 mt-6">Campos Visibles</h4>
              <div className="space-y-3">
                {[
                  { key: 'showLogo', label: 'Mostrar Logo / Nombre' },
                  { key: 'showAddress', label: 'Mostrar Dirección' },
                  { key: 'showPhone', label: 'Mostrar Teléfono' },
                  { key: 'showNCF', label: 'Mostrar CI o Pasaporte' },
                  { key: 'showFooter', label: 'Mostrar Pie de Página' },
                ].map(item => (
                  <label key={item.key} className="flex items-center justify-between cursor-pointer group">
                    <span className="text-[10px] font-bold text-slate-600 uppercase group-hover:text-slate-900 transition-colors">{item.label}</span>
                    <div className="relative inline-flex items-center">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={(ticketConfig as any)[item.key]}
                        onChange={e => setTicketConfig({...ticketConfig, [item.key]: e.target.checked})}
                      />
                      <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4 col-span-1 md:col-span-2">
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-1">Contenido Personalizado</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre en Ticket</label>
                  <input type="text" value={ticketConfig.businessName} onChange={e => setTicketConfig({...ticketConfig, businessName: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-100" />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Teléfono en Ticket</label>
                  <input type="text" value={ticketConfig.businessPhone} onChange={e => setTicketConfig({...ticketConfig, businessPhone: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-100" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Dirección en Ticket</label>
                  <input type="text" value={ticketConfig.businessAddress} onChange={e => setTicketConfig({...ticketConfig, businessAddress: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-100" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Texto de Pie de Página (Footer)</label>
                  <textarea 
                    value={ticketConfig.footerText} 
                    onChange={e => setTicketConfig({...ticketConfig, footerText: e.target.value})}
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-100 resize-none"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-50">
            <button 
              onClick={handleSaveTicket}
              className="w-full sm:w-auto px-8 py-3 bg-indigo-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-800 transition-all shadow-xl shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar Configuración de Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
