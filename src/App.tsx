/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Inventory from "./pages/Inventory";
import Returns from "./pages/Returns";
import Settings from "./pages/Settings";
import Customers from "./pages/Customers";
import Transfers from "./pages/Transfers";
import Reports from "./pages/Reports";
import CustomerShop from "./pages/CustomerShop";
import Suppliers from "./pages/Suppliers";
import InventoryAudit from "./pages/InventoryAudit";
import Banks from "./pages/Banks";
import { useStore } from "./store/useStore";

export default function App() {
  const { currentUser, isInitialized, syncWithSupabase } = useStore();

  useEffect(() => {
    // Sincronizar automáticamente con Supabase al iniciar la aplicación (una sola vez)
    useStore.getState().syncWithSupabase().catch(() => {});
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/shop" element={<CustomerShop />} />
        
        <Route path="/*" element={
          !currentUser ? <Login /> : (
            <Layout>
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
            </Layout>
          )
        } />
      </Routes>
    </Router>
  );
}
