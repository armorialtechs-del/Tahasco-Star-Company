import React, { useMemo, useState } from 'react';
import { Download, Eye, Printer, Search, Trash2, X } from 'lucide-react';
import { useErp } from '../store/erpStore';
import type { PaymentMethod, Sale } from '../types/erp';
import { formatCurrency, salesToCsv } from '../utils/erpLogic';
import { ReceiptModal } from './ReceiptModal';

export function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const SalesHistoryView: React.FC = () => {
  const { db, currentUser, clearSales } = useErp();
  const currency = db.settings.currency || 'GHS';
  const isAdmin = currentUser?.role === 'admin';

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [cashierFilter, setCashierFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentMethod>('all');

  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [clearModalOpen, setClearModalOpen] = useState(false);

  // Sales staff see their own recorded sales; Admins see all sales
  const baseSales = useMemo(() => {
    if (isAdmin) return db.sales;
    return db.sales.filter((s) => s.cashierId === currentUser?.id);
  }, [currentUser?.id, db.sales, isAdmin]);

  const cashiers = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of baseSales) {
      map.set(s.cashierId, s.cashierName);
    }
    return Array.from(map.entries());
  }, [baseSales]);

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseSales
      .filter((s) => {
        if (dateFilter && !s.createdAt.startsWith(dateFilter)) {
          // Compare local YYYY-MM-DD as well
          const localDay = new Date(s.createdAt).toLocaleDateString('en-CA');
          if (localDay !== dateFilter) return false;
        }
        if (cashierFilter !== 'all' && s.cashierId !== cashierFilter) return false;
        if (paymentFilter !== 'all' && s.paymentMethod !== paymentFilter) return false;
        if (q) {
          const matchesReceipt = s.receiptNumber.toLowerCase().includes(q);
          const matchesCustomer = (s.customerName ?? '').toLowerCase().includes(q);
          const matchesProduct = s.items.some(
            (i) => i.productName.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q),
          );
          if (!matchesReceipt && !matchesCustomer && !matchesProduct) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [baseSales, cashierFilter, dateFilter, paymentFilter, search]);

  const totalFilteredRevenue = useMemo(
    () => filteredSales.reduce((acc, s) => acc + s.totalAmount, 0),
    [filteredSales],
  );

  const handleExportCsv = () => {
    const csv = salesToCsv(filteredSales);
    downloadCsvFile(`tahasco-sales-history-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div className="space-y-5">
      {/* Filters & Export */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            Showing <span className="font-mono-num font-semibold text-slate-900">{filteredSales.length}</span>{' '}
            transactions · Total:{' '}
            <span className="font-mono-num font-bold text-slate-900">
              {formatCurrency(totalFilteredRevenue, currency)}
            </span>
            {!isAdmin && ' (Your recorded sales)'}
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setClearModalOpen(true)}
                disabled={db.sales.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-red-200 bg-white hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed text-red-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Sales</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredSales.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Search by receipt number or product"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Receipt #, product, customer..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <input
            type="date"
            aria-label="Filter by date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono-num"
          />

          <select
            aria-label="Filter by cashier"
            value={cashierFilter}
            onChange={(e) => setCashierFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="all">All Cashiers</option>
            {cashiers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by payment method"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as 'all' | PaymentMethod)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="all">All Payment Methods</option>
            <option value="Cash">Cash</option>
            <option value="Mobile Money">Mobile Money</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">Cashier</th>
                <th className="py-3 px-4">Items Sold</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No sales records match your current filters.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono-num font-semibold text-slate-900">
                      {sale.receiptNumber}
                    </td>
                    <td className="py-3 px-4 font-mono-num text-xs text-slate-600 whitespace-nowrap">
                      {new Date(sale.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{sale.cashierName}</td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-[260px] truncate">
                      {sale.items.map((i) => `${i.productName} (x${i.quantity})`).join(', ')}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">
                      {sale.paymentMethod}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-bold text-slate-900">
                      {formatCurrency(sale.totalAmount, currency)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailSale(sale)}
                          aria-label={`View details for ${sale.receiptNumber}`}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setReceiptSale(sale)}
                          aria-label={`Reprint receipt ${sale.receiptNumber}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Details Modal */}
      {detailSale && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Transaction details ${detailSale.receiptNumber}`}
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-mono-num">
                  {detailSale.receiptNumber}
                </h2>
                <p className="text-xs text-slate-500">
                  {new Date(detailSale.createdAt).toLocaleString()} · Cashier: {detailSale.cashierName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailSale(null)}
                aria-label="Close transaction details"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              {detailSale.customerName && (
                <div className="text-xs text-slate-600">
                  Customer: <span className="font-semibold text-slate-900">{detailSale.customerName}</span>{' '}
                  {detailSale.customerPhone ? `(${detailSale.customerPhone})` : ''}
                </div>
              )}

              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {detailSale.items.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-slate-900">{item.productName}</div>
                      <div className="text-slate-500 font-mono-num">
                        {item.quantity} x {formatCurrency(item.unitPrice, currency)}
                      </div>
                    </div>
                    <div className="font-mono-num font-bold text-slate-900">
                      {formatCurrency(item.lineTotal, currency)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-xs pt-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-mono-num">{formatCurrency(detailSale.subtotal, currency)}</span>
                </div>
                {detailSale.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount</span>
                    <span className="font-mono-num">
                      -{formatCurrency(detailSale.discountAmount, currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total Paid ({detailSale.paymentMethod})</span>
                  <span className="font-mono-num">{formatCurrency(detailSale.totalAmount, currency)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Amount Tendered</span>
                  <span className="font-mono-num">{formatCurrency(detailSale.amountPaid, currency)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Change Given</span>
                  <span className="font-mono-num">{formatCurrency(detailSale.changeGiven, currency)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetailSale(null)}
                className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = detailSale;
                  setDetailSale(null);
                  setReceiptSale(target);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />

      {clearModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Clear sales history confirmation"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Clear Sales Records</h2>
              <button
                type="button"
                onClick={() => setClearModalOpen(false)}
                aria-label="Close clear sales dialog"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              {filteredSales.length < db.sales.length
                ? `Choose whether to clear only the ${filteredSales.length} filtered sale record(s) or all ${db.sales.length} saved sales. Product inventory counts remain unchanged.`
                : `Are you sure you want to permanently clear all ${db.sales.length} saved sales records? Product inventory counts remain unchanged.`}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setClearModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              {filteredSales.length > 0 && filteredSales.length < db.sales.length && (
                <button
                  type="button"
                  onClick={() => {
                    clearSales(filteredSales.map((s) => s.id));
                    setClearModalOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold border border-red-300 bg-red-50 hover:bg-red-100 text-red-800 rounded-lg cursor-pointer"
                >
                  Clear Filtered ({filteredSales.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  clearSales();
                  setClearModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold bg-red-700 hover:bg-red-800 text-white rounded-lg cursor-pointer"
              >
                Clear All Sales ({db.sales.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
