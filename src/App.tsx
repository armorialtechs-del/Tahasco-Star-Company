import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Info, ShieldAlert } from 'lucide-react';
import { ErpProvider, useErp } from './store/erpStore';
import { AuthView } from './components/AuthView';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { StockAdjustmentView } from './components/StockAdjustmentView';
import { AlertsView } from './components/AlertsView';
import { PosView } from './components/PosView';
import { SalesHistoryView } from './components/SalesHistoryView';
import { ReceiptsView } from './components/ReceiptsView';
import { ThirtyDayReportView } from './components/ThirtyDayReportView';
import { MonthlyRevenueView } from './components/MonthlyRevenueView';
import { ExpensesProfitView } from './components/ExpensesProfitView';
import { UsersView } from './components/UsersView';
import { SettingsView } from './components/SettingsView';

const ErpWorkspace: React.FC = () => {
  const { currentUser, activeSection, canAccessSection, setActiveSection, toast } = useErp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!currentUser) {
    return <AuthView />;
  }

  const renderSection = () => {
    if (!canAccessSection(activeSection)) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-lg mx-auto mt-10">
          <ShieldAlert className="w-10 h-10 text-red-600 mx-auto" />
          <h2 className="mt-3 text-lg font-bold text-slate-900">Access Restricted</h2>
          <p className="mt-1 text-sm text-slate-600">
            This module requires Administrator privileges.
          </p>
          <button
            type="button"
            onClick={() => setActiveSection('dashboard')}
            className="mt-5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      );
    }

    switch (activeSection) {
      case 'dashboard':
        return <DashboardView />;
      case 'inventory':
        return <InventoryView />;
      case 'add-stock':
        return <StockAdjustmentView />;
      case 'alerts':
        return <AlertsView />;
      case 'new-sale':
        return <PosView />;
      case 'sales-history':
        return <SalesHistoryView />;
      case 'receipts':
        return <ReceiptsView />;
      case 'thirty-day-report':
        return <ThirtyDayReportView />;
      case 'monthly-revenue':
        return <MonthlyRevenueView />;
      case 'expenses':
        return <ExpensesProfitView />;
      case 'users':
        return <UsersView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 app-shell-content">
        <TopHeader onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {renderSection()}
        </main>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 no-print ${
            toast.type === 'error'
              ? 'bg-red-900 text-white border-red-800'
              : toast.type === 'info'
                ? 'bg-slate-900 text-white border-slate-800'
                : 'bg-teal-800 text-white border-teal-700'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : toast.type === 'info' ? (
            <Info className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErpProvider>
      <ErpWorkspace />
    </ErpProvider>
  );
}
