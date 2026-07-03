import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Store,
  Settings,
  Menu,
  RotateCcw,
  Calculator,
  ArrowLeftRight,
  BarChart,
  UserCircle,
  LogOut,
  Truck,
  ClipboardCheck,
  Wifi,
  WifiOff,
  CloudOff,
  CreditCard,
  FileText,
  Clock
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { useStore } from "../store/useStore";

const adminNavItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Punto de Venta", href: "/pos", icon: ShoppingCart },
  { name: "Caja (POS)", href: "/cash", icon: Calculator },
  { name: "Transferencias", href: "/transfers", icon: ArrowLeftRight },
  { name: "Clientes (POS)", href: "/customers", icon: UserCircle },
  { name: "Inventario", href: "/inventory", icon: Package },
  { name: "Auditoría Stock", href: "/inventory-audit", icon: ClipboardCheck },
  { name: "Proveedores", href: "/suppliers", icon: Truck },
  { name: "Cuentas Bancarias", href: "/banks", icon: CreditCard },
  { name: "Catálogo QR", href: "/catalog", icon: Store },
  { name: "Cotizaciones", href: "/quotes", icon: FileText },
  { name: "Devoluciones", href: "/returns", icon: RotateCcw },
  { name: "Reportes", href: "/reports", icon: BarChart },
  { name: "Empleados", href: "/users", icon: Users },
  { name: "Configuración", href: "/settings", icon: Settings },
];

const cashierNavItems = [
  { name: "Punto de Venta", href: "/pos", icon: ShoppingCart },
  { name: "Caja (POS)", href: "/cash", icon: Calculator },
  { name: "Transferencias", href: "/transfers", icon: ArrowLeftRight },
  { name: "Clientes (POS)", href: "/customers", icon: UserCircle },
  { name: "Tienda Web (Admin)", href: "/catalog", icon: Store },
  { name: "Cotizaciones", href: "/quotes", icon: FileText },
  { name: "Devoluciones", href: "/returns", icon: RotateCcw },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { currentUser, logout, isOffline } = useStore();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const navItems =
    currentUser?.role === "admin" ? adminNavItems : cashierNavItems;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-indigo-600 text-white p-4 flex justify-between items-center shadow-md">
        <h1 className="text-xl font-bold tracking-tight">OmniPOS</h1>
        <button onClick={() => setSidebarOpen(!sidebarOpen)}>
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-100 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 flex flex-col h-full",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="p-8 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
              Omni<span className="text-indigo-600">POS</span>
            </h1>
            {isOffline && (
               <div className="flex items-center space-x-1 text-orange-500 bg-orange-50 px-2 py-1 rounded-full text-[8px] font-bold uppercase" title="Modo Offline Activo">
                 <CloudOff className="w-3 h-3" />
               </div>
            )}
          </div>
          <p className="text-[8px] text-slate-400 mt-0.5 uppercase tracking-[0.2em] font-black">Sistema de Gestión</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar pb-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
              >
                {({ isActive }) => (
                  <div className={cn(
                    "flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 group",
                    isActive
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                      : "text-slate-400 hover:bg-slate-50 hover:text-slate-900"
                  )}>
                    <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-white" : "text-slate-300 group-hover:text-indigo-500")} />
                    <span className="font-bold text-[10px] uppercase tracking-widest">{item.name}</span>
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="shrink-0 p-6 bg-white border-t border-slate-50">
          <div className="mb-4 px-2">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors",
              isOnline ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
            )}>
              {isOnline ? (
                <Wifi className="w-3.5 h-3.5" />
              ) : (
                <WifiOff className="w-3.5 h-3.5" />
              )}
              <span>{isOnline ? "Online" : "Modo Offline"}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-[10px] uppercase">
              {currentUser?.name.charAt(0)}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-900 uppercase leading-none mb-1">
                {currentUser?.name}
              </p>
              <p className="text-[8px] text-slate-400 uppercase tracking-widest font-bold">
                {currentUser?.role}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center justify-center space-x-2 px-4 py-2.5 w-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all text-[9px] font-black uppercase tracking-[0.15em]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Salir</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col relative">
        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <div className="flex-1 overflow-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
