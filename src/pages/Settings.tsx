import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Save, DollarSign, Building2, Users, Plus, Trash2, Edit, LayoutGrid, Store, AlertTriangle, RefreshCw, Usb, Bluetooth, Wifi, Printer, CheckCircle2, ExternalLink, AlertCircle, Sparkles, Smartphone } from "lucide-react";
import { useStore } from "../store/useStore";
import { InfoTooltip } from "../components/InfoTooltip";
import { Branch, Category, User } from "../types";
import { cn } from "../lib/utils";

export default function Settings() {
  const { 
    currencies, updateCurrencyRate, 
    storeConfig, updateStoreConfig, 
    branches, addBranch, updateBranch, deleteBranch,
    categories, addCategory, updateCategory, deleteCategory,
    receiptConfig, updateReceiptConfig,
    users, updateUser, addUser, deleteUser,
    getBaseCurrency, clearAllData
  } = useStore();

  const baseCurrency = getBaseCurrency();

  const [rates, setRates] = useState<{ [code: string]: number }>(
    currencies.reduce((acc, c) => ({ ...acc, [c.code]: c.rateToBase }), {})
  );

  const [config, setConfig] = useState(storeConfig);
  const [ticketConfig, setTicketConfig] = useState(receiptConfig);
  const employees = users.filter(u => u.role === 'employee');
  const [employeeSalaries, setEmployeeSalaries] = useState<{ [id: string]: number }>({});
  
  const [printerStatus, setPrinterStatus] = useState<{
    type: 'idle' | 'loading' | 'success' | 'error' | 'warning';
    message: string;
    deviceName?: string;
  } | null>(null);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      setIsInIframe(true);
    }
  }, []);

  // Sync employee salaries when users are loaded
  useEffect(() => {
    if (users.length > 0) {
      setEmployeeSalaries(prev => {
        const next = { ...prev };
        users.forEach(u => {
          if (!(u.id in next)) {
            next[u.id] = u.baseSalary || 0;
          }
        });
        return next;
      });
    }
  }, [users]);

  const [newBranchName, setNewBranchName] = useState("");
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  const [newCategory, setNewCategory] = useState({ name: "", department: "" });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmCache, setShowConfirmCache] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [resetInput, setResetInput] = useState("");

  const handleClearData = async () => {
    if (resetInput !== 'ELIMINAR') return;
    
    setIsLoading(true);
    try {
      await clearAllData();
      window.location.reload();
    } catch (e) {
      console.error("Error al eliminar los datos:", e);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleSaveEmployeeSalary = (userId: string) => {
    const salary = employeeSalaries[userId];
    updateUser(userId, { baseSalary: salary });
    alert("Salario actualizado correctamente.");
  };

  const handleAddBranch = () => {
    if (newBranchName) {
      if (editingBranch) {
        updateBranch(editingBranch.id, { name: newBranchName });
        setEditingBranch(null);
      } else {
        addBranch({ id: crypto.randomUUID(), name: newBranchName });
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
        addCategory({ id: crypto.randomUUID(), ...newCategory });
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
                {currency.isBase ? (
                  <div className="w-auto px-2 py-1 bg-slate-200 border border-slate-300 rounded-lg text-xs font-black text-slate-500 text-center">
                    Moneda Base
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-500">1 {currency.code} =</span>
                    <input
                      type="number"
                      value={rates[currency.code] || ''}
                      onChange={(e) => setRates({ ...rates, [currency.code]: parseFloat(e.target.value) || 0 })}
                      className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-900 focus:ring-1 focus:ring-indigo-100 outline-none text-right"
                    />
                    <span className="text-[10px] font-black text-slate-500">{baseCurrency.code}</span>
                  </div>
                )}
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
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Configuración de Ticket e Información del Negocio</h3>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Datos que aparecerán en el recibo del cliente</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-1">Configuración Hardware e Impresión</h4>
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-600 uppercase group-hover:text-slate-900 transition-colors">Impresión Automática</span>
                    <span className="text-[7px] text-slate-400 font-medium">Imprimir ticket al confirmar cobro sin preguntar.</span>
                  </div>
                  <div className="relative inline-flex items-center ml-2">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={ticketConfig.autoPrint ?? false}
                      onChange={e => setTicketConfig({...ticketConfig, autoPrint: e.target.checked})}
                    />
                    <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                  </div>
                </label>

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
                    <span className="text-[10px] font-bold text-slate-600 uppercase group-hover:text-slate-900 transition-colors block">Impresión Nativa Térmica</span>
                    <span className="text-[7px] text-slate-400 font-medium">Conexión directa por USB, Bluetooth o Wi-Fi.</span>
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
                  <div className="space-y-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest">Buscar / Emparejar Impresora</span>
                      {isInIframe && (
                        <button
                          type="button"
                          onClick={() => window.open(window.location.href, '_blank')}
                          className="text-[8px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded"
                          title="Abre en nueva pestaña para habilitar Bluetooth y USB sin bloqueos del visor"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          Abrir en Pestaña Directa
                        </button>
                      )}
                    </div>
                    
                    {isInIframe && (
                      <div className="p-2 bg-amber-50 border border-amber-200/70 rounded-lg text-amber-800 text-[8px] leading-relaxed flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Nota de Seguridad del Navegador:</strong> Los botones de Bluetooth y USB requieren permisos nativos. Si estás en una ventana embebida, pulsa <button type="button" onClick={() => window.open(window.location.href, '_blank')} className="font-bold underline text-indigo-700">Abrir en Pestaña Directa</button> para buscar dispositivos sin restricciones.
                        </div>
                      </div>
                    )}

                    {printerStatus && (
                      <div className={cn(
                        "p-2.5 rounded-lg text-[9px] font-medium leading-tight flex items-start gap-2 animate-in fade-in duration-200",
                        printerStatus.type === 'loading' && "bg-blue-50 border border-blue-200 text-blue-800",
                        printerStatus.type === 'success' && "bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold",
                        printerStatus.type === 'error' && "bg-rose-50 border border-rose-200 text-rose-800",
                        printerStatus.type === 'warning' && "bg-amber-50 border border-amber-200 text-amber-800",
                        printerStatus.type === 'idle' && "bg-slate-100 border border-slate-200 text-slate-700"
                      )}>
                        {printerStatus.type === 'loading' && <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0 mt-0.5" />}
                        {printerStatus.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />}
                        {printerStatus.type === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />}
                        {printerStatus.type === 'warning' && <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />}
                        <div className="flex-1">
                          <p>{printerStatus.message}</p>
                          {printerStatus.deviceName && (
                            <p className="text-[8px] opacity-80 mt-0.5 font-bold">Dispositivo: {printerStatus.deviceName}</p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          setPrinterStatus({ type: 'loading', message: 'Buscando puertos USB / Serie disponibles...' });
                          try {
                            const { connectPrinter, isInsideIframe } = await import('../lib/escpos');
                            if (isInsideIframe()) {
                              setPrinterStatus({
                                type: 'warning',
                                message: 'Las conexiones USB nativas están bloqueadas en el visor embebido. Abre la aplicación en una pestaña nueva.'
                              });
                              return;
                            }
                            await connectPrinter();
                            setPrinterStatus({
                              type: 'success',
                              message: 'Impresora USB / Serie conectada y lista para imprimir.',
                              deviceName: 'Puerto Serie USB'
                            });
                          } catch (error: any) {
                            if (error.message?.includes('cancelada')) {
                              setPrinterStatus({ type: 'idle', message: 'Selección de puerto cancelada.' });
                              return;
                            }
                            setPrinterStatus({ type: 'error', message: error.message || 'Error al conectar por USB' });
                          }
                        }}
                        className="py-2.5 px-3 bg-white border border-slate-200 text-slate-800 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <Usb className="w-3.5 h-3.5 text-indigo-600" />
                        Buscar USB / Serie
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setPrinterStatus({ type: 'loading', message: 'Abriendo escaneo de dispositivos Bluetooth...' });
                          try {
                            const { connectBluetoothPrinter, isInsideIframe } = await import('../lib/escpos');
                            if (isInsideIframe()) {
                              setPrinterStatus({
                                type: 'warning',
                                message: 'Web Bluetooth está restringido dentro del visor. Abre la app en una nueva pestaña para emparejar.'
                              });
                              return;
                            }
                            const dev = await connectBluetoothPrinter();
                            setPrinterStatus({
                              type: 'success',
                              message: 'Impresora Bluetooth vinculada exitosamente.',
                              deviceName: dev?.name || 'Impresora Térmica Bluetooth'
                            });
                          } catch (error: any) {
                            if (error.message?.includes('cancelada')) {
                              setPrinterStatus({ type: 'idle', message: 'Búsqueda Bluetooth cancelada.' });
                              return;
                            }
                            setPrinterStatus({ type: 'error', message: error.message || 'Error al buscar Bluetooth' });
                          }
                        }}
                        className="py-2.5 px-3 bg-white border border-slate-200 text-slate-800 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <Bluetooth className="w-3.5 h-3.5 text-blue-600" />
                        Buscar Bluetooth
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2">
                      <div className="relative flex-1">
                        <Wifi className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="IP Impresora (Ej: 192.168.1.100)"
                          value={ticketConfig.printerIp || ''}
                          onChange={e => setTicketConfig({ ...ticketConfig, printerIp: e.target.value })}
                          className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const { testWifiPrinterConnection } = await import('../lib/escpos');
                            await testWifiPrinterConnection(ticketConfig.printerIp || '');
                            setPrinterStatus({
                              type: 'success',
                              message: `Dirección IP de impresora configurada correctamente: ${ticketConfig.printerIp}`
                            });
                          } catch (error: any) {
                            setPrinterStatus({ type: 'error', message: error.message || 'IP no válida' });
                          }
                        }}
                        className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shrink-0"
                      >
                        Probar IP
                      </button>
                    </div>

                    <div className="pt-1 flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          setPrinterStatus({ type: 'loading', message: 'Enviando ticket de prueba a impresora térmica...' });
                          try {
                            const { printThermalReceipt } = await import('../lib/escpos');
                            const lines = [
                              "CENTER|BOLD|MARÉ STORE",
                              "CENTER|*** TICKET DE PRUEBA ***",
                              ticketConfig.businessPhone ? `CENTER|Tel: ${ticketConfig.businessPhone}` : "",
                              "---",
                              "1x Producto Demostración   $10.00",
                              "---",
                              "BOLD|TOTAL: $10.00",
                              "---",
                              "CENTER|Impresion Termica 58mm OK",
                              `CENTER|${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            ].filter(Boolean);
                            const success = await printThermalReceipt({
                              lines,
                              openDrawer: ticketConfig.openDrawer ?? false,
                              width: ticketConfig.printerWidth || '58mm',
                              onSuccess: (method) => {
                                setPrinterStatus({ type: 'success', message: `¡Ticket enviado exitosamente mediante ${method}!` });
                              },
                              onError: (err) => {
                                setPrinterStatus({ type: 'error', message: `No se pudo imprimir: ${err}` });
                              }
                            });
                            if (!success) {
                              setPrinterStatus({
                                type: 'warning',
                                message: 'No hay impresora Bluetooth o USB conectada. Puedes usar el botón RawBT para Android o conectar por Bluetooth primero.'
                              });
                            }
                          } catch (err: any) {
                            setPrinterStatus({
                              type: 'error',
                              message: `Error de impresión: ${err.message}`
                            });
                          }
                        }}
                        className="w-full py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-emerald-100 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-600" />
                        Imprimir Ticket de Prueba (Directo)
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const { printThermalReceipt } = await import('../lib/escpos');
                          await printThermalReceipt({
                            lines: [
                              "CENTER|BOLD|MARÉ STORE",
                              "CENTER|PRUEBA RAWBT ANDROID",
                              "---",
                              "1x Producto Prueba   $10.00",
                              "---",
                              "BOLD|TOTAL: $10.00",
                              "---"
                            ],
                            width: ticketConfig.printerWidth || '58mm',
                            preferRawBT: true
                          });
                        }}
                        className="w-full py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-indigo-100 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Smartphone className="w-3 h-3 text-indigo-600" />
                        Probar con App RawBT (Android)
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Tamaño Papel</label>
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
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-1">Información que saldrá al imprimir el Ticket</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre Comercial</label>
                  <input type="text" value={ticketConfig.businessName} onChange={e => setTicketConfig({...ticketConfig, businessName: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-100" />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Teléfono de Contacto</label>
                  <input type="text" value={ticketConfig.businessPhone} onChange={e => setTicketConfig({...ticketConfig, businessPhone: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-100" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Dirección Física</label>
                  <input type="text" value={ticketConfig.businessAddress} onChange={e => setTicketConfig({...ticketConfig, businessAddress: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-100" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Texto al Final del Recibo</label>
                  <textarea 
                    value={ticketConfig.footerText} 
                    onChange={e => setTicketConfig({...ticketConfig, footerText: e.target.value})}
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-100 resize-none"
                    placeholder="Ej: ¡Gracias por su compra! Vuelva pronto."
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
              Guardar Configuración y Datos del Negocio
            </button>
          </div>
        </div>
      </div>

      {true && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4 lg:col-span-3">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
            <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Gestión de Empleados</h3>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Salarios y Asignación de Sucursales</p>
            </div>
          </div>
          
          {users.length === 0 ? (
            <div className="p-4 bg-slate-50 rounded-xl text-center text-sm font-bold text-slate-500">
              Cargando usuarios o no hay trabajadores registrados...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-900 uppercase">Salario Base por Trabajador</h4>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Fondo base asignado a cada usuario por turno</p>
                  </div>
                  <div className="bg-indigo-100 text-indigo-700 text-[7px] font-black px-2 py-0.5 rounded-full uppercase">
                    {users.length} Usuarios
                  </div>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {users.map(u => (
                    <div key={u.id} className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-sm">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[10px] font-black text-slate-900 uppercase truncate">{u.name}</p>
                          <span className="text-[7px] font-black uppercase bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                            {u.role}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="relative w-28">
                          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                            <span className="text-slate-400 text-[9px] font-bold">$</span>
                          </div>
                          <input 
                            type="number" 
                            min="0"
                            step="0.01"
                            value={employeeSalaries[u.id] ?? (u.baseSalary || 0)}
                            onChange={e => setEmployeeSalaries({ ...employeeSalaries, [u.id]: Number(e.target.value) })}
                            className="w-full pl-5 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-indigo-300" 
                          />
                        </div>
                        <button 
                          onClick={() => handleSaveEmployeeSalary(u.id)}
                          className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-sm active:scale-95"
                          title="Guardar Salario"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-900 uppercase">Permisos de Sucursal</h4>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Sucursales donde pueden operar</p>
                  </div>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                  {employees.map(emp => (
                    <div key={emp.id} className="bg-white p-2 border border-slate-200 rounded-lg">
                      <p className="text-[9px] font-black text-slate-900 mb-1">{emp.name}</p>
                      <div className="flex flex-wrap gap-2">
                        {branches.map(branch => {
                          const isAllowed = emp.allowedBranches?.includes(branch.id) ?? true;
                          return (
                            <label key={branch.id} className="flex items-center gap-1 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={isAllowed}
                                onChange={(e) => {
                                  const allowed = emp.allowedBranches ?? branches.map(b => b.id);
                                  const newAllowed = e.target.checked 
                                    ? [...allowed, branch.id]
                                    : allowed.filter(id => id !== branch.id);
                                  updateUser(emp.id, { allowedBranches: newAllowed });
                                }}
                                className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                              />
                              <span className="text-[8px] font-bold text-slate-600 uppercase">{branch.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex gap-3">
            <InfoTooltip text="Configura aquí el pago base y los accesos. El sistema sumará automáticamente las comisiones de productos vendidas durante el turno para darte el Gran Total de Nómina." />
            <p className="text-[9px] text-amber-700 font-medium leading-relaxed">
              <strong>Instrucciones:</strong> El total que verás en Reportes será (Monto Base + Comisiones). Luego puedes repartir ese total entre tus trabajadores según tu criterio. Los empleados solo podrán abrir caja en las sucursales asignadas.
            </p>
          </div>
        </div>
      )}

      {/* Zona Peligrosa */}
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-5 space-y-4">
        <div className="flex items-center gap-3 border-b border-red-50 pb-3">
          <div className="bg-red-50 p-2 rounded-lg text-red-600">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black text-red-600 uppercase tracking-wider">Zona Peligrosa</h3>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Acciones destructivas del sistema</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 mb-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Limpiar Caché Local</h4>
            <p className="text-xs text-slate-600 mt-1">
              Úsalo si la aplicación se comporta de forma extraña o si la sincronización está atascada.
            </p>
          </div>
          <div className="flex gap-2">
            {showConfirmCache ? (
              <>
                <button
                  onClick={() => setShowConfirmCache(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    localStorage.clear();
                    window.location.reload();
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                >
                  Confirmar Limpieza
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowConfirmCache(true)}
                className="w-full sm:w-auto shrink-0 px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Limpiar Caché Local
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-red-50/50 p-4 rounded-xl border border-red-100">
          <div className="flex-1">
            <h4 className="text-sm font-bold text-slate-900">Restablecer Sistema por Completo</h4>
            <p className="text-xs text-slate-600 mt-1">
              Esto eliminará <strong>todos</strong> los datos de la base de datos (inventario, ventas, clientes, usuarios) y te cerrará la sesión.
            </p>
            {showConfirmReset && (
              <div className="mt-3 p-3 bg-white rounded-lg border border-red-200 animate-in fade-in slide-in-from-top-2">
                <p className="text-[10px] font-black text-red-600 uppercase mb-2">Escribe "ELIMINAR" para confirmar:</p>
                <input 
                  type="text"
                  value={resetInput}
                  onChange={e => setResetInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-red-100 uppercase"
                  placeholder="Escribe aquí..."
                />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {showConfirmReset ? (
              <>
                <button
                  onClick={() => {
                    setShowConfirmReset(false);
                    setResetInput("");
                  }}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleClearData}
                  disabled={isLoading || resetInput !== 'ELIMINAR'}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95 disabled:opacity-30 flex items-center gap-2"
                >
                  {isLoading ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div> : <Trash2 className="w-3 h-3" />}
                  Confirmar Borrado
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowConfirmReset(true)}
                disabled={isLoading}
                className="w-full sm:w-auto shrink-0 px-6 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar Todo y Reiniciar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
