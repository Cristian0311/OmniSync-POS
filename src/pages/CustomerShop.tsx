import { useState, useMemo, useEffect } from "react";
import {
  ShoppingCart,
  Plus,
  Minus,
  QrCode,
  Trash2,
  ArrowLeft,
  Search,
  Store,
  Tag,
  ChevronRight,
  PackageSearch
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useStore } from "../store/useStore";
import { CartItem, Product } from "../types";
import { cn } from "../lib/utils";

export default function CustomerShop() {
  const {
    products,
    categories,
    getBaseCurrency,
    inventory,
    branches,
    catalogConfig,
    initializeFromSupabase
  } = useStore();
  const baseCurrency = getBaseCurrency();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("Todos");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeFromSupabase().finally(() => {
      setIsLoading(false);
    });
  }, [initializeFromSupabase]);

  const visibleBranches = useMemo(() => {
    if (!catalogConfig.visibleBranches || catalogConfig.visibleBranches.length === 0) return branches;
    return branches.filter(b => catalogConfig.visibleBranches?.includes(b.id));
  }, [branches, catalogConfig.visibleBranches]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    visibleBranches[0]?.id || "",
  );

  // Sync selected branch if it disappears from visible list
  useEffect(() => {
    if (selectedBranchId && !visibleBranches.find(b => b.id === selectedBranchId)) {
      setSelectedBranchId(visibleBranches[0]?.id || "");
    }
  }, [visibleBranches, selectedBranchId]);
  const [searchQuery, setSearchQuery] = useState("");
  const [orderCode, setOrderCode] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchesCategory =
          activeCategoryId === "Todos" || p.categoryId === activeCategoryId;
        const matchesSearch =
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .map((product) => {
        const totalStock = inventory
          .filter(
            (i) =>
              i.productId === product.id && i.branchId === selectedBranchId,
          )
          .reduce((sum, curr) => sum + curr.quantity, 0);
        return { ...product, totalStock };
      });
  }, [
    products,
    activeCategoryId,
    searchQuery,
    inventory,
    selectedBranchId,
  ]);

  const formatMoney = (amount: number, currency = baseCurrency) => {
    const converted = amount * currency.rateToBase;
    const formatted = converted.toLocaleString("es-CU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${currency.symbol} ${formatted}`;
  };

  const allCurrencies = useStore.getState().currencies;

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, { id: crypto.randomUUID(), product, quantity: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            return { ...item, quantity: Math.max(0, item.quantity + delta) };
          }
          return item;
        })
        .filter((i) => i.quantity > 0),
    );
  };

  const total = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCreateOrder = () => {
    const simplifiedCart = cart.map(item => ({
      id: item.product.id,
      q: item.quantity
    }));
    const payload = `APP_ORDER:${JSON.stringify({ i: simplifiedCart })}`;
    setOrderCode(payload);
    setCart([]);
  };

  if (orderCode) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-md w-full animate-in zoom-in-95 duration-300">
          <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <QrCode className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">
            ¡Tu pedido está listo!
          </h1>
          <p className="text-sm font-bold text-slate-500 mb-8 uppercase tracking-widest leading-relaxed">
            Muestra este código QR al cajero para procesar tu compra de inmediato.
          </p>

          <div className="bg-white p-6 rounded-3xl border-2 border-indigo-50 shadow-inner mb-8 flex justify-center inline-block">
            <QRCodeSVG value={orderCode} size={220} level="H" className="drop-shadow-sm" />
          </div>

          {catalogConfig.whatsappNumber && (
            <button
              onClick={() => {
                const text = `¡Hola! Tengo un pedido nuevo (QR generado en tienda).\nCódigo de pedido: ${orderCode}`;
                window.open(`https://wa.me/${catalogConfig.whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="w-full mb-3 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-200 active:scale-95 flex justify-center items-center gap-2"
            >
              Enviar por WhatsApp
            </button>
          )}

          <button
            onClick={() => {
              setOrderCode(null);
              setIsCartOpen(false);
            }}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg active:scale-95"
          >
            Nueva Orden
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Sleek Header */}
      <header className="bg-white sticky top-0 z-20 border-b border-slate-100 px-4 sm:px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none">Tienda en Línea</h1>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Catálogo Digital</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <select
            value={selectedBranchId}
            onChange={(e) => {
              setSelectedBranchId(e.target.value);
              setCart([]); 
            }}
            className="hidden sm:block px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-black text-slate-700 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
          >
            {visibleBranches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative bg-slate-900 p-3 rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200 active:scale-95"
          >
            <ShoppingCart className="w-5 h-5 text-white" />
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto w-full max-w-7xl mx-auto p-4 sm:p-8">
        
        {/* Mobile Branch Selector */}
        <div className="sm:hidden mb-6">
           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Seleccionar Sucursal</label>
           <select
            value={selectedBranchId}
            onChange={(e) => {
              setSelectedBranchId(e.target.value);
              setCart([]); 
            }}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-xs font-black text-slate-700 uppercase tracking-widest shadow-sm"
          >
            {visibleBranches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Hero Section & Search */}
        <div 
          className="rounded-3xl p-6 sm:p-10 text-white mb-8 shadow-xl relative overflow-hidden"
          style={{ backgroundColor: catalogConfig.themeColor || '#4f46e5' }}
        >
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter mb-2 whitespace-pre-wrap">
              {catalogConfig.bannerText || 'Descubre Nuestros Productos'}
            </h2>
            <p className="text-white/80 text-xs sm:text-sm font-bold uppercase tracking-widest mb-6">Encuentra exactamente lo que necesitas</p>
            
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por nombre o SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl outline-none text-sm font-bold text-slate-900 placeholder:text-slate-400 shadow-lg"
              />
            </div>
          </div>
        </div>

        {/* Categories Navigation */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Categorías</h3>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
            <button
              onClick={() => setActiveCategoryId("Todos")}
              className={cn(
                "px-6 py-3 rounded-2xl whitespace-nowrap text-[10px] font-black uppercase tracking-widest transition-all",
                activeCategoryId === "Todos"
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                  : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={cn(
                  "px-6 py-3 rounded-2xl whitespace-nowrap text-[10px] font-black uppercase tracking-widest transition-all",
                  activeCategoryId === cat.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                    : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <PackageSearch className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-2">No se encontraron productos</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Intenta ajustar tu búsqueda o categoría</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const isOutOfStock = product.totalStock <= 0;
              return (
                <div
                  key={product.id}
                  className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                >
                  <div className="relative w-full aspect-square rounded-2xl bg-slate-50 mb-5 flex items-center justify-center overflow-hidden">
                    <div className={cn("absolute inset-0 opacity-20 transition-transform duration-500 group-hover:scale-110", product.color)}></div>
                    <span className="relative z-10 text-5xl font-black text-slate-800 opacity-50 drop-shadow-sm">
                      {product.name.charAt(0)}
                    </span>
                    {isOutOfStock && (
                      <div className="absolute top-3 right-3 bg-rose-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md">
                        Agotado
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col">
                    <div className="mb-4">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter leading-tight mb-1 line-clamp-2">
                        {product.name}
                      </h3>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                        {categories.find((c) => c.id === product.categoryId)?.name || "General"}
                      </p>
                    </div>
                    
                    {catalogConfig.showPrices && (
                      <div className="mt-auto space-y-2 mb-5 p-3 bg-slate-50 rounded-xl">
                        {allCurrencies.map(currency => (
                          <div key={currency.code} className="flex justify-between items-center">
                            <span className={cn(
                              "font-black tracking-tight",
                              currency.isBase ? "text-indigo-600 text-sm" : "text-slate-400 text-xs"
                            )}>
                              {formatMoney(product.price, currency)}
                            </span>
                            <span className="text-[8px] font-black text-slate-400 uppercase">{currency.code}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {!catalogConfig.showPrices && (
                      <div className="mt-auto mb-5 p-3 bg-slate-50 rounded-xl">
                        <span className="text-xs font-black text-slate-600 tracking-widest uppercase block text-center">Disponible</span>
                      </div>
                    )}
                    
                    <button
                      onClick={() => !isOutOfStock && addToCart(product)}
                      disabled={isOutOfStock}
                      className={cn(
                        "w-full py-3.5 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
                        isOutOfStock
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-slate-900 text-white hover:bg-slate-800 shadow-md active:scale-95"
                      )}
                    >
                      {isOutOfStock ? (
                        "Sin Disponibilidad"
                      ) : (
                        <>
                          <Plus className="w-4 h-4" /> Agregar al Carrito
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Checkout Button for Mobile */}
      {itemCount > 0 && !isCartOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm sm:hidden z-20">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl flex items-center justify-between active:scale-95 transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <span>{itemCount} Productos</span>
            </div>
            <div className="flex items-center gap-2">
              {catalogConfig.showPrices && <span>{formatMoney(total)}</span>}
              <ChevronRight className="w-4 h-4 opacity-50" />
            </div>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-700" />
                </button>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tu Pedido</h2>
              </div>
              <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                {itemCount} items
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                    <ShoppingCart className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="text-xs font-black uppercase tracking-widest">Tu carrito está vacío</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 bg-white border border-slate-100 p-4 rounded-2xl shadow-sm hover:border-indigo-100 transition-colors"
                  >
                    <div
                      className={cn("w-16 h-16 rounded-xl flex items-center justify-center shrink-0 opacity-80", item.product.color)}
                    >
                      <span className="font-black text-xl text-slate-900 opacity-50">
                        {item.product.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <h4 className="font-black text-slate-900 text-xs uppercase tracking-tighter leading-tight mb-1">
                        {item.product.name}
                      </h4>
                      {catalogConfig.showPrices && (
                        <div className="font-black text-indigo-600 text-sm">
                          {formatMoney(item.product.price)}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <button
                        onClick={() => updateQty(item.id, -item.quantity)}
                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                        <button
                          onClick={() => updateQty(item.id, -1)}
                          className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors shadow-sm"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-black text-xs w-6 text-center text-slate-700">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(item.id, 1)}
                          className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors shadow-sm"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-slate-100 p-6 bg-slate-50 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
                {catalogConfig.showPrices && (
                  <div className="flex justify-between items-end mb-6">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Total Estimado
                    </span>
                    <span className="text-3xl font-black text-slate-900 tracking-tighter">
                      {formatMoney(total)}
                    </span>
                  </div>
                )}
                <button
                  onClick={handleCreateOrder}
                  className="w-full bg-indigo-600 text-white font-black text-xs uppercase tracking-widest py-5 rounded-2xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-3 shadow-xl shadow-indigo-200 active:scale-95"
                >
                  <QrCode className="w-5 h-5" />
                  Generar Código de Pago
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
