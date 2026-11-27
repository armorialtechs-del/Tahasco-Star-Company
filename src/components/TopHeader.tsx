import React, { useState } from 'react';
import { Bell, Check, Menu, Plus, ShoppingCart } from 'lucide-react';
import { useErp } from '../store/erpStore';
import type { NavSection } from '../types/erp';

interface TopHeaderProps {
  onOpenMobileMenu: () => void;
}

const SECTION_TITLES: Record<NavSection, string> = {
  dashboard: 'Executive Dashboard',
  inventory: 'Inventory Management',
  'add-stock': 'Stock Adjustments & Restock',
  alerts: 'Stock Threshold Alerts',
  'new-sale': 'New Sale / Point of Sale',
  'sales-history': 'Sales History',
  receipts: 'Receipts Archive',
  'thirty-day-report': '30-Day Sales & Revenue Report',
  'monthly-revenue': 'Monthly Revenue Report',
  expenses: 'Expenses & Profit Tracking',
  users: 'User Accounts & Roles',
  settings: 'Company Settings',
};

export const TopHeader: React.FC<TopHeaderProps> = ({ onOpenMobileMenu }) => {
  const {
    db,
    currentUser,
    activeSection,
    setActiveSection,
    markAllNotificationsRead,
    markNotificationRead,
  } = useErp();
  const [notifOpen, setNotifOpen] = useState(false);

  const isAdmin = currentUser?.role === 'admin';
  const visibleNotifications = db.notifications.filter((n) => {
    if (n.clearedAt) return false;
    if (isAdmin) return true;
    return (
      n.targetRole !== 'admin' &&
      n.type !== 'low_stock' &&
      n.type !== 'out_of_stock'
    );
  });
  const unreadCount = visibleNotifications.filter((n) => !n.read).length;

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 shrink-0 no-print">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <div className="text-xs text-slate-500 truncate">
            {db.settings.companyName} / {SECTION_TITLES[activeSection]}
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
            {SECTION_TITLES[activeSection]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {activeSection !== 'new-sale' && (
          <button
            type="button"
            onClick={() => setActiveSection('new-sale')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>New Sale</span>
          </button>
        )}

        {currentUser?.role === 'admin' && activeSection === 'inventory' && (
          <button
            type="button"
            onClick={() => setActiveSection('add-stock')}
            className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Stock</span>
          </button>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            aria-label={`Notifications (${unreadCount} unread)`}
            aria-expanded={notifOpen}
            className="relative p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setNotifOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">
                    System Notifications
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="text-xs font-medium text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark all read</span>
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {visibleNotifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">
                      No notifications yet.
                    </div>
                  ) : (
                    visibleNotifications.slice(0, 12).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          markNotificationRead(n.id);
                          if (n.targetSection) {
                            setActiveSection(n.targetSection);
                          }
                          setNotifOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                          n.read ? 'bg-white' : 'bg-slate-50/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-semibold ${
                              n.type === 'out_of_stock'
                                ? 'text-red-700'
                                : n.type === 'low_stock'
                                  ? 'text-amber-700'
                                  : 'text-slate-900'
                            }`}
                          >
                            {n.title}
                          </span>
                          <span className="text-[11px] text-slate-400 tabular-nums">
                            {new Date(n.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{n.message}</p>
                      </button>
                    ))
                  )}
                </div>
                {isAdmin && (
                  <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSection('alerts');
                        setNotifOpen(false);
                      }}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-900 cursor-pointer"
                    >
                      Open Alerts Center
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
