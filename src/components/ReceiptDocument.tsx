import React from 'react';
import type { CompanySettings, Sale } from '../types/erp';
import { formatCurrency } from '../utils/erpLogic';
import { BrandLogo } from './BrandLogo';

interface ReceiptDocumentProps {
  sale: Sale;
  settings: CompanySettings;
  paperFormat: 'a4' | 'thermal';
}

export const ReceiptDocument: React.FC<ReceiptDocumentProps> = ({
  sale,
  settings,
  paperFormat,
}) => {
  const currency = settings.currency || 'GHS';
  const isThermal = paperFormat === 'thermal';

  return (
    <div
      className={`print-area bg-white text-slate-900 border border-slate-200 ${
        isThermal ? 'thermal-80mm w-[302px] p-4 text-xs' : 'w-full max-w-[640px] p-8 text-sm'
      }`}
    >
      {/* Company Header */}
      <div className="text-center pb-4 border-b border-dashed border-slate-300">
        <div className="flex justify-center mb-2">
          <BrandLogo
            logoDataUrl={settings.logoDataUrl}
            companyName={settings.companyName}
            size={isThermal ? 'sm' : 'md'}
          />
        </div>
        <h2
          className={`font-bold tracking-tight text-slate-900 ${
            isThermal ? 'text-sm' : 'text-xl'
          }`}
        >
          {settings.companyName}
        </h2>
        <p className="text-xs text-slate-600 mt-0.5">{settings.address}</p>
        <p className="text-xs text-slate-600">
          Tel: {settings.phone} · {settings.email}
        </p>
      </div>

      {/* Receipt Meta */}
      <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">Receipt No:</span>
          <span className="font-mono-num font-semibold text-slate-900">{sale.receiptNumber}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">Date &amp; Time:</span>
          <span className="font-mono-num text-slate-900">
            {new Date(sale.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">Cashier:</span>
          <span className="text-slate-900 font-medium">{sale.cashierName}</span>
        </div>
        {sale.customerName && (
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Customer:</span>
            <span className="text-slate-900">{sale.customerName}</span>
          </div>
        )}
        {sale.customerPhone && (
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Customer Phone:</span>
            <span className="font-mono-num text-slate-900">{sale.customerPhone}</span>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="py-3 border-b border-dashed border-slate-300">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="py-1.5 font-medium">Item</th>
              <th className="py-1.5 font-medium text-right">Qty</th>
              <th className="py-1.5 font-medium text-right">Price</th>
              <th className="py-1.5 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sale.items.map((item) => (
              <tr key={item.id} className="text-xs">
                <td className="py-2 pr-2">
                  <div className="font-medium text-slate-900">{item.productName}</div>
                  <div className="text-[11px] text-slate-500 font-mono-num">{item.sku}</div>
                </td>
                <td className="py-2 text-right font-mono-num">{item.quantity}</td>
                <td className="py-2 text-right font-mono-num">{item.unitPrice.toFixed(2)}</td>
                <td className="py-2 text-right font-mono-num font-medium">
                  {item.lineTotal.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="py-3 space-y-1.5 text-xs border-b border-dashed border-slate-300">
        <div className="flex justify-between">
          <span className="text-slate-600">Subtotal</span>
          <span className="font-mono-num font-medium">
            {formatCurrency(sale.subtotal, currency)}
          </span>
        </div>
        {sale.discountAmount > 0 && (
          <div className="flex justify-between text-emerald-700">
            <span>Discount</span>
            <span className="font-mono-num">
              -{formatCurrency(sale.discountAmount, currency)}
            </span>
          </div>
        )}
        <div className="flex justify-between pt-1.5 border-t border-slate-200 text-sm font-bold text-slate-900">
          <span>Total Paid</span>
          <span className="font-mono-num">{formatCurrency(sale.totalAmount, currency)}</span>
        </div>
        <div className="flex justify-between pt-1">
          <span className="text-slate-600">Payment Method</span>
          <span className="font-medium">{sale.paymentMethod}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Amount Tendered</span>
          <span className="font-mono-num">{formatCurrency(sale.amountPaid, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">
            {sale.balanceDue > 0 ? 'Balance Due' : 'Change Given'}
          </span>
          <span className="font-mono-num font-medium">
            {formatCurrency(sale.balanceDue > 0 ? sale.balanceDue : sale.changeGiven, currency)}
          </span>
        </div>
      </div>

      {/* Thank You Footer */}
      <div className="pt-4 text-center text-xs text-slate-600 space-y-1">
        <p className="font-medium text-slate-800">{settings.receiptFooter}</p>
        <p className="text-[11px] text-slate-400">
          Official Sales Receipt · {settings.companyName}
        </p>
      </div>
    </div>
  );
};
