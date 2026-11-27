import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  AppDatabase,
  AuthSession,
  Category,
  CompanySettings,
  Expense,
  NavSection,
  PaymentMethod,
  Product,
  Sale,
  User,
  UserRole,
} from '../types/erp';
import {
  adjustProductStock,
  clearAlertNotifications,
  clearDashboardData,
  clearInventoryRecords,
  clearPeriodReportSales,
  clearReceiptRecords,
  clearSalesRecords,
  clearUsersAndRoles,
  completePasswordReset,
  createId,
  createPasswordResetToken,
  executeSaleTransaction,
  hashPassword,
  removeUserAccount,
  roundCurrency,
  syncThresholdNotifications,
  validateResetToken,
  verifyPassword,
} from '../utils/erpLogic';
import { createInitialSeedDatabase } from './seedData';

const DB_STORAGE_KEY = 'tahasco_star_erp_v2';
const LEGACY_DB_STORAGE_KEY = 'tahasco_star_erp_v1';
const SESSION_STORAGE_KEY = 'tahasco_star_session_v1';

function loadDatabaseFromStorage(): AppDatabase {
  try {
    window.localStorage.removeItem(LEGACY_DB_STORAGE_KEY);
    const raw = window.localStorage.getItem(DB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppDatabase;
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.products)) {
        if (parsed.settings) {
          let migrated = false;
          if (parsed.settings.phone === '+233 30 278 9045 / +233 24 550 1920') {
            parsed.settings.phone = '0551716020 / 05425555272 / 0543066537';
            migrated = true;
          }
          if (parsed.settings.email === 'info@tahascostar.com') {
            parsed.settings.email = 'tahascostar@gmail.com';
            migrated = true;
          }
          if (parsed.settings.address === 'Plot 14, Spintex Industrial Road, Accra, Ghana') {
            parsed.settings.address = 'Wassa Ayiem';
            migrated = true;
          }
          if (migrated) {
            window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(parsed));
          }
        }
        const synced = syncThresholdNotifications(
          parsed.products,
          Array.isArray(parsed.notifications) ? parsed.notifications : [],
          parsed.settings?.defaultLowStockThreshold ?? 10,
        );
        return { ...parsed, notifications: synced.notifications };
      }
    }
  } catch {
    // Fall back to fresh seed data if storage is corrupted
  }
  const seeded = createInitialSeedDatabase();
  const syncedSeed = syncThresholdNotifications(
    seeded.products,
    seeded.notifications,
    seeded.settings.defaultLowStockThreshold,
  );
  const readySeed = { ...seeded, notifications: syncedSeed.notifications };
  try {
    window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(readySeed));
  } catch {
    // Ignore storage quota errors in restricted environments
  }
  return readySeed;
}

function saveDatabaseToStorage(db: AppDatabase): void {
  try {
    window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Ignore storage quota errors
  }
}

function loadSessionFromStorage(): AuthSession | null {
  try {
    const persistent = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (persistent) return JSON.parse(persistent) as AuthSession;
    const temp = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (temp) return JSON.parse(temp) as AuthSession;
  } catch {
    return null;
  }
  return null;
}

function saveSessionToStorage(session: AuthSession | null): void {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    if (!session) return;
    if (session.rememberMe) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // Ignore storage errors
  }
}

export interface ProductInput {
  sku: string;
  name: string;
  categoryId: string;
  description?: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  minStockLevel: number;
  supplier?: string;
  imageUrl?: string;
}

