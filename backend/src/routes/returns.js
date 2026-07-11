const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAction } = require('../services/auditService');
const { nextId } = require('../services/idService');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const returns = db
    .prepare(
      `SELECT r.*, p.model AS product_name, pr.name AS project_name, u.name AS logged_by_name
       FROM returns r
       LEFT JOIN products p ON p.id = r.product_id
       LEFT JOIN projects pr ON pr.id = r.project_id
       LEFT JOIN users u ON u.id = r.logged_by
       ORDER BY r.date DESC`
    )
    .all();
  res.json(returns);
});

router.post('/', authenticate, (req, res) => {
  const { date, return_type, project_id, product_id, quantity, reason, oem, sent_to_oem_date, oem_response, notes } = req.body;
  if (!product_id || !quantity || !reason) {
    return res.status(400).json({ error: 'product_id, quantity and reason are required.' });
  }
  const id = nextId('RET', 'returns');
  db.prepare(
    `INSERT INTO returns (id, date, return_type, project_id, product_id, quantity, reason, oem, sent_to_oem_date, oem_response, reconciled, notes, logged_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    id,
    date || new Date().toISOString().slice(0, 10),
    return_type || 'Client Return',
    project_id || null,
    product_id,
    quantity,
    reason,
    oem || null,
    sent_to_oem_date || null,
    oem_response || null,
    notes || null,
    req.user.id
  );
  logAction({ user: req.user, action: 'return.create', entityType: 'return', entityId: id, details: { return_type, product_id } });
  res.status(201).json(db.prepare('SELECT * FROM returns WHERE id = ?').get(id));
});

router.put('/:id', authenticate, (req, res) => {
  const existing = db.prepare('SELECT * FROM returns WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Return not found.' });
  }
  const { oem, sent_to_oem_date, oem_response, reconciled, notes } = req.body;
  db.prepare(
    'UPDATE returns SET oem = ?, sent_to_oem_date = ?, oem_response = ?, reconciled = ?, notes = ? WHERE id = ?'
  ).run(
    oem ?? existing.oem,
    sent_to_oem_date ?? existing.sent_to_oem_date,
    oem_response ?? existing.oem_response,
    reconciled !== undefined ? (reconciled ? 1 : 0) : existing.reconciled,
    notes ?? existing.notes,
    req.params.id
  );
  logAction({ user: req.user, action: 'return.update', entityType: 'return', entityId: req.params.id });
  res.json(db.prepare('SELECT * FROM returns WHERE id = ?').get(req.params.id));
});

router.delete('/:id', authenticate, authorize('super_admin'), (req, res) => {
  const result = db.prepare('DELETE FROM returns WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Return not found.' });
  }
  logAction({ user: req.user, action: 'return.delete', entityType: 'return', entityId: req.params.id });
  res.status(204).send();
});

module.exports = router;
