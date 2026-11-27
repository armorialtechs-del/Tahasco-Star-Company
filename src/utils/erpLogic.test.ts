import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialSeedDatabase } from '../store/seedData';
import {
  adjustProductStock,
  calculateSaleTotals,
  clearAlertNotifications,
  clearDashboardData,
  clearInventoryRecords,
  clearPeriodReportSales,
  clearReceiptRecords,
  clearSalesRecords,
  clearUsersAndRoles,
  completePasswordReset,
  computeDashboardMetrics,
  computeMonthlyRevenueReport,
  computePeriodReport,
  computeProfitAndExpenses,
  createPasswordResetToken,
  executeSaleTransaction,
  hashPassword,
  removeUserAccount,
  salesToCsv,
  syncThresholdNotifications,
  validateResetToken,
  verifyPassword,
} from './erpLogic';
import { buildPrintableReceiptHtml, buildReceiptPdfBytes } from './receiptPrint';

test('password hashing and verification work deterministically', () => {
  const hash = hashPassword('Admin@123');
  assert.equal(verifyPassword('Admin@123', hash), true);
  assert.equal(verifyPassword('WrongPass', hash), false);
});

test('executeSaleTransaction prevents selling more than available stock', () => {
  const baseDb = createInitialSeedDatabase(new Date('2026-11-27T10:00:00Z'));
  const cashier = baseDb.users[1];
  const zeroStockDb = {
    ...baseDb,
    products: baseDb.products.map((p, idx) => (idx === 0 ? { ...p, quantity: 0 } : p)),
  };

  const outRes = executeSaleTransaction(
    zeroStockDb,
    {
      items: [{ productId: zeroStockDb.products[0].id, quantity: 1 }],
      discountAmount: 0,
      amountPaid: 500,
      paymentMethod: 'Cash',
    },
    cashier,
  );
  assert.equal(outRes.ok, false);

  const cement = baseDb.products[0];
  const overRes = executeSaleTransaction(
    baseDb,
    {
      items: [{ productId: cement.id, quantity: cement.quantity + 5 }],
      discountAmount: 0,
      amountPaid: 500000,
      paymentMethod: 'Cash',
    },
    cashier,
  );
  assert.equal(overRes.ok, false);
});

