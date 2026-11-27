import React, { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
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
  computeMonthlyRevenueReport,
  formatCurrency,
  monthlyReportToCsv,
} from '../utils/erpLogic';
import { downloadCsvFile } from './SalesHistoryView';

export const MonthlyRevenueView: React.FC = () => {
  const { db } = useErp();
  const currency = db.settings.currency || 'GHS';

  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear, currentYear - 1]);
    for (const s of db.sales) {
      years.add(new Date(s.createdAt).getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [currentYear, db.sales]);

  const [selectedYear, setSelectedYear] = useState(currentYear);

  const report = useMemo(
    () => computeMonthlyRevenueReport(db.sales, selectedYear),
    [db.sales, selectedYear],
  );

  const handleExportCsv = () => {
    const csv = monthlyReportToCsv(report.months, selectedYear);
    downloadCsvFile(`tahasco-monthly-revenue-${selectedYear}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <label htmlFor="monthly-year" className="text-xs font-semibold text-slate-700">
            Select Year
          </label>
          <select
            id="monthly-year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number.parseInt(e.target.value, 10))}
            className="px-3 py-2 text-sm font-mono-num font-semibold border border-slate-300 rounded-lg bg-white"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
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

      <div className="print-area space-y-6">
        <div className="hidden print:block pb-4 border-b border-slate-300">
          <h1 className="text-xl font-bold text-slate-900">
            {db.settings.companyName} — {selectedYear} Monthly Revenue Report
          </h1>
        </div>

        {/* Annual Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-500">{selectedYear} Annual Revenue</div>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-num">
              {formatCurrency(report.annualRevenue, currency)}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-500">Annual Transactions</div>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-num">
              {report.annualTransactions.toLocaleString()}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-500">Annual Items Sold</div>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-num">
              {report.annualItemsSold.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Monthly Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-bold text-slate-900 mb-1">
            Monthly Revenue Comparison ({selectedYear})
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Grouped automatically by transaction month and year (January – December)
          </p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.months} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="shortName" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={64} />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value ?? 0), currency), 'Total Revenue']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="totalRevenue" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Jan - Dec Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              January – December Breakdown ({selectedYear})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4 text-right">Total Sales</th>
                  <th className="py-3 px-4 text-right">Transactions</th>
                  <th className="py-3 px-4 text-right">Items Sold</th>
                  <th className="py-3 px-4 text-right">Avg Value</th>
                  <th className="py-3 px-4">Best-Selling Product</th>
                  <th className="py-3 px-4 text-right">MoM Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.months.map((row) => (
                  <tr key={row.monthIndex} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-semibold text-slate-900">{row.monthName}</td>
                    <td className="py-3 px-4 text-right font-mono-num font-bold text-slate-900">
                      {formatCurrency(row.totalRevenue, currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-slate-700">
                      {row.transactionCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-slate-700">
                      {row.itemsSold}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-slate-700">
                      {formatCurrency(row.averageTransactionValue, currency)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{row.bestSellingProduct}</td>
                    <td className="py-3 px-4 text-right font-mono-num text-xs font-semibold">
                      {row.momChangePct === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span
                          className={row.momChangePct >= 0 ? 'text-emerald-700' : 'text-red-700'}
                        >
                          {row.momChangePct >= 0 ? '+' : ''}
                          {row.momChangePct}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