export interface ErpContextValue {
  db: AppDatabase;
  currentUser: User | null;
  activeSection: NavSection;
  setActiveSection: (section: NavSection) => void;
  canAccessSection: (section: NavSection) => boolean;
  login: (identifier: string, password: string, rememberMe: boolean) => { ok: true } | { ok: false; error: string };
  logout: () => void;
  requestPasswordReset: (email: string) => { ok: true; token: string; expiresAt: number } | { ok: false; error: string };
  checkResetToken: (token: string) => { valid: true; email: string } | { valid: false; error: string };
  resetPasswordWithToken: (token: string, newPassword: string) => { ok: true } | { ok: false; error: string };
  addProduct: (input: ProductInput) => { ok: true; product: Product } | { ok: false; error: string };
  updateProduct: (productId: string, input: Omit<ProductInput, 'quantity'>) => { ok: true } | { ok: false; error: string };
  updateProductThreshold: (productId: string, minStockLevel: number) => { ok: true } | { ok: false; error: string };
  deleteProduct: (productId: string) => { ok: true } | { ok: false; error: string };
  addCategory: (name: string, description?: string) => { ok: true; category: Category } | { ok: false; error: string };
  adjustStock: (params: {
    productId: string;
    mode: 'restock' | 'reduction';
    quantity: number;
    note: string;
  }) => { ok: true; product: Product } | { ok: false; error: string };
  completeSale: (payload: {
    idempotencyKey?: string;
    items: Array<{ productId: string; quantity: number }>;
    discountAmount: number;
    amountPaid: number;
    paymentMethod: PaymentMethod;
    customerName?: string;
    customerPhone?: string;
    notes?: string;
  }) => { ok: true; sale: Sale } | { ok: false; error: string };
  addExpense: (input: {
    name: string;
    category: string;
    amount: number;
    date: string;
    notes?: string;
  }) => { ok: true; expense: Expense } | { ok: false; error: string };
  deleteExpense: (expenseId: string) => { ok: true } | { ok: false; error: string };
  createUser: (input: {
    name: string;
    username: string;
    email: string;
    role: UserRole;
    password: string;
  }) => { ok: true; user: User } | { ok: false; error: string };
  updateUser: (
    userId: string,
    updates: { name: string; username: string; email: string; role: UserRole; active: boolean; newPassword?: string },
  ) => { ok: true } | { ok: false; error: string };
  updateSettings: (updates: CompanySettings) => { ok: true } | { ok: false; error: string };
  markAllNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;
  clearSales: (saleIds?: string[]) => { ok: true } | { ok: false; error: string };
  clearReceipts: (saleIds?: string[], deleteSales?: boolean) => { ok: true } | { ok: false; error: string };
  clearAlerts: () => { ok: true } | { ok: false; error: string };
  clearPeriodReport: (startDate: string, endDate: string) => { ok: true } | { ok: false; error: string };
  clearDashboard: (options?: { clearSales?: boolean; clearAlerts?: boolean }) => { ok: true } | { ok: false; error: string };
  clearUsers: (mode: 'remove_others' | 'reset_roles_to_staff') => { ok: true } | { ok: false; error: string };
  removeUser: (userId: string) => { ok: true } | { ok: false; error: string };
  clearInventory: (options?: {
    productIds?: string[];
    mode?: 'remove_products' | 'zero_stock';
    clearHistory?: boolean;
  }) => { ok: true } | { ok: false; error: string };
  importDatabaseJson: (rawJson: string) => { ok: true } | { ok: false; error: string };
  resetToDemoData: () => void;
  toast: { id: string; type: 'success' | 'error' | 'info'; message: string } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ErpContext = createContext<ErpContextValue | null>(null);

const STAFF_ALLOWED_SECTIONS: NavSection[] = [
  'dashboard',
  'inventory',
  'new-sale',
  'sales-history',
  'receipts',
];

export const ErpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<AppDatabase>(() => loadDatabaseFromStorage());
  const [session, setSession] = useState<AuthSession | null>(() => loadSessionFromStorage());
  const [activeSection, setActiveSectionState] = useState<NavSection>('dashboard');
  const [toast, setToast] = useState<ErpContextValue['toast']>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = createId('toast');
    setToast({ id, message, type });
    window.setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 3800);
  }, []);

  const commitDb = useCallback((updater: (prev: AppDatabase) => AppDatabase) => {
    setDb((prev) => {
      const next = updater(prev);
      saveDatabaseToStorage(next);
      return next;
    });
  }, []);

  // Cross-tab localStorage synchronization
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DB_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as AppDatabase;
          if (parsed && Array.isArray(parsed.users)) {
            setDb(parsed);
          }
        } catch {
          // Ignore invalid JSON from external edits
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const currentUser = useMemo(() => {
    if (!session) return null;
    const found = db.users.find((u) => u.id === session.userId && u.active);
    return found ?? null;
  }, [db.users, session]);

  const canAccessSection = useCallback(
    (section: NavSection): boolean => {
      if (!currentUser) return false;
      if (currentUser.role === 'admin') return true;
      return STAFF_ALLOWED_SECTIONS.includes(section);
    },
    [currentUser],
  );

  const setActiveSection = useCallback(
    (section: NavSection) => {
      if (!currentUser) return;
      if (currentUser.role !== 'admin' && !STAFF_ALLOWED_SECTIONS.includes(section)) {
        showToast('Access restricted. Administrator privileges are required for this page.', 'error');
        return;
      }
      setActiveSectionState(section);
    },
    [currentUser, showToast],
  );

  const login = useCallback(
    (identifier: string, password: string, rememberMe: boolean) => {
      const needle = identifier.trim().toLowerCase();
      if (!needle || !password) {
        return { ok: false as const, error: 'Enter both email/username and password.' };
      }
      const user = db.users.find(
        (u) => u.email.toLowerCase() === needle || u.username.toLowerCase() === needle,
      );
      if (!user) {
        return { ok: false as const, error: 'Invalid credentials. Account not found.' };
      }
      if (!user.active) {
        return { ok: false as const, error: 'This account has been deactivated. Contact an administrator.' };
      }
      if (!verifyPassword(password, user.passwordHash)) {
        return { ok: false as const, error: 'Incorrect password. Please try again.' };
      }

      const newSession: AuthSession = {
        userId: user.id,
        rememberMe,
        loggedInAt: new Date().toISOString(),
      };
      setSession(newSession);
      saveSessionToStorage(newSession);
      setActiveSectionState('dashboard');
      commitDb((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === user.id ? { ...u, lastLoginAt: new Date().toISOString() } : u,
        ),
      }));
      return { ok: true as const };
    },
    [commitDb, db.users],
  );

  const logout = useCallback(() => {
    setSession(null);
    saveSessionToStorage(null);
    setActiveSectionState('dashboard');
  }, []);

  const requestPasswordReset = useCallback(
    (email: string) => {
      const res = createPasswordResetToken(db, email);
      if (!res.ok) return { ok: false as const, error: res.error };
      commitDb(() => res.db);
      return {
        ok: true as const,
        token: res.resetToken.token,
        expiresAt: res.resetToken.expiresAt,
      };
    },
    [commitDb, db],
  );

  const checkResetToken = useCallback(
    (token: string) => {
      const res = validateResetToken(db, token);
      if (!res.valid) return { valid: false as const, error: res.error };
      return { valid: true as const, email: res.resetToken.email };
    },
    [db],
  );

  const resetPasswordWithToken = useCallback(
    (token: string, newPassword: string) => {
      const res = completePasswordReset(db, token, newPassword);
      if (!res.ok) return { ok: false as const, error: res.error };
      commitDb(() => res.db);
      return { ok: true as const };
    },
    [commitDb, db],
  );

  const addProduct = useCallback(
    (input: ProductInput) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can add products.' };
      }
      const sku = input.sku.trim().toUpperCase();
      const name = input.name.trim();
      if (!sku || !name) {
        return { ok: false as const, error: 'Product name and SKU are required.' };
      }
      if (db.products.some((p) => p.sku.toUpperCase() === sku)) {
        return { ok: false as const, error: `SKU "${sku}" already exists.` };
      }
      if (input.costPrice < 0 || input.sellingPrice <= 0) {
        return { ok: false as const, error: 'Selling price must be greater than zero and cost price cannot be negative.' };
      }
      if (!Number.isInteger(input.quantity) || input.quantity < 0) {
        return { ok: false as const, error: 'Initial stock quantity must be 0 or a positive whole number.' };
      }
      const category = db.categories.find((c) => c.id === input.categoryId);
      if (!category) {
        return { ok: false as const, error: 'Please select a valid category.' };
      }

      const isoNow = new Date().toISOString();
      const product: Product = {
        id: createId('prod'),
        sku,
        name,
        categoryId: category.id,
        categoryName: category.name,
        description: input.description?.trim() || undefined,
        costPrice: roundCurrency(input.costPrice),
        sellingPrice: roundCurrency(input.sellingPrice),
        quantity: input.quantity,
        minStockLevel: Math.max(0, Math.floor(input.minStockLevel)),
        supplier: input.supplier?.trim() || undefined,
        imageUrl: input.imageUrl?.trim() || undefined,
        dateAdded: isoNow,
        updatedAt: isoNow,
      };

      const nextProducts = [product, ...db.products];
      const addedNotif = {
        id: createId('notif'),
        type: 'stock_update' as const,
        title: 'Product Added',
        message: `${product.name} (${product.sku}) added with ${product.quantity} units.`,
        createdAt: isoNow,
        read: false,
        targetRole: 'admin' as const,
        targetSection: 'inventory' as const,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
      };
      const synced = syncThresholdNotifications(
        nextProducts,
        [addedNotif, ...db.notifications],
        db.settings.defaultLowStockThreshold,
        isoNow,
        'initial stock check',
      );

      commitDb((prev) => ({
        ...prev,
        products: [product, ...prev.products],
        inventoryTransactions:
          product.quantity > 0
            ? [
                {
                  id: createId('invtx'),
                  productId: product.id,
                  productName: product.name,
                  sku: product.sku,
                  type: 'initial',
                  quantityChange: product.quantity,
                  previousQty: 0,
                  newQty: product.quantity,
                  note: 'Initial product opening stock',
                  userId: currentUser.id,
                  userName: currentUser.name,
                  createdAt: isoNow,
                },
                ...prev.inventoryTransactions,
              ]
            : prev.inventoryTransactions,
        notifications: synced.notifications,
      }));

      if (synced.triggeredAlerts.length > 0) {
        const alert = synced.triggeredAlerts[0];
        showToast(`Admin Alert: ${alert.message}`, alert.type === 'out_of_stock' ? 'error' : 'info');
      } else {
        showToast(`${product.name} added to inventory.`);
      }
      return { ok: true as const, product };
    },
    [commitDb, currentUser, db.categories, db.notifications, db.products, db.settings.defaultLowStockThreshold, showToast],
  );

  const updateProduct = useCallback(
    (productId: string, input: Omit<ProductInput, 'quantity'>) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can edit products.' };
      }
      const sku = input.sku.trim().toUpperCase();
      const name = input.name.trim();
      if (!sku || !name) {
        return { ok: false as const, error: 'Product name and SKU are required.' };
      }
      if (db.products.some((p) => p.id !== productId && p.sku.toUpperCase() === sku)) {
        return { ok: false as const, error: `SKU "${sku}" is already used by another product.` };
      }
      const category = db.categories.find((c) => c.id === input.categoryId);
      if (!category) {
        return { ok: false as const, error: 'Select a valid category.' };
      }

      const isoNow = new Date().toISOString();
      const nextProducts = db.products.map((p) =>
        p.id === productId
          ? {
              ...p,
              sku,
              name,
              categoryId: category.id,
              categoryName: category.name,
              description: input.description?.trim() || undefined,
              costPrice: roundCurrency(input.costPrice),
              sellingPrice: roundCurrency(input.sellingPrice),
              minStockLevel: Math.max(0, Math.floor(input.minStockLevel)),
              supplier: input.supplier?.trim() || undefined,
              imageUrl: input.imageUrl?.trim() || undefined,
              updatedAt: isoNow,
            }
          : p,
      );
      const synced = syncThresholdNotifications(
        nextProducts,
        db.notifications,
        db.settings.defaultLowStockThreshold,
        isoNow,
        'threshold updated',
      );

      commitDb((prev) => ({
        ...prev,
        products: nextProducts,
        notifications: synced.notifications,
      }));

      if (synced.triggeredAlerts.length > 0) {
        const alert = synced.triggeredAlerts[0];
        showToast(`Admin Alert: ${alert.message}`, alert.type === 'out_of_stock' ? 'error' : 'info');
      } else {
        showToast(`${name} updated successfully.`);
      }
      return { ok: true as const };
    },
    [commitDb, currentUser, db.categories, db.notifications, db.products, db.settings.defaultLowStockThreshold, showToast],
  );

  const updateProductThreshold = useCallback(
    (productId: string, minStockLevel: number) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can change alert thresholds.' };
      }
      if (!Number.isInteger(minStockLevel) || minStockLevel < 0) {
        return { ok: false as const, error: 'Threshold must be 0 or a positive whole number.' };
      }
      const target = db.products.find((p) => p.id === productId);
      if (!target) {
        return { ok: false as const, error: 'Product not found.' };
      }

      const isoNow = new Date().toISOString();
      const nextProducts = db.products.map((p) =>
        p.id === productId ? { ...p, minStockLevel, updatedAt: isoNow } : p,
      );
      const synced = syncThresholdNotifications(
        nextProducts,
        db.notifications,
        db.settings.defaultLowStockThreshold,
        isoNow,
        'threshold updated',
      );

      commitDb((prev) => ({
        ...prev,
        products: nextProducts,
        notifications: synced.notifications,
      }));

      if (synced.triggeredAlerts.length > 0) {
        showToast(`Alert triggered: ${synced.triggeredAlerts[0].message}`, 'info');
      } else {
        showToast(`Threshold for ${target.name} updated to ${minStockLevel} units.`);
      }
      return { ok: true as const };
    },
    [commitDb, currentUser, db.notifications, db.products, db.settings.defaultLowStockThreshold, showToast],
  );

  const deleteProduct = useCallback(
    (productId: string) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can delete products.' };
      }
      const target = db.products.find((p) => p.id === productId);
      if (!target) {
        return { ok: false as const, error: 'Product not found.' };
      }
      const nextProducts = db.products.filter((p) => p.id !== productId);
      const synced = syncThresholdNotifications(
        nextProducts,
        db.notifications,
        db.settings.defaultLowStockThreshold,
      );
      commitDb((prev) => ({
        ...prev,
        products: nextProducts,
        notifications: synced.notifications,
      }));
      showToast(`${target.name} removed from inventory.`);
      return { ok: true as const };
    },
    [commitDb, currentUser, db.notifications, db.products, db.settings.defaultLowStockThreshold, showToast],
  );

  const addCategory = useCallback(
    (nameInput: string, description?: string) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can create categories.' };
      }
      const name = nameInput.trim();
      if (!name) return { ok: false as const, error: 'Category name is required.' };
      if (db.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        return { ok: false as const, error: 'Category already exists.' };
      }
      const category: Category = {
        id: createId('cat'),
        name,
        description: description?.trim() || undefined,
      };
      commitDb((prev) => ({ ...prev, categories: [...prev.categories, category] }));
      showToast(`Category "${name}" created.`);
      return { ok: true as const, category };
    },
    [commitDb, currentUser, db.categories, showToast],
  );

  const adjustStock = useCallback(
    (params: { productId: string; mode: 'restock' | 'reduction'; quantity: number; note: string }) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can adjust stock levels.' };
      }
      const res = adjustProductStock(db, params, currentUser);
      if (!res.ok) return { ok: false as const, error: res.error };
      commitDb(() => res.db);
      if (res.triggeredAlerts.length > 0) {
        const critical = res.triggeredAlerts.find((a) => a.type === 'out_of_stock') ?? res.triggeredAlerts[0];
        showToast(
          `Admin Alert: ${critical.message}`,
          critical.type === 'out_of_stock' ? 'error' : 'info',
        );
      } else {
        showToast(
          `${res.product.name} stock updated to ${res.product.quantity} units.`,
        );
      }
      return { ok: true as const, product: res.product };
    },
    [commitDb, currentUser, db, showToast],
  );

  const completeSale = useCallback(
    (payload: {
      idempotencyKey?: string;
      items: Array<{ productId: string; quantity: number }>;
      discountAmount: number;
      amountPaid: number;
      paymentMethod: PaymentMethod;
      customerName?: string;
      customerPhone?: string;
      notes?: string;
    }) => {
      if (!currentUser) {
        return { ok: false as const, error: 'You must be logged in to record sales.' };
      }
      const res = executeSaleTransaction(db, payload, currentUser);
      if (!res.ok) {
        return { ok: false as const, error: res.error };
      }
      commitDb(() => res.db);
      if (currentUser.role === 'admin' && res.triggeredAlerts.length > 0) {
        const critical = res.triggeredAlerts.find((a) => a.type === 'out_of_stock') ?? res.triggeredAlerts[0];
        showToast(
          `Sale ${res.sale.receiptNumber} saved · Admin Alert: ${critical.message}`,
          critical.type === 'out_of_stock' ? 'error' : 'info',
        );
      } else {
        showToast(`Sale ${res.sale.receiptNumber} completed.`);
      }
      return { ok: true as const, sale: res.sale };
    },
    [commitDb, currentUser, db, showToast],
  );

  const addExpense = useCallback(
    (input: { name: string; category: string; amount: number; date: string; notes?: string }) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can record expenses.' };
      }
      if (!input.name.trim() || !input.category.trim()) {
        return { ok: false as const, error: 'Expense name and category are required.' };
      }
      if (!Number.isFinite(input.amount) || input.amount <= 0) {
        return { ok: false as const, error: 'Expense amount must be greater than zero.' };
      }
      const expense: Expense = {
        id: createId('exp'),
        name: input.name.trim(),
        category: input.category.trim(),
        amount: roundCurrency(input.amount),
        date: input.date || new Date().toISOString().slice(0, 10),
        notes: input.notes?.trim() || undefined,
        recordedById: currentUser.id,
        recordedByName: currentUser.name,
        createdAt: new Date().toISOString(),
      };
      commitDb((prev) => ({
        ...prev,
        expenses: [expense, ...prev.expenses],
      }));
      showToast(`Expense "${expense.name}" recorded.`);
      return { ok: true as const, expense };
    },
    [commitDb, currentUser, showToast],
  );

  const deleteExpense = useCallback(
    (expenseId: string) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can delete expenses.' };
      }
      commitDb((prev) => ({
        ...prev,
        expenses: prev.expenses.filter((e) => e.id !== expenseId),
      }));
      showToast('Expense removed.');
      return { ok: true as const };
    },
    [commitDb, currentUser, showToast],
  );

  const createUser = useCallback(
    (input: { name: string; username: string; email: string; role: UserRole; password: string }) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can create users.' };
      }
      const name = input.name.trim();
      const username = input.username.trim().toLowerCase();
      const email = input.email.trim().toLowerCase();
      if (!name || !username || !email) {
        return { ok: false as const, error: 'Name, username, and email are required.' };
      }
      if (input.password.length < 6) {
        return { ok: false as const, error: 'Password must be at least 6 characters.' };
      }
      if (db.users.some((u) => u.email.toLowerCase() === email || u.username.toLowerCase() === username)) {
        return { ok: false as const, error: 'A user with that email or username already exists.' };
      }
      const user: User = {
        id: createId('usr'),
        name,
        username,
        email,
        role: input.role,
        passwordHash: hashPassword(input.password),
        active: true,
        createdAt: new Date().toISOString(),
      };
      commitDb((prev) => ({ ...prev, users: [...prev.users, user] }));
      showToast(`User account "${user.name}" created.`);
      return { ok: true as const, user };
    },
    [commitDb, currentUser, db.users, showToast],
  );

  const updateUser = useCallback(
    (
      userId: string,
      updates: { name: string; username: string; email: string; role: UserRole; active: boolean; newPassword?: string },
    ) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can manage users.' };
      }
      if (userId === currentUser.id && !updates.active) {
        return { ok: false as const, error: 'You cannot deactivate your own currently signed-in account.' };
      }
      if (userId === currentUser.id && updates.role !== 'admin') {
        return { ok: false as const, error: 'You cannot remove your own administrator role.' };
      }
      if (updates.newPassword && updates.newPassword.length < 6) {
        return { ok: false as const, error: 'New password must be at least 6 characters.' };
      }
      const email = updates.email.trim().toLowerCase();
      const username = updates.username.trim().toLowerCase();
      if (
        db.users.some(
          (u) =>
            u.id !== userId &&
            (u.email.toLowerCase() === email || u.username.toLowerCase() === username),
        )
      ) {
        return { ok: false as const, error: 'Another user already uses that email or username.' };
      }

      commitDb((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === userId
            ? {
                ...u,
                name: updates.name.trim(),
                username,
                email,
                role: updates.role,
                active: updates.active,
                passwordHash: updates.newPassword ? hashPassword(updates.newPassword) : u.passwordHash,
              }
            : u,
        ),
      }));
      showToast('User account updated.');
      return { ok: true as const };
    },
    [commitDb, currentUser, db.users, showToast],
  );

  const updateSettings = useCallback(
    (updates: CompanySettings) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can update company settings.' };
      }
      if (!updates.companyName.trim()) {
        return { ok: false as const, error: 'Company name cannot be empty.' };
      }
      const freshThreshold = Math.max(1, Math.floor(updates.defaultLowStockThreshold || 10));
      commitDb((prev) => {
        const synced = syncThresholdNotifications(
          prev.products,
          prev.notifications,
          freshThreshold,
        );
        return {
          ...prev,
          notifications: synced.notifications,
          settings: {
            ...updates,
            companyName: updates.companyName.trim(),
            currency: updates.currency.trim() || 'GHS',
            defaultLowStockThreshold: freshThreshold,
          },
        };
      });
      showToast('Company settings saved.');
      return { ok: true as const };
    },
    [commitDb, currentUser, showToast],
  );

  const markAllNotificationsRead = useCallback(() => {
    commitDb((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }));
  }, [commitDb]);

  const markNotificationRead = useCallback(
    (id: string) => {
      commitDb((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      }));
    },
    [commitDb],
  );

  const clearSales = useCallback(
    (saleIds?: string[]) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can clear sales records.' };
      }
      commitDb((prev) => clearSalesRecords(prev, saleIds));
      showToast(
        saleIds ? `${saleIds.length} sale record(s) cleared.` : 'All sales records cleared.',
        'info',
      );
      return { ok: true as const };
    },
    [commitDb, currentUser, showToast],
  );

  const clearReceipts = useCallback(
    (saleIds?: string[], deleteSales = false) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can clear receipts.' };
      }
      commitDb((prev) => clearReceiptRecords(prev, saleIds, deleteSales));
      showToast(
        deleteSales
          ? 'Receipts and underlying sales records cleared.'
          : 'Receipts archive cleared.',
        'info',
      );
      return { ok: true as const };
    },
    [commitDb, currentUser, showToast],
  );

  const clearAlerts = useCallback(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      return { ok: false as const, error: 'Only administrators can clear alerts.' };
    }
    commitDb((prev) => clearAlertNotifications(prev));
    showToast('All alerts and alert history cleared.', 'info');
    return { ok: true as const };
  }, [commitDb, currentUser, showToast]);

  const clearPeriodReport = useCallback(
    (startDate: string, endDate: string) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can clear report data.' };
      }
      commitDb((prev) => clearPeriodReportSales(prev, startDate, endDate));
      showToast(`Sales report cleared for ${startDate} to ${endDate}.`, 'info');
      return { ok: true as const };
    },
    [commitDb, currentUser, showToast],
  );

  const clearDashboard = useCallback(
    (options: { clearSales?: boolean; clearAlerts?: boolean } = {}) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can clear dashboard data.' };
      }
      commitDb((prev) => clearDashboardData(prev, options));
      showToast('Dashboard metrics and selected activity cleared.', 'info');
      return { ok: true as const };
    },
    [commitDb, currentUser, showToast],
  );

  const clearUsers = useCallback(
    (mode: 'remove_others' | 'reset_roles_to_staff') => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can clear user accounts and roles.' };
      }
      const res = clearUsersAndRoles(db, currentUser.id, mode);
      if (!res.ok) return { ok: false as const, error: res.error };
      commitDb(() => res.db);
      showToast(
        mode === 'remove_others'
          ? 'Other user accounts and reset tokens cleared.'
          : 'Other user roles reset to Sales Staff and reset tokens cleared.',
        'info',
      );
      return { ok: true as const };
    },
    [commitDb, currentUser, db, showToast],
  );

  const removeUser = useCallback(
    (userId: string) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can clear user accounts.' };
      }
      const res = removeUserAccount(db, userId, currentUser.id);
      if (!res.ok) return { ok: false as const, error: res.error };
      commitDb(() => res.db);
      showToast(`User account "${res.removedUser.name}" cleared.`, 'info');
      return { ok: true as const };
    },
    [commitDb, currentUser, db, showToast],
  );

  const clearInventory = useCallback(
    (
      options: {
        productIds?: string[];
        mode?: 'remove_products' | 'zero_stock';
        clearHistory?: boolean;
      } = {},
    ) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can clear inventory.' };
      }
      commitDb((prev) => clearInventoryRecords(prev, { ...options, actor: currentUser }));
      showToast(
        options.mode === 'zero_stock'
          ? 'Selected inventory stock quantities cleared to 0.'
          : options.productIds
            ? `${options.productIds.length} product(s) cleared from inventory.`
            : 'All inventory products cleared.',
        'info',
      );
      return { ok: true as const };
    },
    [commitDb, currentUser, showToast],
  );

  const importDatabaseJson = useCallback(
    (rawJson: string) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return { ok: false as const, error: 'Only administrators can restore backups.' };
      }
      try {
        const parsed = JSON.parse(rawJson) as AppDatabase;
        if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.products) || !Array.isArray(parsed.sales)) {
          return { ok: false as const, error: 'Invalid backup file structure.' };
        }
        const synced = syncThresholdNotifications(
          parsed.products,
          Array.isArray(parsed.notifications) ? parsed.notifications : [],
          parsed.settings?.defaultLowStockThreshold ?? 10,
        );
        commitDb(() => ({ ...parsed, notifications: synced.notifications }));
        showToast('Backup restored successfully.');
        return { ok: true as const };
      } catch {
        return { ok: false as const, error: 'Could not parse JSON backup file.' };
      }
    },
    [commitDb, currentUser, showToast],
  );

  const resetToDemoData = useCallback(() => {
    if (!currentUser || currentUser.role !== 'admin') return;
    const fresh = createInitialSeedDatabase();
    const synced = syncThresholdNotifications(
      fresh.products,
      fresh.notifications,
      fresh.settings.defaultLowStockThreshold,
    );
    commitDb(() => ({ ...fresh, notifications: synced.notifications }));
    showToast('Database reset to initial sample business records.', 'info');
  }, [commitDb, currentUser, showToast]);

  const value: ErpContextValue = {
    db,
    currentUser,
    activeSection,
    setActiveSection,
    canAccessSection,
    login,
    logout,
    requestPasswordReset,
    checkResetToken,
    resetPasswordWithToken,
    addProduct,
    updateProduct,
    updateProductThreshold,
    deleteProduct,
    addCategory,
    adjustStock,
    completeSale,
    addExpense,
    deleteExpense,
    createUser,
    updateUser,
    updateSettings,
    markAllNotificationsRead,
    markNotificationRead,
    clearSales,
    clearReceipts,
    clearAlerts,
    clearPeriodReport,
    clearDashboard,
    clearUsers,
    removeUser,
    clearInventory,
    importDatabaseJson,
    resetToDemoData,
    toast,
    showToast,
  };

  return <ErpContext.Provider value={value}>{children}</ErpContext.Provider>;
};

export function useErp(): ErpContextValue {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error('useErp must be used inside ErpProvider');
  return ctx;
}
