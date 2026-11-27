import type { AppDatabase, Category, Product, Sale, User } from '../types/erp';
import { hashPassword, roundCurrency } from '../utils/erpLogic';

export function createInitialSeedDatabase(referenceDate = new Date()): AppDatabase {
  const nowIso = referenceDate.toISOString();
  const y = referenceDate.getFullYear();
  const m = referenceDate.getMonth();
  const d = referenceDate.getDate();

  const daysAgoIso = (daysAgo: number, hour = 11, min = 30): string => {
    const dt = new Date(y, m, d - daysAgo, hour, min, 0);
    return dt.toISOString();
  };

  const monthOffsetIso = (monthsAgo: number, dayOfMonth: number, hour = 14): string => {
    const targetMonth = m - monthsAgo;
    const dt = new Date(y, Math.max(0, targetMonth), Math.min(dayOfMonth, 27), hour, 15, 0);
    return dt.toISOString();
  };

  const users: User[] = [
    {
      id: 'usr_admin_1',
      name: 'Kwame Mensah',
      username: 'kwame.admin',
      email: 'admin@tahascostar.com',
      role: 'admin',
      passwordHash: hashPassword('Admin@123'),
      active: true,
      createdAt: daysAgoIso(180),
      lastLoginAt: nowIso,
    },
    {
      id: 'usr_staff_1',
      name: 'Abena Osei',
      username: 'abena.sales',
      email: 'sales@tahascostar.com',
      role: 'staff',
      passwordHash: hashPassword('Sales@123'),
      active: true,
      createdAt: daysAgoIso(150),
      lastLoginAt: daysAgoIso(1),
    },
    {
      id: 'usr_staff_2',
      name: 'Yaw Boateng',
      username: 'yaw.pos',
      email: 'yaw@tahascostar.com',
      role: 'staff',
      passwordHash: hashPassword('Staff@123'),
      active: true,
      createdAt: daysAgoIso(90),
    },
  ];

  const categories: Category[] = [
    { id: 'cat_cement', name: 'Cement', description: 'Rapid & Portland bagged cement' },
    { id: 'cat_roofing', name: 'Roofing & Wood', description: 'Roofing sheets & plywood' },
    { id: 'cat_tiles', name: 'Tiles & Ceramics', description: 'Unpolished, polished, rustic, wall & bath tiles' },
    { id: 'cat_doors', name: 'Doors', description: 'Metal security doors' },
    { id: 'cat_steel', name: 'Iron Rods', description: '3/8, 10mm, 12mm, 14mm & 16mm steel rods' },
    { id: 'cat_paint', name: 'Paints', description: 'Home Charm, water paint & oil paint' },
    { id: 'cat_tools', name: 'Tools & Equipment', description: 'Shovels, headpans & wheel barrows' },
  ];

  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const makeProduct = (
    idx: number,
    sku: string,
    name: string,
    categoryId: string,
    sellingPrice: number,
    quantity: number,
    minStockLevel: number,
    description?: string,
  ): Product => ({
    id: `prod_${idx}`,
    sku,
    name,
    categoryId,
    categoryName: catMap.get(categoryId) ?? 'General',
    description,
    costPrice: roundCurrency(sellingPrice * 0.82),
    sellingPrice: roundCurrency(sellingPrice),
    quantity,
    minStockLevel,
    dateAdded: daysAgoIso(30),
    updatedAt: nowIso,
  });

  const products: Product[] = [
    makeProduct(1, 'TSC-CM-001', 'Super Rapid Cement', 'cat_cement', 94.0, 120, 30),
    makeProduct(2, 'TSC-CM-002', 'Unicem Cement', 'cat_cement', 84.0, 140, 30),
    makeProduct(3, 'TSC-RF-001', 'One Star (Roofing Sheet)', 'cat_roofing', 900.0, 24, 6),
    makeProduct(4, 'TSC-RF-002', 'Westhill Medium (Roofing Sheet)', 'cat_roofing', 1100.0, 18, 6),
    makeProduct(5, 'TSC-RF-003', 'Westhill Heavy (Roofing Sheet)', 'cat_roofing', 1300.0, 15, 5),
    makeProduct(6, 'TSC-WD-001', 'Ply wood', 'cat_roofing', 115.0, 45, 10),
    makeProduct(7, 'TSC-TL-001', 'Unpolished Ash 40x40', 'cat_tiles', 110.0, 60, 15),
    makeProduct(8, 'TSC-TL-002', 'Unpolished Pink 40x40', 'cat_tiles', 110.0, 42, 15),
    makeProduct(9, 'TSC-TL-003', 'Unpolished Yellow 40x40', 'cat_tiles', 110.0, 38, 15),
    makeProduct(10, 'TSC-TL-004', 'Unpolished Black 40x40', 'cat_tiles', 110.0, 44, 15),
    makeProduct(11, 'TSC-TL-005', 'Unpolished White 40x40', 'cat_tiles', 115.0, 50, 15),
    makeProduct(12, 'TSC-TL-006', 'Wall Tile', 'cat_tiles', 90.0, 75, 20),
    makeProduct(13, 'TSC-TL-007', 'Bath 30x30', 'cat_tiles', 120.0, 48, 15),
    makeProduct(14, 'TSC-TL-008', 'Rustic 40x40', 'cat_tiles', 125.0, 36, 12),
    makeProduct(15, 'TSC-TL-009', 'Polished 40x40', 'cat_tiles', 130.0, 52, 15),
    makeProduct(16, 'TSC-TL-010', 'Polished 60x60', 'cat_tiles', 150.0, 40, 12),
    makeProduct(17, 'TSC-DR-001', 'Metal Door Single', 'cat_doors', 2500.0, 8, 3),
    makeProduct(18, 'TSC-DR-002', 'Metal Door One & Half', 'cat_doors', 2900.0, 5, 3),
    makeProduct(19, 'TSC-PN-001', 'Home Charm 10L', 'cat_paint', 280.0, 26, 8),
    makeProduct(20, 'TSC-PN-002', 'Home Charm 20L', 'cat_paint', 430.0, 20, 6),
    makeProduct(21, 'TSC-IR-001', '3/8 Iron Rod', 'cat_steel', 30.0, 160, 40, '3/8 @ iron rod'),
    makeProduct(22, 'TSC-IR-002', '10mm Iron Rod', 'cat_steel', 40.0, 140, 35, '10mm @ iron rod'),
    makeProduct(23, 'TSC-IR-003', '12mm Iron Rod', 'cat_steel', 64.0, 110, 30, '12mm @ iron rod'),
    makeProduct(24, 'TSC-IR-004', '14mm Iron Rod', 'cat_steel', 83.0, 85, 25, '14mm @ iron rod'),
    makeProduct(25, 'TSC-IR-005', '16mm Iron Rod', 'cat_steel', 113.0, 70, 20, '16mm @ iron rod'),
    makeProduct(26, 'TSC-PN-003', 'Water Paint Gallon', 'cat_paint', 100.0, 34, 10),
    makeProduct(27, 'TSC-PN-004', 'Water Paint Bucket', 'cat_paint', 200.0, 25, 8),
    makeProduct(28, 'TSC-PN-005', 'Oil Paint', 'cat_paint', 200.0, 22, 8),
    makeProduct(29, 'TSC-TL-011', 'Shovel', 'cat_tools', 70.0, 30, 10),
    makeProduct(30, 'TSC-TL-012', 'Headpan', 'cat_tools', 70.0, 35, 10),
    makeProduct(31, 'TSC-TL-013', 'Wheel Barrow', 'cat_tools', 700.0, 10, 4),
  ];

  const makeSale = (
    idx: number,
    createdAt: string,
    cashier: User,
    paymentMethod: Sale['paymentMethod'],
    lineDefs: Array<{ product: Product; qty: number }>,
    discountAmount = 0,
    customerName?: string,
    customerPhone?: string,
  ): Sale => {
    const dt = new Date(createdAt);
    const yStr = dt.getFullYear();
    const mStr = String(dt.getMonth() + 1).padStart(2, '0');
    const dStr = String(dt.getDate()).padStart(2, '0');
    const receiptNumber = `TSC-${yStr}${mStr}${dStr}-${String(idx).padStart(4, '0')}`;

    const items = lineDefs.map((ld, i) => ({
      id: `seed_sitem_${idx}_${i}`,
      productId: ld.product.id,
      productName: ld.product.name,
      sku: ld.product.sku,
      quantity: ld.qty,
      unitPrice: ld.product.sellingPrice,
      costPrice: ld.product.costPrice,
      lineTotal: roundCurrency(ld.product.sellingPrice * ld.qty),
    }));
    const subtotal = roundCurrency(items.reduce((s, it) => s + it.lineTotal, 0));
    const totalAmount = roundCurrency(Math.max(0, subtotal - discountAmount));
    return {
      id: `seed_sale_${idx}`,
      receiptNumber,
      cashierId: cashier.id,
      cashierName: cashier.name,
      customerName,
      customerPhone,
      items,
      subtotal,
      discountAmount,
      totalAmount,
      amountPaid: totalAmount,
      changeGiven: 0,
      balanceDue: 0,
      paymentMethod,
      createdAt,
    };
  };

  const sales: Sale[] = [
    makeSale(
      1,
      daysAgoIso(0, 9, 15),
      users[1],
      'Mobile Money',
      [
        { product: products[0], qty: 10 }, // Super Rapid Cement
        { product: products[28], qty: 2 }, // Shovel
      ],
      0,
      'Kofi Appiah',
      '024 412 8890',
    ),
    makeSale(
      2,
      daysAgoIso(0, 10, 5),
      users[0],
      'Bank Transfer',
      [
        { product: products[16], qty: 1 }, // Metal Door Single
        { product: products[19], qty: 2 }, // Home Charm 20L
      ],
      0,
      'Manna Builders Ltd',
      '030 278 4412',
    ),
    makeSale(
      3,
      daysAgoIso(3, 14, 20),
      users[1],
      'Cash',
      [
        { product: products[1], qty: 20 }, // Unicem Cement
        { product: products[22], qty: 15 }, // 12mm Iron Rod
      ],
      0,
      'Sarpong Estates',
    ),
    makeSale(
      4,
      daysAgoIso(8, 11, 45),
      users[2],
      'Mobile Money',
      [
        { product: products[3], qty: 3 }, // Westhill Medium
        { product: products[5], qty: 8 }, // Ply wood
      ],
    ),
    makeSale(
      5,
      daysAgoIso(14, 16, 10),
      users[0],
      'Bank Transfer',
      [
        { product: products[15], qty: 18 }, // Polished 60x60
        { product: products[11], qty: 12 }, // Wall Tile
      ],
    ),
    makeSale(
      6,
      daysAgoIso(21, 13, 30),
      users[1],
      'Cash',
      [
        { product: products[30], qty: 2 }, // Wheel Barrow
        { product: products[29], qty: 4 }, // Headpan
      ],
    ),
    makeSale(
      7,
      daysAgoIso(38, 11, 20),
      users[1],
      'Cash',
      [
        { product: products[4], qty: 2 }, // Westhill Heavy
        { product: products[24], qty: 10 }, // 16mm Iron Rod
      ],
    ),
    makeSale(
      8,
      monthOffsetIso(Math.min(m, 3), 14),
      users[1],
      'Mobile Money',
      [
        { product: products[0], qty: 25 },
        { product: products[26], qty: 5 },
      ],
    ),
    makeSale(
      9,
      monthOffsetIso(Math.min(m, 5), 19),
      users[0],
      'Bank Transfer',
      [
        { product: products[17], qty: 2 }, // Metal Door One & Half
        { product: products[14], qty: 12 }, // Polished 40x40
      ],
    ),
  ];

  const expenses = [
    {
      id: 'exp_1',
      name: 'Warehouse Electricity & Generator Fuel',
      category: 'Utilities',
      amount: 1450.0,
      date: daysAgoIso(3).slice(0, 10),
      notes: 'Monthly power & backup diesel refill',
      recordedById: users[0].id,
      recordedByName: users[0].name,
      createdAt: daysAgoIso(3),
    },
    {
      id: 'exp_2',
      name: 'Delivery Truck Dispatch & Fuel',
      category: 'Logistics & Delivery',
      amount: 980.0,
      date: daysAgoIso(8).slice(0, 10),
      notes: 'Wassa Ayiem & surrounding customer site deliveries',
      recordedById: users[0].id,
      recordedByName: users[0].name,
      createdAt: daysAgoIso(8),
    },
    {
      id: 'exp_3',
      name: 'Shopfront Rent — Monthly Allocation',
      category: 'Rent & Facility',
      amount: 3200.0,
      date: daysAgoIso(14).slice(0, 10),
      notes: 'Wassa Ayiem main warehouse & showroom',
      recordedById: users[0].id,
      recordedByName: users[0].name,
      createdAt: daysAgoIso(14),
    },
  ];

  const inventoryTransactions = products.map((prod, idx) => ({
    id: `invtx_seed_${idx + 1}`,
    productId: prod.id,
    productName: prod.name,
    sku: prod.sku,
    type: 'initial' as const,
    quantityChange: prod.quantity,
    previousQty: 0,
    newQty: prod.quantity,
    note: 'Opening stock catalog loaded',
    userId: users[0].id,
    userName: users[0].name,
    createdAt: daysAgoIso(1),
  }));

  return {
    version: 2,
    users,
    passwordResetTokens: [],
    categories,
    products,
    inventoryTransactions,
    sales,
    expenses,
    settings: {
      companyName: 'TAHASCO STAR COMPANY',
      tagline: 'Building Materials, Roofing, Tiles & Hardware Supply',
      phone: '0551716020 / 05425555272 / 0543066537',
      email: 'tahascostar@gmail.com',
      address: 'Wassa Ayiem',
      currency: 'GHS',
      receiptFooter:
        'Thank you for doing business with TAHASCO STAR COMPANY. Goods sold in good condition are not returnable after 7 days.',
      defaultLowStockThreshold: 10,
    },
    notifications: [
      {
        id: 'notif_seed_1',
        type: 'system',
        title: 'Inventory Catalog Updated',
        message: '31 building material, tile, roofing, paint, iron rod, door, and tool items loaded.',
        createdAt: nowIso,
        read: false,
        targetSection: 'inventory',
      },
    ],
  };
}
