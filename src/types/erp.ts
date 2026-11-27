export type UserRole = 'admin' | 'staff';

export type PaymentMethod = 'Cash' | 'Mobile Money' | 'Bank Transfer' | 'Other';

export type InventoryTransactionType =
  | 'initial'
  | 'restock'
  | 'reduction'
  | 'sale'
  | 'adjustment';

export type NotificationType =
  | 'low_stock'
  | 'out_of_stock'
  | 'sale'
  | 'stock_update'
  | 'system';

export type NavSection =
  | 'dashboard'
  | 'inventory'
  | 'add-stock'
  | 'alerts'
  | 'new-sale'
  | 'sales-history'
  | 'receipts'
  | 'thirty-day-report'
  | 'monthly-revenue'
  | 'expenses'
  | 'users'
  | 'settings';

export type AuditLogCategory =
  | 'auth'
  | 'inventory'
  | 'sales'
  | 'expenses'
  | 'users'
  | 'settings';

export interface AuditLogEntry {
  id: string;
  category: AuditLogCategory;
  action: string;
  details: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface PasswordResetToken {
  token: string;
  userId: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  usedAt?: number;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description?: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  minStockLevel: number;
  supplier?: string;
  imageUrl?: string;
  dateAdded: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: InventoryTransactionType;
  quantityChange: number;
  previousQty: number;
  newQty: number;
  note: string;
  userId: string;
  userName: string;
  referenceId?: string;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  idempotencyKey?: string;
  receiptNumber: string;
  cashierId: string;
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
  items: SaleItem[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  changeGiven: number;
  balanceDue: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  receiptCleared?: boolean;
  createdAt: string;
}

export interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string; // YYYY-MM-DD
  notes?: string;
  recordedById: string;
  recordedByName: string;
  createdAt: string;
}

export interface CompanySettings {
  companyName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  receiptFooter: string;
  defaultLowStockThreshold: number;
  logoDataUrl?: string;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  targetSection?: NavSection;
  targetRole?: UserRole;
  productId?: string;
  productName?: string;
  sku?: string;
  currentQty?: number;
  threshold?: number;
  resolvedAt?: string;
  clearedAt?: string;
}

export interface AppDatabase {
  version: number;
  users: User[];
  passwordResetTokens: PasswordResetToken[];
  categories: Category[];
  products: Product[];
  inventoryTransactions: InventoryTransaction[];
  sales: Sale[];
  expenses: Expense[];
  settings: CompanySettings;
  notifications: NotificationItem[];
  auditLogs?: AuditLogEntry[];
}

export interface AuthSession {
  userId: string;
  rememberMe: boolean;
  loggedInAt: string;
}
