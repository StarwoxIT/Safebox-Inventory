const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAction } = require('../services/auditService');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  res.json(db.prepare('SELECT * FROM units ORDER BY name').all());
});

router.post('/', authenticate, authorize('super_admin'), (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required.' });
  }
  const id = uuid();
  try {
    db.prepare('INSERT INTO units (id, name) VALUES (?, ?)').run(id, name);
  } catch (err) {
    return res.status(400).json({ error: 'A unit with that name already exists.' });
  }
  logAction({ user: req.user, action: 'unit.create', entityType: 'unit', entityId: id, details: { name } });
  res.status(201).json(db.prepare('SELECT * FROM units WHERE id = ?').get(id));
});

router.delete('/:id', authenticate, authorize('super_admin'), (req, res) => {
  const result = db.prepare('DELETE FROM units WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Unit not found.' });
  }
  logAction({ user: req.user, action: 'unit.delete', entityType: 'unit', entityId: req.params.id });
  res.status(204).send();
});

module.exports = router;
