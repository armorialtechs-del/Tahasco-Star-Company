import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { useErp } from '../store/erpStore';
import type { PaymentMethod, Product, Sale } from '../types/erp';
import { calculateSaleTotals, createId, formatCurrency } from '../utils/erpLogic';
import { ReceiptModal } from './ReceiptModal';

interface CartRow {
  productId: string;
  quantity: number;
}

const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Mobile Money', 'Bank Transfer', 'Other'];

export const PosView: React.FC = () => {
  const { db, currentUser, completeSale } = useErp();
  const currency = db.settings.currency || 'GHS';
  const isAdmin = currentUser?.role === 'admin';

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cart, setCart] = useState<CartRow[]>([]);
  const [discountInput, setDiscountInput] = useState('0');
  const [amountPaidInput, setAmountPaidInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => createId('idem'));
  const [completedReceipt, setCompletedReceipt] = useState<Sale | null>(null);

  const productMap = useMemo(() => new Map(db.products.map((p) => [p.id, p])), [db.products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.products.filter((p) => {
      if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    });
  }, [categoryFilter, db.products, search]);

  const cartDetailed = useMemo(() => {
    return cart
      .map((row) => {
        const product = productMap.get(row.productId);
        if (!product) return null;
        return {
          product,
          quantity: row.quantity,
          lineTotal: product.sellingPrice * row.quantity,
        };
      })
      .filter((x): x is { product: Product; quantity: number; lineTotal: number } => x !== null);
  }, [cart, productMap]);

  const rawDiscount = isAdmin ? Math.max(0, Number.parseFloat(discountInput) || 0) : 0;
  const parsedAmountPaid =
    amountPaidInput === ''
      ? calculateSaleTotals(cartDetailed, rawDiscount, 0).totalAmount
      : Math.max(0, Number.parseFloat(amountPaidInput) || 0);

  const totals = useMemo(
    () => calculateSaleTotals(cartDetailed, rawDiscount, parsedAmountPaid),
    [cartDetailed, parsedAmountPaid, rawDiscount],
  );

  const addToCart = (product: Product) => {
    setErrorMsg('');
    if (product.quantity <= 0) {
      setErrorMsg(`${product.name} is out of stock.`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((r) => r.productId === product.id);
      if (existing) {
        if (existing.quantity + 1 > product.quantity) {
          setErrorMsg(`Cannot add more ${product.name}. Only ${product.quantity} available.`);
          return prev;
        }
        return prev.map((r) =>
          r.productId === product.id ? { ...r, quantity: r.quantity + 1 } : r,
        );
      }
      return [...prev, { productId: product.id, quantity: 1 }];
    });
  };

  const updateCartQty = (productId: string, nextQty: number) => {
    setErrorMsg('');
    const prod = productMap.get(productId);
    if (!prod) return;
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((r) => r.productId !== productId));
      return;
    }
    if (nextQty > prod.quantity) {
      setErrorMsg(`Only ${prod.quantity} units of ${prod.name} are available in stock.`);
      return;
    }
    setCart((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, quantity: nextQty } : r)),
    );
  };

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (cartDetailed.length === 0) {
      setErrorMsg('Select at least one product before completing the sale.');
      return;
    }

    const res = completeSale({
      idempotencyKey,
      items: cartDetailed.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
      discountAmount: rawDiscount,
      amountPaid: parsedAmountPaid,
      paymentMethod,
      customerName,
      customerPhone,
    });

    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    setCompletedReceipt(res.sale);
    setCart([]);
    setDiscountInput('0');
    setAmountPaidInput('');
    setCustomerName('');
    setCustomerPhone('');
    setIdempotencyKey(createId('idem'));
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* Product Catalog Picker */}
      <div className="xl:col-span-7 space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Search products to sell"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name or SKU..."
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Items
            </button>
            {db.categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  categoryFilter === cat.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredProducts.length === 0 ? (
            <div className="sm:col-span-2 bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              No products match your search.
            </div>
          ) : (
            filteredProducts.map((product) => {
              const out = product.quantity <= 0;
              const inCartQty = cart.find((c) => c.productId === product.id)?.quantity ?? 0;
              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={out}
                  onClick={() => addToCart(product)}
                  className={`text-left p-4 rounded-xl border transition-colors flex flex-col justify-between gap-2 ${
                    out
                      ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                      : 'bg-white border-slate-200 hover:border-slate-900 cursor-pointer'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 leading-snug">
                        {product.name}
                      </span>
                      {inCartQty > 0 && (
                        <span className="text-xs font-bold text-teal-700 font-mono-num shrink-0">
                          {inCartQty} in cart
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 font-mono-num">
                      {product.sku} · {product.categoryName}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-sm font-bold text-slate-900 font-mono-num">
                      {formatCurrency(product.sellingPrice, currency)}
                    </span>
                    <span
                      className={`text-xs font-semibold font-mono-num ${
                        out
                          ? 'text-red-700'
                          : product.quantity <= product.minStockLevel
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                      }`}
                    >
                      {out ? 'Out of stock' : `${product.quantity} available`}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Checkout Cart Panel */}
      <form
        onSubmit={handleCheckout}
        className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between h-fit sticky top-4 space-y-4"
      >
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-slate-700" />
              <h2 className="text-base font-bold text-slate-900">Current Sale</h2>
            </div>
            {cartDetailed.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-xs font-medium text-red-700 hover:text-red-900 cursor-pointer"
              >
                Clear Cart
              </button>
            )}
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Cart Items */}
          <div className="mt-3 divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {cartDetailed.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                Select products from the left to build a sale.
              </div>
            ) : (
              cartDetailed.map(({ product, quantity, lineTotal }) => (
                <div key={product.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {product.name}
                    </div>
                    <div className="text-xs text-slate-500 font-mono-num">
                      {formatCurrency(product.sellingPrice, currency)} each · {product.quantity} left
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateCartQty(product.id, quantity - 1)}
                      aria-label={`Decrease quantity of ${product.name}`}
                      className="p-1 rounded border border-slate-300 hover:bg-slate-100 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={product.quantity}
                      aria-label={`Quantity for ${product.name}`}
                      value={quantity}
                      onChange={(e) =>
                        updateCartQty(product.id, Number.parseInt(e.target.value, 10) || 0)
                      }
                      className="w-12 text-center py-1 text-xs font-mono-num font-semibold border border-slate-300 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => updateCartQty(product.id, quantity + 1)}
                      aria-label={`Increase quantity of ${product.name}`}
                      className="p-1 rounded border border-slate-300 hover:bg-slate-100 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="w-24 text-right font-mono-num text-xs font-bold text-slate-900 shrink-0">
                    {formatCurrency(lineTotal, currency)}
                  </div>

                  <button
                    type="button"
                    onClick={() => updateCartQty(product.id, 0)}
                    aria-label={`Remove ${product.name} from cart`}
                    className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Optional Customer Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200">
          <div>
            <label htmlFor="pos-cust-name" className="block text-xs font-medium text-slate-600 mb-1">
              Customer Name (Optional)
            </label>
            <input
              id="pos-cust-name"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Walk-in customer"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="pos-cust-phone" className="block text-xs font-medium text-slate-600 mb-1">
              Customer Phone (Optional)
            </label>
            <input
              id="pos-cust-phone"
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="024 XXX XXXX"
              className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <span className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Method</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  paymentMethod === method
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        {/* Discount & Amount Paid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {isAdmin && (
            <div>
              <label htmlFor="pos-discount" className="block text-xs font-medium text-slate-600 mb-1">
                Discount ({currency})
              </label>
              <input
                id="pos-discount"
                type="number"
                min="0"
                step="0.01"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
              />
            </div>
          )}

          <div className={isAdmin ? '' : 'sm:col-span-2'}>
            <label htmlFor="pos-paid" className="block text-xs font-medium text-slate-600 mb-1">
              Amount Tendered ({currency})
            </label>
            <input
              id="pos-paid"
              type="number"
              min="0"
              step="0.01"
              value={amountPaidInput}
              onChange={(e) => setAmountPaidInput(e.target.value)}
              placeholder={totals.totalAmount.toFixed(2)}
              className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        {/* Summary & Checkout */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="font-mono-num font-medium">
              {formatCurrency(totals.subtotal, currency)}
            </span>
          </div>
          {totals.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Discount</span>
              <span className="font-mono-num">-{formatCurrency(totals.discountAmount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
            <span>Total Due</span>
            <span className="font-mono-num">{formatCurrency(totals.totalAmount, currency)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-600 pt-1">
            <span>{totals.balanceDue > 0 ? 'Balance Due' : 'Change to Return'}</span>
            <span
              className={`font-mono-num font-bold ${
                totals.balanceDue > 0 ? 'text-red-700' : 'text-teal-700'
              }`}
            >
              {formatCurrency(
                totals.balanceDue > 0 ? totals.balanceDue : totals.changeGiven,
                currency,
              )}
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={cartDetailed.length === 0}
          className="w-full py-3 px-4 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Complete Sale &amp; Generate Receipt</span>
        </button>
      </form>

      <ReceiptModal sale={completedReceipt} onClose={() => setCompletedReceipt(null)} />
    </div>
  );
};
