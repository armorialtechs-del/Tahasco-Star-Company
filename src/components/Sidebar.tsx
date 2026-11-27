import React from 'react';
import {
  BarChart3,
  BellRing,
  Boxes,
  CalendarRange,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  PackagePlus,
  Receipt,
  Settings,
  ShoppingCart,
  Users,
  X,
} from 'lucide-react';
import { useErp } from '../store/erpStore';
import type { NavSection } from '../types/erp';
import { BrandLogo } from './BrandLogo';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'add-stock', label: 'Add Stock', icon: PackagePlus, adminOnly: true },
  { id: 'alerts', label: 'Alerts', icon: BellRing, adminOnly: true },
  { id: 'new-sale', label: 'New Sale', icon: ShoppingCart },
  { id: 'sales-history', label: 'Sales History', icon: ClipboardList },
  { id: 'receipts', label: 'Receipts', icon: Receipt },
  { id: 'thirty-day-report', label: '30-Day Report', icon: BarChart3, adminOnly: true },
  { id: 'monthly-revenue', label: 'Monthly Revenue', icon: CalendarRange, adminOnly: true },
  { id: 'expenses', label: 'Expenses', icon: CreditCard, adminOnly: true },
  { id: 'users', label: 'Users', icon: Users, adminOnly: true },
  { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const { db, currentUser, activeSection, setActiveSection, logout } = useErp();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || currentUser?.role === 'admin',
  );

  const activeThresholdAlerts = db.notifications.filter(
    (n) => (n.type === 'low_stock' || n.type === 'out_of_stock') && !n.resolvedAt && !n.clearedAt,
  );
  const unreadThresholdCount = activeThresholdAlerts.filter((n) => !n.read).length;
  const alertsBadgeCount = unreadThresholdCount > 0 ? unreadThresholdCount : activeThresholdAlerts.length;
  const hasCriticalOutOfStock = activeThresholdAlerts.some((n) => n.type === 'out_of_stock');

  const handleNavClick = (section: NavSection) => {
    setActiveSection(section);
    onCloseMobile();
  };

  const navContent = (
    <div className="h-full flex flex-col bg-white border-r border-slate-200 w-[268px]">
      <div className="px-4 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo
            logoDataUrl={db.settings.logoDataUrl}
            companyName={db.settings.companyName}
            size="sm"
          />
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-slate-900 leading-tight">
              {db.settings.companyName}
            </div>
            <div className="text-xs text-slate-500 truncate mt-0.5">
              {currentUser?.role === 'admin' ? 'Admin Workspace' : 'POS Terminal'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          const showAlertBadge = item.id === 'alerts' && alertsBadgeCount > 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {showAlertBadge && (
                <span
                  className={`ml-auto px-1.5 py-0.5 rounded-md text-[11px] font-mono-num font-bold ${
                    isActive
                      ? 'bg-white text-slate-900'
                      : hasCriticalOutOfStock
                        ? 'bg-red-600 text-white'
                        : 'bg-amber-500 text-white'
                  }`}
                >
                  {alertsBadgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-200 space-y-2">
        <div className="px-3 py-2">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {currentUser?.name}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {currentUser?.role === 'admin' ? 'Administrator' : 'Sales Staff'} ·{' '}
            {currentUser?.username}
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block shrink-0 no-print">{navContent}</aside>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full">{navContent}</aside>
        </div>
      )}
    </>
  );
};
