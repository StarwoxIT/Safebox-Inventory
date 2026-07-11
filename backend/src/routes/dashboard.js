const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', authenticate, (req, res) => {
  const totalProjects = db.prepare('SELECT COUNT(*) AS c FROM projects').get().c;
  const totalQuotes = db.prepare('SELECT COUNT(*) AS c FROM quotations').get().c;
  const totalRevenueProjection = db
    .prepare("SELECT COALESCE(SUM(grand_total), 0) AS total FROM quotations WHERE status = 'final'")
    .get().total;
  const pendingRevenueProjection = db
    .prepare("SELECT COALESCE(SUM(grand_total), 0) AS total FROM quotations WHERE status = 'draft'")
    .get().total;
  const confirmedIncome = db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM income_records').get().total;
  const selectedQuotesCount = db.prepare('SELECT COUNT(*) AS c FROM quotations WHERE is_selected = 1').get().c;

  const projectsByStatus = db
    .prepare('SELECT status, COUNT(*) AS c FROM projects GROUP BY status')
    .all()
    .reduce((acc, row) => ({ ...acc, [row.status]: row.c }), {});

  const outstandingBalance = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payment_milestones WHERE status = 'pending'")
    .get().total;
  const overduePendingUsage = db
    .prepare("SELECT COALESCE(SUM(amount_due), 0) AS total FROM usage_billing_periods WHERE status = 'pending'")
    .get().total;
  const activeEaasProjects = db.prepare("SELECT COUNT(*) AS c FROM projects WHERE status = 'active_eaas'").get().c;

  const pendingApprovals =
    db.prepare("SELECT COUNT(*) AS c FROM products WHERE status = 'Pending'").get().c +
    db.prepare("SELECT COUNT(*) AS c FROM stock_movements WHERE status = 'Pending'").get().c;

  const IN_TYPES = "'Purchase (IN)','Return (IN)','Transfer IN','Client Return to Stock','Project Return to Stock'";
  const OUT_TYPES = "'Used in Project (OUT)','Sale (OUT)','Transfer OUT','Damaged/Written Off','Adjustment'";
  const stockRows = db
    .prepare(
      `SELECT p.id, p.category, p.unit_cost, p.min_threshold, p.max_threshold,
        COALESCE((SELECT SUM(quantity) FROM stock_movements WHERE product_id = p.id AND movement_type IN (${IN_TYPES}) AND status = 'Approved'), 0)
        - COALESCE((SELECT SUM(quantity) FROM stock_movements WHERE product_id = p.id AND movement_type IN (${OUT_TYPES}) AND status = 'Approved'), 0)
        + COALESCE((SELECT SUM(quantity) FROM returns WHERE product_id = p.id AND (return_type = 'Project Return' OR reconciled = 1)), 0)
        AS current_stock
       FROM products p WHERE p.status = 'Approved'`
    )
    .all();

  const totalStockValue = stockRows.reduce((sum, p) => sum + p.current_stock * p.unit_cost, 0);
  const belowThreshold = stockRows.filter((p) => p.current_stock <= p.min_threshold).length;
  const lowStock = stockRows.filter((p) => p.current_stock > p.min_threshold && p.current_stock <= p.min_threshold * 1.2).length;
  const totalApprovedProducts = stockRows.length;
  const openOemReturns = db.prepare("SELECT COUNT(*) AS c FROM returns WHERE oem IS NOT NULL AND oem != '' AND reconciled = 0").get().c;
  const totalEngineers = db.prepare('SELECT COUNT(*) AS c FROM project_engineers').get().c;

  const categorySummary = {};
  stockRows.forEach((p) => {
    if (!categorySummary[p.category]) {
      categorySummary[p.category] = { count: 0, totalStock: 0, totalValue: 0 };
    }
    categorySummary[p.category].count += 1;
    categorySummary[p.category].totalStock += p.current_stock;
    categorySummary[p.category].totalValue += p.current_stock * p.unit_cost;
  });

  const revenueByMonth = db
    .prepare(
      `SELECT strftime('%Y-%m', created_at) AS month, SUM(grand_total) AS total
       FROM quotations
       GROUP BY month
       ORDER BY month ASC
       LIMIT 12`
    )
    .all();

  const recentActivity = db
    .prepare(
      `SELECT v.id, v.change_type, v.created_at, u.name AS changed_by_name,
              q.option_number, q.title, p.name AS project_name, p.id AS project_id, q.id AS quotation_id
       FROM quotation_versions v
       LEFT JOIN users u ON u.id = v.changed_by
       LEFT JOIN quotations q ON q.id = v.quotation_id
       LEFT JOIN projects p ON p.id = q.project_id
       ORDER BY v.created_at DESC
       LIMIT 15`
    )
    .all();

  res.json({
    totalProjects,
    totalQuotes,
    totalRevenueProjection,
    pendingRevenueProjection,
    confirmedIncome,
    selectedQuotesCount,
    projectsByStatus,
    outstandingBalance,
    overduePendingUsage,
    activeEaasProjects,
    pendingApprovals,
    totalStockValue,
    belowThreshold,
    lowStock,
    totalApprovedProducts,
    openOemReturns,
    totalEngineers,
    categorySummary,
    revenueByMonth,
    recentActivity,
  });
});

module.exports = router;
