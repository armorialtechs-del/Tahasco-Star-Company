import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Edit2,
  History,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useErp } from '../store/erpStore';
import type { Product } from '../types/erp';
import { formatCurrency } from '../utils/erpLogic';

type SortField = 'name' | 'sellingPrice' | 'quantity' | 'dateAdded';

export const InventoryView: React.FC = () => {
  const {
    db,
    currentUser,
    addProduct,
    updateProduct,
    deleteProduct,
    addCategory,
    clearInventory,
    setActiveSection,
  } = useErp();

  const isAdmin = currentUser?.role === 'admin';
  const currency = db.settings.currency || 'GHS';

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Add/Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formError, setFormError] = useState('');
  const [formState, setFormState] = useState({
    sku: '',
    name: '',
    categoryId: db.categories[0]?.id || '',
    description: '',
    costPrice: '',
    sellingPrice: '',
    quantity: '',
    minStockLevel: String(db.settings.defaultLowStockThreshold),
    supplier: '',
    imageUrl: '',
  });

  // New Category inline modal
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryAdder, setShowCategoryAdder] = useState(false);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Product Stock History Modal
  const [historyTarget, setHistoryTarget] = useState<Product | null>(null);

  // Clear Inventory Modal
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearMode, setClearMode] = useState<'remove_products' | 'zero_stock'>('remove_products');
  const [clearHistoryLogs, setClearHistoryLogs] = useState(true);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.products
      .filter((p) => {
        if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false;
        if (stockFilter === 'out' && p.quantity > 0) return false;
        if (stockFilter === 'low' && (p.quantity <= 0 || p.quantity > p.minStockLevel)) return false;
        if (stockFilter === 'in' && p.quantity <= p.minStockLevel) return false;
        if (q) {
          const match =
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            (p.supplier && p.supplier.toLowerCase().includes(q));
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'name') cmp = a.name.localeCompare(b.name);
        else if (sortField === 'sellingPrice') cmp = a.sellingPrice - b.sellingPrice;
        else if (sortField === 'quantity') cmp = a.quantity - b.quantity;
        else cmp = new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime();
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [categoryFilter, db.products, search, sortDir, sortField, stockFilter]);

  const productHistory = useMemo(() => {
    if (!historyTarget) return [];
    return db.inventoryTransactions.filter((t) => t.productId === historyTarget.id);
  }, [db.inventoryTransactions, historyTarget]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormError('');
    setFormState({
      sku: `TSC-${String(db.products.length + 1).padStart(3, '0')}`,
      name: '',
      categoryId: db.categories[0]?.id || '',
      description: '',
      costPrice: '',
      sellingPrice: '',
      quantity: '0',
      minStockLevel: String(db.settings.defaultLowStockThreshold),
      supplier: '',
      imageUrl: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormError('');
    setFormState({
      sku: p.sku,
      name: p.name,
      categoryId: p.categoryId,
      description: p.description ?? '',
      costPrice: String(p.costPrice),
      sellingPrice: String(p.sellingPrice),
      quantity: String(p.quantity),
      minStockLevel: String(p.minStockLevel),
      supplier: p.supplier ?? '',
      imageUrl: p.imageUrl ?? '',
    });
    setModalOpen(true);
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormState((prev) => ({ ...prev, imageUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const costPrice = Number.parseFloat(formState.costPrice);
    const sellingPrice = Number.parseFloat(formState.sellingPrice);
    const quantity = Number.parseInt(formState.quantity, 10);
    const minStockLevel = Number.parseInt(formState.minStockLevel, 10);

    if (Number.isNaN(costPrice) || Number.isNaN(sellingPrice)) {
      setFormError('Enter valid numeric cost and selling prices.');
      return;
    }

    if (editingProduct) {
      const res = updateProduct(editingProduct.id, {
        sku: formState.sku,
        name: formState.name,
        categoryId: formState.categoryId,
        description: formState.description,
        costPrice,
        sellingPrice,
        minStockLevel: Number.isNaN(minStockLevel) ? 10 : minStockLevel,
        supplier: formState.supplier,
        imageUrl: formState.imageUrl,
      });
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
    } else {
      const res = addProduct({
        sku: formState.sku,
        name: formState.name,
        categoryId: formState.categoryId,
        description: formState.description,
        costPrice,
        sellingPrice,
        quantity: Number.isNaN(quantity) ? 0 : quantity,
        minStockLevel: Number.isNaN(minStockLevel) ? 10 : minStockLevel,
        supplier: formState.supplier,
        imageUrl: formState.imageUrl,
      });
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
    }

    setModalOpen(false);
  };

  const handleCreateCategory = () => {
    const res = addCategory(newCategoryName);
    if (res.ok) {
      setFormState((prev) => ({ ...prev, categoryId: res.category.id }));
      setNewCategoryName('');
      setShowCategoryAdder(false);
    }
  };

  const lowCount = db.products.filter((p) => p.quantity > 0 && p.quantity <= p.minStockLevel).length;
  const outCount = db.products.filter((p) => p.quantity <= 0).length;

  return (
    <div className="space-y-5">
      {/* Toolbar & Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span>{db.products.length} total SKUs</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-700 font-medium">{lowCount} low stock</span>
            <span aria-hidden="true">·</span>
            <span className="text-red-700 font-medium">{outCount} out of stock</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setClearMode('remove_products');
                    setClearHistoryLogs(true);
                    setClearModalOpen(true);
                  }}
                  disabled={db.products.length === 0 && db.inventoryTransactions.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-red-200 bg-white hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed text-red-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Inventory</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('add-stock')}
                  className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Adjust Stock
                </button>
                <button
                  type="button"
                  onClick={openAddModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Search inventory by name, SKU, or supplier"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, SKU, supplier..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">All Categories</option>
            {db.categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by stock status"
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as 'all' | 'in' | 'low' | 'out')}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">All Stock Levels</option>
            <option value="in">Healthy Stock</option>
            <option value="low">Low Stock Alert</option>
            <option value="out">Out of Stock</option>
          </select>

          <div className="flex items-center gap-2">
            <select
              aria-label="Sort inventory by"
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="name">Sort: Name</option>
              <option value="quantity">Sort: Stock Qty</option>
              <option value="sellingPrice">Sort: Selling Price</option>
              <option value="dateAdded">Sort: Date Added</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white hover:bg-slate-50 cursor-pointer"
            >
              {sortDir === 'asc' ? 'ASC' : 'DESC'}
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Product / SKU</th>
                <th className="py-3 px-4">Category</th>
                {isAdmin && <th className="py-3 px-4 text-right">Cost Price</th>}
                <th className="py-3 px-4 text-right">Selling Price</th>
                <th className="py-3 px-4 text-right">In Stock</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="py-12 text-center text-slate-500">
                    No matching products found. Adjust your search or add a new product.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOut = p.quantity <= 0;
                  const isLow = !isOut && p.quantity <= p.minStockLevel;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate max-w-[240px]">
                              {p.name}
                            </div>
                            <div className="text-xs text-slate-500 font-mono-num">
                              {p.sku}
                              {p.supplier ? ` · ${p.supplier}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 text-xs">{p.categoryName}</td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right font-mono-num text-slate-600">
                          {formatCurrency(p.costPrice, currency)}
                        </td>
                      )}
                      <td className="py-3 px-4 text-right font-mono-num font-semibold text-slate-900">
                        {formatCurrency(p.sellingPrice, currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-bold text-slate-900">
                        {p.quantity}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold">
                        {isOut ? (
                          <span className="text-red-700">Out of stock</span>
                        ) : isLow ? (
                          <span className="text-amber-700">Low stock (Min {p.minStockLevel})</span>
                        ) : (
                          <span className="text-emerald-700">In stock</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setHistoryTarget(p)}
                            aria-label={`View stock history for ${p.name}`}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(p)}
                                aria-label={`Edit ${p.name}`}
                                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(p)}
                                aria-label={`Delete ${p.name}`}
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={editingProduct ? 'Edit Product' : 'Add New Product'}
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                {editingProduct ? `Edit Product — ${editingProduct.name}` : 'Add New Product'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close product modal"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div
                role="alert"
                className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitProduct} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="prod-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Product Name *
                  </label>
                  <input
                    id="prod-name"
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    placeholder="e.g. Steel Bar 16mm"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="prod-sku" className="block text-xs font-semibold text-slate-700 mb-1">
                    Product ID / SKU *
                  </label>
                  <input
                    id="prod-sku"
                    type="text"
                    required
                    value={formState.sku}
                    onChange={(e) => setFormState({ ...formState, sku: e.target.value })}
                    placeholder="TSC-BM-009"
                    className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="prod-cat" className="block text-xs font-semibold text-slate-700">
                    Category *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCategoryAdder((v) => !v)}
                    className="text-xs font-medium text-teal-700 hover:text-teal-900 cursor-pointer"
                  >
                    + New Category
                  </button>
                </div>
                <select
                  id="prod-cat"
                  value={formState.categoryId}
                  onChange={(e) => setFormState({ ...formState, categoryId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {db.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {showCategoryAdder && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="New category name"
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      className="px-3 py-1.5 bg-teal-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="prod-cost" className="block text-xs font-semibold text-slate-700 mb-1">
                    Cost Price ({currency}) *
                  </label>
                  <input
                    id="prod-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formState.costPrice}
                    onChange={(e) => setFormState({ ...formState, costPrice: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="prod-sell" className="block text-xs font-semibold text-slate-700 mb-1">
                    Selling Price ({currency}) *
                  </label>
                  <input
                    id="prod-sell"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formState.sellingPrice}
                    onChange={(e) => setFormState({ ...formState, sellingPrice: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                  />
                </div>
                {!editingProduct && (
                  <div>
                    <label htmlFor="prod-qty" className="block text-xs font-semibold text-slate-700 mb-1">
                      Opening Stock *
                    </label>
                    <input
                      id="prod-qty"
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={formState.quantity}
                      onChange={(e) => setFormState({ ...formState, quantity: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="prod-min" className="block text-xs font-semibold text-slate-700 mb-1">
                    Min Stock Level *
                  </label>
                  <input
                    id="prod-min"
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={formState.minStockLevel}
                    onChange={(e) => setFormState({ ...formState, minStockLevel: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="prod-supplier" className="block text-xs font-semibold text-slate-700 mb-1">
                    Supplier (Optional)
                  </label>
                  <input
                    id="prod-supplier"
                    type="text"
                    value={formState.supplier}
                    onChange={(e) => setFormState({ ...formState, supplier: e.target.value })}
                    placeholder="Supplier company name"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="prod-img" className="block text-xs font-semibold text-slate-700 mb-1">
                    Product Image (Optional)
                  </label>
                  <input
                    id="prod-img"
                    type="file"
                    accept="image/*"
                    onChange={handleImageFile}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-300 file:bg-slate-50 file:text-slate-700 file:font-medium"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="prod-desc" className="block text-xs font-semibold text-slate-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  id="prod-desc"
                  rows={2}
                  value={formState.description}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete product"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">Delete Product?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-slate-900">{deleteTarget.name}</span> (
              <span className="font-mono-num">{deleteTarget.sku}</span>)? Existing historical sales
              receipts will remain intact.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteProduct(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock History Modal */}
      {historyTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Stock history for ${historyTarget.name}`}
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl p-6 shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Stock History</h2>
                <p className="text-xs text-slate-500">
                  {historyTarget.name} ({historyTarget.sku}) · Current stock:{' '}
                  <span className="font-mono-num font-semibold">{historyTarget.quantity}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryTarget(null)}
                aria-label="Close stock history"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 overflow-y-auto flex-1">
              {productHistory.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  No stock movements recorded for this product yet.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3 text-right">Change</th>
                      <th className="py-2 pr-3 text-right">Balance</th>
                      <th className="py-2 pr-3">User</th>
                      <th className="py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productHistory.map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-2 pr-3 font-mono-num text-slate-600">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 pr-3 capitalize font-medium text-slate-800">
                          {tx.type}
                        </td>
                        <td
                          className={`py-2 pr-3 text-right font-mono-num font-semibold ${
                            tx.quantityChange > 0 ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {tx.quantityChange > 0 ? `+${tx.quantityChange}` : tx.quantityChange}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono-num font-semibold text-slate-900">
                          {tx.newQty}
                        </td>
                        <td className="py-2 pr-3 text-slate-700">{tx.userName}</td>
                        <td className="py-2 text-slate-600">{tx.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
      {clearModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Clear inventory confirmation"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Clear Inventory</h2>
              <button
                type="button"
                onClick={() => setClearModalOpen(false)}
                aria-label="Close clear inventory dialog"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              {filteredProducts.length < db.products.length
                ? `Choose whether to clear the ${filteredProducts.length} filtered item(s) or all ${db.products.length} inventory product(s). Historical sales receipts remain intact.`
                : `Choose how to clear all ${db.products.length} product(s) in inventory. Historical sales receipts remain intact.`}
            </p>
            <div className="mt-4 space-y-2.5">
              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="clear-inventory-mode"
                  checked={clearMode === 'remove_products'}
                  onChange={() => setClearMode('remove_products')}
                  className="mt-0.5"
                />
                <span>
                  <strong className="text-slate-900 block">
                    Remove products from inventory catalog
                  </strong>
                  Deletes the selected products from stock and clears their active threshold alerts.
                </span>
              </label>
              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="clear-inventory-mode"
                  checked={clearMode === 'zero_stock'}
                  onChange={() => setClearMode('zero_stock')}
                  className="mt-0.5"
                />
                <span>
                  <strong className="text-slate-900 block">
                    Reset stock quantities to 0 (keep catalog)
                  </strong>
                  Sets available stock quantity to 0 while keeping product names, SKUs, categories, and prices.
                </span>
              </label>
              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearHistoryLogs}
                  onChange={(e) => setClearHistoryLogs(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span>Also clear recorded stock movement history logs</span>
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setClearModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              {filteredProducts.length > 0 && filteredProducts.length < db.products.length && (
                <button
                  type="button"
                  onClick={() => {
                    clearInventory({
                      productIds: filteredProducts.map((p) => p.id),
                      mode: clearMode,
                      clearHistory: clearHistoryLogs,
                    });
                    setClearModalOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold border border-red-300 bg-red-50 hover:bg-red-100 text-red-800 rounded-lg cursor-pointer"
                >
                  Clear Filtered ({filteredProducts.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  clearInventory({
                    mode: clearMode,
                    clearHistory: clearHistoryLogs,
                  });
                  setClearModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold bg-red-700 hover:bg-red-800 text-white rounded-lg cursor-pointer"
              >
                {clearMode === 'zero_stock'
                  ? `Zero All Stock (${db.products.length})`
                  : `Clear All Inventory (${db.products.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
