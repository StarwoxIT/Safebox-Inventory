const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAction } = require('../services/auditService');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  categories.forEach((c) => {
    c.subcategories = db
      .prepare('SELECT * FROM subcategories WHERE category_id = ? ORDER BY name')
      .all(c.id);
  });
  res.json(categories);
});

router.post('/', authenticate, authorize('super_admin'), (req, res) => {
  const { name, subcategories } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required.' });
  }
  const id = uuid();
  db.prepare('INSERT INTO categories (id, name) VALUES (?, ?)').run(id, name);
  const insertSub = db.prepare('INSERT INTO subcategories (id, category_id, name) VALUES (?, ?, ?)');
  (subcategories || []).forEach((sub) => insertSub.run(uuid(), id, sub));
  logAction({ user: req.user, action: 'category.create', entityType: 'category', entityId: id, details: { name } });
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
});

router.put('/:id', authenticate, authorize('super_admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Category not found.' });
  }
  const { name, subcategories } = req.body;
  if (name) {
    db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, req.params.id);
  }
  if (subcategories) {
    db.prepare('DELETE FROM subcategories WHERE category_id = ?').run(req.params.id);
    const insertSub = db.prepare('INSERT INTO subcategories (id, category_id, name) VALUES (?, ?, ?)');
    subcategories.forEach((sub) => insertSub.run(uuid(), req.params.id, sub));
  }
  logAction({ user: req.user, action: 'category.update', entityType: 'category', entityId: req.params.id });
  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  updated.subcategories = db.prepare('SELECT * FROM subcategories WHERE category_id = ? ORDER BY name').all(req.params.id);
  res.json(updated);
});

router.delete('/:id', authenticate, authorize('super_admin'), (req, res) => {
  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Category not found.' });
  }
  logAction({ user: req.user, action: 'category.delete', entityType: 'category', entityId: req.params.id });
  res.status(204).send();
});

module.exports = router;
