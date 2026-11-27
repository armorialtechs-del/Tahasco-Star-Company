import React, { useMemo, useState } from 'react';
import { Download, Printer, Trash2, X } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useErp } from '../store/erpStore';
import {
  computePeriodReport,
  formatCurrency,
  periodReportToCsv,
  toLocalDateKey,
} from '../utils/erpLogic';
import { downloadCsvFile } from './SalesHistoryView';

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return {
    startStr: toLocalDateKey(start),
    endStr: toLocalDateKey(end),
  };
}

export const ThirtyDayReportView: React.FC = () => {
  const { db, currentUser, clearPeriodReport } = useErp();
  const currency = db.settings.currency || 'GHS';
  const isAdmin = currentUser?.role === 'admin';
  const initial = useMemo(() => defaultRange(), []);

  const [startDate, setStartDate] = useState(initial.startStr);
  const [endDate, setEndDate] = useState(initial.endStr);
  const [clearModalOpen, setClearModalOpen] = useState(false);

  const report = useMemo(
    () => computePeriodReport(db.sales, startDate, endDate),
    [db.sales, endDate, startDate],
  );

  const handleReset30Days = () => {
    const d = defaultRange();
    setStartDate(d.startStr);
    setEndDate(d.endStr);
  };

  const handleExportCsv = () => {
    const csv = periodReportToCsv(report);
    downloadCsvFile(`tahasco-period-report-${startDate}-to-${endDate}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end justify-between gap-4 no-print">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="rep-start" className="block text-xs font-semibold text-slate-600 mb-1">
              From Date
            </label>
            <input
              id="rep-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="rep-end" className="block text-xs font-semibold text-slate-600 mb-1">
              To Date
            </label>
            <input
              id="rep-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
            />
          </div>
          <button
            type="button"
            onClick={handleReset30Days}
            className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            Last 30 Days
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setClearModalOpen(true)}
              disabled={report.totalSalesCount === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-red-200 bg-white hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed text-red-700 text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Report</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Printable Report Body */}
      <div className="print-area space-y-6">
        <div className="hidden print:block pb-4 border-b border-slate-300">
          <h1 className="text-xl font-bold text-slate-900">
            {db.settings.companyName} — Sales &amp; Revenue Report
          </h1>
          <p className="text-xs text-slate-600">
            Period: {startDate} to {endDate}
          </p>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-500">Period Revenue</div>
            <div className="mt-2 text-xl font-bold text-slate-900 font-mono-num">
              {formatCurrency(report.totalRevenue, currency)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Prev period: {formatCurrency(report.previousRevenue, currency)}
              {report.revenueChangePct !== null && (
                <span
                  className={`ml-1.5 font-semibold ${
                    report.revenueChangePct >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  ({report.revenueChangePct >= 0 ? '+' : ''}
                  {report.revenueChangePct}%)
                </span>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-500">Total Number of Sales</div>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-num">
              {report.totalSalesCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Prev period: {report.previousSalesCount}
              {report.salesChangePct !== null && (
                <span
                  className={`ml-1.5 font-semibold ${
                    report.salesChangePct >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  ({report.salesChangePct >= 0 ? '+' : ''}
                  {report.salesChangePct}%)
                </span>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-500">Total Items Sold</div>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-num">
              {report.totalItemsSold}
            </div>
            <div className="mt-1 text-xs text-slate-500">Units dispatched</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-500">Average Sale Value</div>
            <div className="mt-2 text-xl font-bold text-teal-700 font-mono-num">
              {formatCurrency(report.averageSaleValue, currency)}
            </div>
            <div className="mt-1 text-xs text-slate-500">Per completed receipt</div>
          </div>
        </div>

        {/* Daily Revenue Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-bold text-slate-900 mb-1">Daily Revenue Chart</h2>
          <p className="text-xs text-slate-500 mb-4">
            Actual recorded sales revenue between {startDate} and {endDate}
          </p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.dailyBreakdown} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval={Math.max(0, Math.floor(report.dailyBreakdown.length / 10) - 1)}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={60} />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value ?? 0), currency), 'Revenue']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="revenue" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Best-Selling Products & Payment Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Best-Selling Products</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-2.5 px-4">Product</th>
                    <th className="py-2.5 px-4 text-right">Qty Sold</th>
                    <th className="py-2.5 px-4 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.bestSellingProducts.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-500">
                        No products sold in this period.
                      </td>
                    </tr>
                  ) : (
                    report.bestSellingProducts.map((p) => (
                      <tr key={p.productId}>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-900">{p.productName}</div>
                          <div className="font-mono-num text-slate-500">{p.sku}</div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono-num font-semibold">
                          {p.quantitySold}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono-num font-bold text-slate-900">
                          {formatCurrency(p.revenue, currency)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Payment Method Breakdown</h2>
            </div>
            <div className="p-5 space-y-4">
              {report.paymentBreakdown.map((pm) => (
                <div key={pm.method} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      {pm.method} ({pm.count} sales)
                    </span>
                    <span className="font-mono-num font-bold text-slate-900">
                      {formatCurrency(pm.revenue, currency)} ({pm.sharePct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-slate-900 rounded-full"
                      style={{ width: `${pm.sharePct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Daily Breakdown Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">Daily Revenue Breakdown</h2>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4 text-right">Sales Count</th>
                  <th className="py-2.5 px-4 text-right">Items Sold</th>
                  <th className="py-2.5 px-4 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...report.dailyBreakdown].reverse().map((d) => (
                  <tr key={d.dateKey}>
                    <td className="py-2 px-4 font-mono-num text-slate-700">{d.dateKey}</td>
                    <td className="py-2 px-4 text-right font-mono-num">{d.salesCount}</td>
                    <td className="py-2 px-4 text-right font-mono-num">{d.itemsSold}</td>
                    <td className="py-2 px-4 text-right font-mono-num font-semibold text-slate-900">
                      {formatCurrency(d.revenue, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {clearModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 no-print"
          role="dialog"
          aria-modal="true"
          aria-label="Clear 30-day report confirmation"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Clear 30-Day Report Data</h2>
              <button
                type="button"
                onClick={() => setClearModalOpen(false)}
                aria-label="Close clear report dialog"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Clear {report.totalSalesCount} sale record(s) from <span className="font-mono-num font-semibold text-slate-900">{startDate}</span> to <span className="font-mono-num font-semibold text-slate-900">{endDate}</span>? This resets the report totals for this period to zero without changing product stock quantities.
            </p>
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
                onClick={() => {
                  clearPeriodReport(startDate, endDate);
                  setClearModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold bg-red-700 hover:bg-red-800 text-white rounded-lg cursor-pointer"
              >
                Clear Report ({report.totalSalesCount})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
