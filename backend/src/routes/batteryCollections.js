const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAction } = require('../services/auditService');
const { nextId } = require('../services/idService');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const rows = db
    .prepare(
      `SELECT bc.*, u.name AS logged_by_name
       FROM battery_collections bc
       LEFT JOIN users u ON u.id = bc.logged_by
       ORDER BY bc.date DESC, bc.created_at DESC`
    )
    .all();
  res.json(rows);
});

router.post('/', authenticate, (req, res) => {
  const { date, battery_type, quantity, collected_from, notes } = req.body;
  if (!battery_type || !quantity || !collected_from) {
    return res.status(400).json({ error: 'battery_type, quantity and collected_from are required.' });
  }
  const id = nextId('BAT', 'battery_collections');
  db.prepare(
    `INSERT INTO battery_collections (id, date, battery_type, quantity, collected_from, notes, logged_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, date || new Date().toISOString().slice(0, 10), battery_type, quantity, collected_from, notes || null, req.user.id);
  logAction({ user: req.user, action: 'battery_collection.create', entityType: 'battery_collection', entityId: id });
  res.status(201).json(db.prepare('SELECT * FROM battery_collections WHERE id = ?').get(id));
});

router.put('/:id', authenticate, authorize('super_admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM battery_collections WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Battery collection not found.' });
  }
  const { date, battery_type, quantity, collected_from, notes } = req.body;
  db.prepare(
    'UPDATE battery_collections SET date = ?, battery_type = ?, quantity = ?, collected_from = ?, notes = ? WHERE id = ?'
  ).run(
    date ?? existing.date,
    battery_type ?? existing.battery_type,
    quantity ?? existing.quantity,
    collected_from ?? existing.collected_from,
    notes ?? existing.notes,
    req.params.id
  );
  logAction({ user: req.user, action: 'battery_collection.update', entityType: 'battery_collection', entityId: req.params.id });
  res.json(db.prepare('SELECT * FROM battery_collections WHERE id = ?').get(req.params.id));
});

router.delete('/:id', authenticate, authorize('super_admin'), (req, res) => {
  const result = db.prepare('DELETE FROM battery_collections WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Battery collection not found.' });
  }
  logAction({ user: req.user, action: 'battery_collection.delete', entityType: 'battery_collection', entityId: req.params.id });
  res.status(204).send();
});

module.exports = router;
