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
import Catalog from "./pages/Catalog";
import Returns from "./pages/Returns";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Customers from "./pages/Customers";
import CashRegister from "./pages/CashRegister";
import Transfers from "./pages/Transfers";
import Reports from "./pages/Reports";
import CustomerShop from "./pages/CustomerShop";
import Suppliers from "./pages/Suppliers";
import InventoryAudit from "./pages/InventoryAudit";
import Banks from "./pages/Banks";
import { useStore } from "./store/useStore";

export default function App() {
  const { currentUser, setOfflineStatus, isOffline, syncPendingTransactions } = useStore();

  useEffect(() => {
    const handleOnline = () => {
      setOfflineStatus(false);
      syncPendingTransactions();
    };
    const handleOffline = () => {
      setOfflineStatus(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (navigator.onLine && isOffline) {
      setOfflineStatus(false);
      syncPendingTransactions();
    } else if (!navigator.onLine && !isOffline) {
      setOfflineStatus(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOfflineStatus, syncPendingTransactions, isOffline]);

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
                <Route path="/cash" element={<CashRegister />} />
                <Route path="/transfers" element={<Transfers />} />
                <Route path="/inventory" element={currentUser.role === 'admin' ? <Inventory /> : <Navigate to="/" replace />} />
                <Route path="/inventory-audit" element={currentUser.role === 'admin' ? <InventoryAudit /> : <Navigate to="/" replace />} />
                <Route path="/suppliers" element={currentUser.role === 'admin' ? <Suppliers /> : <Navigate to="/" replace />} />
                <Route path="/banks" element={currentUser.role === 'admin' ? <Banks /> : <Navigate to="/" replace />} />
                <Route path="/catalog" element={<Catalog />} />
                <Route path="/returns" element={<Returns />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/reports" element={currentUser.role === 'admin' ? <Reports /> : <Navigate to="/" replace />} />
                <Route path="/users" element={currentUser.role === 'admin' ? <Users /> : <Navigate to="/" replace />} />
                <Route path="/settings" element={currentUser.role === 'admin' ? <Settings /> : <Navigate to="/" replace />} />
              </Routes>
            </Layout>
          )
        } />
      </Routes>
    </Router>
  );
}
