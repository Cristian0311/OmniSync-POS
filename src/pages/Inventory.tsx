import React, { useMemo, useState } from "react";
import { ArrowLeftRight, PackagePlus, AlertCircle, Search, ShieldCheck, X, DollarSign, Trash2, Edit, History, Package, TrendingUp, Filter, Download, Plus, ArrowRightLeft, LayoutGrid, List, Settings2, Tag } from "lucide-react";
import { useStore } from "../store/useStore";
import { cn, generateId } from "../lib/utils";
import { Product, Category } from "../types";
import { InfoTooltip } from "../components/InfoTooltip";
import { TransferHistory } from "../components/TransferHistory";
import { PrintLabels } from "../components/PrintLabels";
import { ABCAnalysis } from "../components/ABCAnalysis";
import { RestockAlerts } from "../components/RestockAlerts";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";

export default function Inventory() {
  const { 
    products, inventory, branches, addProduct, updateProduct, 
    transferInventory, setInventoryQuantity, deleteProduct, deleteCategory,
    transfers, categories, batchDeleteProducts, batchUpdateProducts, getBaseCurrency, currencies
  } = useStore();
  const baseCurrency = getBaseCurrency();

  const [searchQuery, setSearchQuery] = useState("");
  
  useBarcodeScanner((barcode) => {
    setSearchQuery(barcode);
  });
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [managingStockProduct, setManagingStockProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'transfers' | 'labels' | 'abc' | 'restock'>('products');
  const [showBatchPriceModal, setShowBatchPriceModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({ name: "", department: "" });
  const [batchPriceAdjust, setBatchPriceAdjust] = useState({ type: 'percentage' as 'percentage' | 'fixed', value: 0, direction: 'increase' as 'increase' | 'decrease' });

  const handleBatchDelete = () => {
    if (window.confirm(`¿Seguro que deseas eliminar ${selectedItems.length} productos?`)) {
      batchDeleteProducts(selectedItems);
      setSelectedItems([]);
    }
  };

  const handleBatchUpdateStatus = (status: 'active' | 'discontinued' | 'draft') => {
    batchUpdateProducts(selectedItems, { status });
    setSelectedItems([]);
  };

  const handleBatchPriceApply = () => {
    const factor = batchPriceAdjust.direction === 'increase' ? 1 : -1;
    
    selectedItems.forEach(id => {
      const product = products.find(p => p.id === id);
      if (product) {
        let newPrice = product.price;
        if (batchPriceAdjust.type === 'percentage') {
          newPrice = product.price * (1 + (batchPriceAdjust.value / 100) * factor);
        } else {
          newPrice = product.price + (batchPriceAdjust.value * factor);
        }
        updateProduct(id, { price: Math.max(0, newPrice), margin: Math.max(0, newPrice - product.costPrice) });
      }
    });
    
    setShowBatchPriceModal(false);
    setSelectedItems([]);
    alert(`Se han actualizado ${selectedItems.length} precios.`);
  };

  // Form State
  const [formData, setFormData] = useState<Partial<Product & { initialQuantity: number, initialBranchId: string, initialVariant?: string, initialVariantQuantities?: { [key: string]: number } }>>({
    name: "",
    sku: "",
    barcode: "",
    costPrice: 0,
    price: 0,
    margin: 0,
    categoryId: "",
    color: "bg-slate-100 text-slate-700",
    commissionType: 'percentage',
    commissionValue: 0,
    initialQuantity: 0,
    initialBranchId: branches[0]?.id || "",
    availableSizes: [],
    availableColors: [],
    initialVariantQuantities: {}
  });

  const [newSize, setNewSize] = useState("");
  const [newColor, setNewColor] = useState("");
  const [showKitPicker, setShowKitPicker] = useState(false);
  const [kitQuery, setKitQuery] = useState("");

  const handleCostPriceChange = (cost: number, price: number) => {
    const margin = price - cost;
    setFormData(prev => ({ ...prev, costPrice: cost, price, margin }));
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      updateProduct(editingProduct.id, formData);
      alert("Producto actualizado correctamente.");
    } else {
      const { initialQuantity, initialBranchId, initialVariant, initialVariantQuantities, ...productData } = formData;
      const newProduct: Product = {
        ...productData as Product,
        id: generateId('PRD'),
      };
      addProduct(newProduct, initialQuantity, initialBranchId, initialVariant, initialVariantQuantities);
    }
    setShowAddModal(false);
    setEditingProduct(null);
    setFormData({ 
      name: "", sku: "", barcode: "", costPrice: 0, price: 0, margin: 0, categoryId: "", 
      color: "bg-slate-100 text-slate-700", commissionType: 'percentage', commissionValue: 0,
      initialQuantity: 0, initialBranchId: branches[0]?.id || "",
      availableSizes: [], availableColors: [], initialVariantQuantities: {}
    });
  };

  const exportToCSV = () => {
    const headers = ["ID", "Nombre", "SKU", "EAN", "Departamento", "Costo", "Precio", "Stock Total", "Unidad", "Estado"];
    const rows = inventoryView.map(p => [
      p.id,
      p.name,
      p.sku,
      p.barcode || "",
      categories.find(c => c.id === p.categoryId)?.name || "",
      p.costPrice,
      p.price,
      p.totalStock,
      p.unit || "uds",
      p.status || "active"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `inventario_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { addCategory, updateCategory } = useStore.getState();
    if (editingCategory) {
      updateCategory(editingCategory.id, categoryFormData);
    } else {
      addCategory({
        id: generateId('CAT'),
        ...categoryFormData
      } as Category);
    }
    setEditingCategory(null);
    setCategoryFormData({ name: "", department: "" });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const inventoryView = useMemo(() => {
    let filtered = products.map(product => {
      const productLevels = inventory.filter(i => i.productId === product.id && (selectedBranch === 'all' || i.branchId === selectedBranch));
      
      const totalStock = productLevels.reduce((acc, curr) => acc + curr.quantity, 0);
      const isLowStock = productLevels.some(i => i.quantity <= (product.minStockAlert || i.minQuantity));
      
      return {
        ...product,
        totalStock,
        isLowStock,
        levels: productLevels
      };
    });

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) || 
        item.sku.toLowerCase().includes(query) || 
        (item.barcode && item.barcode.includes(query))
      );
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter(p => p.categoryId === selectedCategory);
    }

    if (stockFilter === 'low') {
      filtered = filtered.filter(p => p.isLowStock);
    } else if (stockFilter === 'out') {
      filtered = filtered.filter(p => p.totalStock === 0);
    }

    return filtered;
  }, [products, inventory, searchQuery, selectedBranch, selectedCategory, stockFilter]);

  const formatMoney = (amount: number, currency = baseCurrency) => {
    const converted = currency.isBase ? amount : amount / (currency.rateToBase || 1);
    const formatted = converted.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${currency.symbol} ${formatted}`;
  };

  const MultiCurrencyDisplay = ({ amount }: { amount: number }) => (
    <div className="flex flex-col gap-0.5 mt-0.5">
      {currencies.map(c => (
        <div key={c.code} className={cn("flex justify-between items-center text-[9px]", c.isBase ? "font-black text-slate-900" : "font-bold text-slate-500")}>
          <span>{formatMoney(amount, c)}</span>
          <span className="text-[7px]">{c.code}</span>
        </div>
      ))}
    </div>
  );

  const stats = useMemo(() => {
    const activeProducts = inventoryView;
    const totalProducts = activeProducts.length;
    const totalStock = activeProducts.reduce((sum, p) => sum + p.totalStock, 0);
    const lowStockCount = activeProducts.filter(p => p.isLowStock).length;
    const totalCostValue = activeProducts.reduce((sum, p) => sum + (p.costPrice * p.totalStock), 0);
    const totalSaleValue = activeProducts.reduce((sum, p) => sum + (p.price * p.totalStock), 0);
    const totalProfit = totalSaleValue - totalCostValue;

    return { totalProducts, totalStock, lowStockCount, totalCostValue, totalSaleValue, totalProfit };
  }, [inventoryView]);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 px-1">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
            Inventario
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Control y Valoración de Stock</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setActiveTab('labels')}
            className="flex-1 sm:flex-none bg-slate-900 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-md active:scale-95"
          >
            Imprimir Etiquetas
          </button>
          <button 
            onClick={() => setActiveTab('abc')}
            className="flex-1 sm:flex-none bg-blue-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-md active:scale-95"
          >
            Análisis ABC
          </button>
          <button 
            onClick={() => {
              setEditingProduct(null);
              setFormData({ 
                name: "", sku: "", barcode: "", costPrice: 0, price: 0, margin: 0, categoryId: "", 
                color: "bg-slate-100 text-slate-700", commissionType: 'percentage', commissionValue: 0,
                initialQuantity: 0, initialBranchId: branches[0]?.id || ""
              });
              setShowAddModal(true);
            }}
            className="flex-1 sm:flex-none bg-indigo-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
          >
            <PackagePlus className="w-4 h-4" />
            Nuevo Producto
          </button>
        </div>
      </header>

      {/* Summary Cards Lineal - Ultra Compact */}
      <div className="flex flex-wrap gap-2 px-1 overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex-1 min-w-[130px] bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-0">
          <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-tight">Tipos de Prod.</span>
          <div className="text-[11px] font-black text-slate-900 leading-tight">{stats.totalProducts.toLocaleString()} tipos</div>
        </div>
        <div className="flex-1 min-w-[130px] bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-0">
          <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-tight">Valor Costo</span>
          <MultiCurrencyDisplay amount={stats.totalCostValue} />
        </div>
        <div className="flex-1 min-w-[130px] bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-0">
          <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-tight">Valor Venta</span>
          <MultiCurrencyDisplay amount={stats.totalSaleValue} />
        </div>
        <div className="flex-1 min-w-[130px] bg-indigo-50 p-2.5 rounded-xl border border-indigo-100 shadow-sm flex flex-col gap-0">
          <span className="text-[7px] font-black uppercase text-indigo-400 tracking-widest leading-tight">Ganancia Est.</span>
          <MultiCurrencyDisplay amount={stats.totalProfit} />
        </div>
        <div className="flex-1 min-w-[130px] bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-0">
          <span className="text-[7px] font-black uppercase text-rose-400 tracking-widest leading-tight">Bajo Stock</span>
          <div className="text-[11px] font-black text-rose-600 leading-tight">{stats.lowStockCount} alertas</div>
        </div>
      </div>

      {/* Advanced Unified Toolbar - Linear & Compact */}
      <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto">
            <div className="flex-1 relative flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Buscar productos..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold focus:bg-white focus:ring-1 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400"
                />
              </div>
              <InfoTooltip text="Busca productos por nombre, SKU o código de barras." position="bottom" />
            </div>
            
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1">
                <select 
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none hover:bg-slate-100 transition-colors cursor-pointer appearance-none min-w-[110px]"
                >
                  <option value="all">Sucs: Todas</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <InfoTooltip text="Filtra por una sucursal específica para ver su stock local." position="bottom" />
              </div>

              <div className="flex items-center gap-1">
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none hover:bg-slate-100 transition-colors cursor-pointer appearance-none min-w-[110px]"
                >
                  <option value="all">Cats: Todas</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <InfoTooltip text="Filtra los productos por su categoría o departamento." position="bottom" />
              </div>

            <button 
              onClick={() => setShowCategoryModal(true)}
              className="p-1.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm"
              title="Gestionar Categorías"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>

            <select 
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none hover:bg-slate-100 transition-colors cursor-pointer appearance-none min-w-[90px]"
            >
              <option value="all">Stock: Todo</option>
              <option value="low">Bajo Stock</option>
              <option value="out">Sin Exist.</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto justify-end border-t lg:border-t-0 pt-2 lg:pt-0">
          <div className="bg-slate-100/50 p-1 rounded-xl flex gap-1 border border-slate-100">
            <button 
              onClick={() => setViewMode('table')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                viewMode === 'table' ? "bg-white text-indigo-600 shadow-sm ring-1 ring-black/5" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                viewMode === 'grid' ? "bg-white text-indigo-600 shadow-sm ring-1 ring-black/5" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          <button 
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button 
            onClick={() => {
              setEditingProduct(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-hide">
        {(['products', 'transfers', 'labels', 'abc', 'restock'] as const)
          .filter(tab => tab !== 'transfers' || transfers.length > 0)
          .map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={cn(
              "whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === tab ? "bg-indigo-100 text-indigo-700" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
            )}
          >
            {tab === 'products' ? 'Productos' : tab === 'transfers' ? 'Historial de Traslados' : tab === 'labels' ? 'Impresión de Etiquetas' : tab === 'abc' ? 'Análisis ABC' : 'Alertas de Reabastecimiento'}
          </button>
        ))}
      </div>


      {/* Tab Content */}
      {activeTab === 'labels' && <PrintLabels />}
      {activeTab === 'abc' && <ABCAnalysis />}
      {activeTab === 'restock' && <RestockAlerts />}
      {activeTab === 'transfers' && <TransferHistory />}
      {activeTab === 'products' && (
        viewMode === 'table' ? (
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto h-full">
            <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 sticky top-0 z-10 backdrop-blur-sm">
                  <th className="w-16 px-6 py-4">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedItems.length === inventoryView.length && inventoryView.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedItems(inventoryView.map(i => i.id));
                        else setSelectedItems([]);
                      }}
                    />
                  </th>
                  <th className="w-1/4 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto / Cat</th>
                  <th className="w-40 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU / CB</th>
                  <th className="w-32 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Garantía</th>
                  <th className="w-40 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio (CUP)</th>
                  <th className="w-44 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Actual</th>
                  <th className="w-32 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventoryView.map((item) => (
                  <tr key={item.id} className={cn(
                    "hover:bg-slate-50/50 transition-colors group",
                    selectedItems.includes(item.id) && "bg-indigo-50/30"
                  )}>
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        checked={selectedItems.includes(item.id)}
                        onChange={() => {
                          setSelectedItems(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]);
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className={cn("w-full h-full opacity-20", item.color)} />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="text-xs font-black text-slate-900 uppercase tracking-tighter truncate flex items-center gap-1.5">
                            {item.name}
                            {item.isLowStock && <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" title="Bajo Stock" />}
                          </div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase truncate">{categories.find(c => c.id === item.categoryId)?.name || 'General'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[10px] font-mono font-black text-slate-900 uppercase truncate">{item.sku}</div>
                      <div className="text-[8px] text-slate-400 font-mono truncate">{item.barcode || '---'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className={cn("w-3.5 h-3.5", item.warrantyDays ? "text-emerald-500" : "text-slate-300")} />
                        <span className="text-[10px] font-bold text-slate-600">
                          {item.warrantyDays ? `${item.warrantyDays}d` : '---'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[10px] font-black text-slate-900 whitespace-nowrap">{formatMoney(item.price)}</div>
                      <div className="text-[8px] text-emerald-600 font-black whitespace-nowrap">GAN: {formatMoney(item.margin)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <span className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-black inline-block w-fit whitespace-nowrap",
                          item.totalStock === 0 ? "bg-rose-100 text-rose-600" :
                          item.isLowStock ? "bg-amber-100 text-amber-600" : 
                          "bg-emerald-100 text-emerald-600"
                        )}>
                          {item.totalStock} {item.unit || 'uds'}
                        </span>
                        {item.levels.filter(l => l.variantLabel).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.levels.filter(l => l.variantLabel).slice(0, 3).map((lvl, idx) => (
                              <span key={idx} className="text-[8px] font-bold text-slate-400 uppercase bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                {lvl.variantLabel}: {lvl.quantity}
                              </span>
                            ))}
                            {item.levels.filter(l => l.variantLabel).length > 3 && (
                              <span className="text-[7px] font-black text-slate-300 uppercase">+{item.levels.filter(l => l.variantLabel).length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button 
                          onClick={() => {
                            const { totalStock, isLowStock, levels, ...productOnly } = item as any;
                            setManagingStockProduct(productOnly);
                          }}
                          className="text-slate-400 hover:text-emerald-600 transition-colors p-2 rounded-xl hover:bg-emerald-50 border border-slate-100 shadow-sm"
                          title="Gestionar Stock"
                        >
                          <PackagePlus className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            const { totalStock, isLowStock, levels, ...productOnly } = item as any;
                            setEditingProduct(productOnly);
                            setFormData(productOnly);
                            setShowAddModal(true);
                          }}
                          className="text-slate-400 hover:text-indigo-600 transition-colors p-2 rounded-xl hover:bg-indigo-50 border border-slate-100 shadow-sm"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => window.confirm("¿Seguro que deseas eliminar este producto?") && deleteProduct(item.id)}
                          className="text-slate-400 hover:text-rose-600 transition-colors p-2 rounded-xl hover:bg-rose-50 border border-slate-100 shadow-sm"
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
            
            {/* Table Footer / Batch Actions */}
            {selectedItems.length > 0 && (
              <div className="bg-indigo-600 p-4 flex items-center justify-between text-white animate-in slide-in-from-bottom-full duration-300">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold">{selectedItems.length} seleccionados</span>
                  <div className="h-4 w-px bg-indigo-400" />
                  <button 
                    onClick={() => handleBatchUpdateStatus('active')}
                    className="text-xs font-black uppercase tracking-widest hover:text-indigo-200 transition-colors"
                  >
                    Marcar Activo
                  </button>
                  <button 
                    onClick={() => handleBatchUpdateStatus('discontinued')}
                    className="text-xs font-black uppercase tracking-widest hover:text-amber-200 transition-colors"
                  >
                    Descontinuar
                  </button>
                  <button 
                    onClick={() => setShowBatchPriceModal(true)}
                    className="text-xs font-black uppercase tracking-widest hover:text-emerald-200 transition-colors"
                  >
                    Ajustar Precios
                  </button>
                  <button 
                    onClick={handleBatchDelete}
                    className="text-xs font-black uppercase tracking-widest hover:text-rose-200 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
                <button onClick={() => setSelectedItems([])} className="text-xs font-black uppercase tracking-widest hover:text-indigo-200">Cancelar</button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pr-2">
            {inventoryView.map((item) => (
              <div key={item.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative">
                <div className="h-40 bg-slate-100 relative">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className={cn("w-full h-full opacity-20", item.color)} />
                  )}
                  <div className="absolute top-3 left-3 flex flex-col gap-1">
                    <span className={cn(
                      "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-white shadow-sm",
                      item.totalStock === 0 ? "bg-rose-500" :
                      item.isLowStock ? "bg-amber-500" : "bg-emerald-500"
                    )}>
                      {item.totalStock === 0 ? 'Sin Stock' : item.isLowStock ? 'Bajo Stock' : 'Stock OK'}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                    <button 
                      onClick={() => {
                        const { totalStock, isLowStock, levels, ...productOnly } = item as any;
                        setEditingProduct(productOnly);
                        setFormData(productOnly);
                        setShowAddModal(true);
                      }}
                      className="bg-white/90 backdrop-blur-sm p-2 rounded-xl shadow-sm text-slate-600 hover:text-indigo-600"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight line-clamp-1">{item.name}</h3>
                    <p className="text-[10px] font-mono text-slate-400 font-bold uppercase">{item.sku}</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Precio Venta</p>
                      <p className="text-sm font-black text-slate-900">{formatMoney(item.price)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Stock</p>
                      <p className={cn(
                        "text-sm font-black",
                        item.isLowStock ? "text-rose-600" : "text-emerald-600"
                      )}>{item.totalStock} {item.unit || 'uds'}</p>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-slate-50">
                    <button 
                      onClick={() => {
                        const { totalStock, isLowStock, levels, ...productOnly } = item as any;
                        setManagingStockProduct(productOnly);
                      }}
                      className="w-full py-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <PackagePlus className="w-4 h-4" />
                      Gestionar Stock
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-white/20">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ficha técnica y stock</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* Imagen y Datos Básicos */}
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-40 shrink-0">
                  <div className="flex items-center mb-1 ml-1">
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Imagen del Producto</label>
                    <InfoTooltip text="Haz clic para subir una imagen representativa del producto. Formatos soportados: JPG, PNG." />
                  </div>
                  <div className="relative group aspect-square">
                    <div className="w-full h-full rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden transition-colors group-hover:border-indigo-300">
                      {formData.image ? (
                        <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <PackagePlus className="w-6 h-6" />
                          <span className="text-[8px] font-black uppercase">Subir Foto</span>
                        </div>
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    {formData.image && (
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, image: undefined})}
                        className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center mb-1 ml-1">
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Nombre</label>
                        <InfoTooltip text="Nombre descriptivo del producto que verán tus clientes en el recibo y sistema." />
                      </div>
                      <input type="text" required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none text-xs font-bold" placeholder="Ej: Smart TV 55" />
                    </div>
                    <div>
                      <div className="flex items-center mb-1 ml-1">
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Categoría</label>
                        <InfoTooltip text="Selecciona la categoría a la que pertenece el producto para organizarlo mejor." />
                      </div>
                      <select required value={formData.categoryId || ''} onChange={e => setFormData({...formData, categoryId: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none text-xs font-bold">
                        <option value="">Seleccione Categoría...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.department} - {c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center mb-1 ml-1">
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">SKU</label>
                        <InfoTooltip text="Stock Keeping Unit: Código interno único para identificar este producto en tu inventario." />
                      </div>
                      <div className="flex gap-1">
                        <input type="text" required value={formData.sku || ''} onChange={e => setFormData({...formData, sku: e.target.value})} className="flex-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none text-[10px] font-mono font-black uppercase" />
                        <button type="button" onClick={() => setFormData({...formData, sku: `SKU-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`})} className="px-2 py-2 bg-slate-100 text-slate-500 rounded-xl text-[8px] font-black uppercase hover:bg-slate-200">Gen</button>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center mb-1 ml-1">
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Cód. Barras</label>
                        <InfoTooltip text="(Opcional) Código de barras global para escanear el producto con un lector." />
                      </div>
                      <div className="flex gap-1">
                        <input type="text" value={formData.barcode || ''} onChange={e => setFormData({...formData, barcode: e.target.value})} className="flex-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-100 outline-none text-[10px] font-mono font-black" />
                        <button type="button" onClick={() => setFormData({...formData, barcode: `750${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`})} className="px-2 py-2 bg-slate-100 text-slate-500 rounded-xl text-[8px] font-black uppercase hover:bg-slate-200">Gen</button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center mb-1 ml-1">
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Unidad de Medida</label>
                        <InfoTooltip text="Cómo se vende el producto (por unidad, a granel en kg o litros, etc)." />
                      </div>
                      <select 
                        value={formData.unit || 'unidad'} 
                        onChange={e => setFormData({...formData, unit: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-indigo-100"
                      >
                        <option value="unidad">Unidad (uds)</option>
                        <option value="kg">Kilogramo (kg)</option>
                        <option value="m">Metro (m)</option>
                        <option value="par">Par</option>
                        <option value="caja">Caja</option>
                        <option value="litro">Litro (L)</option>
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center mb-1 ml-1">
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Estado del Producto</label>
                        <InfoTooltip text="Activo: se puede vender. Descontinuado: no se reabastecerá. Borrador: oculto en POS." />
                      </div>
                      <select 
                        value={formData.status || 'active'} 
                        onChange={e => setFormData({...formData, status: e.target.value as any})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-indigo-100"
                      >
                        <option value="active">Activo</option>
                        <option value="discontinued">Descontinuado</option>
                        <option value="draft">Borrador</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Rastrear por Serial</label>
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl">
                        <input 
                          type="checkbox" 
                          checked={formData.hasSerial || false} 
                          onChange={e => setFormData({...formData, hasSerial: e.target.checked})}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[10px] font-black text-slate-700 uppercase">Habilitar Seriales</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Tipo de Producto</label>
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl">
                        <input 
                          type="checkbox" 
                          checked={formData.isKit || false} 
                          onChange={e => setFormData({...formData, isKit: e.target.checked})}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[10px] font-black text-slate-700 uppercase">Es un KIT / COMBO</span>
                      </div>
                    </div>
                  </div>

                  {formData.isKit && (
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Componentes del Kit</label>
                        <button 
                          type="button"
                          onClick={() => setShowKitPicker(true)}
                          className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase"
                        >
                          Agregar Producto
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {(formData.kitComponents || []).map((comp, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-indigo-100">
                            <span className="text-[10px] font-bold text-slate-600 uppercase">
                              {products.find(p => p.id === comp.productId)?.name}
                            </span>
                            <div className="flex items-center gap-3">
                              <input 
                                type="number" 
                                value={comp.quantity}
                                onChange={e => {
                                  const newComps = [...(formData.kitComponents || [])];
                                  newComps[idx].quantity = parseInt(e.target.value) || 1;
                                  setFormData({...formData, kitComponents: newComps});
                                }}
                                className="w-12 px-1 py-0.5 border border-slate-200 rounded text-center text-[10px] font-black"
                              />
                              <button 
                                type="button" 
                                onClick={() => setFormData({...formData, kitComponents: (formData.kitComponents || []).filter((_, i) => i !== idx)})}
                                className="text-rose-500 hover:bg-rose-50 p-1 rounded"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {(formData.kitComponents || []).length === 0 && (
                          <p className="text-[9px] font-bold text-indigo-400 uppercase text-center py-2">Agrega productos que componen este combo</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Alerta de Stock Mínimo (Global)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={formData.minStockAlert ?? ''} 
                      onChange={e => setFormData({...formData, minStockAlert: parseInt(e.target.value) || undefined})} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black outline-none focus:ring-1 focus:ring-indigo-100" 
                      placeholder="Ej: 5"
                    />
                  </div>
                </div>
              </div>

              {/* Variantes (Tallas / Colores) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Variantes (Tallas, Números, Colores)</label>
                  <InfoTooltip text="Define las opciones disponibles para este producto (ej: S, M, L o 40, 41, 42). El stock se manejará por cada variante." />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Tallas / Números</label>
                    <div className="flex gap-1">
                      <input 
                        type="text" 
                        value={newSize} 
                        onChange={e => setNewSize(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), newSize && setFormData({...formData, availableSizes: [...(formData.availableSizes || []), newSize]}), setNewSize(""))}
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none" 
                        placeholder="Ej: 42 o L" 
                      />
                      <button 
                        type="button"
                        onClick={() => { if(newSize) { setFormData({...formData, availableSizes: [...(formData.availableSizes || []), newSize]}); setNewSize(""); } }}
                        className="px-3 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase"
                      >+</button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(formData.availableSizes || []).map(size => (
                        <span key={size} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-black uppercase">
                          {size}
                          <button type="button" onClick={() => setFormData({...formData, availableSizes: (formData.availableSizes || []).filter(s => s !== size)})}><X className="w-2.5 h-2.5" /></button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Colores / Otros</label>
                    <div className="flex gap-1">
                      <input 
                        type="text" 
                        value={newColor} 
                        onChange={e => setNewColor(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), newColor && setFormData({...formData, availableColors: [...(formData.availableColors || []), newColor]}), setNewColor(""))}
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none" 
                        placeholder="Ej: Azul o Cuero" 
                      />
                      <button 
                        type="button"
                        onClick={() => { if(newColor) { setFormData({...formData, availableColors: [...(formData.availableColors || []), newColor]}); setNewColor(""); } }}
                        className="px-3 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase"
                      >+</button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(formData.availableColors || []).map(color => (
                        <span key={color} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black uppercase">
                          {color}
                          <button type="button" onClick={() => setFormData({...formData, availableColors: (formData.availableColors || []).filter(c => c !== color)})}><X className="w-2.5 h-2.5" /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Economy and Features */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Economía */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 col-span-2 md:col-span-1">
                    <div className="flex items-center mb-1">
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Costo (CUP)</label>
                      <InfoTooltip text="El precio que pagas a tus proveedores por este producto." />
                    </div>
                    <input type="number" required value={formData.costPrice ?? 0} onChange={e => handleCostPriceChange(parseFloat(e.target.value) || 0, formData.price || 0)} className="w-full px-2 py-1 bg-white border border-slate-100 rounded-lg outline-none font-black text-slate-900 text-sm" />
                  </div>
                  <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100">
                    <div className="flex items-center mb-1">
                      <label className="block text-[8px] font-black text-indigo-400 uppercase tracking-widest">Precio (CUP)</label>
                      <InfoTooltip text="El precio final al que venderás este producto a tus clientes." />
                    </div>
                    <input type="number" required value={formData.price ?? 0} onChange={e => handleCostPriceChange(formData.costPrice || 0, parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 bg-white border border-indigo-100 rounded-lg outline-none font-black text-indigo-700 text-sm" />
                  </div>
                  <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100 flex flex-col justify-center">
                    <label className="block text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-0.5 text-center">Ganancia</label>
                    <div className="text-sm font-black text-emerald-600 text-center">
                      CUP {formData.margin?.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Warranty and Series */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col justify-center gap-2">
                    <div className="flex items-center">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={formData.hasSerial || false}
                          onChange={(e) => setFormData({...formData, hasSerial: e.target.checked})}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Registrar Series (S/N)</span>
                      </label>
                      <InfoTooltip text="Actívalo si vendes equipos (celulares, electrodomésticos) y necesitas registrar el IMEI o Número de Serie de cada unidad en la venta." />
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="flex items-center mb-1">
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Días de Garantía</label>
                      <InfoTooltip text="Tiempo en días de garantía. Se imprimirá en el recibo. Deja 0 si no tiene garantía." />
                    </div>
                    <input 
                      type="number" 
                      min="0"
                      placeholder="0 = Sin Garantía"
                      value={formData.warrantyDays ?? ''} 
                      onChange={e => setFormData({...formData, warrantyDays: parseInt(e.target.value) || undefined})} 
                      className="w-full px-2 py-1 bg-white border border-slate-100 rounded-lg outline-none font-black text-slate-900 text-sm" 
                    />
                  </div>
                </div>
              </div>

              {/* Stock Inicial (Solo para nuevos productos) */}
              {!editingProduct && (
                <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 space-y-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-2 border-b border-emerald-100 pb-3">
                    <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                      <PackagePlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-emerald-900 uppercase tracking-widest">Inventario Inicial</h3>
                      <p className="text-[9px] font-bold text-emerald-700 uppercase">¿Con cuánto stock ingresa este producto?</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1 ml-1">Sucursal de Almacenamiento Inicial</label>
                    <select 
                      value={formData.initialBranchId || (branches.length > 0 ? branches[0].id : '')} 
                      onChange={e => setFormData({...formData, initialBranchId: e.target.value})}
                      className="w-full px-4 py-3 bg-white border border-emerald-200 rounded-xl text-xs font-black uppercase outline-none focus:ring-2 focus:ring-emerald-500/20 text-emerald-900 shadow-inner"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  {((formData.availableSizes || []).length > 0 || (formData.availableColors || []).length > 0) ? (
                    <div>
                      <label className="block text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1 ml-1">Stock Inicial por Variante</label>
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {Array.from(new Set([...(formData.availableSizes || []), ...(formData.availableColors || [])])).map(variant => (
                          <div key={variant} className="flex justify-between items-center bg-white p-3 rounded-xl border border-emerald-200 shadow-sm">
                            <span className="text-xs font-black text-slate-700 uppercase tracking-tight ml-2">{variant}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-emerald-600 uppercase">Cantidad:</span>
                              <input 
                                type="number" 
                                min="0"
                                value={formData.initialVariantQuantities?.[variant] || ''}
                                onChange={e => {
                                  const newVariants = { ...formData.initialVariantQuantities };
                                  newVariants[variant] = parseInt(e.target.value) || 0;
                                  setFormData({...formData, initialVariantQuantities: newVariants});
                                }}
                                className="w-24 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-black text-center text-emerald-900"
                                placeholder="0"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1 ml-1">Cantidad Inicial (Stock)</label>
                      <input 
                        type="number" 
                        min="0"
                        value={formData.initialQuantity ?? 0} 
                        onChange={e => setFormData({...formData, initialQuantity: parseInt(e.target.value) || 0})}
                        className="w-full px-4 py-3 bg-white border border-emerald-200 rounded-xl text-lg font-black outline-none focus:ring-2 focus:ring-emerald-500/20 text-emerald-900 shadow-inner"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Comisiones */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Comisión del Vendedor</label>
                <div className="flex gap-4">
                  <select 
                    required 
                    value={formData.commissionType} 
                    onChange={e => setFormData({...formData, commissionType: e.target.value as 'percentage' | 'fixed'})} 
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="percentage">% Porcentaje</option>
                    <option value="fixed">CUP Fijo</option>
                  </select>
                  <div className="relative w-32">
                    <input 
                      type="number" 
                      step="0.01" 
                      required 
                      value={formData.commissionValue ?? 0} 
                      onChange={e => setFormData({...formData, commissionValue: parseFloat(e.target.value) || 0})} 
                      className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black outline-none focus:ring-2 focus:ring-indigo-500/20" 
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 uppercase">
                      {formData.commissionType === 'percentage' ? '%' : 'CUP'}
                    </span>
                  </div>
                </div>
              </div>
            </form>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 rounded-xl transition-all">Cancelar</button>
              <button onClick={handleAddSubmit} className="flex-[2] py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95">
                {editingProduct ? 'Guardar Cambios' : 'Registrar Producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nueva Categoría */}
      {/* (Categoría funcionalidad eliminada) */}

      {managingStockProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Gestionar Stock</h2>
                <p className="text-xs text-slate-500 font-medium">{managingStockProduct.name}</p>
              </div>
              <button onClick={() => setManagingStockProduct(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-full hover:bg-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {branches.map(branch => {
                const productVariants = [
                  undefined, 
                  ...(managingStockProduct.availableSizes || []), 
                  ...(managingStockProduct.availableColors || [])
                ];

                return (
                  <div key={branch.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{branch.name}</p>
                    
                    <div className="space-y-2">
                      {productVariants.map(variant => {
                        const level = inventory.find(i => 
                          i.productId === managingStockProduct.id && 
                          i.branchId === branch.id && 
                          i.variantLabel === variant
                        ) || { quantity: 0, minQuantity: 5 };

                        return (
                          <div key={variant || 'base'} className="flex items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200/50">
                            <div className="flex-1">
                              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                {variant ? `Variante: ${variant}` : 'Producto Base'}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Mínimo:</label>
                                <input 
                                  type="number" 
                                  min="0"
                                  value={level.minQuantity} 
                                  onChange={(e) => setInventoryQuantity(managingStockProduct.id, branch.id, level.quantity, variant, parseInt(e.target.value) || 0)}
                                  className="w-12 px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded text-[10px] outline-none"
                                />
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                              <input 
                                type="number" 
                                min="0"
                                value={level.quantity} 
                                onChange={(e) => setInventoryQuantity(managingStockProduct.id, branch.id, parseInt(e.target.value) || 0, variant, level.minQuantity)}
                                className="w-20 px-2 py-1 bg-white border border-indigo-200 rounded-lg font-black text-indigo-700 text-right outline-none text-xs"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-slate-50">
              <button 
                onClick={() => setManagingStockProduct(null)} 
                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
              >
                Cerrar y Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchPriceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Ajuste de Precios Masivo</h3>
              <button onClick={() => setShowBatchPriceModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest text-center mb-4">Afectando a {selectedItems.length} productos</p>
              
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setBatchPriceAdjust({...batchPriceAdjust, direction: 'increase'})}
                  className={cn("py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", batchPriceAdjust.direction === 'increase' ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500/20" : "bg-slate-50 text-slate-400 hover:bg-slate-100")}
                >Incrementar</button>
                <button 
                  onClick={() => setBatchPriceAdjust({...batchPriceAdjust, direction: 'decrease'})}
                  className={cn("py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", batchPriceAdjust.direction === 'decrease' ? "bg-rose-100 text-rose-700 ring-2 ring-rose-500/20" : "bg-slate-50 text-slate-400 hover:bg-slate-100")}
                >Decrementar</button>
              </div>

              <div className="flex gap-2">
                <select 
                  value={batchPriceAdjust.type}
                  onChange={(e) => setBatchPriceAdjust({...batchPriceAdjust, type: e.target.value as any})}
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black uppercase outline-none"
                >
                  <option value="percentage">Porcentaje (%)</option>
                  <option value="fixed">Monto Fijo (CUP)</option>
                </select>
                <input 
                  type="number" 
                  value={batchPriceAdjust.value || ''}
                  onChange={(e) => setBatchPriceAdjust({...batchPriceAdjust, value: parseFloat(e.target.value) || 0})}
                  className="w-32 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="0.00"
                />
              </div>

              <button 
                onClick={handleBatchPriceApply}
                className="w-full py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-[0.98] mt-4"
              >Aplicar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* Kit Component Picker Modal */}
      {showKitPicker && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Seleccionar Componente</h3>
              <button onClick={() => setShowKitPicker(false)} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar producto..." 
                  value={kitQuery}
                  onChange={e => setKitQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none"
                />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2 px-1 custom-scrollbar">
                {products
                  .filter(p => !p.isKit && (p.name.toLowerCase().includes(kitQuery.toLowerCase()) || p.sku.toLowerCase().includes(kitQuery.toLowerCase())))
                  .slice(0, 10)
                  .map(p => (
                    <button 
                      key={p.id}
                      type="button"
                      onClick={() => {
                        const existing = (formData.kitComponents || []).find(c => c.productId === p.id);
                        if (!existing) {
                          setFormData({
                            ...formData, 
                            kitComponents: [...(formData.kitComponents || []), { productId: p.id, quantity: 1 }]
                          });
                        }
                        setShowKitPicker(false);
                      }}
                      className="w-full flex items-center justify-between p-3 bg-white hover:bg-indigo-50 border border-slate-100 rounded-2xl transition-all"
                    >
                      <div className="text-left">
                        <p className="text-[10px] font-black text-slate-900 uppercase">{p.name}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">{p.sku}</p>
                      </div>
                      <Plus className="w-4 h-4 text-indigo-400" />
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Categorías */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase">Gestionar Categorías</h2>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Organización del catálogo</p>
              </div>
              <button onClick={() => setShowCategoryModal(false)} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <form onSubmit={handleCategorySubmit} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Nombre</label>
                    <input 
                      required
                      type="text" 
                      value={categoryFormData.name}
                      onChange={e => setCategoryFormData({...categoryFormData, name: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-100"
                      placeholder="Ej: Smartphones"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Departamento</label>
                    <input 
                      required
                      type="text" 
                      value={categoryFormData.department}
                      onChange={e => setCategoryFormData({...categoryFormData, department: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-100"
                      placeholder="Ej: Electrónica"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  {editingCategory && (
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingCategory(null);
                        setCategoryFormData({ name: "", department: "", color: "bg-slate-100", icon: "Tag" });
                      }}
                      className="px-4 py-2 text-[10px] font-black uppercase text-slate-400"
                    >
                      Cancelar
                    </button>
                  )}
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100"
                  >
                    {editingCategory ? 'Actualizar' : 'Agregar'}
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1">Existentes</h3>
                <div className="grid grid-cols-1 gap-2">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-2xl group hover:border-indigo-100 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <Tag className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">{cat.name}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{cat.department}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingCategory(cat);
                            setCategoryFormData({ name: cat.name, department: cat.department });
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => window.confirm("¿Eliminar categoría?") && deleteCategory(cat.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
