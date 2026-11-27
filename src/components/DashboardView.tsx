import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  PackagePlus,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useErp } from '../store/erpStore';
import type { Sale } from '../types/erp';
import { computeDashboardMetrics, formatCurrency } from '../utils/erpLogic';
import { ReceiptModal } from './ReceiptModal';

export const DashboardView: React.FC = () => {
  const { db, currentUser, setActiveSection, clearDashboard } = useErp();
  const [selectedReceipt, setSelectedReceipt] = useState<Sale | null>(null);
  const [chartWindow, setChartWindow] = useState<'7d' | '30d'>('30d');
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearSalesMetrics, setClearSalesMetrics] = useState(true);
  const [clearStockAlerts, setClearStockAlerts] = useState(true);

  const currency = db.settings.currency || 'GHS';
  const metrics = useMemo(() => computeDashboardMetrics(db), [db]);

  const visibleDailyData = useMemo(() => {
    if (chartWindow === '7d') {
      return metrics.dailyChartData.slice(-7);
    }
    return metrics.dailyChartData;
  }, [chartWindow, metrics.dailyChartData]);

  const isAdmin = currentUser?.role === 'admin';
  const activeStockAlertsCount =
    metrics.outOfStockProducts.length + metrics.lowStockProducts.length;
  const hasDashboardDataToClear =
    metrics.totalTransactions > 0 || activeStockAlertsCount > 0;

  return (
    <div className="space-y-6">
      {/* Quick Actions Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Quick Operations</h2>
          <p className="text-xs text-slate-500">
            Live figures computed from {metrics.totalTransactions} recorded sales and{' '}
            {metrics.totalInventoryItems} catalog products.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSection('new-sale')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Add New Sale</span>
          </button>
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setActiveSection('add-stock')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>Add Stock</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('inventory')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('thirty-day-report')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>View Reports</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setClearSalesMetrics(metrics.totalTransactions > 0);
                  setClearStockAlerts(activeStockAlertsCount > 0);
                  setClearModalOpen(true);
                }}
                disabled={!hasDashboardDataToClear}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-red-200 bg-white hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed text-red-700 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Dashboard</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Total Inventory Items</div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-num whitespace-nowrap">
            {metrics.totalInventoryItems.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {db.categories.length} active categories
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Total Stock Quantity</div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-num whitespace-nowrap">
            {metrics.totalStockQuantity.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500">Units across warehouse</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Today&apos;s Sales</div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-num whitespace-nowrap">
            {metrics.todaysSalesCount.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500">Completed orders today</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Today&apos;s Revenue</div>
          <div className="mt-2 text-2xl font-bold text-teal-700 font-mono-num whitespace-nowrap">
            {formatCurrency(metrics.todaysRevenue, currency)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Recorded today</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Monthly Revenue</div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-num whitespace-nowrap">
            {formatCurrency(metrics.monthlyRevenue, currency)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Total Transactions</div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-num whitespace-nowrap">
            {metrics.totalTransactions.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500">All-time saved receipts</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend & 30-Day Performance */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Revenue Trend &amp; Sales Performance
              </h2>
              <p className="text-xs text-slate-500">
                Daily revenue recorded over the selected window
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setChartWindow('7d')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  chartWindow === '7d'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => setChartWindow('30d')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  chartWindow === '30d'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Last 30 Days
              </button>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={visibleDailyData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  interval={chartWindow === '30d' ? 4 : 0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value ?? 0), currency), 'Revenue']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0f766e"
                  strokeWidth={2}
                  fill="url(#revGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Sales Count Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900">Daily Sales Count</h2>
            <p className="text-xs text-slate-500">Number of completed transactions per day</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics.dailyChartData.slice(-10)}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value) => [Number(value ?? 0), 'Transactions']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="salesCount" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top-Selling Products & Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Top-Selling Products</h2>
              <p className="text-xs text-slate-500">Ranked by cumulative sales revenue</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('inventory')}
              className="text-xs font-medium text-teal-700 hover:text-teal-900 cursor-pointer"
            >
              View Inventory
            </button>
          </div>

          {metrics.topSellingProducts.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No product sales recorded yet.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.topSellingProducts.slice(0, 5)}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis
                      type="category"
                      dataKey="productName"
                      width={165}
                      tick={{ fontSize: 11, fill: '#334155' }}
                      tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)}
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(Number(value ?? 0), currency), 'Revenue']}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="revenue" fill="#0f766e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Low Stock & Out of Stock Alerts */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Stock Alerts</h2>
              <p className="text-xs text-slate-500">
                {metrics.outOfStockProducts.length} out of stock ·{' '}
                {metrics.lowStockProducts.length} low stock
              </p>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveSection('alerts')}
                  className="text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
                >
                  Manage Alerts
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('add-stock')}
                  className="text-xs font-medium text-teal-700 hover:text-teal-900 cursor-pointer"
                >
                  Restock Items
                </button>
              </div>
            )}
          </div>

          {metrics.outOfStockProducts.length === 0 && metrics.lowStockProducts.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              All inventory items are adequately stocked above minimum thresholds.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {metrics.outOfStockProducts.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{p.name}</div>
                    <div className="text-xs text-slate-500 font-mono-num">
                      {p.sku} · Min {p.minStockLevel}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Out of stock (0)</span>
                  </span>
                </div>
              ))}
              {metrics.lowStockProducts.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{p.name}</div>
                    <div className="text-xs text-slate-500 font-mono-num">
                      {p.sku} · Min {p.minStockLevel}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 shrink-0 font-mono-num">
                    <Boxes className="w-3.5 h-3.5" />
                    <span>Low ({p.quantity} left)</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Sales</h2>
            <p className="text-xs text-slate-500">Latest completed customer transactions</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveSection('sales-history')}
            className="text-xs font-medium text-teal-700 hover:text-teal-900 cursor-pointer"
          >
            View All Sales
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">Cashier</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-right">Items</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {metrics.recentSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No sales recorded yet.
                  </td>
                </tr>
              ) : (
                metrics.recentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono-num font-semibold text-slate-900">
                      {sale.receiptNumber}
                    </td>
                    <td className="py-2.5 px-4 font-mono-num text-xs text-slate-600">
                      {new Date(sale.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{sale.cashierName}</td>
                    <td className="py-2.5 px-4 text-slate-700">{sale.paymentMethod}</td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-slate-700">
                      {sale.items.reduce((s, it) => s + it.quantity, 0)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-slate-900">
                      {formatCurrency(sale.totalAmount, currency)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(sale)}
                        className="text-xs font-medium text-teal-700 hover:text-teal-900 cursor-pointer"
                      >
                        Receipt
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReceiptModal sale={selectedReceipt} onClose={() => setSelectedReceipt(null)} />

      {clearModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Clear dashboard data confirmation"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Clear Dashboard Data</h2>
              <button
                type="button"
                onClick={() => setClearModalOpen(false)}
                aria-label="Close clear dashboard dialog"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Choose which dashboard sections to clear. Product catalog items and inventory stock quantities remain unchanged.
            </p>
            <div className="mt-4 space-y-2.5">
              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearSalesMetrics}
                  onChange={(e) => setClearSalesMetrics(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span>
                  <strong className="text-slate-900 block">
                    Sales, Revenue Metrics &amp; Charts ({metrics.totalTransactions} transactions)
                  </strong>
                  Resets Today&apos;s Sales, Today&apos;s Revenue, Monthly Revenue, Total Transactions, charts, and Recent Sales to zero.
                </span>
              </label>
              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearStockAlerts}
                  onChange={(e) => setClearStockAlerts(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span>
                  <strong className="text-slate-900 block">
                    Active Stock Alerts ({activeStockAlertsCount} active)
                  </strong>
                  Clears dashboard stock alert notifications until product quantities drop further.
                </span>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClearModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!clearSalesMetrics && !clearStockAlerts}
                onClick={() => {
                  clearDashboard({
                    clearSales: clearSalesMetrics,
                    clearAlerts: clearStockAlerts,
                  });
                  setClearModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold bg-red-700 hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg cursor-pointer"
              >
                Clear Dashboard Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
