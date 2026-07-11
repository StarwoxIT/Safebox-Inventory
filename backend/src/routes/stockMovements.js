const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAction } = require('../services/auditService');
const { nextId } = require('../services/idService');
const { isApprovalRequired } = require('../services/settingsService');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const movements = db
    .prepare(
      `SELECT m.*, u.name AS recorded_by_name, p.model AS product_name, p.category, p.unit
       FROM stock_movements m
       LEFT JOIN users u ON u.id = m.recorded_by
       LEFT JOIN products p ON p.id = m.product_id
       ORDER BY m.date DESC, m.created_at DESC`
    )
    .all();
  res.json(movements);
});

router.post('/', authenticate, (req, res) => {
  const { date, product_id, movement_type, quantity, condition, source, notes } = req.body;
  if (!product_id || !quantity || !movement_type) {
    return res.status(400).json({ error: 'product_id, movement_type and quantity are required.' });
  }
  const id = nextId('MV', 'stock_movements');
  const autoApprove = req.user.role === 'super_admin' || !isApprovalRequired();
  const status = autoApprove ? 'Approved' : 'Pending';
  const approvedBy = autoApprove ? req.user.id : null;
  const approvedAt = autoApprove ? new Date().toISOString() : null;
  db.prepare(
    `INSERT INTO stock_movements (id, date, product_id, movement_type, quantity, condition, source, recorded_by, status, approved_by, approved_at, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    date || new Date().toISOString().slice(0, 10),
    product_id,
    movement_type,
    quantity,
    condition || 'New',
    source || null,
    req.user.id,
    status,
    approvedBy,
    approvedAt,
    notes || null
  );
  logAction({
    user: req.user,
    action: 'stock_movement.create',
    entityType: 'stock_movement',
    entityId: id,
    details: { movement_type, quantity, product_id, status },
  });
  res.status(201).json(db.prepare('SELECT * FROM stock_movements WHERE id = ?').get(id));
});

router.post('/:id/approve', authenticate, authorize('super_admin'), (req, res) => {
  const { decision } = req.body;
  if (!['Approved', 'Rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be Approved or Rejected.' });
  }
  const existing = db.prepare('SELECT * FROM stock_movements WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Stock movement not found.' });
  }
  db.prepare(
    "UPDATE stock_movements SET status = ?, approved_by = ?, approved_at = datetime('now') WHERE id = ?"
  ).run(decision, req.user.id, req.params.id);
  logAction({
    user: req.user,
    action: `stock_movement.${decision.toLowerCase()}`,
    entityType: 'stock_movement',
    entityId: req.params.id,
  });
  res.json(db.prepare('SELECT * FROM stock_movements WHERE id = ?').get(req.params.id));
});

router.delete('/:id', authenticate, authorize('super_admin'), (req, res) => {
  const result = db.prepare('DELETE FROM stock_movements WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Stock movement not found.' });
  }
  logAction({ user: req.user, action: 'stock_movement.delete', entityType: 'stock_movement', entityId: req.params.id });
  res.status(204).send();
});

module.exports = router;
