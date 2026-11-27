import React, { useMemo, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Eye, Printer, Receipt, Search, Trash2, X } from 'lucide-react';
import { useErp } from '../store/erpStore';
import type { Sale } from '../types/erp';
import { formatCurrency } from '../utils/erpLogic';
import {
  clearPrintPageStyle,
  downloadReceiptPdf,
  triggerDirectWindowPrint,
} from '../utils/receiptPrint';
import { ReceiptDocument } from './ReceiptDocument';
import { ReceiptModal } from './ReceiptModal';

export const ReceiptsView: React.FC = () => {
  const { db, currentUser, showToast, clearReceipts } = useErp();
  const currency = db.settings.currency || 'GHS';
  const isAdmin = currentUser?.role === 'admin';

  const [query, setQuery] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [blockedNotice, setBlockedNotice] = useState(false);
  const [quickPrintSale, setQuickPrintSale] = useState<Sale | null>(null);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [alsoDeleteSales, setAlsoDeleteSales] = useState(false);

  const visibleReceipts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.sales
      .filter((s) => !s.receiptCleared)
      .filter((s) => (isAdmin ? true : s.cashierId === currentUser?.id))
      .filter((s) => {
        if (!q) return true;
        return (
          s.receiptNumber.toLowerCase().includes(q) ||
          (s.customerName ?? '').toLowerCase().includes(q) ||
          s.cashierName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [currentUser?.id, db.sales, isAdmin, query]);

  const handleQuickPrint = (sale: Sale) => {
    // Synchronously commit the print-only receipt portal so window.print() runs inside the user click gesture
    flushSync(() => {
      setQuickPrintSale(sale);
    });
    document.body.classList.add('printing-receipt-modal');

    const result = triggerDirectWindowPrint('a4');

    document.body.classList.remove('printing-receipt-modal');
    clearPrintPageStyle();
    setQuickPrintSale(null);

    if (result.blockedByIframe) {
      downloadReceiptPdf(sale, db.settings, 'a4');
      setBlockedNotice(true);
      setSelectedSale(sale);
      showToast(
        `Print dialog blocked by preview frame. PDF receipt ${sale.receiptNumber} downloaded.`,
        'info',
      );
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Saved Receipts Directory</h2>
          <p className="text-xs text-slate-500">
            Select any receipt to preview and print in A4 or 80mm thermal format.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Search receipts"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search receipt # or customer..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setAlsoDeleteSales(false);
                setClearModalOpen(true);
              }}
              disabled={visibleReceipts.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-red-200 bg-white hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed text-red-700 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Receipts</span>
            </button>
          )}
        </div>
      </div>

      {visibleReceipts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
          {query.trim()
            ? 'No receipts match your search.'
            : 'No saved receipts in the archive. New sales will appear here automatically.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleReceipts.map((sale) => (
            <div
              key={sale.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-teal-700 shrink-0" />
                    <span className="font-mono-num font-bold text-slate-900 text-sm">
                      {sale.receiptNumber}
                    </span>
                  </div>
                  <span className="font-mono-num font-bold text-slate-900 text-sm">
                    {formatCurrency(sale.totalAmount, currency)}
                  </span>
                </div>

                <div className="mt-2 text-xs text-slate-500 space-y-1">
                  <div className="font-mono-num">
                    {new Date(sale.createdAt).toLocaleString()}
                  </div>
                  <div>
                    Cashier: <span className="text-slate-800 font-medium">{sale.cashierName}</span>
                    {sale.customerName ? ` · Customer: ${sale.customerName}` : ''}
                  </div>
                  <div>
                    {sale.items.length} line item(s) · Paid via {sale.paymentMethod}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBlockedNotice(false);
                    setSelectedSale(sale);
                  }}
                  className="flex-1 py-2 px-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPrint(sale)}
                  aria-label={`Print receipt ${sale.receiptNumber}`}
                  className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {quickPrintSale &&
        createPortal(
          <div className="print-modal-wrapper hidden print:block" aria-hidden="true">
            <ReceiptDocument sale={quickPrintSale} settings={db.settings} paperFormat="a4" />
          </div>,
          document.body,
        )}

      <ReceiptModal
        sale={selectedSale}
        initialBlockedNotice={blockedNotice}
        onClose={() => {
          setSelectedSale(null);
          setBlockedNotice(false);
        }}
      />

      {clearModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Clear receipts confirmation"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Clear Receipts Archive</h2>
              <button
                type="button"
                onClick={() => setClearModalOpen(false)}
                aria-label="Close clear receipts dialog"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Clear {visibleReceipts.length} receipt(s) from the Receipts Archive view. New sales completed after this will continue generating receipts automatically.
            </p>
            <label className="mt-4 flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={alsoDeleteSales}
                onChange={(e) => setAlsoDeleteSales(e.target.checked)}
                className="mt-0.5 rounded border-slate-300"
              />
              <span>
                Also permanently delete the underlying sales records from Sales History and revenue reports
              </span>
            </label>
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
                  clearReceipts(
                    query.trim() ? visibleReceipts.map((s) => s.id) : undefined,
                    alsoDeleteSales,
                  );
                  setClearModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold bg-red-700 hover:bg-red-800 text-white rounded-lg cursor-pointer"
              >
                Clear Receipts ({visibleReceipts.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
