import React, { useMemo, useState } from 'react';
import { AlertCircle, ArrowDownCircle, ArrowUpCircle, CheckCircle2 } from 'lucide-react';
import { useErp } from '../store/erpStore';

export const StockAdjustmentView: React.FC = () => {
  const { db, adjustStock } = useErp();

  const [selectedProductId, setSelectedProductId] = useState(db.products[0]?.id || '');
  const [mode, setMode] = useState<'restock' | 'reduction'>('restock');
  const [quantity, setQuantity] = useState('10');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [txFilter, setTxFilter] = useState<'all' | 'restock' | 'reduction' | 'sale' | 'initial'>('all');

  const selectedProduct = useMemo(
    () => db.products.find((p) => p.id === selectedProductId) ?? db.products[0],
    [db.products, selectedProductId],
  );

  const filteredTransactions = useMemo(() => {
    if (txFilter === 'all') return db.inventoryTransactions;
    return db.inventoryTransactions.filter((t) => t.type === txFilter);
  }, [db.inventoryTransactions, txFilter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedProduct) {
      setErrorMsg('Please select a product.');
      return;
    }

    const qty = Number.parseInt(quantity, 10);
    const res = adjustStock({
      productId: selectedProduct.id,
      mode,
      quantity: qty,
      note,
    });

    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    setSuccessMsg(
      `${res.product.name} updated immediately to ${res.product.quantity} units in stock.`,
    );
    setQuantity('10');
    setNote('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Stock Adjustment Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 h-fit">
        <h2 className="text-base font-bold text-slate-900">Adjust Product Stock</h2>
        <p className="text-xs text-slate-500 mt-1">
          Add new stock shipments or record damaged/returned stock reductions. Negative stock is
          strictly prevented.
        </p>

        {errorMsg && (
          <div
            role="alert"
            className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="stock-prod" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Product
            </label>
            <select
              id="stock-prod"
              value={selectedProduct?.id || ''}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {db.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) — Current: {p.quantity}
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600">Current Stock On Hand</span>
              <span className="font-mono-num text-base font-bold text-slate-900">
                {selectedProduct.quantity} units
              </span>
            </div>
          )}

          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              Adjustment Type
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('restock')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  mode === 'restock'
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <ArrowUpCircle className="w-4 h-4" />
                <span>Add Stock</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('reduction')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  mode === 'reduction'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <ArrowDownCircle className="w-4 h-4" />
                <span>Reduce Stock</span>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="stock-qty" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Quantity *
            </label>
            <input
              id="stock-qty"
              type="number"
              min="1"
              step="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label htmlFor="stock-note" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Reason / Reference Note *
            </label>
            <input
              id="stock-note"
              type="text"
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === 'restock'
                  ? 'e.g. Supplier invoice #INV-409'
                  : 'e.g. Damaged during warehouse move'
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            {mode === 'restock' ? 'Confirm Stock Addition' : 'Confirm Stock Reduction'}
          </button>
        </form>
      </div>

      {/* Stock Movement Ledger */}
      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Stock Adjustment &amp; Movement History</h2>
            <p className="text-xs text-slate-500">
              Complete audit log of restocks, reductions, and sales deductions
            </p>
          </div>

          <select
            aria-label="Filter stock movements by type"
            value={txFilter}
            onChange={(e) =>
              setTxFilter(e.target.value as 'all' | 'restock' | 'reduction' | 'sale' | 'initial')
            }
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="all">All Movements</option>
            <option value="restock">Restocks</option>
            <option value="reduction">Reductions</option>
            <option value="sale">Sales Deductions</option>
            <option value="initial">Opening Stock</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Change</th>
                <th className="py-3 px-4 text-right">New Qty</th>
                <th className="py-3 px-4">Recorded By</th>
                <th className="py-3 px-4">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 text-sm">
                    No inventory transactions match this filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.slice(0, 60).map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono-num text-slate-600 whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900">{tx.productName}</div>
                      <div className="font-mono-num text-slate-500">{tx.sku}</div>
                    </td>
                    <td className="py-2.5 px-4 capitalize font-medium text-slate-700">{tx.type}</td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono-num font-bold ${
                        tx.quantityChange > 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {tx.quantityChange > 0 ? `+${tx.quantityChange}` : tx.quantityChange}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-slate-900">
                      {tx.newQty}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{tx.userName}</td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-[200px] truncate">{tx.note}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
