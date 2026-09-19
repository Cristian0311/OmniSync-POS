import React, { useState, useMemo } from "react";
import { 
  TrendingUp, DollarSign, Calendar, Calculator, Package, User, 
  X, ArrowDownRight, History, Download, Printer, CheckCircle2, 
  Clock, AlertCircle
} from "lucide-react";
import { useStore } from "../store/useStore";
import { cn } from "../lib/utils";
import { InfoTooltip } from "../components/InfoTooltip";
import { supabase } from "../lib/supabase";

export default function Reports() {
  const { 
    transactions, getBaseCurrency, cashSessions, users, branches, 
    currencies, warranties, returns, supplierOrders, products, 
    inventory, bankTransactions, bankCards, customers, categories,
    salarySettlements, addSalarySettlement, updateSalarySettlement,
    addSyncTask
  } = useStore();
  const baseCurrency = getBaseCurrency();

  const totalSales = transactions.reduce((sum, t) => sum + t.total, 0);
  
  // Calculate cash movements total
  const allMovements = cashSessions.flatMap(s => s.movements || []);
  const totalCashIncomes = allMovements.filter(m => m.type === 'income').reduce((s, m) => s + (m.amount * (currencies.find(c => c.code === m.currencyCode)?.rateToBase || 1)), 0);
  const totalCashExpenses = allMovements.filter(m => m.type === 'expense').reduce((s, m) => s + (m.amount * (currencies.find(c => c.code === m.currencyCode)?.rateToBase || 1)), 0);
  
  // Bank movements breakdown
  const bankPaymentsReceived = bankTransactions.filter(t => t.type === 'payment_received').reduce((sum, t) => {
    const card = bankCards.find(c => c.id === t.cardId);
    const rate = currencies.find(c => c.code === card?.currency)?.rateToBase || 1;
    return sum + (t.amount * rate);
  }, 0);

  const bankOtherDeposits = bankTransactions.filter(t => t.type === 'deposit').reduce((sum, t) => {
    const card = bankCards.find(c => c.id === t.cardId);
    const rate = currencies.find(c => c.code === card?.currency)?.rateToBase || 1;
    return sum + (t.amount * rate);
  }, 0);

  const bankSupplierPayments = bankTransactions.filter(t => t.type === 'supplier_payment').reduce((sum, t) => {
    const card = bankCards.find(c => c.id === t.cardId);
    const rate = currencies.find(c => c.code === card?.currency)?.rateToBase || 1;
    return sum + (t.amount * rate);
  }, 0);

  const bankOtherWithdrawals = bankTransactions.filter(t => t.type === 'withdrawal').reduce((sum, t) => {
    const card = bankCards.find(c => c.id === t.cardId);
    const rate = currencies.find(c => c.code === card?.currency)?.rateToBase || 1;
    return sum + (t.amount * rate);
  }, 0);

  const totalBankDeposits = bankPaymentsReceived + bankOtherDeposits;
  const totalBankWithdrawals = bankSupplierPayments + bankOtherWithdrawals;

  const totalIncomes = totalCashIncomes + bankOtherDeposits;
  const totalExpenses = totalCashExpenses + totalBankWithdrawals;
  const netFlow = totalSales + totalIncomes - totalExpenses;

  const txCount = transactions.length;

  const formatMoney = (amount: number, code: string = baseCurrency.code) => {
    const currency = currencies.find(c => c.code === code) || baseCurrency;
    const formatted = amount.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${currency.symbol} ${formatted}`;
  };

  const MultiCurrencyTotal = ({ amount, className = "" }: { amount: number, className?: string }) => (
    <div className={`flex flex-col gap-0.5 mt-1 ${className}`}>
      {currencies.map(c => {
        const converted = c.isBase ? amount : amount / (c.rateToBase || 1);
        return (
          <div key={c.code} className={cn("flex justify-between items-center text-[10px]", c.isBase ? "font-black text-slate-900" : "font-bold text-slate-500")}>
            <span>{c.symbol} {converted.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="text-[8px]">{c.code}</span>
          </div>
        );
      })}
    </div>
  );

  const getProductName = (itemProduct: any) => {
    if (!itemProduct) return 'Desconocido';
    if (typeof itemProduct === 'string') {
      const p = products.find(p => p.id === itemProduct);
      return p ? p.name : itemProduct;
    }
    return itemProduct.name || 'Desconocido';
  };

  const [activeTab, setActiveTab] = useState<'sales' | 'payroll' | 'sessions' | 'products'>('sales');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionFilter, setSessionFilter] = useState<'all' | 'today' | 'custom'>('all');
  const [selectedFilterDate, setSelectedFilterDate] = useState<string>('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
  const [printSessionId, setPrintSessionId] = useState<string | null>(null);

  // Chronological mapping so all sessions (historical and new) have consistent Turno-1, Turno-2, etc.
  const sessionTurnMap = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...cashSessions].sort(
      (a, b) => new Date(a.openedAt || a.closedAt || '').getTime() - new Date(b.openedAt || b.closedAt || '').getTime()
    );
    sorted.forEach((s, idx) => {
      if (s.id.startsWith('Turno-')) {
        map.set(s.id, s.id);
      } else {
        map.set(s.id, `Turno-${idx + 1}`);
      }
    });
    return map;
  }, [cashSessions]);

  const closedSessions = useMemo(() => {
    return [...cashSessions]
      .filter(s => s.status === 'closed')
      .sort((a, b) => new Date(b.closingDate || b.closedAt || b.openedAt || '').getTime() - new Date(a.closingDate || a.closedAt || a.openedAt || '').getTime());
  }, [cashSessions]);

  const filteredClosedSessions = useMemo(() => {
    return closedSessions.filter(s => {
      if (selectedBranchFilter !== 'all' && s.branchId !== selectedBranchFilter) {
        return false;
      }
      const dateObj = new Date(s.closingDate || s.closedAt || s.openedAt);
      if (selectedFilterDate) {
        return dateObj.toISOString().split('T')[0] === selectedFilterDate;
      }
      if (sessionFilter === 'today') {
        return dateObj.toLocaleDateString() === new Date().toLocaleDateString();
      }
      return true;
    });
  }, [closedSessions, sessionFilter, selectedFilterDate, selectedBranchFilter]);

  // Complete payroll settlements per closed session
  const payrollList = useMemo(() => {
    const settlementMap = new Map<string, typeof salarySettlements[0]>();
    (salarySettlements || []).forEach(st => {
      settlementMap.set(st.sessionId, st);
    });

    return closedSessions.map(session => {
      const turnLabel = sessionTurnMap.get(session.id) || session.id;
      const sessionTx = transactions.filter(t => 
        t.sessionId 
          ? t.sessionId === session.id
          : (t.branchId === session.branchId && 
             new Date(t.date).getTime() >= new Date(session.openedAt).getTime() && 
             (!session.closedAt || new Date(t.date).getTime() <= new Date(session.closedAt).getTime()))
      );

      const totalSales = sessionTx.reduce((sum, tx) => sum + tx.total, 0);
      const totalItems = sessionTx.reduce((sum, tx) => sum + tx.items.reduce((s, i) => s + i.quantity, 0), 0);

      const existing = settlementMap.get(session.id);
      const emp = users.find(u => u.id === session.userId || u.name === session.workerName);
      const workerName = session.workerName || existing?.userName || emp?.name || 'Vendedor';

      // Calculate commissions if not in existing settlement
      let commissions = existing ? existing.commissions : 0;
      if (!existing) {
        commissions = sessionTx.reduce((sum, tx) => {
          return sum + tx.items.reduce((s, item) => {
            const prodId = typeof item.product === 'string' ? item.product : item.product?.id;
            const prod = products.find(p => p.id === prodId);
            if (!prod) return s;
            const commValue = prod.commissionType === 'percentage'
              ? (prod.price * (prod.commissionValue || 0) / 100)
              : (prod.commissionValue || 0);
            return s + (commValue * item.quantity);
          }, 0);
        }, 0);
      }

      const baseSalary = existing ? existing.baseSalary : (emp?.baseSalary || 0);
      const totalSalary = existing ? existing.total : (baseSalary + commissions);
      const status = existing ? existing.status : 'pending';
      const date = existing?.date || session.closingDate || session.closedAt || session.openedAt;

      return {
        settlementId: existing?.id,
        sessionId: session.id,
        turnLabel,
        date,
        workerName,
        userId: session.userId,
        branchId: session.branchId,
        baseSalary,
        commissions,
        totalSalary,
        totalSales,
        totalItems,
        status: status as 'pending' | 'paid',
        sessionTx
      };
    });
  }, [closedSessions, salarySettlements, transactions, users, products, sessionTurnMap]);

  const filteredPayrollList = useMemo(() => {
    return payrollList.filter(item => {
      if (selectedBranchFilter !== 'all' && item.branchId !== selectedBranchFilter) {
        return false;
      }
      const dateObj = new Date(item.date);
      if (selectedFilterDate) {
        return dateObj.toISOString().split('T')[0] === selectedFilterDate;
      }
      if (sessionFilter === 'today') {
        return dateObj.toLocaleDateString() === new Date().toLocaleDateString();
      }
      return true;
    });
  }, [payrollList, selectedBranchFilter, selectedFilterDate, sessionFilter]);

  const filteredCashSessions = useMemo(() => {
    return cashSessions.filter(s => {
      if (selectedBranchFilter !== 'all' && s.branchId !== selectedBranchFilter) {
        return false;
      }
      const dateObj = new Date(s.closingDate || s.closedAt || s.openedAt);
      if (selectedFilterDate) {
        return dateObj.toISOString().split('T')[0] === selectedFilterDate;
      }
      if (sessionFilter === 'today') {
        return dateObj.toLocaleDateString() === new Date().toLocaleDateString();
      }
      return true;
    });
  }, [cashSessions, selectedBranchFilter, selectedFilterDate, sessionFilter]);

  // Aggregated payroll totals per worker
  const aggregatedPayrollByWorker = useMemo(() => {
    const map = new Map<string, {
      userId: string;
      workerName: string;
      shiftsCount: number;
      totalSales: number;
      totalBaseSalary: number;
      totalCommissions: number;
      totalSalary: number;
      pendingSalary: number;
      paidSalary: number;
    }>();

    filteredPayrollList.forEach(item => {
      const key = item.workerName;
      if (!map.has(key)) {
        map.set(key, {
          userId: item.userId,
          workerName: item.workerName,
          shiftsCount: 0,
          totalSales: 0,
          totalBaseSalary: 0,
          totalCommissions: 0,
          totalSalary: 0,
          pendingSalary: 0,
          paidSalary: 0
        });
      }
      const agg = map.get(key)!;
      agg.shiftsCount += 1;
      agg.totalSales += item.totalSales;
      agg.totalBaseSalary += item.baseSalary;
      agg.totalCommissions += item.commissions;
      agg.totalSalary += item.totalSalary;
      if (item.status === 'paid') {
        agg.paidSalary += item.totalSalary;
      } else {
        agg.pendingSalary += item.totalSalary;
      }
    });

    return Array.from(map.values());
  }, [filteredPayrollList]);

  // Toggle payment status handler
  const handleTogglePayment = async (item: typeof payrollList[0]) => {
    const nextStatus: 'pending' | 'paid' = item.status === 'paid' ? 'pending' : 'paid';
    if (item.settlementId) {
      updateSalarySettlement(item.settlementId, { status: nextStatus });
      try {
        await supabase.from('salary_settlements').update({ status: nextStatus }).eq('id', item.settlementId);
      } catch (e) {
        console.error("Error updating settlement in Supabase:", e);
        addSyncTask({
          action: 'UPDATE',
          table: 'salary_settlements',
          data: { id: item.settlementId, status: nextStatus }
        });
      }
    } else {
      const newSettlement: import("../types").SalarySettlement = {
        id: crypto.randomUUID(),
        sessionId: item.sessionId,
        userId: item.userId || '',
        userName: item.workerName,
        baseSalary: item.baseSalary,
        commissions: item.commissions,
        total: item.totalSalary,
        date: item.date,
        status: nextStatus
      };
      addSalarySettlement(newSettlement);
      try {
        await supabase.from('salary_settlements').insert([{
          id: newSettlement.id,
          session_id: newSettlement.sessionId,
          user_id: newSettlement.userId,
          user_name: newSettlement.userName,
          base_salary: newSettlement.baseSalary,
          commissions: newSettlement.commissions,
          total: newSettlement.total,
          date: newSettlement.date,
          status: newSettlement.status
        }]);
      } catch (e) {
        console.error("Error inserting settlement in Supabase:", e);
        addSyncTask({
          action: 'INSERT',
          table: 'salary_settlements',
          data: {
            id: newSettlement.id,
            session_id: newSettlement.sessionId,
            user_id: newSettlement.userId,
            user_name: newSettlement.userName,
            base_salary: newSettlement.baseSalary,
            commissions: newSettlement.commissions,
            total: newSettlement.total,
            date: newSettlement.date,
            status: newSettlement.status
          }
        });
      }
    }
  };

  const handlePrintShiftTicket = async (sessionId: string) => {
    setPrintSessionId(sessionId);
    const session = cashSessions.find(s => s.id === sessionId);
    if (!session) {
      setTimeout(() => window.print(), 100);
      return;
    }

    try {
      const { printThermalReceipt, format58mmLine } = await import('../lib/escpos');
      const branch = branches.find(b => b.id === session.branchId);
      const payrollItem = payrollList.find(p => p.sessionId === session.id);
      const sequentialTurn = sessionTurnMap.get(session.id) || session.id;
      const workerName = session.workerName || users.find(u => u.id === session.userId)?.name || 'Vendedor';

      const sessionTx = transactions.filter(t => 
        t.sessionId 
          ? t.sessionId === session.id
          : (t.branchId === session.branchId && 
             new Date(t.date).getTime() >= new Date(session.openedAt).getTime() && 
             (!session.closedAt || new Date(t.date).getTime() <= new Date(session.closedAt).getTime()))
      );

      const totalSales = sessionTx.reduce((sum, tx) => sum + tx.total, 0);
      const totalItems = sessionTx.reduce((sum, tx) => sum + tx.items.reduce((s, i) => s + i.quantity, 0), 0);

      const grouped: {[key: string]: {name: string, quantity: number, total: number}} = {};
      sessionTx.forEach(tx => {
        tx.items.forEach(item => {
          const prodObj = typeof item.product === 'object' ? item.product : products.find(p => p.id === (item.product as unknown as string));
          const name = prodObj?.name || getProductName(item.product);
          if (!grouped[name]) grouped[name] = { name, quantity: 0, total: 0 };
          grouped[name].quantity += item.quantity;
          const price = prodObj?.price || 0;
          grouped[name].total += (price * item.quantity);
        });
      });

      const lines: string[] = [];
      lines.push("CENTER|BOLD|MARÉ");
      lines.push(`CENTER|${(branch?.name || 'Sucursal Principal').toUpperCase()}`);
      lines.push("CENTER|BOLD|CIERRE DE TURNO");
      lines.push("---");
      lines.push(format58mmLine("FECHA:", new Date(session.closingDate || session.closedAt || session.openedAt).toLocaleDateString(), 32));
      lines.push(format58mmLine("HORA:", new Date(session.closingDate || session.closedAt || session.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 32));
      lines.push(format58mmLine("TURNO:", sequentialTurn, 32));
      lines.push(format58mmLine("TRABAJADOR:", workerName.slice(0, 18), 32));
      lines.push("---");
      lines.push("BOLD|DETALLE PRODUCTOS:");
      const itemsList = Object.values(grouped);
      if (itemsList.length === 0) {
        lines.push("Sin productos vendidos");
      } else {
        itemsList.forEach(item => {
          lines.push(format58mmLine(`${item.quantity}x ${item.name.slice(0, 16)}`, formatMoney(item.total), 32));
        });
      }
      lines.push("---");
      lines.push(format58mmLine("TOTAL VENTAS:", formatMoney(totalSales), 32));
      lines.push(format58mmLine("ITEMS VENDIDOS:", `${totalItems}`, 32));

      if (payrollItem) {
        lines.push("---");
        lines.push("BOLD|LIQUIDACION SALARIO:");
        lines.push(format58mmLine("Salario Base:", formatMoney(payrollItem.baseSalary), 32));
        lines.push(format58mmLine("Comisiones:", `+${formatMoney(payrollItem.commissions)}`, 32));
        lines.push(format58mmLine("TOTAL SALARIO:", formatMoney(payrollItem.totalSalary), 32));
        lines.push(format58mmLine("Estado:", payrollItem.status === 'paid' ? 'PAGADO' : 'PENDIENTE', 32));
      }

      lines.push("---");
      lines.push("CENTER|Firma Trabajador: ___________");
      lines.push("CENTER|Firma Supervisor: ___________");
      lines.push("CENTER|MARÉ SISTEMA POS");

      await printThermalReceipt({
        lines,
        openDrawer: false,
        width: '58mm',
        onError: () => {
          setTimeout(() => window.print(), 100);
        }
      });
    } catch (e) {
      console.error(e);
      setTimeout(() => window.print(), 100);
    }
  };

  const exportSalesCSV = () => {
    const headers = ["Fecha", "ID Ticket", "Cliente", "Cajero", "Total", "Monedas"];
    const rows = transactions.map(t => [
      new Date(t.date).toLocaleDateString(),
      t.id,
      customers.find(c => c.id === t.customerId)?.name || "Mostrador",
      users.find(u => u.id === t.userId)?.name || "N/A",
      t.total,
      t.payments.map(p => `${p.amount} ${p.currencyCode}`).join(' | ')
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte_ventas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Find printable shift data
  const printSession = cashSessions.find(s => s.id === printSessionId);
  const printPayrollItem = printSession ? payrollList.find(p => p.sessionId === printSession.id) : null;
  const printBranch = printSession ? branches.find(b => b.id === printSession.branchId) : null;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1400px] mx-auto pb-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
        <div className="px-2">
          <h2 className="text-base font-black text-slate-900 tracking-tighter flex items-center gap-2 uppercase">
            Panel de Reportes
            <InfoTooltip text="Panel integral de reportes comerciales, registro de ventas por turno, nómina y liquidación diaria del personal." position="bottom" />
          </h2>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Control Financiero, Ventas y Nómina Operativa</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={exportSalesCSV}
            className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />
          {[
            { id: 'sales', label: 'Registro de Ventas por Turno', icon: TrendingUp },
            { id: 'payroll', label: 'Nómina y Liquidación Diaria', icon: Calculator },
            { id: 'sessions', label: 'Historial de Cajas', icon: History },
            { id: 'products', label: 'Productos Vendidos', icon: Package }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id as any)} 
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                  activeTab === tab.id 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest truncate">Ingresos Ventas</p>
            <MultiCurrencyTotal amount={totalSales} />
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <ArrowDownRight className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest truncate">Gastos / Egresos</p>
            <MultiCurrencyTotal amount={totalExpenses} />
          </div>
        </div>
        
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest truncate">Flujo Neto</p>
            <MultiCurrencyTotal amount={netFlow} />
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Package className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest truncate">Transacciones Totales</p>
            <h3 className="text-base font-black text-slate-900 truncate">{txCount}</h3>
          </div>
        </div>
      </div>

      {/* Currency Breakdown */}
      <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3 px-1">Desglose por Divisas</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {currencies.map(c => {
            const cashTotal = transactions.reduce((sum, tx) => {
              const payment = tx.payments.find(p => p.currencyCode === c.code && p.method === 'cash');
              const change = tx.changePayments?.find(cp => cp.currencyCode === c.code && cp.method === 'cash');
              return sum + (payment?.amount || 0) - (change?.amount || 0);
            }, 0);
            const transferTotal = transactions.reduce((sum, tx) => {
              const payment = tx.payments.find(p => p.currencyCode === c.code && p.method === 'transfer');
              const change = tx.changePayments?.find(cp => cp.currencyCode === c.code && cp.method === 'transfer');
              return sum + (payment?.amount || 0) - (change?.amount || 0);
            }, 0);

            if (cashTotal === 0 && transferTotal === 0) return null;

            return (
              <div key={c.code} className="p-2 bg-slate-50/50 rounded-xl border border-slate-100/50">
                <p className="text-[9px] font-black text-slate-900 mb-1.5 flex items-center justify-between">
                  {c.code}
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                </p>
                <div className="space-y-1">
                  {cashTotal > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[7px] font-black text-slate-400 uppercase">Cash</span>
                      <span className="text-[9px] font-black text-emerald-600 tracking-tighter">{formatMoney(cashTotal, c.code)}</span>
                    </div>
                  )}
                  {transferTotal > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[7px] font-black text-slate-400 uppercase">Transf</span>
                      <span className="text-[9px] font-black text-blue-600 tracking-tighter">{formatMoney(transferTotal, c.code)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Filter Toolbar: Sucursales, Periodo, Fecha */}
      <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1.5">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sucursal:</span>
            <select
              value={selectedBranchFilter}
              onChange={(e) => setSelectedBranchFilter(e.target.value)}
              className="bg-transparent text-[10px] font-black text-slate-800 uppercase outline-none cursor-pointer"
            >
              <option value="all">Todas las Sucursales ({branches.length})</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl p-1">
            <button
              onClick={() => { setSessionFilter('all'); setSelectedFilterDate(''); }}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                sessionFilter === 'all' && !selectedFilterDate ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200/60"
              )}
            >
              Todos ({closedSessions.length})
            </button>
            <button
              onClick={() => { setSessionFilter('today'); setSelectedFilterDate(''); }}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                sessionFilter === 'today' ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200/60"
              )}
            >
              Hoy
            </button>
            <div className="flex items-center gap-1 px-2 py-0.5 border-l border-slate-200">
              <Calendar className="w-3 h-3 text-slate-400" />
              <input 
                type="date" 
                value={selectedFilterDate}
                onChange={(e) => {
                  setSelectedFilterDate(e.target.value);
                  setSessionFilter('custom');
                }}
                className="bg-transparent text-[10px] font-bold text-slate-700 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Sync en tiempo real
          </span>
        </div>
      </div>

      {/* TAB 1: REGISTRO DE VENTAS POR TURNO */}
      {activeTab === 'sales' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Registro de Ventas por Turnos Cerrados
              </h3>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Ventas consecutivas lineales por turno y fecha de cierre
              </p>
            </div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
              {filteredClosedSessions.length} turnos encontrados
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-[0.15em]">
                  <th className="px-3 py-2.5">Turno</th>
                  <th className="px-3 py-2.5">Fecha y Hora Cierre</th>
                  <th className="px-3 py-2.5">Vendedor / Sucursal</th>
                  <th className="px-3 py-2.5 text-center">Productos</th>
                  <th className="px-3 py-2.5 text-right">Venta Total</th>
                  <th className="px-3 py-2.5 text-right">Salario Liquidado</th>
                  <th className="px-3 py-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClosedSessions.map(session => {
                  const sessionTx = transactions.filter(t => 
                    t.sessionId 
                      ? t.sessionId === session.id
                      : (t.branchId === session.branchId && 
                         new Date(t.date).getTime() >= new Date(session.openedAt).getTime() && 
                         (!session.closedAt || new Date(t.date).getTime() <= new Date(session.closedAt).getTime()))
                  );
                  const totalSalesInSession = sessionTx.reduce((sum, tx) => sum + tx.total, 0);
                  const totalItems = sessionTx.reduce((sum, tx) => sum + tx.items.reduce((s, i) => s + i.quantity, 0), 0);
                  const sequentialTurn = sessionTurnMap.get(session.id) || session.id;
                  const dateToDisplay = new Date(session.closingDate || session.closedAt || session.openedAt);
                  const pItem = filteredPayrollList.find(p => p.sessionId === session.id);
                  const branchName = branches.find(b => b.id === session.branchId)?.name || 'Sucursal Principal';
                  const workerName = session.workerName || users.find(u => u.id === session.userId)?.name || 'Vendedor';
                  
                  return (
                    <tr key={session.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Turno lineal */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100 tracking-wider">
                          {sequentialTurn}
                        </span>
                      </td>

                      {/* Fecha y hora en una sola línea */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
                          <span>{dateToDisplay.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                          <span className="text-[9px] font-medium text-slate-400">{dateToDisplay.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>

                      {/* Vendedor y Sucursal en una sola línea */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-black text-slate-900 uppercase">{workerName}</span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/50">
                            {branchName}
                          </span>
                        </div>
                      </td>

                      {/* Productos */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-slate-200/50">
                          {totalItems} prods
                        </span>
                      </td>

                      {/* Venta Total */}
                      <td className="px-3 py-2 text-right font-black text-slate-900 text-xs sm:text-sm tracking-tight whitespace-nowrap">
                        {formatMoney(totalSalesInSession)}
                      </td>

                      {/* Salario Liquidado */}
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          {formatMoney(pItem?.totalSalary || 0)}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => setExpandedSession(session.id)}
                            className="bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-sm"
                          >
                            Detalle
                          </button>
                          <button
                            onClick={() => handlePrintShiftTicket(session.id)}
                            title="Imprimir Comprobante Térmico"
                            className="p-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all active:scale-95 border border-slate-200"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredClosedSessions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                      <AlertCircle className="w-7 h-7 mx-auto mb-1.5 opacity-40" />
                      <p className="font-black uppercase text-[10px] tracking-wider">No se encontraron turnos cerrados para el filtro seleccionado.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: NÓMINA Y LIQUIDACIÓN DIARIA */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          {/* Payroll KPI Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Total Nómina Liquidada</span>
              <p className="text-base font-black text-indigo-600 mt-0.5">
                {formatMoney(filteredPayrollList.reduce((sum, item) => sum + item.totalSalary, 0))}
              </p>
            </div>
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Total Comisiones</span>
              <p className="text-base font-black text-emerald-600 mt-0.5">
                {formatMoney(filteredPayrollList.reduce((sum, item) => sum + item.commissions, 0))}
              </p>
            </div>
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Total Salarios Base</span>
              <p className="text-base font-black text-slate-900 mt-0.5">
                {formatMoney(filteredPayrollList.reduce((sum, item) => sum + item.baseSalary, 0))}
              </p>
            </div>
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Turnos Computados</span>
              <p className="text-base font-black text-slate-900 mt-0.5">
                {filteredPayrollList.length} Turnos
              </p>
            </div>
          </div>

          {/* Liquidación por Turno Cerrado Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-indigo-50/20">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-indigo-600" />
                  Liquidación Diaria de Salarios por Turno Cerrado
                </h3>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Fecha de salario, turno lineal consecutivo, ventas, comisiones y liquidación exacta
                </p>
              </div>
              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider">
                {filteredPayrollList.length} liquidaciones
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-[0.15em]">
                    <th className="px-3 py-2.5">Turno</th>
                    <th className="px-3 py-2.5">Fecha Salario</th>
                    <th className="px-3 py-2.5">Trabajador / Sucursal</th>
                    <th className="px-3 py-2.5 text-right">Ventas Turno</th>
                    <th className="px-3 py-2.5 text-right">Salario Base</th>
                    <th className="px-3 py-2.5 text-right">Comisión Prods</th>
                    <th className="px-3 py-2.5 text-right">Salario Total</th>
                    <th className="px-3 py-2.5 text-center">Estado Pago</th>
                    <th className="px-3 py-2.5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayrollList.map(item => {
                    const dateObj = new Date(item.date);
                    const branchName = branches.find(b => b.id === item.branchId)?.name || 'Sucursal Principal';
                    return (
                      <tr key={item.sessionId} className="hover:bg-slate-50/60 transition-colors">
                        {/* Turno lineal */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100 tracking-wider">
                            {item.turnLabel}
                          </span>
                        </td>

                        {/* Fecha del salario y hora lineal */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
                            <span>{dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                            <span className="text-[9px] font-medium text-slate-400">{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </td>

                        {/* Trabajador y Sucursal lineal */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-black text-slate-900 uppercase">{item.workerName}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/50">
                              {branchName}
                            </span>
                          </div>
                        </td>

                        {/* Ventas Turno lineal */}
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1 text-[10px]">
                            <span className="font-black text-slate-900">{formatMoney(item.totalSales)}</span>
                            <span className="text-[8px] font-bold text-slate-400">({item.totalItems}p)</span>
                          </div>
                        </td>

                        {/* Salario Base */}
                        <td className="px-3 py-2 text-right text-[10px] font-bold text-slate-700 whitespace-nowrap">
                          {formatMoney(item.baseSalary)}
                        </td>

                        {/* Comisión Productos */}
                        <td className="px-3 py-2 text-right text-[10px] font-bold text-emerald-600 whitespace-nowrap">
                          +{formatMoney(item.commissions)}
                        </td>

                        {/* Total Salario a Liquidar */}
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <span className="text-xs font-black text-emerald-700 tracking-tight bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                            {formatMoney(item.totalSalary)}
                          </span>
                        </td>

                        {/* Estado */}
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleTogglePayment(item)}
                            className={cn(
                              "px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider transition-all border",
                              item.status === 'paid'
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                            )}
                          >
                            {item.status === 'paid' ? '✓ Pagado' : '⏳ Pendiente'}
                          </button>
                        </td>

                        {/* Acciones */}
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <button
                            onClick={() => handlePrintShiftTicket(item.sessionId)}
                            title="Imprimir Comprobante de Liquidación"
                            className="p-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all border border-slate-200 active:scale-95"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredPayrollList.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-10 text-center text-slate-400 font-bold uppercase text-[10px]">
                        No hay turnos cerrados con nómina calculada para el filtro seleccionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resumen Consolidado por Trabajador */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                Resumen Acumulado por Trabajador
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/40 border-b border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-[0.15em]">
                    <th className="px-3 py-2.5">Trabajador</th>
                    <th className="px-3 py-2.5 text-center">Turnos Realizados</th>
                    <th className="px-3 py-2.5 text-right">Ventas Totales</th>
                    <th className="px-3 py-2.5 text-right">Salario Base Acumulado</th>
                    <th className="px-3 py-2.5 text-right">Comisiones Totales</th>
                    <th className="px-3 py-2.5 text-right">Total Ganado</th>
                    <th className="px-3 py-2.5 text-right">Pendiente de Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {aggregatedPayrollByWorker.map((agg, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-2 text-[11px] font-black text-slate-900 uppercase tracking-tight whitespace-nowrap">
                        {agg.workerName}
                      </td>
                      <td className="px-3 py-2 text-center text-[10px] font-black text-slate-700 whitespace-nowrap">
                        {agg.shiftsCount} turnos
                      </td>
                      <td className="px-3 py-2 text-right text-[10px] font-bold text-slate-700 whitespace-nowrap">
                        {formatMoney(agg.totalSales)}
                      </td>
                      <td className="px-3 py-2 text-right text-[10px] font-bold text-slate-700 whitespace-nowrap">
                        {formatMoney(agg.totalBaseSalary)}
                      </td>
                      <td className="px-3 py-2 text-right text-[10px] font-bold text-emerald-600 whitespace-nowrap">
                        +{formatMoney(agg.totalCommissions)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-black text-slate-900 whitespace-nowrap">
                        {formatMoney(agg.totalSalary)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <span className={cn(
                          "text-[11px] font-black",
                          agg.pendingSalary > 0 ? "text-amber-600" : "text-emerald-600"
                        )}>
                          {formatMoney(agg.pendingSalary)}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {aggregatedPayrollByWorker.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-6 text-center text-slate-400 text-[10px] font-bold uppercase">
                        No hay acumulación registrada de trabajadores.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HISTORIAL DE CAJAS */}
      {activeTab === 'sessions' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Calculator className="w-3.5 h-3.5 text-indigo-600" />
              Historial de Aperturas y Cierres de Caja
            </h3>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
              {filteredCashSessions.length} registros
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-[0.15em]">
                  <th className="px-3 py-2.5">Turno</th>
                  <th className="px-3 py-2.5">Usuario / Sucursal</th>
                  <th className="px-3 py-2.5">Apertura</th>
                  <th className="px-3 py-2.5">Cierre</th>
                  <th className="px-3 py-2.5">Fondo Inicial</th>
                  <th className="px-3 py-2.5">Estado</th>
                  <th className="px-3 py-2.5 text-center">Ticket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredCashSessions.map(session => (
                  <tr key={session.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100 tracking-wider">
                        {sessionTurnMap.get(session.id) || session.id}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-black text-slate-900 uppercase">
                          {session.workerName || users.find(u => u.id === session.userId)?.name || session.userId}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/50">
                          {branches.find(b => b.id === session.branchId)?.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[10px] font-bold text-slate-600 whitespace-nowrap">
                      {new Date(session.openedAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2 text-[10px] font-bold text-slate-600 whitespace-nowrap">
                      {session.closedAt ? new Date(session.closedAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="px-3 py-2 font-black text-slate-900 text-[10px] whitespace-nowrap">
                      {formatMoney(session.openingBalance)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest",
                        session.status === 'open' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-100 text-slate-600 border border-slate-200/50"
                      )}>
                        {session.status === 'open' ? 'Abierta' : 'Cerrada'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {session.status === 'closed' && (
                        <button
                          onClick={() => handlePrintShiftTicket(session.id)}
                          title="Imprimir Ticket de Cierre"
                          className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all border border-slate-200 active:scale-95"
                        >
                          <Printer className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredCashSessions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500 text-[10px] font-bold uppercase">
                      No hay registros de caja para el filtro seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PRODUCTOS VENDIDOS */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-indigo-600" />
              Productos Vendidos
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-[0.15em]">
                  <th className="px-3 py-2.5">Producto</th>
                  <th className="px-3 py-2.5">Categoría</th>
                  <th className="px-3 py-2.5 text-center">Cantidad</th>
                  <th className="px-3 py-2.5 text-right">Ingresos Brutos ({baseCurrency.code})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(() => {
                  const productMap: Record<string, { product: any, quantity: number, total: number }> = {};
                  const txList = transactions.filter(t => selectedBranchFilter === 'all' || t.branchId === selectedBranchFilter);
                  txList.forEach(tx => {
                    tx.items.forEach(item => {
                      const id = typeof item.product === 'string' ? item.product : item.product.id;
                      const prodObj = typeof item.product === 'string' ? products.find(p => p.id === id) : item.product;
                      if (!productMap[id]) {
                        productMap[id] = { product: prodObj || { name: 'Desconocido', categoryId: '' }, quantity: 0, total: 0 };
                      }
                      productMap[id].quantity += item.quantity;
                      productMap[id].total += ((prodObj?.price || 0) * item.quantity);
                    });
                  });
                  const productStats = Object.values(productMap).sort((a, b) => b.quantity - a.quantity);
                  return (
                    <>
                      {productStats.map((stat, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-3 py-2 text-[10px] font-black text-slate-900 uppercase tracking-tight whitespace-nowrap">{stat.product.name}</td>
                          <td className="px-3 py-2 text-[8px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{categories.find(c => c.id === stat.product.categoryId)?.name || 'Sin Categoría'}</td>
                          <td className="px-3 py-2 text-[11px] font-black text-slate-900 text-center whitespace-nowrap">{stat.quantity} uds</td>
                          <td className="px-3 py-2 text-[10px] font-black text-indigo-600 text-right tracking-tight whitespace-nowrap">{formatMoney(stat.total)}</td>
                        </tr>
                      ))}
                      {productStats.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-[10px] font-bold uppercase">
                            No hay productos vendidos para el filtro seleccionado.
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Detalle del Turno Cerrado */}
      {expandedSession && cashSessions.find(s => s.id === expandedSession) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 border border-white/20">
            {(() => {
              const session = cashSessions.find(s => s.id === expandedSession)!;
              const sessionTx = transactions.filter(t => 
                t.sessionId 
                  ? t.sessionId === session.id
                  : (t.branchId === session.branchId && 
                     new Date(t.date).getTime() >= new Date(session.openedAt).getTime() && 
                     (!session.closedAt || new Date(t.date).getTime() <= new Date(session.closedAt).getTime()))
              );
              const sequentialTurn = sessionTurnMap.get(session.id) || session.id;
              const dateToDisplay = new Date(session.closingDate || session.closedAt || session.openedAt);
              const totalSalesInSession = sessionTx.reduce((sum, tx) => sum + tx.total, 0);
              const pItem = payrollList.find(p => p.sessionId === session.id);

              // Group items by product
              const groupedItems: {[key: string]: {name: string, quantity: number, total: number}} = {};
              sessionTx.forEach(tx => {
                tx.items.forEach(item => {
                  const prodObj = typeof item.product === 'object' ? item.product : products.find(p => p.id === (item.product as unknown as string));
                  const prodName = prodObj?.name || getProductName(item.product);
                  if (!groupedItems[prodName]) {
                    groupedItems[prodName] = { name: prodName, quantity: 0, total: 0 };
                  }
                  groupedItems[prodName].quantity += item.quantity;
                  const price = prodObj?.price || 0;
                  groupedItems[prodName].total += (price * item.quantity);
                });
              });

              return (
                <>
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
                    <div>
                      <div className="text-sm font-black text-slate-900 uppercase tracking-tight">
                        {dateToDisplay.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-black text-indigo-600 uppercase bg-white px-2 py-0.5 rounded border border-indigo-100">
                          {sequentialTurn}
                        </span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase">
                          {session.workerName || users.find(u => u.id === session.userId)?.name || 'Vendedor'}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setExpandedSession(null)}
                      className="p-1.5 hover:bg-white rounded-full transition-colors text-slate-400"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-5 max-h-[50vh] overflow-y-auto space-y-2 custom-scrollbar">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Productos Vendidos ({Object.keys(groupedItems).length})
                    </div>
                    {Object.values(groupedItems).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-[10px] font-black text-indigo-600 border border-slate-100">
                            {item.quantity}
                          </div>
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">{item.name}</span>
                        </div>
                        <span className="text-[11px] font-black text-slate-900">{formatMoney(item.total)}</span>
                      </div>
                    ))}

                    {Object.keys(groupedItems).length === 0 && (
                      <p className="text-center py-6 text-xs font-bold text-slate-400 uppercase">No hay productos vendidos en este turno.</p>
                    )}

                    {pItem && (
                      <div className="mt-4 p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-1.5">
                        <div className="text-[9px] font-black text-emerald-800 uppercase tracking-widest flex items-center justify-between">
                          <span>Liquidación Salarial del Turno</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[8px]",
                            pItem.status === 'paid' ? "bg-emerald-200 text-emerald-900" : "bg-amber-100 text-amber-900"
                          )}>
                            {pItem.status === 'paid' ? 'Pagado' : 'Pendiente'}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-600">
                          <span>Salario Base:</span>
                          <span className="font-bold">{formatMoney(pItem.baseSalary)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-emerald-700">
                          <span>Comisiones Productos:</span>
                          <span className="font-bold">+{formatMoney(pItem.commissions)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-black text-slate-900 border-t border-emerald-200/60 pt-1">
                          <span>Total Salario:</span>
                          <span className="text-emerald-700">{formatMoney(pItem.totalSalary)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Total Ventas Turno</span>
                      <span className="text-base font-black text-indigo-600">{formatMoney(totalSalesInSession)}</span>
                    </div>
                    <button
                      onClick={() => handlePrintShiftTicket(session.id)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-sm"
                    >
                      <Printer className="w-4 h-4" />
                      Imprimir Ticket Térmico
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Hidden Thermal Printer Area */}
      {printSession && (
        <div id="print-closure-area" className="hidden">
          {(() => {
            const sessionTx = transactions.filter(t => 
              t.sessionId 
                ? t.sessionId === printSession.id
                : (t.branchId === printSession.branchId && 
                   new Date(t.date).getTime() >= new Date(printSession.openedAt).getTime() && 
                   (!printSession.closedAt || new Date(t.date).getTime() <= new Date(printSession.closedAt).getTime()))
            );
            const totalSales = sessionTx.reduce((sum, tx) => sum + tx.total, 0);
            const totalItems = sessionTx.reduce((sum, tx) => sum + tx.items.reduce((s, i) => s + i.quantity, 0), 0);
            const workerName = printSession.workerName || users.find(u => u.id === printSession.userId)?.name || 'Vendedor';
            const sequentialTurn = sessionTurnMap.get(printSession.id) || printSession.id;

            return (
              <>
                <div className="text-center mb-3">
                  <h1 className="text-base font-black uppercase tracking-wider">MARÉ</h1>
                  <p className="text-[10px] uppercase font-bold">{printBranch?.name || 'Sucursal Principal'}</p>
                  <p className="text-[9px] mt-1 font-bold">COMPROBANTE DE CIERRE DE TURNO</p>
                  <div className="border-b-2 border-black my-2"></div>
                </div>

                <div className="text-[10px] space-y-1 mb-2 font-mono">
                  <div className="flex justify-between">
                    <span>FECHA CIERRE:</span>
                    <span className="font-bold">{new Date(printSession.closingDate || printSession.closedAt || printSession.openedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>HORA CIERRE:</span>
                    <span className="font-bold">{new Date(printSession.closingDate || printSession.closedAt || printSession.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TURNO:</span>
                    <span className="font-bold">{sequentialTurn}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TRABAJADOR:</span>
                    <span className="font-bold">{workerName}</span>
                  </div>
                </div>

                <div className="border-b border-black border-dashed my-2"></div>
                <div className="text-[9px] font-black uppercase mb-1">DETALLE DE PRODUCTOS VENDIDOS</div>
                <div className="text-[9px] space-y-1 font-mono">
                  {(() => {
                    const grouped: {[key: string]: {name: string, quantity: number, total: number}} = {};
                    sessionTx.forEach(tx => {
                      tx.items.forEach(item => {
                        const prodObj = typeof item.product === 'object' ? item.product : products.find(p => p.id === (item.product as unknown as string));
                        const name = prodObj?.name || getProductName(item.product);
                        if (!grouped[name]) grouped[name] = { name, quantity: 0, total: 0 };
                        grouped[name].quantity += item.quantity;
                        const price = prodObj?.price || 0;
                        grouped[name].total += (price * item.quantity);
                      });
                    });

                    return Object.values(grouped).map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.quantity}x {item.name.slice(0, 18)}</span>
                        <span>{formatMoney(item.total)}</span>
                      </div>
                    ));
                  })()}
                </div>

                <div className="border-b border-black border-dashed my-2"></div>
                <div className="text-[10px] font-mono space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>TOTAL VENTAS:</span>
                    <span>{formatMoney(totalSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ITEMS VENDIDOS:</span>
                    <span>{totalItems}</span>
                  </div>
                </div>

                {printPayrollItem && (
                  <>
                    <div className="border-b-2 border-black my-2"></div>
                    <div className="text-[9px] font-black uppercase mb-1">LIQUIDACIÓN DE SALARIO</div>
                    <div className="text-[10px] font-mono space-y-1">
                      <div className="flex justify-between">
                        <span>Salario Base:</span>
                        <span>{formatMoney(printPayrollItem.baseSalary)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Comisiones Productos:</span>
                        <span>+{formatMoney(printPayrollItem.commissions)}</span>
                      </div>
                      <div className="flex justify-between font-black text-xs border-t border-black pt-1">
                        <span>TOTAL SALARIO:</span>
                        <span>{formatMoney(printPayrollItem.totalSalary)}</span>
                      </div>
                      <div className="flex justify-between text-[9px] mt-0.5">
                        <span>Estado:</span>
                        <span className="font-bold uppercase">{printPayrollItem.status === 'paid' ? 'PAGADO' : 'PENDIENTE'}</span>
                      </div>
                    </div>
                  </>
                )}
              </>
            );
          })()}

          <div className="mt-8 pt-6 border-t border-black border-dashed text-center text-[9px]">
            <p className="mb-6">Firma del Trabajador: ______________________</p>
            <p>Firma del Supervisor: ______________________</p>
            <p className="mt-4 font-mono text-[8px]">MARÉ SISTEMA DE PUNTO DE VENTA</p>
          </div>
        </div>
      )}
    </div>
  );
}
