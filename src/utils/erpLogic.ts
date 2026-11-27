import type {
  AppDatabase,
  InventoryTransaction,
  NotificationItem,
  PasswordResetToken,
  PaymentMethod,
  Product,
  Sale,
  SaleItem,
  User,
} from '../types/erp';

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: number, currency = 'GHS'): string {
  const safe = Number.isFinite(amount) ? roundCurrency(amount) : 0;
  return `${currency} ${safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function hashPassword(password: string): string {
  // Deterministic salted hash suitable for synchronous client-side and Node verification
  const salted = `tahasco_salt_v1:${password}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < salted.length; i += 1) {
    const ch = salted.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const partA = (h2 >>> 0).toString(16).padStart(8, '0');
  const partB = (h1 >>> 0).toString(16).padStart(8, '0');
  return `tsc1$${partA}${partB}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  return hashPassword(password) === storedHash;
}

export function createId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function toLocalDateKey(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function generateReceiptNumber(existingSales: Sale[], date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const prefix = `TSC-${y}${m}${d}-`;
  let maxSeq = 0;
  for (const sale of existingSales) {
    if (sale.receiptNumber.startsWith(prefix)) {
      const seq = Number.parseInt(sale.receiptNumber.slice(prefix.length), 10);
      if (Number.isFinite(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
}

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface SaleValidationResult {
  valid: boolean;
  errors: string[];
  resolvedItems: SaleItem[];
}

export function validateSaleItems(
  items: CartItemInput[],
  products: Product[],
): SaleValidationResult {
  const errors: string[] = [];
  if (items.length === 0) {
    return { valid: false, errors: ['Add at least one product to complete a sale.'], resolvedItems: [] };
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  const aggregatedQty = new Map<string, number>();

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      errors.push('Item quantity must be a whole number greater than zero.');
      continue;
    }
    aggregatedQty.set(item.productId, (aggregatedQty.get(item.productId) ?? 0) + item.quantity);
  }

  const resolvedItems: SaleItem[] = [];
  for (const [productId, totalQty] of aggregatedQty.entries()) {
    const product = productMap.get(productId);
    if (!product) {
      errors.push('One or more selected products no longer exist in inventory.');
      continue;
    }
    if (product.quantity <= 0) {
      errors.push(`${product.name} (${product.sku}) is out of stock.`);
      continue;
    }
    if (totalQty > product.quantity) {
      errors.push(
        `Insufficient stock for ${product.name}: requested ${totalQty}, only ${product.quantity} available.`,
      );
      continue;
    }
    resolvedItems.push({
      id: createId('sitem'),
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: totalQty,
      unitPrice: roundCurrency(product.sellingPrice),
      costPrice: roundCurrency(product.costPrice),
      lineTotal: roundCurrency(product.sellingPrice * totalQty),
    });
  }

  return {
    valid: errors.length === 0 && resolvedItems.length > 0,
    errors,
    resolvedItems,
  };
}

export function calculateSaleTotals(
  items: Pick<SaleItem, 'lineTotal'>[],
  rawDiscountAmount: number,
  rawAmountPaid: number,
): {
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  changeGiven: number;
  balanceDue: number;
} {
  const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const discountAmount = roundCurrency(Math.min(Math.max(0, rawDiscountAmount || 0), subtotal));
  const totalAmount = roundCurrency(Math.max(0, subtotal - discountAmount));
  const amountPaid = roundCurrency(Math.max(0, rawAmountPaid || 0));
  const diff = roundCurrency(amountPaid - totalAmount);
  const changeGiven = diff > 0 ? diff : 0;
  const balanceDue = diff < 0 ? Math.abs(diff) : 0;

  return {
    subtotal,
    discountAmount,
    totalAmount,
    amountPaid,
    changeGiven,
    balanceDue,
  };
}

export interface ExecuteSalePayload {
  idempotencyKey?: string;
  items: CartItemInput[];
  discountAmount: number;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  createdAt?: string;
}

export function syncThresholdNotifications(
  products: Product[],
  existingNotifications: NotificationItem[],
  defaultThreshold: number,
  nowIso = new Date().toISOString(),
  reason?: string,
): { notifications: NotificationItem[]; triggeredAlerts: NotificationItem[] } {
  const productById = new Map(products.map((p) => [p.id, p]));
  const working = existingNotifications.map((n) => ({ ...n }));
  const triggeredAlerts: NotificationItem[] = [];

  // Map existing unresolved threshold alerts by productId
  const activeAlertIndexByProduct = new Map<string, number>();
  for (let i = 0; i < working.length; i += 1) {
    const n = working[i];
    if ((n.type === 'low_stock' || n.type === 'out_of_stock') && !n.resolvedAt) {
      let pid = n.productId;
      if (!pid) {
        const matched = products.find((p) => n.message.includes(p.sku));
        if (matched) pid = matched.id;
      }
      if (pid && !activeAlertIndexByProduct.has(pid)) {
        activeAlertIndexByProduct.set(pid, i);
      }
    }
  }

  const newlyCreatedAlerts: NotificationItem[] = [];

  for (const product of products) {
    const threshold =
      Number.isFinite(product.minStockLevel) && product.minStockLevel >= 0
        ? product.minStockLevel
        : Math.max(0, defaultThreshold);
    const isOut = product.quantity === 0;
    const isLow = product.quantity > 0 && threshold > 0 && product.quantity <= threshold;
    const existingIdx = activeAlertIndexByProduct.get(product.id);

    if (isOut || isLow) {
      const nextType = isOut ? 'out_of_stock' : 'low_stock';
      const nextTitle = isOut ? 'Out of Stock Alert' : 'Low Stock Alert';
      const suffix = reason ? ` (${reason})` : '';
      const nextMessage = isOut
        ? `${product.name} (${product.sku}) is out of stock — 0 units left (threshold ${threshold})${suffix}.`
        : `${product.name} (${product.sku}) dropped to ${product.quantity} units (threshold ${threshold})${suffix}.`;

      if (existingIdx !== undefined) {
        const prev = working[existingIdx];
        const qtyChanged = prev.currentQty !== product.quantity;
        const severityChanged = prev.type !== nextType;
        const thresholdChanged = prev.threshold !== threshold;
        const shouldReactivate =
          !prev.clearedAt ||
          severityChanged ||
          product.quantity < (prev.currentQty ?? Infinity) ||
          threshold > (prev.threshold ?? 0);

        if (prev.clearedAt && !shouldReactivate) {
          working[existingIdx] = {
            ...prev,
            currentQty: product.quantity,
            threshold,
            read: true,
          };
        } else {
          const updatedAlert: NotificationItem = {
            ...prev,
            type: nextType,
            title: nextTitle,
            message: qtyChanged || severityChanged || thresholdChanged || prev.clearedAt ? nextMessage : prev.message,
            targetRole: 'admin',
            targetSection: 'alerts',
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            currentQty: product.quantity,
            threshold,
            clearedAt: undefined,
            ...(qtyChanged || severityChanged || thresholdChanged || prev.clearedAt
              ? { read: false, createdAt: nowIso }
              : {}),
          };
          working[existingIdx] = updatedAlert;

          if (
            prev.clearedAt ||
            severityChanged ||
            (qtyChanged && product.quantity < (prev.currentQty ?? Infinity)) ||
            thresholdChanged
          ) {
            triggeredAlerts.push(updatedAlert);
          }
        }
      } else {
        const created: NotificationItem = {
          id: createId('notif'),
          type: nextType,
          title: nextTitle,
          message: nextMessage,
          createdAt: nowIso,
          read: false,
          targetRole: 'admin',
          targetSection: 'alerts',
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          currentQty: product.quantity,
          threshold,
        };
        newlyCreatedAlerts.push(created);
        triggeredAlerts.push(created);
      }
    } else if (existingIdx !== undefined) {
      // Product is now above threshold: auto-resolve (or remove cleared marker)
      const prev = working[existingIdx];
      working[existingIdx] = {
        ...prev,
        currentQty: product.quantity,
        threshold,
        read: true,
        resolvedAt: nowIso,
        clearedAt: prev.clearedAt,
      };
    }
  }

  // Also resolve any orphan unresolved threshold alerts whose products were deleted
  for (let i = 0; i < working.length; i += 1) {
    const n = working[i];
    if ((n.type === 'low_stock' || n.type === 'out_of_stock') && !n.resolvedAt && n.productId && !productById.has(n.productId)) {
      working[i] = { ...n, read: true, resolvedAt: nowIso };
    }
  }

  const combined = [...newlyCreatedAlerts, ...working];
  const activeAlerts = combined.filter(
    (n) => (n.type === 'low_stock' || n.type === 'out_of_stock') && !n.resolvedAt,
  );
  const otherOrResolved = combined
    .filter((n) => !((n.type === 'low_stock' || n.type === 'out_of_stock') && !n.resolvedAt))
    .slice(0, 80);

  return {
    notifications: [...activeAlerts, ...otherOrResolved].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
    triggeredAlerts,
  };
}

export function executeSaleTransaction(
  db: AppDatabase,
  payload: ExecuteSalePayload,
  cashier: User,
): { ok: true; db: AppDatabase; sale: Sale; triggeredAlerts: NotificationItem[] } | { ok: false; error: string } {
  if (
    payload.idempotencyKey &&
    db.sales.some((s) => s.idempotencyKey === payload.idempotencyKey)
  ) {
    return { ok: false, error: 'Duplicate transaction detected. This sale was already recorded.' };
  }

  const validation = validateSaleItems(payload.items, db.products);
  if (!validation.valid) {
    return { ok: false, error: validation.errors.join(' ') };
  }

  if (payload.discountAmount < 0) {
    return { ok: false, error: 'Discount cannot be negative.' };
  }

  const totals = calculateSaleTotals(
    validation.resolvedItems,
    payload.discountAmount,
    payload.amountPaid,
  );

  if (totals.amountPaid < totals.totalAmount) {
    return {
      ok: false,
      error: `Amount paid (${formatCurrency(totals.amountPaid, db.settings.currency)}) is less than total due (${formatCurrency(totals.totalAmount, db.settings.currency)}).`,
    };
  }

  const now = payload.createdAt ? new Date(payload.createdAt) : new Date();
  const isoNow = now.toISOString();
  const receiptNumber = generateReceiptNumber(db.sales, now);
  const saleId = createId('sale');

  const sale: Sale = {
    id: saleId,
    idempotencyKey: payload.idempotencyKey,
    receiptNumber,
    cashierId: cashier.id,
    cashierName: cashier.name,
    customerName: payload.customerName?.trim() || undefined,
    customerPhone: payload.customerPhone?.trim() || undefined,
    items: validation.resolvedItems,
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    totalAmount: totals.totalAmount,
    amountPaid: totals.amountPaid,
    changeGiven: totals.changeGiven,
    balanceDue: totals.balanceDue,
    paymentMethod: payload.paymentMethod,
    notes: payload.notes?.trim() || undefined,
    createdAt: isoNow,
  };

  const qtyDeductions = new Map(validation.resolvedItems.map((i) => [i.productId, i.quantity]));
  const newTransactions: InventoryTransaction[] = [];
  const saleNotification: NotificationItem = {
    id: createId('notif'),
    type: 'sale',
    title: 'Sale Completed',
    message: `Receipt ${receiptNumber} · ${formatCurrency(totals.totalAmount, db.settings.currency)} (${payload.paymentMethod})`,
    createdAt: isoNow,
    read: false,
    targetSection: 'sales-history',
  };

  const updatedProducts = db.products.map((product) => {
    const deducted = qtyDeductions.get(product.id);
    if (!deducted) return product;

    const previousQty = product.quantity;
    const newQty = previousQty - deducted;
    newTransactions.push({
      id: createId('invtx'),
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      type: 'sale',
      quantityChange: -deducted,
      previousQty,
      newQty,
      note: `Sale ${receiptNumber}`,
      userId: cashier.id,
      userName: cashier.name,
      referenceId: saleId,
      createdAt: isoNow,
    });

    return {
      ...product,
      quantity: newQty,
      updatedAt: isoNow,
    };
  });

  const synced = syncThresholdNotifications(
    updatedProducts,
    [saleNotification, ...db.notifications],
    db.settings.defaultLowStockThreshold,
    isoNow,
    `after sale ${receiptNumber}`,
  );

  return {
    ok: true,
    sale,
    triggeredAlerts: synced.triggeredAlerts,
    db: {
      ...db,
      products: updatedProducts,
      sales: [sale, ...db.sales],
      inventoryTransactions: [...newTransactions, ...db.inventoryTransactions],
      notifications: synced.notifications,
    },
  };
}

export function adjustProductStock(
  db: AppDatabase,
  params: {
    productId: string;
    mode: 'restock' | 'reduction';
    quantity: number;
    note: string;
  },
  actor: User,
): { ok: true; db: AppDatabase; product: Product; triggeredAlerts: NotificationItem[] } | { ok: false; error: string } {
  if (!Number.isInteger(params.quantity) || params.quantity <= 0) {
    return { ok: false, error: 'Adjustment quantity must be a whole number greater than zero.' };
  }

  const target = db.products.find((p) => p.id === params.productId);
  if (!target) {
    return { ok: false, error: 'Selected product was not found.' };
  }

  const delta = params.mode === 'restock' ? params.quantity : -params.quantity;
  const newQty = target.quantity + delta;
  if (newQty < 0) {
    return {
      ok: false,
      error: `Cannot reduce stock by ${params.quantity}. Only ${target.quantity} units available.`,
    };
  }

  const isoNow = new Date().toISOString();
  const updatedProduct: Product = {
    ...target,
    quantity: newQty,
    updatedAt: isoNow,
  };

  const tx: InventoryTransaction = {
    id: createId('invtx'),
    productId: target.id,
    productName: target.name,
    sku: target.sku,
    type: params.mode,
    quantityChange: delta,
    previousQty: target.quantity,
    newQty,
    note:
      params.note.trim() ||
      (params.mode === 'restock' ? 'Manual stock restock' : 'Manual stock reduction'),
    userId: actor.id,
    userName: actor.name,
    createdAt: isoNow,
  };

  const updatedProducts = db.products.map((p) => (p.id === target.id ? updatedProduct : p));
  const stockUpdateNotif: NotificationItem = {
    id: createId('notif'),
    type: 'stock_update',
    title: params.mode === 'restock' ? 'Stock Restocked' : 'Stock Reduced',
    message: `${target.name}: ${target.quantity} -> ${newQty} units (${delta > 0 ? `+${delta}` : delta}).`,
    createdAt: isoNow,
    read: false,
    targetRole: 'admin',
    targetSection: 'inventory',
    productId: target.id,
    productName: target.name,
    sku: target.sku,
  };

  const synced = syncThresholdNotifications(
    updatedProducts,
    [stockUpdateNotif, ...db.notifications],
    db.settings.defaultLowStockThreshold,
    isoNow,
    params.mode === 'restock' ? 'after restock' : 'after stock reduction',
  );

  return {
    ok: true,
    product: updatedProduct,
    triggeredAlerts: synced.triggeredAlerts,
    db: {
      ...db,
      products: updatedProducts,
      inventoryTransactions: [tx, ...db.inventoryTransactions],
      notifications: synced.notifications,
    },
  };
}

export function createPasswordResetToken(
  db: AppDatabase,
  emailInput: string,
  nowMs = Date.now(),
):
  | { ok: true; db: AppDatabase; resetToken: PasswordResetToken; user: User }
  | { ok: false; error: string } {
  const normalized = emailInput.trim().toLowerCase();
  if (!normalized) {
    return { ok: false, error: 'Please enter your registered email address.' };
  }
  const user = db.users.find((u) => u.email.toLowerCase() === normalized && u.active);
  if (!user) {
    return { ok: false, error: 'No active account found with that email address.' };
  }

  const token = `RST-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${nowMs.toString(36).toUpperCase()}`;
  const resetToken: PasswordResetToken = {
    token,
    userId: user.id,
    email: user.email,
    createdAt: nowMs,
    expiresAt: nowMs + 30 * 60 * 1000, // 30 minutes
  };

  // Invalidate any previous unused tokens for this user
  const filteredTokens = db.passwordResetTokens.filter((t) => t.userId !== user.id || t.usedAt);

  return {
    ok: true,
    user,
    resetToken,
    db: {
      ...db,
      passwordResetTokens: [resetToken, ...filteredTokens],
    },
  };
}

export function validateResetToken(
  db: AppDatabase,
  tokenInput: string,
  nowMs = Date.now(),
): { valid: true; resetToken: PasswordResetToken } | { valid: false; error: string } {
  const token = tokenInput.trim();
  if (!token) {
    return { valid: false, error: 'Reset token is required.' };
  }
  const record = db.passwordResetTokens.find((t) => t.token === token);
  if (!record) {
    return { valid: false, error: 'Invalid password reset token.' };
  }
  if (record.usedAt) {
    return { valid: false, error: 'This password reset link has already been used.' };
  }
  if (nowMs > record.expiresAt) {
    return { valid: false, error: 'This password reset link has expired. Please request a new one.' };
  }
  return { valid: true, resetToken: record };
}

export function completePasswordReset(
  db: AppDatabase,
  tokenInput: string,
  newPassword: string,
  nowMs = Date.now(),
): { ok: true; db: AppDatabase } | { ok: false; error: string } {
  const check = validateResetToken(db, tokenInput, nowMs);
  if (!check.valid) {
    return { ok: false, error: check.error };
  }
  if (newPassword.length < 6) {
    return { ok: false, error: 'New password must be at least 6 characters.' };
  }

  const newHash = hashPassword(newPassword);
  return {
    ok: true,
    db: {
      ...db,
      users: db.users.map((u) =>
        u.id === check.resetToken.userId ? { ...u, passwordHash: newHash } : u,
      ),
      passwordResetTokens: db.passwordResetTokens.map((t) =>
        t.token === check.resetToken.token ? { ...t, usedAt: nowMs } : t,
      ),
    },
  };
}

export interface DashboardMetrics {
  totalInventoryItems: number;
  totalStockQuantity: number;
  todaysSalesCount: number;
  todaysRevenue: number;
  monthlyRevenue: number;
  totalTransactions: number;
  lowStockProducts: Product[];
  outOfStockProducts: Product[];
  dailyChartData: Array<{
    dateKey: string;
    label: string;
    revenue: number;
    salesCount: number;
  }>;
  topSellingProducts: Array<{
    productId: string;
    productName: string;
    sku: string;
    quantitySold: number;
    revenue: number;
  }>;
  recentSales: Sale[];
}

export function computeDashboardMetrics(
  db: AppDatabase,
  referenceDate = new Date(),
): DashboardMetrics {
  const todayKey = toLocalDateKey(referenceDate);
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();

  const totalInventoryItems = db.products.length;
  const totalStockQuantity = db.products.reduce((sum, p) => sum + p.quantity, 0);
  const clearedProductAlertIds = new Set(
    db.notifications
      .filter(
        (n) =>
          (n.type === 'low_stock' || n.type === 'out_of_stock') &&
          !n.resolvedAt &&
          Boolean(n.clearedAt) &&
          Boolean(n.productId),
      )
      .map((n) => n.productId as string),
  );
  const outOfStockProducts = db.products.filter(
    (p) => p.quantity <= 0 && !clearedProductAlertIds.has(p.id),
  );
  const lowStockProducts = db.products.filter(
    (p) => p.quantity > 0 && p.quantity <= p.minStockLevel && !clearedProductAlertIds.has(p.id),
  );

  let todaysSalesCount = 0;
  let todaysRevenue = 0;
  let monthlyRevenue = 0;

  for (const sale of db.sales) {
    const saleDate = new Date(sale.createdAt);
    const saleKey = toLocalDateKey(saleDate);
    if (saleKey === todayKey) {
      todaysSalesCount += 1;
      todaysRevenue = roundCurrency(todaysRevenue + sale.totalAmount);
    }
    if (saleDate.getFullYear() === currentYear && saleDate.getMonth() === currentMonth) {
      monthlyRevenue = roundCurrency(monthlyRevenue + sale.totalAmount);
    }
  }

  // Build 30-day series ending on referenceDate
  const dailyMap = new Map<string, { label: string; revenue: number; salesCount: number }>();
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - i);
    const key = toLocalDateKey(d);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    dailyMap.set(key, { label, revenue: 0, salesCount: 0 });
  }

  const productPerfMap = new Map<
    string,
    { productId: string; productName: string; sku: string; quantitySold: number; revenue: number }
  >();

  for (const sale of db.sales) {
    const key = toLocalDateKey(sale.createdAt);
    const bucket = dailyMap.get(key);
    if (bucket) {
      bucket.revenue = roundCurrency(bucket.revenue + sale.totalAmount);
      bucket.salesCount += 1;
    }

    for (const item of sale.items) {
      const existing = productPerfMap.get(item.productId) ?? {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        quantitySold: 0,
        revenue: 0,
      };
      existing.quantitySold += item.quantity;
      existing.revenue = roundCurrency(existing.revenue + item.lineTotal);
      productPerfMap.set(item.productId, existing);
    }
  }

  const dailyChartData = Array.from(dailyMap.entries()).map(([dateKey, val]) => ({
    dateKey,
    ...val,
  }));

  const topSellingProducts = Array.from(productPerfMap.values())
    .sort((a, b) => b.revenue - a.revenue || b.quantitySold - a.quantitySold)
    .slice(0, 6);

  const recentSales = [...db.sales]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return {
    totalInventoryItems,
    totalStockQuantity,
    todaysSalesCount,
    todaysRevenue,
    monthlyRevenue,
    totalTransactions: db.sales.length,
    lowStockProducts,
    outOfStockProducts,
    dailyChartData,
    topSellingProducts,
    recentSales,
  };
}

export interface PeriodReport {
  startDateKey: string;
  endDateKey: string;
  totalRevenue: number;
  totalSalesCount: number;
  totalItemsSold: number;
  averageSaleValue: number;
  previousRevenue: number;
  previousSalesCount: number;
  revenueChangePct: number | null;
  salesChangePct: number | null;
  dailyBreakdown: Array<{
    dateKey: string;
    label: string;
    revenue: number;
    salesCount: number;
    itemsSold: number;
  }>;
  bestSellingProducts: Array<{
    productId: string;
    productName: string;
    sku: string;
    quantitySold: number;
    revenue: number;
  }>;
  paymentBreakdown: Array<{
    method: PaymentMethod;
    count: number;
    revenue: number;
    sharePct: number;
  }>;
}

export function computePeriodReport(
  sales: Sale[],
  startDateStr: string,
  endDateStr: string,
): PeriodReport {
  const start = new Date(`${startDateStr}T00:00:00`);
  const end = new Date(`${endDateStr}T23:59:59.999`);
  const spanDays = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - spanDays + 1);
  prevStart.setHours(0, 0, 0, 0);

  const dailyMap = new Map<
    string,
    { label: string; revenue: number; salesCount: number; itemsSold: number }
  >();
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = toLocalDateKey(cursor);
    dailyMap.set(key, {
      label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: 0,
      salesCount: 0,
      itemsSold: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  let totalRevenue = 0;
  let totalSalesCount = 0;
  let totalItemsSold = 0;
  let previousRevenue = 0;
  let previousSalesCount = 0;

  const productMap = new Map<
    string,
    { productId: string; productName: string; sku: string; quantitySold: number; revenue: number }
  >();
  const paymentMap = new Map<PaymentMethod, { count: number; revenue: number }>([
    ['Cash', { count: 0, revenue: 0 }],
    ['Mobile Money', { count: 0, revenue: 0 }],
    ['Bank Transfer', { count: 0, revenue: 0 }],
    ['Other', { count: 0, revenue: 0 }],
  ]);

  for (const sale of sales) {
    const t = new Date(sale.createdAt).getTime();
    if (t >= start.getTime() && t <= end.getTime()) {
      totalRevenue = roundCurrency(totalRevenue + sale.totalAmount);
      totalSalesCount += 1;
      const itemsQty = sale.items.reduce((s, it) => s + it.quantity, 0);
      totalItemsSold += itemsQty;

      const dayKey = toLocalDateKey(sale.createdAt);
      const dayBucket = dailyMap.get(dayKey);
      if (dayBucket) {
        dayBucket.revenue = roundCurrency(dayBucket.revenue + sale.totalAmount);
        dayBucket.salesCount += 1;
        dayBucket.itemsSold += itemsQty;
      }

      const pm = paymentMap.get(sale.paymentMethod) ?? { count: 0, revenue: 0 };
      pm.count += 1;
      pm.revenue = roundCurrency(pm.revenue + sale.totalAmount);
      paymentMap.set(sale.paymentMethod, pm);

      for (const item of sale.items) {
        const prod = productMap.get(item.productId) ?? {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          quantitySold: 0,
          revenue: 0,
        };
        prod.quantitySold += item.quantity;
        prod.revenue = roundCurrency(prod.revenue + item.lineTotal);
        productMap.set(item.productId, prod);
      }
    } else if (t >= prevStart.getTime() && t <= prevEnd.getTime()) {
      previousRevenue = roundCurrency(previousRevenue + sale.totalAmount);
      previousSalesCount += 1;
    }
  }

  const averageSaleValue =
    totalSalesCount > 0 ? roundCurrency(totalRevenue / totalSalesCount) : 0;
  const revenueChangePct =
    previousRevenue > 0
      ? roundCurrency(((totalRevenue - previousRevenue) / previousRevenue) * 100)
      : null;
  const salesChangePct =
    previousSalesCount > 0
      ? roundCurrency(((totalSalesCount - previousSalesCount) / previousSalesCount) * 100)
      : null;

  return {
    startDateKey: startDateStr,
    endDateKey: endDateStr,
    totalRevenue,
    totalSalesCount,
    totalItemsSold,
    averageSaleValue,
    previousRevenue,
    previousSalesCount,
    revenueChangePct,
    salesChangePct,
    dailyBreakdown: Array.from(dailyMap.entries()).map(([dateKey, d]) => ({
      dateKey,
      ...d,
    })),
    bestSellingProducts: Array.from(productMap.values()).sort(
      (a, b) => b.revenue - a.revenue || b.quantitySold - a.quantitySold,
    ),
    paymentBreakdown: Array.from(paymentMap.entries()).map(([method, data]) => ({
      method,
      count: data.count,
      revenue: data.revenue,
      sharePct: totalRevenue > 0 ? roundCurrency((data.revenue / totalRevenue) * 100) : 0,
    })),
  };
}

export interface MonthlyRevenueRow {
  monthIndex: number; // 0..11
  monthName: string;
  shortName: string;
  totalRevenue: number;
  transactionCount: number;
  itemsSold: number;
  averageTransactionValue: number;
  bestSellingProduct: string;
  momChangePct: number | null;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function computeMonthlyRevenueReport(
  sales: Sale[],
  year: number,
): {
  year: number;
  months: MonthlyRevenueRow[];
  annualRevenue: number;
  annualTransactions: number;
  annualItemsSold: number;
} {
  const buckets = MONTH_NAMES.map((monthName, idx) => ({
    monthIndex: idx,
    monthName,
    shortName: monthName.slice(0, 3),
    totalRevenue: 0,
    transactionCount: 0,
    itemsSold: 0,
    productQty: new Map<string, { name: string; qty: number; rev: number }>(),
  }));

  for (const sale of sales) {
    const dt = new Date(sale.createdAt);
    if (dt.getFullYear() !== year) continue;
    const m = dt.getMonth();
    const bucket = buckets[m];
    bucket.totalRevenue = roundCurrency(bucket.totalRevenue + sale.totalAmount);
    bucket.transactionCount += 1;
    for (const item of sale.items) {
      bucket.itemsSold += item.quantity;
      const p = bucket.productQty.get(item.productId) ?? {
        name: item.productName,
        qty: 0,
        rev: 0,
      };
      p.qty += item.quantity;
      p.rev = roundCurrency(p.rev + item.lineTotal);
      bucket.productQty.set(item.productId, p);
    }
  }

  let annualRevenue = 0;
  let annualTransactions = 0;
  let annualItemsSold = 0;

  const months: MonthlyRevenueRow[] = buckets.map((b, idx) => {
    annualRevenue = roundCurrency(annualRevenue + b.totalRevenue);
    annualTransactions += b.transactionCount;
    annualItemsSold += b.itemsSold;

    const topProd = Array.from(b.productQty.values()).sort(
      (a, c) => c.qty - a.qty || c.rev - a.rev,
    )[0];

    const prevRev = idx > 0 ? buckets[idx - 1].totalRevenue : 0;
    const momChangePct =
      idx > 0 && prevRev > 0
        ? roundCurrency(((b.totalRevenue - prevRev) / prevRev) * 100)
        : null;

    return {
      monthIndex: b.monthIndex,
      monthName: b.monthName,
      shortName: b.shortName,
      totalRevenue: b.totalRevenue,
      transactionCount: b.transactionCount,
      itemsSold: b.itemsSold,
      averageTransactionValue:
        b.transactionCount > 0 ? roundCurrency(b.totalRevenue / b.transactionCount) : 0,
      bestSellingProduct: topProd ? `${topProd.name} (${topProd.qty})` : '—',
      momChangePct,
    };
  });

  return {
    year,
    months,
    annualRevenue,
    annualTransactions,
    annualItemsSold,
  };
}

export function computeProfitAndExpenses(
  db: AppDatabase,
  referenceDate = new Date(),
): {
  totalSalesRevenue: number;
  totalCogs: number;
  estimatedGrossProfit: number;
  totalExpenses: number;
  monthlyExpenses: number;
  monthlyRevenue: number;
  revenueMinusExpenses: number;
  netOperatingProfit: number;
  expensesByCategory: Array<{ category: string; amount: number; sharePct: number }>;
} {
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();

  let totalSalesRevenue = 0;
  let totalCogs = 0;
  let monthlyRevenue = 0;

  for (const sale of db.sales) {
    totalSalesRevenue = roundCurrency(totalSalesRevenue + sale.totalAmount);
    const dt = new Date(sale.createdAt);
    if (dt.getFullYear() === currentYear && dt.getMonth() === currentMonth) {
      monthlyRevenue = roundCurrency(monthlyRevenue + sale.totalAmount);
    }
    for (const item of sale.items) {
      totalCogs = roundCurrency(totalCogs + item.costPrice * item.quantity);
    }
  }

  let totalExpenses = 0;
  let monthlyExpenses = 0;
  const catMap = new Map<string, number>();

  for (const exp of db.expenses) {
    totalExpenses = roundCurrency(totalExpenses + exp.amount);
    const dt = new Date(`${exp.date}T00:00:00`);
    if (dt.getFullYear() === currentYear && dt.getMonth() === currentMonth) {
      monthlyExpenses = roundCurrency(monthlyExpenses + exp.amount);
    }
    catMap.set(exp.category, roundCurrency((catMap.get(exp.category) ?? 0) + exp.amount));
  }

  const estimatedGrossProfit = roundCurrency(totalSalesRevenue - totalCogs);
  const revenueMinusExpenses = roundCurrency(totalSalesRevenue - totalExpenses);
  const netOperatingProfit = roundCurrency(estimatedGrossProfit - totalExpenses);

  const expensesByCategory = Array.from(catMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      sharePct: totalExpenses > 0 ? roundCurrency((amount / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    totalSalesRevenue,
    totalCogs,
    estimatedGrossProfit,
    totalExpenses,
    monthlyExpenses,
    monthlyRevenue,
    revenueMinusExpenses,
    netOperatingProfit,
    expensesByCategory,
  };
}

function csvEscape(val: string | number): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

export function salesToCsv(sales: Sale[]): string {
  const header = [
    'Receipt Number',
    'Date & Time',
    'Cashier',
    'Customer Name',
    'Customer Phone',
    'Items Count',
    'Items Summary',
    'Subtotal',
    'Discount',
    'Total Amount',
    'Amount Paid',
    'Change Given',
    'Payment Method',
  ];
  const rows = sales.map((s) => [
    s.receiptNumber,
    new Date(s.createdAt).toLocaleString(),
    s.cashierName,
    s.customerName ?? '',
    s.customerPhone ?? '',
    s.items.reduce((acc, i) => acc + i.quantity, 0),
    s.items.map((i) => `${i.productName} x${i.quantity}`).join('; '),
    s.subtotal.toFixed(2),
    s.discountAmount.toFixed(2),
    s.totalAmount.toFixed(2),
    s.amountPaid.toFixed(2),
    s.changeGiven.toFixed(2),
    s.paymentMethod,
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

export function periodReportToCsv(report: PeriodReport): string {
  const header = ['Date', 'Sales Count', 'Items Sold', 'Revenue'];
  const rows = report.dailyBreakdown.map((d) => [
    d.dateKey,
    d.salesCount,
    d.itemsSold,
    d.revenue.toFixed(2),
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

export function monthlyReportToCsv(
  months: MonthlyRevenueRow[],
  year: number,
): string {
  const header = [
    'Year',
    'Month',
    'Total Revenue',
    'Transactions',
    'Items Sold',
    'Average Value',
    'Best-Selling Product',
  ];
  const rows = months.map((m) => [
    year,
    m.monthName,
    m.totalRevenue.toFixed(2),
    m.transactionCount,
    m.itemsSold,
    m.averageTransactionValue.toFixed(2),
    m.bestSellingProduct,
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

export function clearSalesRecords(db: AppDatabase, saleIds?: string[]): AppDatabase {
  const idSet = saleIds ? new Set(saleIds) : null;
  const removedReceipts = new Set(
    db.sales.filter((s) => (!idSet ? true : idSet.has(s.id))).map((s) => s.receiptNumber),
  );
  const nextSales = idSet ? db.sales.filter((s) => !idSet.has(s.id)) : [];
  const nextNotifications = db.notifications.filter((n) => {
    if (n.type !== 'sale') return true;
    if (!idSet) return false;
    return !Array.from(removedReceipts).some((rec) => n.message.includes(rec));
  });

  return {
    ...db,
    sales: nextSales,
    notifications: nextNotifications,
  };
}

export function clearReceiptRecords(
  db: AppDatabase,
  saleIds?: string[],
  deleteSales = false,
): AppDatabase {
  if (deleteSales) {
    return clearSalesRecords(db, saleIds);
  }
  const idSet = saleIds ? new Set(saleIds) : null;
  return {
    ...db,
    sales: db.sales.map((s) => (!idSet || idSet.has(s.id) ? { ...s, receiptCleared: true } : s)),
  };
}

export function clearAlertNotifications(
  db: AppDatabase,
  nowIso = new Date().toISOString(),
): AppDatabase {
  const nextNotifications: NotificationItem[] = [];
  for (const n of db.notifications) {
    const isThreshold = n.type === 'low_stock' || n.type === 'out_of_stock';
    if (isThreshold && !n.resolvedAt) {
      // Keep hidden clearedAt marker so page reload does not immediately re-trigger the same qty alert
      nextNotifications.push({
        ...n,
        read: true,
        clearedAt: n.clearedAt ?? nowIso,
      });
    } else if (!isThreshold && n.type !== 'stock_update') {
      nextNotifications.push(n);
    }
    // Resolved alerts & stock_update alert logs are removed from history
  }
  return {
    ...db,
    notifications: nextNotifications,
  };
}

export function clearPeriodReportSales(
  db: AppDatabase,
  startDate: string,
  endDate: string,
): AppDatabase {
  const idsInPeriod = db.sales
    .filter((s) => {
      const key = toLocalDateKey(s.createdAt);
      return key >= startDate && key <= endDate;
    })
    .map((s) => s.id);

  return clearSalesRecords(db, idsInPeriod);
}

export function clearDashboardData(
  db: AppDatabase,
  options: { clearSales?: boolean; clearAlerts?: boolean; nowIso?: string } = {},
): AppDatabase {
  const clearSales = options.clearSales ?? true;
  const clearAlerts = options.clearAlerts ?? true;
  const nowIso = options.nowIso ?? new Date().toISOString();

  let working = db;
  if (clearSales) {
    working = clearSalesRecords(working);
  }
  if (clearAlerts) {
    const synced = syncThresholdNotifications(
      working.products,
      working.notifications,
      working.settings.defaultLowStockThreshold,
      nowIso,
    );
    working = clearAlertNotifications({ ...working, notifications: synced.notifications }, nowIso);
  }
  return working;
}

export function clearUsersAndRoles(
  db: AppDatabase,
  currentUserId: string,
  mode: 'remove_others' | 'reset_roles_to_staff' = 'remove_others',
): { ok: true; db: AppDatabase; affectedCount: number } | { ok: false; error: string } {
  const actor = db.users.find((u) => u.id === currentUserId);
  if (!actor || !actor.active || actor.role !== 'admin') {
    return {
      ok: false,
      error: 'Only an active administrator can clear user accounts and roles.',
    };
  }

  if (mode === 'remove_others') {
    const othersCount = db.users.filter((u) => u.id !== currentUserId).length;
    return {
      ok: true,
      affectedCount: othersCount,
      db: {
        ...db,
        users: db.users.filter((u) => u.id === currentUserId),
        passwordResetTokens: [],
      },
    };
  }

  const elevatedCount = db.users.filter((u) => u.id !== currentUserId && u.role !== 'staff').length;
  return {
    ok: true,
    affectedCount: elevatedCount,
    db: {
      ...db,
      users: db.users.map((u) => (u.id === currentUserId ? u : { ...u, role: 'staff' })),
      passwordResetTokens: [],
    },
  };
}

export function removeUserAccount(
  db: AppDatabase,
  userId: string,
  currentUserId: string,
): { ok: true; db: AppDatabase; removedUser: User } | { ok: false; error: string } {
  const actor = db.users.find((u) => u.id === currentUserId);
  if (!actor || !actor.active || actor.role !== 'admin') {
    return { ok: false, error: 'Only administrators can clear user accounts.' };
  }
  if (userId === currentUserId) {
    return { ok: false, error: 'You cannot clear your own currently signed-in account.' };
  }
  const target = db.users.find((u) => u.id === userId);
  if (!target) {
    return { ok: false, error: 'User account not found.' };
  }

  return {
    ok: true,
    removedUser: target,
    db: {
      ...db,
      users: db.users.filter((u) => u.id !== userId),
      passwordResetTokens: db.passwordResetTokens.filter((t) => t.userId !== userId),
    },
  };
}

export function clearInventoryRecords(
  db: AppDatabase,
  options: {
    productIds?: string[];
    mode?: 'remove_products' | 'zero_stock';
    clearHistory?: boolean;
    actor?: User;
    nowIso?: string;
  } = {},
): AppDatabase {
  const mode = options.mode ?? 'remove_products';
  const clearHistory = options.clearHistory ?? true;
  const nowIso = options.nowIso ?? new Date().toISOString();
  const idSet = options.productIds ? new Set(options.productIds) : null;

  if (mode === 'remove_products') {
    const nextProducts = idSet ? db.products.filter((p) => !idSet.has(p.id)) : [];
    const nextTransactions = clearHistory
      ? idSet
        ? db.inventoryTransactions.filter((tx) => !idSet.has(tx.productId))
        : []
      : db.inventoryTransactions;

    const filteredNotifications = clearHistory
      ? db.notifications.filter((n) => {
          if (n.type === 'stock_update') {
            return idSet ? Boolean(n.productId && !idSet.has(n.productId)) : false;
          }
          if ((n.type === 'low_stock' || n.type === 'out_of_stock') && (!idSet || (n.productId && idSet.has(n.productId)))) {
            return false;
          }
          return true;
        })
      : db.notifications;

    const synced = syncThresholdNotifications(
      nextProducts,
      filteredNotifications,
      db.settings.defaultLowStockThreshold,
      nowIso,
    );

    return {
      ...db,
      products: nextProducts,
      inventoryTransactions: nextTransactions,
      notifications: synced.notifications,
    };
  }

  // zero_stock mode: keep catalog items & prices, set stock quantities to 0
  const resetLogs: InventoryTransaction[] = [];
  const nextProducts = db.products.map((p) => {
    if (idSet && !idSet.has(p.id)) return p;
    if (p.quantity > 0 && !clearHistory && options.actor) {
      resetLogs.push({
        id: createId('invtx'),
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        type: 'reduction',
        quantityChange: -p.quantity,
        previousQty: p.quantity,
        newQty: 0,
        note: 'Inventory stock cleared to 0',
        userId: options.actor.id,
        userName: options.actor.name,
        createdAt: nowIso,
      });
    }
    return p.quantity === 0 ? p : { ...p, quantity: 0, updatedAt: nowIso };
  });

  const nextTransactions = clearHistory
    ? idSet
      ? db.inventoryTransactions.filter((tx) => !idSet.has(tx.productId))
      : []
    : [...resetLogs, ...db.inventoryTransactions];

  const synced = syncThresholdNotifications(
    nextProducts,
    db.notifications,
    db.settings.defaultLowStockThreshold,
    nowIso,
    'after clearing inventory stock to 0',
  );

  return {
    ...db,
    products: nextProducts,
    inventoryTransactions: nextTransactions,
    notifications: synced.notifications,
  };
}
