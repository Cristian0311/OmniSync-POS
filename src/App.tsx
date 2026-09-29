import { useShallow } from 'zustand/react/shallow';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import { useStore } from "./store/useStore";
import { initMultiDeviceRealtimeSync } from "./services/realtimeSync";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Code-splitting de rutas para acelerar inicio en tablets y reducir consumo de memoria
const Dashboard = lazy(() => import("./pages/Dashboard"));
const POS = lazy(() => import("./pages/POS"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Returns = lazy(() => import("./pages/Returns"));
const Settings = lazy(() => import("./pages/Settings"));
const Customers = lazy(() => import("./pages/Customers"));
const Transfers = lazy(() => import("./pages/Transfers"));
const Reports = lazy(() => import("./pages/Reports"));
const CustomerShop = lazy(() => import("./pages/CustomerShop"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const InventoryAudit = lazy(() => import("./pages/InventoryAudit"));
const Banks = lazy(() => import("./pages/Banks"));

function PageLoading() {
  return (
    <div className="flex-1 min-h-[50vh] flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-2">
        <div className="animate-spin rounded-full h-7 w-7 border-2 border-indigo-600 border-t-transparent"></div>
        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Cargando módulo...</span>
      </div>
    </div>
  );
}

export default function App() {
  const { currentUser, isInitialized, restoreTransactionsFromBackup, currentBranchId } = useStore(useShallow((state) => ({ currentUser: state.currentUser, isInitialized: state.isInitialized, restoreTransactionsFromBackup: state.restoreTransactionsFromBackup, currentBranchId: state.currentBranchId })));

  useEffect(() => {
    if (isInitialized) {
      // Garantizar la recuperación automática de cualquier ticket cobrado en segundo plano
      restoreTransactionsFromBackup();
    }
  }, [isInitialized, restoreTransactionsFromBackup]);

  useEffect(() => {
    // Keep the active form field visible when Android/iOS opens the software keyboard.
    const scrollFocusedField = () => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return;
      if (!active.matches('input, textarea, select')) return;
      window.setTimeout(() => {
        active.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      }, 80);
    };

    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        event.preventDefault();
      }
    };

    document.addEventListener('focusin', scrollFocusedField);
    document.addEventListener('contextmenu', handleContextMenu);
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', scrollFocusedField);
    viewport?.addEventListener('scroll', scrollFocusedField);
    return () => {
      document.removeEventListener('focusin', scrollFocusedField);
      document.removeEventListener('contextmenu', handleContextMenu);
      viewport?.removeEventListener('resize', scrollFocusedField);
      viewport?.removeEventListener('scroll', scrollFocusedField);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    // El login activa los motores. El replay offline es un módulo pesado y se
    // carga solo después de autenticar, mientras que la cola durable ligera ya
    // está disponible para el store desde el arranque.
    let active = true;
    let cleanupOfflineWatcher = () => {};

    import("./services/offlineSync")
      .then(({ initOfflineSyncWatcher }) => {
        if (active) cleanupOfflineWatcher = initOfflineSyncWatcher();
      })
      .catch((error) => {
        console.error("[App] No se pudo cargar el motor de sincronización offline:", error);
      });

    const cleanupRealtimeSync = initMultiDeviceRealtimeSync();
    return () => {
      active = false;
      cleanupOfflineWatcher();
      cleanupRealtimeSync();
    };
  }, [currentUser?.id, currentBranchId]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/shop" element={<CustomerShop />} />
            
            <Route path="/*" element={
              !currentUser ? <Login /> : (
                <Layout>
                  <Suspense fallback={<PageLoading />}>
                    <Routes>
                      <Route path="/" element={currentUser.role === 'admin' ? <Dashboard /> : <Navigate to="/pos" replace />} />
                      <Route path="/pos" element={<POS />} />
                      <Route path="/transfers" element={currentUser.role === 'admin' ? <Transfers /> : <Navigate to="/pos" replace />} />
                      <Route path="/inventory" element={currentUser.role === 'admin' ? <Inventory /> : <Navigate to="/pos" replace />} />
                      <Route path="/inventory-audit" element={currentUser.role === 'admin' ? <InventoryAudit /> : <Navigate to="/pos" replace />} />
                      <Route path="/suppliers" element={currentUser.role === 'admin' ? <Suppliers /> : <Navigate to="/pos" replace />} />
                      <Route path="/banks" element={currentUser.role === 'admin' ? <Banks /> : <Navigate to="/pos" replace />} />
                      <Route path="/returns" element={currentUser.role === 'admin' ? <Returns /> : <Navigate to="/pos" replace />} />
                      <Route path="/customers" element={currentUser.role === 'admin' ? <Customers /> : <Navigate to="/pos" replace />} />
                      <Route path="/reports" element={currentUser.role === 'admin' ? <Reports /> : <Navigate to="/pos" replace />} />
                      <Route path="/settings" element={currentUser.role === 'admin' ? <Settings /> : <Navigate to="/pos" replace />} />
                    </Routes>
                  </Suspense>
                </Layout>
              )
            } />
          </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}