test('executeSaleTransaction deducts stock, prevents duplicates, and computes change accurately', () => {
  const db = createInitialSeedDatabase(new Date('2026-11-27T10:00:00Z'));
  const cashier = db.users[1];
  const cement = db.products[0];
  const initialQty = cement.quantity;

  const result = executeSaleTransaction(
    db,
    {
      idempotencyKey: 'idem_test_1',
      items: [{ productId: cement.id, quantity: 5 }],
      discountAmount: 10,
      amountPaid: 500,
      paymentMethod: 'Mobile Money',
      customerName: 'Test Customer',
    },
    cashier,
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  // 5 * 94 = 470 subtotal; -10 discount = 460 total; 500 paid => 40 change
  assert.equal(result.sale.subtotal, 470);
  assert.equal(result.sale.totalAmount, 460);
  assert.equal(result.sale.changeGiven, 40);
  assert.equal(result.sale.balanceDue, 0);

  const updatedCement = result.db.products.find((p) => p.id === cement.id)!;
  assert.equal(updatedCement.quantity, initialQty - 5);
  assert.equal(result.db.sales.length, db.sales.length + 1);

  // Duplicate idempotencyKey must fail
  const dup = executeSaleTransaction(
    result.db,
    {
      idempotencyKey: 'idem_test_1',
      items: [{ productId: cement.id, quantity: 1 }],
      discountAmount: 0,
      amountPaid: 100,
      paymentMethod: 'Cash',
    },
    cashier,
  );
  assert.equal(dup.ok, false);
});

test('adjustProductStock updates stock and blocks negative inventory', () => {
  const db = createInitialSeedDatabase(new Date('2026-11-27T10:00:00Z'));
  const admin = db.users[0];
  const rod = db.products[1];

  const restock = adjustProductStock(
    db,
    { productId: rod.id, mode: 'restock', quantity: 25, note: 'New shipment' },
    admin,
  );
  assert.equal(restock.ok, true);
  if (!restock.ok) return;
  assert.equal(restock.product.quantity, rod.quantity + 25);

  const badReduction = adjustProductStock(
    restock.db,
    { productId: rod.id, mode: 'reduction', quantity: 9999, note: 'Too high' },
    admin,
  );
  assert.equal(badReduction.ok, false);
});

test('password reset token validates, rejects expired/used tokens, and updates password', () => {
  const db = createInitialSeedDatabase(new Date('2026-11-27T10:00:00Z'));
  const t0 = 1_700_000_000_000;
  const req = createPasswordResetToken(db, 'sales@tahascostar.com', t0);
  assert.equal(req.ok, true);
  if (!req.ok) return;

  // Expired check (31 minutes later)
  const expiredCheck = validateResetToken(req.db, req.resetToken.token, t0 + 31 * 60 * 1000);
  assert.equal(expiredCheck.valid, false);

  // Valid within 5 minutes
  const done = completePasswordReset(
    req.db,
    req.resetToken.token,
    'NewSecure#2026',
    t0 + 5 * 60 * 1000,
  );
  assert.equal(done.ok, true);
  if (!done.ok) return;

  const updatedUser = done.db.users.find((u) => u.email === 'sales@tahascostar.com')!;
  assert.equal(verifyPassword('NewSecure#2026', updatedUser.passwordHash), true);

  // Reusing same token must fail
  const reuse = completePasswordReset(done.db, req.resetToken.token, 'AnotherPass123', t0 + 6 * 60 * 1000);
  assert.equal(reuse.ok, false);
});

test('calculateSaleTotals, reports, monthly grouping, profit & CSV export calculate accurately', () => {
  const totals = calculateSaleTotals([{ lineTotal: 150.5 }, { lineTotal: 49.5 }], 20, 200);
  assert.equal(totals.subtotal, 200);
  assert.equal(totals.totalAmount, 180);
  assert.equal(totals.changeGiven, 20);

  const refDate = new Date('2026-11-27T10:00:00Z');
  const db = createInitialSeedDatabase(refDate);

  const dash = computeDashboardMetrics(db, refDate);
  assert.equal(dash.totalInventoryItems, 31);
  assert.equal(dash.outOfStockProducts.length, 0);
  assert.equal(dash.dailyChartData.length, 30);

  const monthly = computeMonthlyRevenueReport(db.sales, refDate.getFullYear());
  assert.equal(monthly.months.length, 12);
  assert.equal(monthly.months[0].monthName, 'January');
  assert.equal(monthly.months[11].monthName, 'December');

  const period = computePeriodReport(db.sales, '2026-10-29', '2026-11-27');
  assert.ok(period.totalRevenue > 0);
  assert.equal(period.dailyBreakdown.length, 30);

  const profit = computeProfitAndExpenses(db, refDate);
  assert.equal(
    profit.estimatedGrossProfit,
    Math.round((profit.totalSalesRevenue - profit.totalCogs) * 100) / 100,
  );

  const csv = salesToCsv(db.sales.slice(0, 2));
  assert.ok(csv.includes('Receipt Number'));
  assert.ok(csv.includes(db.sales[0].receiptNumber));
});

test('buildPrintableReceiptHtml renders complete A4 and 80mm thermal printable receipts', () => {
  const db = createInitialSeedDatabase(new Date('2026-11-27T10:00:00Z'));
  const sale = db.sales[0];

  const a4Html = buildPrintableReceiptHtml(sale, db.settings, 'a4');
  assert.ok(a4Html.includes('size: A4;'));
  assert.ok(a4Html.includes(db.settings.companyName));
  assert.ok(a4Html.includes(sale.receiptNumber));
  assert.ok(a4Html.includes(sale.cashierName));
  assert.ok(a4Html.includes(sale.items[0].productName));

  const thermalHtml = buildPrintableReceiptHtml(sale, db.settings, 'thermal');
  assert.ok(thermalHtml.includes('size: 80mm auto;'));
  assert.ok(thermalHtml.includes(sale.receiptNumber));
});

test('buildReceiptPdfBytes generates valid A4 and 80mm thermal PDF documents', () => {
  const db = createInitialSeedDatabase(new Date('2026-11-27T10:00:00Z'));
  const sale = db.sales[0];

  const a4Bytes = buildReceiptPdfBytes(sale, db.settings, 'a4');
  const a4Text = new TextDecoder().decode(a4Bytes);
  assert.ok(a4Text.startsWith('%PDF-1.4\n'));
  assert.ok(a4Text.includes('MediaBox [0 0 595.28 841.89]'));
  assert.ok(a4Text.includes(db.settings.companyName));
  assert.ok(a4Text.includes(sale.receiptNumber));
  assert.ok(a4Text.includes(sale.items[0].productName));
  assert.ok(a4Text.trimEnd().endsWith('%%EOF'));

  const thermalBytes = buildReceiptPdfBytes(sale, db.settings, 'thermal');
  const thermalText = new TextDecoder().decode(thermalBytes);
  assert.ok(thermalText.startsWith('%PDF-1.4\n'));
  assert.ok(thermalText.includes('MediaBox [0 0 226.77'));
  assert.ok(thermalText.includes(sale.receiptNumber));
  assert.ok(thermalText.trimEnd().endsWith('%%EOF'));
});

test('automated threshold alerts trigger on sale drop, escalate to out_of_stock, and auto-resolve on restock', () => {
  const db = createInitialSeedDatabase(new Date('2026-11-27T10:00:00Z'));
  const admin = db.users[0];
  const staff = db.users[1];
  // Metal Door Single has qty 8, minStockLevel 3
  const door = db.products.find((p) => p.sku === 'TSC-DR-001')!;

  // Sale drops door from 8 -> 2 (below threshold 3)
  const saleRes = executeSaleTransaction(
    db,
    {
      items: [{ productId: door.id, quantity: 6 }],
      discountAmount: 0,
      amountPaid: 6 * door.sellingPrice,
      paymentMethod: 'Cash',
    },
    staff,
  );
  assert.equal(saleRes.ok, true);
  if (!saleRes.ok) return;

  assert.equal(saleRes.triggeredAlerts.length, 1);
  assert.equal(saleRes.triggeredAlerts[0].type, 'low_stock');
  assert.equal(saleRes.triggeredAlerts[0].targetRole, 'admin');
  assert.equal(saleRes.triggeredAlerts[0].targetSection, 'alerts');
  assert.equal(saleRes.triggeredAlerts[0].currentQty, 2);

  // Reduction drops remaining 2 -> 0 (escalates to out_of_stock without duplicate active alert)
  const zeroRes = adjustProductStock(
    saleRes.db,
    { productId: door.id, mode: 'reduction', quantity: 2, note: 'Damaged units' },
    admin,
  );
  assert.equal(zeroRes.ok, true);
  if (!zeroRes.ok) return;

  const activeDoorAlerts = zeroRes.db.notifications.filter(
    (n) => n.productId === door.id && (n.type === 'low_stock' || n.type === 'out_of_stock') && !n.resolvedAt,
  );
  assert.equal(activeDoorAlerts.length, 1);
  assert.equal(activeDoorAlerts[0].type, 'out_of_stock');
  assert.equal(activeDoorAlerts[0].currentQty, 0);

  // Restock +10 (0 -> 10, above threshold 3) auto-resolves the alert
  const restockRes = adjustProductStock(
    zeroRes.db,
    { productId: door.id, mode: 'restock', quantity: 10, note: 'Supplier delivery' },
    admin,
  );
  assert.equal(restockRes.ok, true);
  if (!restockRes.ok) return;

  const unresolvedAfterRestock = restockRes.db.notifications.filter(
    (n) => n.productId === door.id && (n.type === 'low_stock' || n.type === 'out_of_stock') && !n.resolvedAt,
  );
  assert.equal(unresolvedAfterRestock.length, 0);

  const resolvedAlerts = restockRes.db.notifications.filter(
    (n) => n.productId === door.id && Boolean(n.resolvedAt),
  );
  assert.equal(resolvedAlerts.length, 1);
});

test('clearSalesRecords clears selected or all sales without altering product inventory', () => {
  const db = createInitialSeedDatabase(new Date('2026-11-27T10:00:00Z'));
  const staff = db.users[1];
  const cement = db.products[0];
  const totalQtyBefore = db.products.reduce((s, p) => s + p.quantity, 0);

  const saleRes = executeSaleTransaction(
    db,
    {
      items: [{ productId: cement.id, quantity: 2 }],
      discountAmount: 0,
      amountPaid: cement.sellingPrice * 2,
      paymentMethod: 'Cash',
    },
    staff,
  );
  assert.equal(saleRes.ok, true);
  if (!saleRes.ok) return;

  const qtyAfterSale = saleRes.db.products.reduce((s, p) => s + p.quantity, 0);
  assert.equal(qtyAfterSale, totalQtyBefore - 2);

  // Partial clear removes only the specified sale and its sale notification
  const partial = clearSalesRecords(saleRes.db, [saleRes.sale.id]);
  assert.equal(partial.sales.length, db.sales.length);
  assert.equal(
    partial.notifications.some(
      (n) => n.type === 'sale' && n.message.includes(saleRes.sale.receiptNumber),
    ),
    false,
  );

  // Full clear removes all sales while preserving inventory stock quantities
  const clearedAll = clearSalesRecords(partial);
  assert.equal(clearedAll.sales.length, 0);
  assert.equal(
    clearedAll.products.reduce((s, p) => s + p.quantity, 0),
    qtyAfterSale,
  );
});

test('clearReceiptRecords clears receipt archive without deleting sales unless requested', () => {
  const db = createInitialSeedDatabase(new Date('2026-11-27T10:00:00Z'));
  const initialCount = db.sales.length;

  const archiveOnly = clearReceiptRecords(db, undefined, false);
  assert.equal(archiveOnly.sales.length, initialCount);
  assert.equal(archiveOnly.sales.filter((s) => !s.receiptCleared).length, 0);

  const periodStillPresent = computePeriodReport(archiveOnly.sales, '2026-10-29', '2026-11-27');
  assert.ok(periodStillPresent.totalSalesCount > 0);

  const alsoDeleted = clearReceiptRecords(db, [db.sales[0].id], true);
  assert.equal(alsoDeleted.sales.length, initialCount - 1);
});

test('clearAlertNotifications clears active/history alerts, stays suppressed on reload, and re-triggers on further stock drop', () => {
  const db = createInitialSeedDatabase(new Date('2026-11-27T10:00:00Z'));
  const admin = db.users[0];
  const staff = db.users[1];
  const door = db.products.find((p) => p.sku === 'TSC-DR-001')!; // qty 8, threshold 3

  // Drop qty 8 -> 3 (triggers low_stock)
  const saleRes = executeSaleTransaction(
    db,
    {
      items: [{ productId: door.id, quantity: 5 }],
      discountAmount: 0,
      amountPaid: 5 * door.sellingPrice,
      paymentMethod: 'Cash',
    },
    staff,
  );
  assert.equal(saleRes.ok, true);
  if (!saleRes.ok) return;

  const clearedDb = clearAlertNotifications(saleRes.db, '2026-11-27T11:00:00Z');
  const visibleActive = clearedDb.notifications.filter(
    (n) => (n.type === 'low_stock' || n.type === 'out_of_stock') && !n.resolvedAt && !n.clearedAt,
  );
  const visibleHistory = clearedDb.notifications.filter(
    (n) => !n.clearedAt && (Boolean(n.resolvedAt) || n.type === 'stock_update'),
  );
  assert.equal(visibleActive.length, 0);
  assert.equal(visibleHistory.length, 0);

  // Simulating page reload sync with unchanged stock keeps cleared alerts hidden
  const reloadSync = syncThresholdNotifications(
    clearedDb.products,
    clearedDb.notifications,
    clearedDb.settings.defaultLowStockThreshold,
    '2026-11-27T11:05:00Z',
  );
  assert.equal(reloadSync.triggeredAlerts.length, 0);
  assert.equal(
    reloadSync.notifications.filter(
      (n) => (n.type === 'low_stock' || n.type === 'out_of_stock') && !n.resolvedAt && !n.clearedAt,
    ).length,
    0,
  );

  // Dropping qty further (3 -> 0) re-triggers an active alert
  const dropFurther = adjustProductStock(
    { ...clearedDb, notifications: reloadSync.notifications },
    { productId: door.id, mode: 'reduction', quantity: 3, note: 'Sold remaining' },
    admin,
  );
  assert.equal(dropFurther.ok, true);
  if (!dropFurther.ok) return;
  assert.equal(dropFurther.triggeredAlerts.length, 1);
  assert.equal(dropFurther.triggeredAlerts[0].type, 'out_of_stock');
  assert.equal(dropFurther.triggeredAlerts[0].clearedAt, undefined);
});

test('clearPeriodReportSales clears sales inside date range and resets period report totals to zero', () => {
  const refDate = new Date('2026-11-27T10:00:00Z');
  const db = createInitialSeedDatabase(refDate);
  const before = computePeriodReport(db.sales, '2026-10-29', '2026-11-27');
  assert.ok(before.totalSalesCount > 0);
  assert.ok(before.totalRevenue > 0);

  const cleared = clearPeriodReportSales(db, '2026-10-29', '2026-11-27');
  const after = computePeriodReport(cleared.sales, '2026-10-29', '2026-11-27');
  assert.equal(after.totalSalesCount, 0);
  assert.equal(after.totalRevenue, 0);
  assert.equal(after.totalItemsSold, 0);
});

test('clearDashboardData clears dashboard sales metrics and stock alerts without changing product quantities', () => {
  const refDate = new Date('2026-11-27T10:00:00Z');
  const db = createInitialSeedDatabase(refDate);
  const staff = db.users[1];
  const door = db.products.find((p) => p.sku === 'TSC-DR-001')!; // qty 8, threshold 3

  // Trigger a low stock alert
  const saleRes = executeSaleTransaction(
    db,
    {
      items: [{ productId: door.id, quantity: 6 }],
      discountAmount: 0,
      amountPaid: 6 * door.sellingPrice,
      paymentMethod: 'Cash',
    },
    staff,
  );
  assert.equal(saleRes.ok, true);
  if (!saleRes.ok) return;

  const qtyAfterSale = saleRes.db.products.reduce((s, p) => s + p.quantity, 0);
  const beforeDash = computeDashboardMetrics(saleRes.db, refDate);
  assert.ok(beforeDash.totalTransactions > 0);
  assert.equal(beforeDash.lowStockProducts.length, 1);

  const clearedDashDb = clearDashboardData(saleRes.db, {
    clearSales: true,
    clearAlerts: true,
    nowIso: '2026-11-27T12:00:00Z',
  });
  const afterDash = computeDashboardMetrics(clearedDashDb, refDate);
  assert.equal(afterDash.totalTransactions, 0);
  assert.equal(afterDash.todaysSalesCount, 0);
  assert.equal(afterDash.todaysRevenue, 0);
  assert.equal(afterDash.monthlyRevenue, 0);
  assert.equal(afterDash.recentSales.length, 0);
  assert.equal(afterDash.topSellingProducts.length, 0);
  assert.equal(afterDash.lowStockProducts.length, 0);
  assert.equal(afterDash.outOfStockProducts.length, 0);
  assert.equal(afterDash.totalStockQuantity, qtyAfterSale);
});

test('clearUsersAndRoles and removeUserAccount protect signed-in admin and clear users, roles, and reset tokens', () => {
  const db = createInitialSeedDatabase(new Date('2026-11-27T10:00:00Z'));
  const admin = db.users[0];
  const staff = db.users[1];

  // Create a reset token for staff first
  const tokRes = createPasswordResetToken(db, staff.email, 1_700_000_000_000);
  assert.equal(tokRes.ok, true);
  if (!tokRes.ok) return;

  // Add an extra admin user to test role reset
  const extraAdmin = {
    ...staff,
    id: 'usr_extra_admin',
    username: 'extra.admin',
    email: 'extra@tahascostar.com',
    role: 'admin' as const,
  };
  const dbWithThree = {
    ...tokRes.db,
    users: [...tokRes.db.users, extraAdmin],
  };

  // Attempting to remove self must fail
  const selfRemove = removeUserAccount(dbWithThree, admin.id, admin.id);
  assert.equal(selfRemove.ok, false);

  // Removing single user succeeds and removes their reset tokens
  const singleRemove = removeUserAccount(dbWithThree, staff.id, admin.id);
  assert.equal(singleRemove.ok, true);
  if (!singleRemove.ok) return;
  assert.equal(singleRemove.db.users.some((u) => u.id === staff.id), false);
  assert.equal(singleRemove.db.passwordResetTokens.some((t) => t.userId === staff.id), false);

  // Resetting roles to staff keeps other accounts but demotes other admins to staff
  const resetRoles = clearUsersAndRoles(dbWithThree, admin.id, 'reset_roles_to_staff');
  assert.equal(resetRoles.ok, true);
  if (!resetRoles.ok) return;
  assert.equal(resetRoles.db.users.length, dbWithThree.users.length);
  assert.equal(resetRoles.db.users.find((u) => u.id === admin.id)?.role, 'admin');
  assert.equal(resetRoles.db.users.find((u) => u.id === extraAdmin.id)?.role, 'staff');
  assert.equal(resetRoles.db.passwordResetTokens.length, 0);

  // Removing all other accounts keeps only current admin
  const removeOthers = clearUsersAndRoles(dbWithThree, admin.id, 'remove_others');
  assert.equal(removeOthers.ok, true);
  if (!removeOthers.ok) return;
  assert.equal(removeOthers.db.users.length, 1);
  assert.equal(removeOthers.db.users[0].id, admin.id);
  assert.equal(removeOthers.db.passwordResetTokens.length, 0);
});

test('clearInventoryRecords supports zero_stock, filtered clear, and full inventory removal', () => {
  const db = createInitialSeedDatabase(new Date('2026-11-27T10:00:00Z'));
  const admin = db.users[0];
  const initialCount = db.products.length;
  const firstTwoIds = db.products.slice(0, 2).map((p) => p.id);

  // Zero stock for selected products while keeping history log
  const zeroed = clearInventoryRecords(db, {
    productIds: firstTwoIds,
    mode: 'zero_stock',
    clearHistory: false,
    actor: admin,
    nowIso: '2026-11-27T12:00:00Z',
  });
  assert.equal(zeroed.products.length, initialCount);
  assert.equal(zeroed.products.find((p) => p.id === firstTwoIds[0])?.quantity, 0);
  assert.equal(zeroed.products.find((p) => p.id === firstTwoIds[1])?.quantity, 0);
  assert.ok(zeroed.inventoryTransactions.length > db.inventoryTransactions.length);

  // Remove only those 2 filtered products and clear their history
  const partialRemoved = clearInventoryRecords(zeroed, {
    productIds: firstTwoIds,
    mode: 'remove_products',
    clearHistory: true,
    nowIso: '2026-11-27T12:05:00Z',
  });
  assert.equal(partialRemoved.products.length, initialCount - 2);
  assert.equal(
    partialRemoved.inventoryTransactions.some((tx) => firstTwoIds.includes(tx.productId)),
    false,
  );

  // Clear all inventory products and transactions
  const clearedAll = clearInventoryRecords(partialRemoved, {
    mode: 'remove_products',
    clearHistory: true,
    nowIso: '2026-11-27T12:10:00Z',
  });
  assert.equal(clearedAll.products.length, 0);
  assert.equal(clearedAll.inventoryTransactions.length, 0);
  assert.equal(clearedAll.sales.length, db.sales.length);
});
