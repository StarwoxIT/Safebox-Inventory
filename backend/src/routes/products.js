const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAction } = require('../services/auditService');
const { nextId } = require('../services/idService');
const { isApprovalRequired } = require('../services/settingsService');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY category, model').all();
  res.json(products);
});

router.get('/stock', authenticate, (req, res) => {
  const IN_TYPES = "'Purchase (IN)','Return (IN)','Transfer IN','Client Return to Stock','Project Return to Stock'";
  const OUT_TYPES = "'Used in Project (OUT)','Sale (OUT)','Transfer OUT','Damaged/Written Off','Adjustment'";
  const stock = db
    .prepare(
      `SELECT p.id, p.model, p.category, p.unit, p.min_threshold, p.max_threshold, p.unit_cost, p.status,
        COALESCE((SELECT SUM(quantity) FROM stock_movements WHERE product_id = p.id AND movement_type IN (${IN_TYPES}) AND status = 'Approved'), 0)
        - COALESCE((SELECT SUM(quantity) FROM stock_movements WHERE product_id = p.id AND movement_type IN (${OUT_TYPES}) AND status = 'Approved'), 0)
        + COALESCE((SELECT SUM(quantity) FROM returns WHERE product_id = p.id AND (return_type = 'Project Return' OR reconciled = 1)), 0)
        AS current_stock
       FROM products p WHERE p.status = 'Approved'`
    )
    .all();
  res.json(stock);
});

router.post('/', authenticate, authorize('admin', 'super_admin'), (req, res) => {
  const { category, subcategory, brand, model, unit, min_threshold, max_threshold, unit_cost, notes } = req.body;
  if (!model || !category) {
    return res.status(400).json({ error: 'category and model are required.' });
  }
  const id = nextId('PRD', 'products');
  const autoApprove = req.user.role === 'super_admin' || !isApprovalRequired();
  const status = autoApprove ? 'Approved' : 'Pending';
  const approvedBy = autoApprove ? req.user.id : null;
  const approvedAt = autoApprove ? new Date().toISOString() : null;
  db.prepare(
    `INSERT INTO products (id, category, subcategory, brand, model, unit, min_threshold, max_threshold, unit_cost, status, created_by, approved_by, approved_at, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    category,
    subcategory || null,
    brand || null,
    model,
    unit || 'Unit',
    min_threshold || 0,
    max_threshold || 100,
    unit_cost || 0,
    status,
    req.user.id,
    approvedBy,
    approvedAt,
    notes || null
  );
  logAction({ user: req.user, action: 'product.create', entityType: 'product', entityId: id, details: { model, status } });
  res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
});

router.put('/:id', authenticate, authorize('admin', 'super_admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Product not found.' });
  }
  const { category, subcategory, brand, model, unit, min_threshold, max_threshold, unit_cost, notes } = req.body;
  db.prepare(
    `UPDATE products SET category = ?, subcategory = ?, brand = ?, model = ?, unit = ?, min_threshold = ?, max_threshold = ?, unit_cost = ?, notes = ?
     WHERE id = ?`
  ).run(
    category ?? existing.category,
    subcategory ?? existing.subcategory,
    brand ?? existing.brand,
    model ?? existing.model,
    unit ?? existing.unit,
    min_threshold ?? existing.min_threshold,
    max_threshold ?? existing.max_threshold,
    unit_cost ?? existing.unit_cost,
    notes ?? existing.notes,
    req.params.id
  );
  logAction({ user: req.user, action: 'product.update', entityType: 'product', entityId: req.params.id });
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
});

router.post('/:id/approve', authenticate, authorize('super_admin'), (req, res) => {
  const { decision } = req.body;
  if (!['Approved', 'Rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be Approved or Rejected.' });
  }
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Product not found.' });
  }
  db.prepare(
    "UPDATE products SET status = ?, approved_by = ?, approved_at = datetime('now') WHERE id = ?"
  ).run(decision, req.user.id, req.params.id);
  logAction({
    user: req.user,
    action: `product.${decision.toLowerCase()}`,
    entityType: 'product',
    entityId: req.params.id,
    details: { model: existing.model },
  });
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
});

router.delete('/:id', authenticate, authorize('super_admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Product not found.' });
  }
  logAction({
    user: req.user,
    action: 'product.delete',
    entityType: 'product',
    entityId: req.params.id,
    details: { model: existing?.model },
  });
  res.status(204).send();
});

module.exports = router;
