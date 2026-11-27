import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Check,
  CheckCircle2,
  PackagePlus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useErp } from '../store/erpStore';
import type { Product } from '../types/erp';

type AlertTab = 'all' | 'out_of_stock' | 'low_stock' | 'thresholds' | 'history';

export const AlertsView: React.FC = () => {
  const {
    db,
    adjustStock,
    updateProductThreshold,
    markNotificationRead,
    markAllNotificationsRead,
    clearAlerts,
  } = useErp();

  const [tab, setTab] = useState<AlertTab>('all');
  const [search, setSearch] = useState('');
  const [clearModalOpen, setClearModalOpen] = useState(false);

  // Quick restock modal state
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState('20');
  const [restockNote, setRestockNote] = useState('Restocked from Alerts center');
  const [restockError, setRestockError] = useState('');

  // Inline threshold editor state
  const [editingThresholdId, setEditingThresholdId] = useState<string | null>(null);
  const [thresholdDraft, setThresholdDraft] = useState('');

  const productById = useMemo(
    () => new Map(db.products.map((p) => [p.id, p])),
    [db.products],
  );

  // Active unresolved stock threshold alerts
  const activeAlerts = useMemo(() => {
    return db.notifications
      .filter((n) => (n.type === 'low_stock' || n.type === 'out_of_stock') && !n.resolvedAt && !n.clearedAt)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'out_of_stock' ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [db.notifications]);

  const outOfStockCount = useMemo(
    () => activeAlerts.filter((a) => a.type === 'out_of_stock').length,
    [activeAlerts],
  );
  const lowStockCount = useMemo(
    () => activeAlerts.filter((a) => a.type === 'low_stock').length,
    [activeAlerts],
  );
  const unreadAlertCount = useMemo(
    () => activeAlerts.filter((a) => !a.read).length,
    [activeAlerts],
  );

  const historyAlerts = useMemo(() => {
    return db.notifications
      .filter((n) => !n.clearedAt)
      .filter((n) => Boolean(n.resolvedAt) || n.type === 'stock_update')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [db.notifications]);

  const q = search.trim().toLowerCase();

  const filteredActiveAlerts = useMemo(() => {
    return activeAlerts
      .filter((a) => {
        if (tab === 'out_of_stock' && a.type !== 'out_of_stock') return false;
        if (tab === 'low_stock' && a.type !== 'low_stock') return false;
        if (!q) return true;
        return (
          (a.productName ?? '').toLowerCase().includes(q) ||
          (a.sku ?? '').toLowerCase().includes(q) ||
          a.message.toLowerCase().includes(q)
        );
      });
  }, [activeAlerts, q, tab]);

  const filteredProductsForThresholds = useMemo(() => {
    return [...db.products]
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.quantity - a.minStockLevel - (b.quantity - b.minStockLevel));
  }, [db.products, q]);

  const filteredHistory = useMemo(() => {
    return historyAlerts.filter((n) => {
      if (!q) return true;
      return (
        (n.productName ?? '').toLowerCase().includes(q) ||
        (n.sku ?? '').toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        n.title.toLowerCase().includes(q)
      );
    });
  }, [historyAlerts, q]);

  const openRestockModal = (product: Product) => {
    const suggested = Math.max(10, product.minStockLevel * 2 - product.quantity);
    setRestockProduct(product);
    setRestockQty(String(suggested));
    setRestockNote('Restocked from Alerts center');
    setRestockError('');
  };

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProduct) return;
    setRestockError('');
    const qty = Number.parseInt(restockQty, 10);
    if (!Number.isInteger(qty) || qty <= 0) {
      setRestockError('Enter a valid whole number greater than zero.');
      return;
    }
    const res = adjustStock({
      productId: restockProduct.id,
      mode: 'restock',
      quantity: qty,
      note: restockNote,
    });
    if (!res.ok) {
      setRestockError(res.error);
      return;
    }
    setRestockProduct(null);
  };

  const handleSaveThreshold = (productId: string) => {
    const parsed = Number.parseInt(thresholdDraft, 10);
    if (Number.isNaN(parsed) || parsed < 0) return;
    const res = updateProductThreshold(productId, parsed);
    if (res.ok) {
      setEditingThresholdId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">Active Threshold Alerts</div>
            <div className="mt-1.5 text-2xl font-bold font-mono-num text-slate-900">
              {activeAlerts.length}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {lowStockCount} low stock · {outOfStockCount} out of stock
            </div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">Critical Out of Stock</div>
            <div className="mt-1.5 text-2xl font-bold font-mono-num text-red-700">
              {outOfStockCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">Items at 0 units available</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-red-50 text-red-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-slate-500">Unread Admin Alerts</div>
            <div className="mt-1.5 text-2xl font-bold font-mono-num text-slate-900">
              {unreadAlertCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">Automated threshold monitor</div>
          </div>
          {unreadAlertCount > 0 ? (
            <button
              type="button"
              onClick={markAllNotificationsRead}
              className="px-3 py-1.5 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
          ) : (
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar & Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ['all', `All Active (${activeAlerts.length})`],
              ['out_of_stock', `Out of Stock (${outOfStockCount})`],
              ['low_stock', `Low Stock (${lowStockCount})`],
              ['thresholds', `Threshold Rules (${db.products.length})`],
              ['history', `Resolved & History (${historyAlerts.length})`],
            ] as Array<[AlertTab, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                tab === id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Search alerts by product or SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product or SKU..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <button
            type="button"
            onClick={() => setClearModalOpen(true)}
            disabled={activeAlerts.length === 0 && historyAlerts.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 bg-white hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed text-red-700 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Alerts</span>
          </button>
        </div>
      </div>

      {/* Active Alerts List */}
      {(tab === 'all' || tab === 'out_of_stock' || tab === 'low_stock') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Automated Low-Stock &amp; Out-of-Stock Alerts</h2>
              <p className="text-xs text-slate-500">
                Alerts fire automatically when a sale, reduction, or threshold change puts stock at or below its minimum threshold.
              </p>
            </div>
          </div>

          {filteredActiveAlerts.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <CheckCircle2 className="w-9 h-9 text-emerald-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-900">
                No active stock threshold alerts
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                All matching products are currently stocked above their defined minimum thresholds. You can configure individual thresholds under the Threshold Rules tab.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredActiveAlerts.map((alert) => {
                const product = alert.productId ? productById.get(alert.productId) : undefined;
                const isOut = alert.type === 'out_of_stock';
                const currentQty = product?.quantity ?? alert.currentQty ?? 0;
                const threshold = product?.minStockLevel ?? alert.threshold ?? 0;
                const needed = Math.max(1, threshold + 1 - currentQty);

                return (
                  <div
                    key={alert.id}
                    className={`p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                      !alert.read ? 'bg-slate-50/70' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isOut ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {!alert.read && (
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isOut ? 'bg-red-600' : 'bg-amber-600'
                              }`}
                              title="Unread alert"
                            />
                          )}
                          <span className="text-sm font-bold text-slate-900">
                            {product?.name ?? alert.productName ?? alert.title}
                          </span>
                          {(product?.sku ?? alert.sku) && (
                            <span className="text-xs font-mono-num text-slate-500">
                              {product?.sku ?? alert.sku}
                            </span>
                          )}
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                              isOut
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {isOut ? 'Out of Stock' : 'Low Stock'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{alert.message}</p>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-mono-num">
                          <span>
                            In Stock:{' '}
                            <strong className={isOut ? 'text-red-700' : 'text-amber-700'}>
                              {currentQty}
                            </strong>
                          </span>
                          <span>Threshold: {threshold}</span>
                          <span>Min to clear alert: +{needed}</span>
                          <span>Triggered: {new Date(alert.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {!alert.read && (
                        <button
                          type="button"
                          onClick={() => markNotificationRead(alert.id)}
                          className="px-3 py-1.5 text-xs font-medium border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Read</span>
                        </button>
                      )}
                      {product && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setTab('thresholds');
                              setEditingThresholdId(product.id);
                              setThresholdDraft(String(product.minStockLevel));
                            }}
                            className="px-3 py-1.5 text-xs font-medium border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>Threshold</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openRestockModal(product)}
                            className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <PackagePlus className="w-3.5 h-3.5" />
                            <span>Restock Now</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Threshold Rules Configuration Table */}
      {tab === 'thresholds' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900">Product Alert Thresholds</h2>
            <p className="text-xs text-slate-500">
              Adjust any product&apos;s minimum stock threshold. Alerts automatically fire or resolve when thresholds change.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Current Stock</th>
                  <th className="py-3 px-4 text-right">Alert Threshold</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredProductsForThresholds.map((p) => {
                  const isOut = p.quantity === 0;
                  const isLow = !isOut && p.minStockLevel > 0 && p.quantity <= p.minStockLevel;
                  const isEditing = editingThresholdId === p.id;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{p.name}</div>
                        <div className="text-xs font-mono-num text-slate-500">{p.sku}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{p.categoryName}</td>
                      <td className="py-3 px-4 text-right font-mono-num font-bold text-slate-900">
                        {p.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            aria-label={`Threshold for ${p.name}`}
                            value={thresholdDraft}
                            onChange={(e) => setThresholdDraft(e.target.value)}
                            className="w-20 px-2 py-1 text-right text-xs border border-slate-300 rounded-md"
                          />
                        ) : (
                          <span>{p.minStockLevel}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold">
                        {isOut ? (
                          <span className="text-red-700">Out of Stock</span>
                        ) : isLow ? (
                          <span className="text-amber-700">Alert Active</span>
                        ) : (
                          <span className="text-emerald-700">Healthy</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveThreshold(p.id)}
                              className="px-2.5 py-1 text-xs font-semibold bg-slate-900 text-white rounded-md cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingThresholdId(null)}
                              className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-md cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingThresholdId(p.id);
                                setThresholdDraft(String(p.minStockLevel));
                              }}
                              className="text-xs font-medium text-teal-700 hover:text-teal-900 cursor-pointer"
                            >
                              Edit Threshold
                            </button>
                            <button
                              type="button"
                              onClick={() => openRestockModal(p)}
                              className="text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
                            >
                              Restock
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resolved Alerts & Admin Stock Activity */}
      {tab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900">Resolved Alerts &amp; Stock Notification Log</h2>
            <p className="text-xs text-slate-500">
              Threshold alerts automatically move here once stock is replenished above the minimum level.
            </p>
          </div>
          {filteredHistory.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No resolved alerts or stock notifications yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredHistory.map((item) => (
                <div key={item.id} className="p-4 sm:px-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{item.title}</span>
                      {item.resolvedAt && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Auto-Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{item.message}</p>
                  </div>
                  <div className="text-right text-[11px] font-mono-num text-slate-500 shrink-0">
                    <div>{new Date(item.resolvedAt ?? item.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Restock Modal */}
      {restockProduct && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Restock ${restockProduct.name}`}
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-900">Restock Product</h2>
                <p className="text-xs text-slate-500">
                  {restockProduct.name} ({restockProduct.sku})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRestockProduct(null)}
                aria-label="Close restock dialog"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="mt-4 space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between text-xs font-mono-num">
                <span>Current Qty: <strong>{restockProduct.quantity}</strong></span>
                <span>Threshold: <strong>{restockProduct.minStockLevel}</strong></span>
              </div>

              {restockError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {restockError}
                </div>
              )}

              <div>
                <label htmlFor="alert-restock-qty" className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantity to Add
                </label>
                <input
                  id="alert-restock-qty"
                  type="number"
                  min="1"
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label htmlFor="alert-restock-note" className="block text-xs font-semibold text-slate-700 mb-1">
                  Note
                </label>
                <input
                  id="alert-restock-note"
                  type="text"
                  value={restockNote}
                  onChange={(e) => setRestockNote(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockProduct(null)}
                  className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
                >
                  Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {clearModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Clear alerts confirmation"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Clear Stock Alerts</h2>
              <button
                type="button"
                onClick={() => setClearModalOpen(false)}
                aria-label="Close clear alerts dialog"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Clear all active alerts ({activeAlerts.length}) and resolved alert history ({historyAlerts.length})? Future sales or stock drops below threshold will still generate new alerts automatically.
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
                  clearAlerts();
                  setClearModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold bg-red-700 hover:bg-red-800 text-white rounded-lg cursor-pointer"
              >
                Clear All Alerts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
