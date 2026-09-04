const db = require('../db');

// Movement types that increase vs. decrease stock — same split used to compute current_stock
// elsewhere (see products.js GET /stock), reused here so a report row shows a quantity in
// exactly one of the IN/OUT columns instead of a signed +/- number.
const IN_TYPES = ['Purchase (IN)', 'Return (IN)', 'Transfer IN', 'Client Return to Stock', 'Project Return to Stock'];
const OUT_TYPES = ['Used in Project (OUT)', 'Sale (OUT)', 'Transfer OUT', 'Damaged/Written Off', 'Adjustment'];

function getStockMovementReport({ from, to, category, subcategory } = {}) {
  const rows = db
    .prepare(
      `SELECT sm.id, sm.date, sm.movement_type, sm.quantity, sm.condition, sm.source, sm.status, sm.notes,
              p.id AS product_id, p.brand, p.model, p.category, p.subcategory, p.unit,
              u.name AS recorded_by_name
       FROM stock_movements sm
       LEFT JOIN products p ON p.id = sm.product_id
       LEFT JOIN users u ON u.id = sm.recorded_by
       WHERE (? IS NULL OR sm.date >= ?) AND (? IS NULL OR sm.date <= ?)
         AND (? IS NULL OR p.category = ?)
         AND (? IS NULL OR p.subcategory = ?)
       ORDER BY sm.date ASC, sm.created_at ASC`
    )
    .all(
      from || null, from || null,
      to || null, to || null,
      category || null, category || null,
      subcategory || null, subcategory || null
    );

  const items = rows.map((r) => ({
    id: r.id,
    date: r.date,
    productId: r.product_id,
    productName: [r.brand, r.model].filter(Boolean).join(' ') || '(deleted product)',
    category: r.category,
    subcategory: r.subcategory,
    unit: r.unit,
    movementType: r.movement_type,
    inQty: IN_TYPES.includes(r.movement_type) ? r.quantity : 0,
    outQty: OUT_TYPES.includes(r.movement_type) ? r.quantity : 0,
    condition: r.condition,
    status: r.status,
    source: r.source,
    notes: r.notes,
    recordedBy: r.recorded_by_name,
  }));

  const totals = items.reduce(
    (acc, i) => {
      acc.totalIn += i.inQty;
      acc.totalOut += i.outQty;
      return acc;
    },
    { totalIn: 0, totalOut: 0 }
  );

  return { items, totals, category: category || null, subcategory: subcategory || null, from: from || null, to: to || null };
}

function getProductReport({ category, subcategory, from, to } = {}) {
  const products = db
    .prepare(
      `SELECT p.*, u.name AS created_by_name
       FROM products p
       LEFT JOIN users u ON u.id = p.created_by
       WHERE (? IS NULL OR p.category = ?)
         AND (? IS NULL OR p.subcategory = ?)
         AND (? IS NULL OR date(p.created_at) >= ?)
         AND (? IS NULL OR date(p.created_at) <= ?)
       ORDER BY p.category, p.model`
    )
    .all(
      category || null, category || null,
      subcategory || null, subcategory || null,
      from || null, from || null,
      to || null, to || null
    );

  const stockRows = db
    .prepare(
      `SELECT p.id,
        COALESCE((SELECT SUM(quantity) FROM stock_movements WHERE product_id = p.id AND movement_type IN (${IN_TYPES.map(() => '?').join(',')}) AND status = 'Approved'), 0)
        - COALESCE((SELECT SUM(quantity) FROM stock_movements WHERE product_id = p.id AND movement_type IN (${OUT_TYPES.map(() => '?').join(',')}) AND status = 'Approved'), 0)
        + COALESCE((SELECT SUM(quantity) FROM returns WHERE product_id = p.id AND (return_type = 'Project Return' OR reconciled = 1)), 0)
        AS current_stock
       FROM products p`
    )
    .all(...IN_TYPES, ...OUT_TYPES);
  const stockMap = Object.fromEntries(stockRows.map((r) => [r.id, r.current_stock]));

  const items = products.map((p) => ({
    id: p.id,
    category: p.category,
    subcategory: p.subcategory,
    brand: p.brand,
    model: p.model,
    unit: p.unit,
    unitCost: p.unit_cost,
    minThreshold: p.min_threshold,
    maxThreshold: p.max_threshold,
    currentStock: stockMap[p.id] || 0,
    status: p.status,
    createdBy: p.created_by_name,
    createdAt: p.created_at,
  }));

  return { items, category: category || null, subcategory: subcategory || null, from: from || null, to: to || null };
}

module.exports = { getStockMovementReport, getProductReport };
