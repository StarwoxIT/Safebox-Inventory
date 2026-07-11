const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAction } = require('../services/auditService');

const router = express.Router();

router.get('/', authenticate, authorize('super_admin'), (req, res) => {
  const users = db
    .prepare('SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC')
    .all();
  res.json(users);
});

router.put('/:id', authenticate, authorize('super_admin'), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) {
    return res.status(404).json({ error: 'User not found.' });
  }
  const { name, role, status } = req.body;
  if (role && !['admin', 'super_admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }
  if (status && !['Active', 'Inactive'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  if (target.id === req.user.id && (role === 'admin' || status === 'Inactive')) {
    return res.status(400).json({ error: 'You cannot demote or deactivate your own account.' });
  }
  if (target.role === 'super_admin' && (role === 'admin' || status === 'Inactive')) {
    const superAdminCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'super_admin' AND status = 'Active'").get().c;
    if (superAdminCount <= 1) {
      return res.status(400).json({ error: 'Cannot demote or deactivate the last remaining active super admin.' });
    }
  }

  db.prepare('UPDATE users SET name = ?, role = ?, status = ? WHERE id = ?').run(
    name ?? target.name,
    role ?? target.role,
    status ?? target.status,
    req.params.id
  );
  logAction({ user: req.user, action: 'user.update', entityType: 'user', entityId: req.params.id, details: { role, status } });
  res.json(db.prepare('SELECT id, name, email, role, status, created_at FROM users WHERE id = ?').get(req.params.id));
});

router.delete('/:id', authenticate, authorize('super_admin'), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) {
    return res.status(404).json({ error: 'User not found.' });
  }
  if (target.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot remove your own account.' });
  }
  if (target.role === 'super_admin') {
    const superAdminCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'super_admin'").get().c;
    if (superAdminCount <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last remaining super admin.' });
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  logAction({
    user: req.user,
    action: 'user.delete',
    entityType: 'user',
    entityId: target.id,
    details: { name: target.name, email: target.email, role: target.role },
  });
  res.status(204).send();
});

module.exports = router;
