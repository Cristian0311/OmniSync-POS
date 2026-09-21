import React, { useState, useEffect } from "react";
import { Settings as SettingsIcon, Save, DollarSign, Building2, Users, Plus, Trash2, Edit, LayoutGrid, Store, AlertTriangle, RefreshCw, Usb, Bluetooth, Wifi, Printer, CheckCircle2, ExternalLink, AlertCircle, Sparkles, Smartphone, ChevronRight, Package, Search, X, Database, CloudUpload, CloudDownload, Check, ShieldCheck } from "lucide-react";
import { useStore } from "../store/useStore";
import { InfoTooltip } from "../components/InfoTooltip";
import { Branch, Category, User } from "../types";
import { cn } from "../lib/utils";
import { testSupabaseTables, pushAllToSupabase, SupabaseDiagnosticReport } from "../services/supabaseSync";

export default function Settings() {
  const { 
    currencies, updateCurrencyRate, 
    storeConfig, updateStoreConfig, 
    branches, addBranch, updateBranch, deleteBranch,
    categories, addCategory, updateCategory, deleteCategory,
    receiptConfig, updateReceiptConfig,
    users, updateUser, addUser, deleteUser,
    getBaseCurrency, clearAllData,
    registerEmployee,
    idnSettlementPrices, addIDNSettlementPrice, updateIDNSettlementPrice, deleteIDNSettlementPrice,
    products,
    syncWithSupabase
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

  // In-app Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // In-app Deletion Confirmations (Bypasses iframe blocked window.confirm)
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<{ id: string; name: string } | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string } | null>(null);

  // Supabase Testing & Sync states
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [isPushingAll, setIsPushingAll] = useState(false);
  const [isPullingAll, setIsPullingAll] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<SupabaseDiagnosticReport | null>(null);
  const [pushSummary, setPushSummary] = useState<string | null>(null);

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
  
  const [newEmployee, setNewEmployee] = useState({ 
    name: "", 
    password: "", 
    isIndependent: false, 
    assignedBranchId: "" 
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmCache, setShowConfirmCache] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [resetInput, setResetInput] = useState("");

  const [selectedIDNUser, setSelectedIDNUser] = useState<User | null>(null);
  const [selectedUserForConfig, setSelectedUserForConfig] = useState<User | null>(null);
  const [userFilterTab, setUserFilterTab] = useState<'all' | 'normal' | 'idn'>('all');
  const [idnProductSearch, setIdnProductSearch] = useState("");
  const [newSettlementPrice, setNewSettlementPrice] = useState<number>(0);
  const [selectedIDNProduct, setSelectedIDNProduct] = useState<string>("");

  const handleRunSupabaseDiagnostic = async () => {
    setIsTestingSupabase(true);
    setPushSummary(null);
    try {
      const report = await testSupabaseTables();
      setDiagnosticReport(report);
      showToast(report.summary, report.connected ? 'success' : 'error');
    } catch (err: any) {
      showToast(`Error al ejecutar test: ${err.message}`, 'error');
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handlePushAllToCloud = async () => {
    setIsPushingAll(true);
    try {
      const res = await pushAllToSupabase();
      if (res.success) {
        const totalItems = Object.values(res.pushed).reduce((a, b) => a + b, 0);
        setPushSummary(`Se guardaron exitosamente ${totalItems} registros en Supabase (${res.pushed.branches} sucursales, ${res.pushed.users} empleados, ${res.pushed.products} productos, ${res.pushed.inventory} stock).`);
        showToast("¡Todos los datos guardados y respaldados en Supabase!", 'success');
      } else {
        showToast("Error al respaldar en Supabase", 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsPushingAll(false);
    }
  };

  const handlePullAllFromCloud = async () => {
    setIsPullingAll(true);
    try {
      await syncWithSupabase();
      showToast("¡Datos sincronizados desde Supabase correctamente!", 'success');
    } catch (err: any) {
      showToast(`Error al sincronizar: ${err.message}`, 'error');
    } finally {
      setIsPullingAll(false);
    }
  };

  const handleClearData = async () => {
    if (resetInput.trim().toUpperCase() !== 'ELIMINAR') return;
    
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
    showToast("Tasas de cambio actualizadas correctamente.");
  };

  const handleSaveConfig = () => {
    updateStoreConfig(config);
    showToast("Datos de la empresa actualizados.");
  };

  const handleSaveTicket = () => {
    updateReceiptConfig(ticketConfig);
    showToast("Configuración de ticket guardada.");
  };

  const handleSaveEmployeeSalary = (userId: string) => {
    const salary = employeeSalaries[userId];
    updateUser(userId, { baseSalary: salary });
    showToast("Salario actualizado correctamente.");
  };

  const confirmDeleteUserAction = () => {
    if (userToDelete) {
      deleteUser(userToDelete.id);
      showToast(`Empleado "${userToDelete.name}" eliminado del sistema.`);
      setUserToDelete(null);
    }
  };

  const confirmDeleteBranchAction = () => {
    if (branchToDelete) {
      deleteBranch(branchToDelete.id);
      showToast(`Sucursal "${branchToDelete.name}" eliminada.`);
      setBranchToDelete(null);
    }
  };

  const confirmDeleteCategoryAction = () => {
    if (categoryToDelete) {
      deleteCategory(categoryToDelete.id);
      showToast(`Categoría "${categoryToDelete.name}" eliminada.`);
      setCategoryToDelete(null);
    }
  };

  const handleAddBranch = () => {
    if (newBranchName.trim()) {
      if (editingBranch) {
        updateBranch(editingBranch.id, { name: newBranchName.trim() });
        setEditingBranch(null);
        showToast("Sucursal actualizada.");
      } else {
        addBranch({ id: crypto.randomUUID(), name: newBranchName.trim() });
        showToast("Sucursal agregada y guardada en Supabase.");
      }
      setNewBranchName("");
    }
  };

  const handleAddCategory = () => {
    if (newCategory.name.trim() && newCategory.department.trim()) {
      if (editingCategory) {
        updateCategory(editingCategory.id, { name: newCategory.name.trim(), department: newCategory.department.trim() });
        setEditingCategory(null);
        showToast("Categoría actualizada.");
      } else {
        addCategory({ id: crypto.randomUUID(), name: newCategory.name.trim(), department: newCategory.department.trim() });
        showToast("Categoría registrada.");
      }
      setNewCategory({ name: "", department: "" });
    }
  };

  const handleAddIDNSettlement = () => {
    if (!selectedIDNUser || !selectedIDNProduct || newSettlementPrice <= 0) return;
    
    const existing = idnSettlementPrices.find(p => p.userId === selectedIDNUser.id && p.productId === selectedIDNProduct);
    if (existing) {
      updateIDNSettlementPrice(existing.id, { settlementPrice: newSettlementPrice });
    } else {
      addIDNSettlementPrice({
        id: crypto.randomUUID(),
        userId: selectedIDNUser.id,
        productId: selectedIDNProduct,
        settlementPrice: newSettlementPrice
      });
    }
    setNewSettlementPrice(0);
    setSelectedIDNProduct("");
    showToast("Precio de liquidación guardado.");
  };

  const filteredIDNProducts = products.filter(p => 
    p.name.toLowerCase().includes(idnProductSearch.toLowerCase()) || 
    p.sku.toLowerCase().includes(idnProductSearch.toLowerCase())
  ).slice(0, 5);

  const handleRegisterEmployeeManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee.name || !newEmployee.password) return;
    
    const registered = registerEmployee(newEmployee.name, newEmployee.password);
    if (newEmployee.isIndependent || newEmployee.assignedBranchId) {
      updateUser(registered.id, {
        isIndependent: newEmployee.isIndependent,
        assignedBranchId: newEmployee.assignedBranchId || undefined,
        allowedBranches: newEmployee.assignedBranchId ? [newEmployee.assignedBranchId] : undefined
      });
    }
    setNewEmployee({ name: "", password: "", isIndependent: false, assignedBranchId: "" });
    showToast("Empleado registrado con éxito. Ya aparecerá en el punto de venta.");
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-5xl mx-auto pb-8 relative">
      {/* In-App Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[200] max-w-md animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={cn(
            "p-4 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-md",
            toast.type === 'success' ? "bg-emerald-950/95 text-emerald-100 border-emerald-800/80 shadow-emerald-900/30" :
            toast.type === 'error' ? "bg-rose-950/95 text-rose-100 border-rose-800/80 shadow-rose-900/30" :
            "bg-slate-900/95 text-white border-slate-700 shadow-slate-900/30"
          )}>
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
            {toast.type === 'info' && <Database className="w-5 h-5 text-indigo-400 shrink-0" />}
            <div className="flex-1 text-xs font-bold leading-snug">{toast.message}</div>
            <button onClick={() => setToast(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-4 h-4 text-slate-400 hover:text-white" />
            </button>
          </div>
        </div>
      )}

      {/* In-App User Deletion Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900 uppercase">¿Eliminar Empleado?</h3>
              <p className="text-xs text-slate-600">
                ¿Estás seguro de que deseas eliminar permanentemente a <span className="font-bold text-slate-900">{userToDelete.name}</span>? Esta acción se sincronizará con Supabase y no se puede deshacer.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteUserAction}
                className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Branch Deletion Confirmation Modal */}
      {branchToDelete && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Store className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900 uppercase">¿Eliminar Sucursal?</h3>
              <p className="text-xs text-slate-600">
                ¿Estás seguro de que deseas eliminar la sucursal <span className="font-bold text-slate-900">"{branchToDelete.name}"</span>?
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBranchToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteBranchAction}
                className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Category Deletion Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900 uppercase">¿Eliminar Categoría?</h3>
              <p className="text-xs text-slate-600">
                ¿Estás seguro de que deseas eliminar la categoría <span className="font-bold text-slate-900">"{categoryToDelete.name}"</span>?
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteCategoryAction}
                className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Employee Configuration Modal */}
      {selectedUserForConfig && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100">
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={cn("p-2 rounded-xl", selectedUserForConfig.isIndependent ? "bg-amber-500/20 text-amber-400" : "bg-indigo-500/20 text-indigo-400")}>
                  {selectedUserForConfig.isIndependent ? <Package className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider">Configuración de Empleado</h3>
                  <p className="text-[10px] font-bold text-slate-300 uppercase">{selectedUserForConfig.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedUserForConfig(null)} 
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar space-y-5 flex-1">
              {/* Type and Role Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 space-y-2">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Tipo de Vendedor</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...selectedUserForConfig, isIndependent: false };
                        setSelectedUserForConfig(updated);
                        updateUser(selectedUserForConfig.id, { isIndependent: false });
                      }}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg font-black text-[9px] uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        !selectedUserForConfig.isIndependent ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      <Users className="w-3.5 h-3.5" />
                      Normal / Fijo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...selectedUserForConfig, isIndependent: true };
                        setSelectedUserForConfig(updated);
                        updateUser(selectedUserForConfig.id, { isIndependent: true });
                      }}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg font-black text-[9px] uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        selectedUserForConfig.isIndependent ? "bg-amber-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      <Package className="w-3.5 h-3.5" />
                      Independiente (IDN)
                    </button>
                  </div>
                </div>

                {/* Base Salary */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 space-y-2">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">
                    {selectedUserForConfig.isIndependent ? 'Salario / Comisión Base (Opcional)' : 'Salario Base por Turno (CUP)'}
                  </span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">{baseCurrency.symbol}</span>
                    <input 
                      type="number"
                      min="0"
                      step="0.01"
                      value={employeeSalaries[selectedUserForConfig.id] ?? (selectedUserForConfig.baseSalary || 0)}
                      onChange={e => {
                        const val = Number(e.target.value);
                        setEmployeeSalaries({ ...employeeSalaries, [selectedUserForConfig.id]: val });
                        updateUser(selectedUserForConfig.id, { baseSalary: val });
                      }}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Contraseña de Acceso */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 space-y-2 sm:col-span-2">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">
                    Contraseña de Acceso al Punto de Venta
                  </span>
                  <input 
                    type="text"
                    value={selectedUserForConfig.password || ''}
                    onChange={e => {
                      const newPass = e.target.value;
                      const updated = { ...selectedUserForConfig, password: newPass };
                      setSelectedUserForConfig(updated);
                      updateUser(selectedUserForConfig.id, { password: newPass });
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Escribe la contraseña para este empleado..."
                  />
                  <p className="text-[9px] font-medium text-slate-500">
                    * Esta contraseña será solicitada obligatoriamente para abrir turnos y autorizar operaciones.
                  </p>
                </div>
              </div>

              {/* Branch Permissions Section */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-[10px] font-black text-slate-900 uppercase">
                      {selectedUserForConfig.isIndependent ? 'Almacén Exclusivo Asignado (IDN)' : 'Permisos de Sucursales'}
                    </h4>
                  </div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">
                    {selectedUserForConfig.isIndependent ? 'Obligatorio 1 almacén' : 'Sucursales habilitadas'}
                  </span>
                </div>

                {selectedUserForConfig.isIndependent ? (
                  <div>
                    <select
                      value={selectedUserForConfig.assignedBranchId || ""}
                      onChange={(e) => {
                        const bId = e.target.value;
                        const updated = { 
                          ...selectedUserForConfig, 
                          assignedBranchId: bId,
                          allowedBranches: bId ? [bId] : undefined 
                        };
                        setSelectedUserForConfig(updated);
                        updateUser(selectedUserForConfig.id, { 
                          assignedBranchId: bId,
                          allowedBranches: bId ? [bId] : undefined
                        });
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                    >
                      <option value="">-- Seleccionar almacén exclusivo --</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <p className="text-[9px] text-amber-700 font-bold mt-1.5">
                      * El vendedor IDN solo podrá ver y liquidar los productos de este almacén en el POS.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {branches.map(branch => {
                      const isAllowed = selectedUserForConfig.allowedBranches?.includes(branch.id) ?? true;
                      return (
                        <label 
                          key={branch.id} 
                          className={cn(
                            "flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer",
                            isAllowed ? "bg-white border-indigo-200 shadow-xs" : "bg-slate-100/60 border-slate-200 opacity-60"
                          )}
                        >
                          <input 
                            type="checkbox"
                            checked={isAllowed}
                            onChange={(e) => {
                              const current = selectedUserForConfig.allowedBranches ?? branches.map(b => b.id);
                              const newAllowed = e.target.checked 
                                ? [...current, branch.id]
                                : current.filter(id => id !== branch.id);
                              
                              const updated = { ...selectedUserForConfig, allowedBranches: newAllowed };
                              setSelectedUserForConfig(updated);
                              updateUser(selectedUserForConfig.id, { allowedBranches: newAllowed });
                            }}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <span className="text-[10px] font-black uppercase text-slate-800 block">{branch.name}</span>
                            <span className="text-[8px] text-slate-400 font-bold">{isAllowed ? 'Acceso Permitido' : 'Acceso Restringido'}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* IDN Custom Settlement Prices */}
              {selectedUserForConfig.isIndependent && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-amber-600" />
                      <h4 className="text-[10px] font-black text-slate-900 uppercase">Precios de Liquidación Especiales (CUP)</h4>
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Por defecto usa el Costo del Producto</span>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Buscar producto..."
                          value={idnProductSearch}
                          onChange={(e) => setIdnProductSearch(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        {idnProductSearch && filteredIDNProducts.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
                            {filteredIDNProducts.map(p => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  setSelectedIDNProduct(p.id);
                                  setIdnProductSearch("");
                                  const existing = idnSettlementPrices.find(sp => sp.userId === selectedUserForConfig.id && sp.productId === p.id);
                                  if (existing) setNewSettlementPrice(existing.settlementPrice);
                                }}
                                className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center justify-between transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                              >
                                <span className="text-[10px] font-black uppercase text-slate-800">{p.name}</span>
                                <span className="text-[9px] font-bold text-slate-400">{p.sku}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">$</span>
                          <input 
                            type="number" 
                            placeholder="Precio Liq. (CUP)"
                            value={newSettlementPrice || ""}
                            onChange={(e) => setNewSettlementPrice(Number(e.target.value))}
                            className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                        <button 
                          onClick={() => {
                            if (!selectedUserForConfig || !selectedIDNProduct || newSettlementPrice <= 0) return;
                            const existing = idnSettlementPrices.find(p => p.userId === selectedUserForConfig.id && p.productId === selectedIDNProduct);
                            if (existing) {
                              updateIDNSettlementPrice(existing.id, { settlementPrice: newSettlementPrice });
                            } else {
                              addIDNSettlementPrice({
                                id: crypto.randomUUID(),
                                userId: selectedUserForConfig.id,
                                productId: selectedIDNProduct,
                                settlementPrice: newSettlementPrice
                              });
                            }
                            setNewSettlementPrice(0);
                            setSelectedIDNProduct("");
                          }}
                          disabled={!selectedIDNProduct || newSettlementPrice <= 0}
                          className="bg-amber-600 hover:bg-amber-700 text-white px-4 rounded-lg font-black text-[9px] uppercase transition-all shadow-sm disabled:opacity-40 cursor-pointer"
                        >
                          Asignar
                        </button>
                      </div>
                    </div>

                    {selectedIDNProduct && (
                      <div className="flex items-center gap-2 px-1">
                        <Package className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-[9px] font-black uppercase text-amber-700">
                          Seleccionado: {products.find(p => p.id === selectedIDNProduct)?.name}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* List of custom prices */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {idnSettlementPrices.filter(p => p.userId === selectedUserForConfig.id).map(p => {
                      const prod = products.find(pr => pr.id === p.productId);
                      return (
                        <div key={p.id} className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-xs">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black text-slate-900 uppercase truncate">{prod?.name || 'Producto'}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase">{prod?.sku}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-[10px] font-black text-amber-700">{baseCurrency.symbol}{p.settlementPrice.toLocaleString()} CUP</p>
                              <p className="text-[7px] font-bold text-slate-400 uppercase">Liquidación</p>
                            </div>
                            <button 
                              onClick={() => deleteIDNSettlementPrice(p.id)}
                              className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title="Eliminar regla de precio"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {idnSettlementPrices.filter(p => p.userId === selectedUserForConfig.id).length === 0 && (
                      <div className="py-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Sin precios de liquidación personalizados (usará costo por defecto)</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Danger Zone: Delete user */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                   type="button"
                   onClick={() => {
                     const userToDeleteTarget = selectedUserForConfig;
                     setSelectedUserForConfig(null);
                     if (userToDeleteTarget) {
                       setUserToDelete({ id: userToDeleteTarget.id, name: userToDeleteTarget.name });
                     }
                   }}
                   className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                 >
                   <Trash2 className="w-3.5 h-3.5" />
                   Eliminar Empleado
                 </button>

                <button 
                  type="button"
                  onClick={() => {
                    setSelectedUserForConfig(null);
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all shadow-md cursor-pointer"
                >
                  Listo / Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IDN Quick Modal Fallback */}
      {selectedIDNUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase">Gestión de Vendedor Independiente</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase">{selectedIDNUser.name}</p>
              </div>
              <button onClick={() => setSelectedIDNUser(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar space-y-6">
              {/* Branch Assignment */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 rounded-lg">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <h4 className="text-[10px] font-black text-slate-900 uppercase">Almacén / Sucursal Asignada</h4>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <select 
                    value={selectedIDNUser.assignedBranchId || ""}
                    onChange={(e) => {
                      const branchVal = e.target.value;
                      setSelectedIDNUser({ ...selectedIDNUser, assignedBranchId: branchVal });
                      updateUser(selectedIDNUser.id, { 
                        assignedBranchId: branchVal,
                        allowedBranches: branchVal ? [branchVal] : undefined
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Sin almacén asignado</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <p className="text-[8px] font-bold text-slate-400 uppercase px-1">
                    * Este vendedor solo podrá operar y liquidar productos de este almacén.
                  </p>
                </div>
              </div>

              {/* Settlement Prices */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-50 rounded-lg">
                    <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <h4 className="text-[10px] font-black text-slate-900 uppercase">Precios de Entrega (Liquidación CUP)</h4>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Buscar producto..."
                        value={idnProductSearch}
                        onChange={(e) => setIdnProductSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      />
                      {idnProductSearch && filteredIDNProducts.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-10 overflow-hidden">
                          {filteredIDNProducts.map(p => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setSelectedIDNProduct(p.id);
                                setIdnProductSearch("");
                                const existing = idnSettlementPrices.find(sp => sp.userId === selectedIDNUser.id && sp.productId === p.id);
                                if (existing) setNewSettlementPrice(existing.settlementPrice);
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <span className="text-[10px] font-black uppercase text-slate-700">{p.name}</span>
                              <span className="text-[9px] font-bold text-slate-400">{p.sku}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">$</span>
                        <input 
                          type="number" 
                          placeholder="Precio Entrega (CUP)"
                          value={newSettlementPrice || ""}
                          onChange={(e) => setNewSettlementPrice(Number(e.target.value))}
                          className="w-full pl-7 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        />
                      </div>
                      <button 
                        onClick={handleAddIDNSettlement}
                        disabled={!selectedIDNProduct || newSettlementPrice <= 0}
                        className="bg-amber-600 hover:bg-amber-700 text-white px-4 rounded-xl font-black text-[10px] uppercase transition-all shadow-lg disabled:opacity-50 cursor-pointer"
                      >
                        Asignar
                      </button>
                    </div>
                  </div>

                  {selectedIDNProduct && (
                    <div className="flex items-center gap-2 px-1">
                      <Package className="w-3 h-3 text-indigo-500" />
                      <span className="text-[9px] font-black uppercase text-indigo-600">
                        {products.find(p => p.id === selectedIDNProduct)?.name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                  {idnSettlementPrices.filter(p => p.userId === selectedIDNUser.id).map(p => {
                    const product = products.find(prod => prod.id === p.productId);
                    return (
                      <div key={p.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-4 shadow-sm group">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black text-slate-900 uppercase truncate">{product?.name || 'Producto Eliminado'}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">{product?.sku}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-[10px] font-black text-amber-700">{baseCurrency.symbol}{p.settlementPrice.toLocaleString()} CUP</p>
                            <p className="text-[7px] font-bold text-slate-400 uppercase">Precio Liquidación</p>
                          </div>
                          <button 
                            onClick={() => deleteIDNSettlementPrice(p.id)}
                            className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {idnSettlementPrices.filter(p => p.userId === selectedIDNUser.id).length === 0 && (
                    <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Sin precios específicos asignados</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setSelectedIDNUser(null)}
                className="bg-slate-900 text-white px-8 py-2.5 rounded-xl font-black text-[10px] uppercase hover:bg-slate-800 transition-all shadow-lg cursor-pointer"
              >
                Cerrar y Guardar
              </button>
            </div>
          </div>
        </div>
      )}

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
        {/* Tasas de Cambio (Compacto Lineal: CUP, USD, EUR) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5 space-y-3.5 min-w-0">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-600 shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider truncate">Tasas de Cambio</h3>
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md shrink-0">
              Base: CUP
            </span>
          </div>
          
          <div className="space-y-2">
            {currencies
              .filter(currency => ['CUP', 'USD', 'EUR'].includes(currency.code))
              .map(currency => {
                const isBase = currency.code === 'CUP';
                return (
                  <div 
                    key={currency.code} 
                    className={cn(
                      "px-3 py-2 rounded-xl border transition-all flex items-center justify-between gap-3",
                      isBase ? "bg-slate-50 border-slate-200" : "bg-white border-slate-200 hover:border-indigo-300 shadow-xs"
                    )}
                  >
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-800 font-black text-[11px] flex items-center justify-center shrink-0 border border-slate-200 shadow-2xs">
                        {currency.symbol || (currency.code === 'EUR' ? '€' : '$')}
                      </span>
                      <span className="text-xs font-black text-slate-900 uppercase tracking-tight">
                        {currency.code}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 justify-end shrink-0">
                      {isBase ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[9px] font-black uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          1.00 (Base)
                        </span>
                      ) : (
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                          <span className="text-[9px] font-black text-slate-400 mr-1 select-none">
                            1 {currency.code} =
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={rates[currency.code] ?? ''}
                            onChange={(e) => setRates({ ...rates, [currency.code]: parseFloat(e.target.value) || 0 })}
                            className="w-14 sm:w-16 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-right text-xs font-black text-slate-900 outline-none focus:border-indigo-500"
                            placeholder="0.00"
                          />
                          <span className="text-[9px] font-black text-slate-600 ml-1 select-none">
                            CUP
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          <button 
            onClick={handleSaveRates}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Guardar Tasas
          </button>
        </div>

        {/* Categorías (Compact) */}
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
            <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {categories.map(cat => (
                <div key={cat.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100 group">
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="text-[10px] font-black text-slate-700 uppercase tracking-tight truncate">{cat.name}</div>
                    <div className="text-[7px] font-bold text-slate-400 uppercase truncate">{cat.department}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setEditingCategory(cat); setNewCategory({ name: cat.name, department: cat.department }); }} className="p-1 text-slate-300 hover:text-indigo-600 rounded-md transition-colors"><Edit className="w-3 h-3" /></button>
                    <button onClick={() => setCategoryToDelete({ id: cat.id, name: cat.name })} className="p-1 text-slate-300 hover:text-rose-500 rounded-md transition-colors"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="text" 
                  value={newCategory.name}
                  onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="Categoría"
                  className="flex-[2] min-w-0 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner" 
                />
                <input 
                  type="text" 
                  value={newCategory.department}
                  onChange={e => setNewCategory({ ...newCategory, department: e.target.value })}
                  placeholder="Departamento"
                  className="flex-1 min-w-0 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner" 
                />
                <button 
                  onClick={handleAddCategory} 
                  className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0"
                >
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
                  <div className="text-[10px] font-black text-slate-700 uppercase tracking-tight truncate flex-1 min-w-0">{branch.name}</div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <button onClick={() => { setEditingBranch(branch); setNewBranchName(branch.name); }} className="p-1 text-slate-300 hover:text-indigo-600 rounded-md transition-colors"><Edit className="w-3 h-3" /></button>
                    {branches.length > 1 && (
                      <button onClick={() => setBranchToDelete({ id: branch.id, name: branch.name })} className="p-1 text-slate-300 hover:text-rose-500 rounded-md transition-colors"><Trash2 className="w-3 h-3" /></button>
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
                  className="flex-1 min-w-0 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-100" 
                />
                <button onClick={handleAddBranch} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shrink-0">
                  {editingBranch ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Apariencia y Visibilidad (Mejorado para Miopía) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4 lg:col-span-3">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
            <div className="bg-slate-900 p-2 rounded-lg text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Apariencia y Visibilidad</h3>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Personalización del entorno de trabajo</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-200/60">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-slate-900 uppercase">Modo Oscuro (Contraste Suave)</h4>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[7px] font-black rounded-full uppercase">Recomendado para Miopía</span>
              </div>
              <p className="text-[10px] text-slate-600 font-medium max-w-2xl">
                Al activar el modo oscuro, el fondo se vuelve gris azulado profundo y las letras blancas suaves. Esto reduce el deslumbramiento, mejora la nitidez de los bordes para personas con miopía y disminuye el cansancio visual tras largas jornadas de trabajo.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors", !config.darkMode ? "text-indigo-600" : "text-slate-400")}>Luz</span>
              <button 
                type="button"
                onClick={() => {
                  const newConfig = { ...config, darkMode: !config.darkMode };
                  setConfig(newConfig);
                  updateStoreConfig(newConfig);
                  showToast(newConfig.darkMode ? "Modo oscuro activado" : "Modo luz activado");
                }}
                className={cn(
                  "relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 focus:outline-none",
                  config.darkMode ? "bg-indigo-600" : "bg-slate-300"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300",
                    config.darkMode ? "translate-x-8" : "translate-x-1"
                  )}
                />
              </button>
              <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors", config.darkMode ? "text-indigo-600" : "text-slate-400")}>Oscuro</span>
            </div>
          </div>
        </div>

        {/* Supabase Diagnostic & Cloud Storage Panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-5 space-y-4 lg:col-span-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Servidor Supabase & Base de Datos Cloud</h3>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[8px] font-black rounded-full uppercase flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" /> Activo
                  </span>
                </div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                  Verificación de persistencia, sincronización automática y diagnóstico en tiempo real
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleRunSupabaseDiagnostic}
                disabled={isTestingSupabase}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isTestingSupabase ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5 text-indigo-400" />}
                Diagnóstico y Test
              </button>

              <button
                type="button"
                onClick={handlePushAllToCloud}
                disabled={isPushingAll}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isPushingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
                Guardar Todo en Supabase
              </button>

              <button
                type="button"
                onClick={handlePullAllFromCloud}
                disabled={isPullingAll}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isPullingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudDownload className="w-3.5 h-3.5 text-slate-600" />}
                Descargar de Supabase
              </button>
            </div>
          </div>

          {pushSummary && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{pushSummary}</span>
            </div>
          )}

          {diagnosticReport && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {diagnosticReport.tables.map(t => (
                  <div 
                    key={t.table}
                    className={cn(
                      "p-2.5 rounded-xl border text-center flex flex-col justify-between gap-1",
                      t.status === 'ok' ? "bg-emerald-50/50 border-emerald-200 text-emerald-900" : 
                      t.status === 'warning' ? "bg-amber-50/50 border-amber-200 text-amber-900" :
                      "bg-rose-50/50 border-rose-200 text-rose-900"
                    )}
                  >
                    <div className="text-[8px] font-black uppercase truncate" title={t.label || t.table}>
                      {t.label || t.table}
                    </div>
                    <div className="text-xs font-black">{t.count} filas</div>
                    <div className="text-[7px] font-black uppercase flex items-center justify-center gap-0.5">
                      {t.status === 'ok' ? (
                        <span className="text-emerald-600 flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> OK</span>
                      ) : t.status === 'warning' ? (
                        <span className="text-amber-600 flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> Aviso</span>
                      ) : (
                        <span className="text-rose-600 flex items-center gap-0.5"><AlertCircle className="w-2.5 h-2.5" /> Error</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs font-bold text-slate-700">
                <span>{diagnosticReport.summary}</span>
                <span className="text-[9px] text-slate-400 uppercase font-black">Probado {new Date(diagnosticReport.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          )}
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-50 pb-3">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Gestión de Personal y Vendedores</h3>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Empleados Normales y Vendedores Independientes (IDN)</p>
              </div>
            </div>

            {/* Segmented Filter for Normal vs IDN */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setUserFilterTab('all')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer",
                  userFilterTab === 'all' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Todos ({users.length})
              </button>
              <button
                type="button"
                onClick={() => setUserFilterTab('normal')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1 cursor-pointer",
                  userFilterTab === 'normal' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                <Users className="w-3 h-3" />
                Normales ({users.filter(u => !u.isIndependent).length})
              </button>
              <button
                type="button"
                onClick={() => setUserFilterTab('idn')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1 cursor-pointer",
                  userFilterTab === 'idn' ? "bg-amber-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                <Package className="w-3 h-3" />
                IDN ({users.filter(u => u.isIndependent).length})
              </button>
            </div>
          </div>

          {/* New Employee Form */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h4 className="text-[10px] font-black text-slate-900 uppercase mb-3 flex items-center gap-2">
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              Registrar Nuevo Personal
            </h4>
            <form onSubmit={handleRegisterEmployeeManual} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre</label>
                  <input 
                    type="text"
                    placeholder="Nombre completo"
                    required
                    value={newEmployee.name}
                    onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Contraseña</label>
                  <input 
                    type="password"
                    placeholder="Contraseña inicial"
                    required
                    value={newEmployee.password}
                    onChange={e => setNewEmployee({ ...newEmployee, password: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipo de Empleado</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewEmployee({ ...newEmployee, isIndependent: false, assignedBranchId: "" })}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-[9px] font-black uppercase border transition-all cursor-pointer",
                        !newEmployee.isIndependent ? "bg-indigo-600 text-white border-indigo-600 shadow-xs" : "bg-white text-slate-600 border-slate-200"
                      )}
                    >
                      Normal / Fijo
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewEmployee({ ...newEmployee, isIndependent: true })}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-[9px] font-black uppercase border transition-all cursor-pointer",
                        newEmployee.isIndependent ? "bg-amber-600 text-white border-amber-600 shadow-xs" : "bg-white text-slate-600 border-slate-200"
                      )}
                    >
                      IDN
                    </button>
                  </div>
                </div>
              </div>

              {newEmployee.isIndependent && (
                <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-700 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black text-amber-900 uppercase">Almacén Exclusivo IDN</p>
                      <p className="text-[8px] font-bold text-amber-700 uppercase">Asigna el almacén donde este vendedor independiente liquidará su stock</p>
                    </div>
                  </div>
                  <select 
                    value={newEmployee.assignedBranchId}
                    onChange={e => setNewEmployee({ ...newEmployee, assignedBranchId: e.target.value })}
                    className="w-full sm:w-64 bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                  >
                    <option value="">Seleccionar Almacén Asignado</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button 
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  Registrar Empleado
                </button>
              </div>
            </form>
          </div>
          
          {/* Employee Cards Grid (Compact & Tablet Optimized) */}
          {users.length === 0 ? (
            <div className="p-8 bg-slate-50 rounded-xl text-center text-sm font-bold text-slate-500">
              No hay usuarios o trabajadores registrados en el sistema.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {users
                  .filter(u => {
                    if (userFilterTab === 'normal') return !u.isIndependent;
                    if (userFilterTab === 'idn') return u.isIndependent;
                    return true;
                  })
                  .map(u => {
                    const isIdn = u.isIndependent;
                    const assignedBranchName = branches.find(b => b.id === u.assignedBranchId)?.name;
                    const allowedCount = (u.allowedBranches || branches.map(b => b.id)).length;

                    return (
                      <div 
                        key={u.id} 
                        className={cn(
                          "p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 shadow-xs hover:shadow-md",
                          isIdn ? "bg-amber-50/20 border-amber-200" : "bg-white border-slate-200"
                        )}
                      >
                        {/* Header card */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-black text-slate-900 uppercase truncate">{u.name}</p>
                              <span className="text-[7px] font-black uppercase bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                {u.role === 'admin' ? 'Admin' : 'Empleado'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <span className={cn(
                                "text-[7px] font-black uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1",
                                isIdn ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"
                              )}>
                                {isIdn ? <Package className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                                {isIdn ? 'Vendedor IDN' : 'Fijo / Normal'}
                              </span>
                            </div>
                          </div>

                          {/* Quick Delete */}
                          <button
                            type="button"
                            onClick={() => setUserToDelete({ id: u.id, name: u.name })}
                            className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar Empleado"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Middle info */}
                        <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-[9px] space-y-1">
                          <div className="flex justify-between font-bold text-slate-600">
                            <span>Sucursales:</span>
                            {isIdn ? (
                              <span className={assignedBranchName ? "text-indigo-700 font-black" : "text-rose-600 font-black"}>
                                {assignedBranchName ? `📍 ${assignedBranchName}` : '⚠️ Sin asignar'}
                              </span>
                            ) : (
                              <span className="text-slate-800 font-black">
                                {allowedCount === branches.length ? 'Todas las sucursales' : `${allowedCount} autorizadas`}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between font-bold text-slate-600">
                            <span>Salario Base:</span>
                            <span className="text-slate-900 font-black">
                              {baseCurrency.symbol}{(employeeSalaries[u.id] ?? (u.baseSalary || 0)).toLocaleString()} CUP
                            </span>
                          </div>
                          {isIdn && (
                            <div className="flex justify-between font-bold text-slate-600">
                              <span>Precios Especiales:</span>
                              <span className="text-amber-800 font-black">
                                {idnSettlementPrices.filter(sp => sp.userId === u.id).length} asignados
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <button
                          type="button"
                          onClick={() => setSelectedUserForConfig(u)}
                          className={cn(
                            "w-full py-2 px-3 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-98 cursor-pointer",
                            isIdn 
                              ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/10" 
                              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/10"
                          )}
                        >
                          <SettingsIcon className="w-3.5 h-3.5" />
                          Configuración y Permisos
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
          
          <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex gap-3">
            <InfoTooltip text="Configura aquí el pago base y los accesos. Cada empleado puede configurarse con permisos individuales de sucursales o como vendedor independiente (IDN) con almacén exclusivo y precios de liquidación." />
            <p className="text-[9px] text-amber-700 font-medium leading-relaxed">
              <strong>Tip de Operación:</strong> Haz clic en <strong>Configuración y Permisos</strong> en cada tarjeta para modificar sucursales autorizadas, cambiar contraseñas, alternar entre Vendedor Normal / IDN, o ajustar precios de liquidación por producto.
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
                  placeholder="Escribe ELIMINAR para confirmar..."
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
                  disabled={isLoading || resetInput.trim().toUpperCase() !== 'ELIMINAR'}
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
