import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, Printer, X } from 'lucide-react';
import { useErp } from '../store/erpStore';
import type { Sale } from '../types/erp';
import {
  clearPrintPageStyle,
  downloadPrintableReceipt,
  downloadReceiptPdf,
  syncPrintPageStyle,
  triggerDirectWindowPrint,
} from '../utils/receiptPrint';
import { ReceiptDocument } from './ReceiptDocument';

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
  initialBlockedNotice?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  onClose,
  initialBlockedNotice = false,
}) => {
  const { db, showToast } = useErp();
  const [paperFormat, setPaperFormat] = useState<'a4' | 'thermal'>('a4');
  const [printBlocked, setPrintBlocked] = useState(initialBlockedNotice);

  useEffect(() => {
    setPrintBlocked(initialBlockedNotice);
  }, [initialBlockedNotice, sale?.id]);

  // Keep body print isolation and dynamic @page dimensions active while modal is open
  useEffect(() => {
    if (!sale) return;
    document.body.classList.add('printing-receipt-modal');
    syncPrintPageStyle(paperFormat);
    return () => {
      document.body.classList.remove('printing-receipt-modal');
      clearPrintPageStyle();
    };
  }, [paperFormat, sale]);

  if (!sale) return null;

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const handlePrint = () => {
    const result = triggerDirectWindowPrint(paperFormat);
    if (result.blockedByIframe) {
      setPrintBlocked(true);
      downloadReceiptPdf(sale, db.settings, paperFormat);
      showToast(
        `Print dialog blocked by preview frame. PDF receipt ${sale.receiptNumber} downloaded automatically.`,
        'info',
      );
    }
  };

  const handleDownloadPdf = () => {
    downloadReceiptPdf(sale, db.settings, paperFormat);
    showToast(`PDF receipt ${sale.receiptNumber} downloaded.`);
  };

  const handleDownloadHtml = () => {
    downloadPrintableReceipt(sale, db.settings, paperFormat);
    showToast(`Printable HTML receipt ${sale.receiptNumber} downloaded.`);
  };

  return createPortal(
    <div
      className="print-modal-wrapper fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Receipt ${sale.receiptNumber}`}
    >
      <div className="print-modal-card bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden shadow-xl">
        {/* Controls bar (hidden on print) */}
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50 no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 whitespace-nowrap">Receipt</span>
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              <button
                type="button"
                onClick={() => setPaperFormat('a4')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  paperFormat === 'a4'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                A4 Standard
              </button>
              <button
                type="button"
                onClick={() => setPaperFormat('thermal')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  paperFormat === 'thermal'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                80mm Thermal
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              title="Download receipt as a ready-to-print PDF file"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close receipt preview"
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {(printBlocked || isInIframe) && (
          <div
            className={`px-5 py-2 border-b text-[11px] flex flex-wrap items-center justify-between gap-2 no-print ${
              printBlocked
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            <span>
              {printBlocked
                ? 'Embedded preview blocked the system print popup, so a PDF copy was downloaded automatically. Open the PDF or open this app in its own browser tab to print directly.'
                : 'Tip: If your embedded preview blocks the print dialog, use Download PDF or Save Printable HTML to print from your browser.'}
            </span>
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="inline-flex items-center gap-1 font-semibold underline hover:no-underline cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-3 h-3" />
              <span>Save Printable HTML</span>
            </button>
          </div>
        )}

        {/* Printable Receipt Body */}
        <div className="print-scroll-container p-6 bg-slate-100/70 flex justify-center max-h-[75vh] overflow-y-auto">
          <ReceiptDocument sale={sale} settings={db.settings} paperFormat={paperFormat} />
        </div>
      </div>
    </div>,
    document.body,
  );
};
