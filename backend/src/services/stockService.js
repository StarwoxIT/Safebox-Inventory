const db = require('../db');

const IN_TYPES = ['Purchase (IN)', 'Return (IN)', 'Transfer IN', 'Client Return to Stock', 'Project Return to Stock'];
const OUT_TYPES = ['Used in Project (OUT)', 'Sale (OUT)', 'Transfer OUT', 'Damaged/Written Off', 'Adjustment'];

// Current stock is a runtime aggregate, not a stored column — mirrors the computation in
// GET /products/stock, scoped to a single product for material-use validation.
function getCurrentStock(productId) {
  const inPlaceholders = IN_TYPES.map(() => '?').join(',');
  const outPlaceholders = OUT_TYPES.map(() => '?').join(',');
  const row = db
    .prepare(
      `SELECT
         COALESCE((SELECT SUM(quantity) FROM stock_movements WHERE product_id = ? AND movement_type IN (${inPlaceholders}) AND status = 'Approved'), 0)
         - COALESCE((SELECT SUM(quantity) FROM stock_movements WHERE product_id = ? AND movement_type IN (${outPlaceholders}) AND status = 'Approved'), 0)
         + COALESCE((SELECT SUM(quantity) FROM returns WHERE product_id = ? AND (return_type = 'Project Return' OR reconciled = 1)), 0)
         AS current_stock`
    )
    .get(productId, ...IN_TYPES, productId, ...OUT_TYPES, productId);
  return row.current_stock;
}

module.exports = { getCurrentStock };
