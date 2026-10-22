const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { JWT_SECRET, authenticate, authorize } = require('../middleware/auth');
const { logAction } = require('../services/auditService');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

router.post('/register', authenticate, authorize('super_admin'), (req, res) => {
  const { name, email, password, role, department } = req.body;
  const assignedRole = role || 'admin';

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required.' });
  }
  if (!['admin', 'super_admin'].includes(assignedRole)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }
  if ((assignedRole === 'admin' && !['finance', 'engineering'].includes(department)) ||
      (assignedRole === 'super_admin' && department)) {
    return res.status(400).json({ error: 'Admins must be assigned to Finance or Engineering; Super Admins have no department.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'A user with this email already exists.' });
  }

  const id = uuid();
  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare(
    'INSERT INTO users (id, name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, name, email, passwordHash, assignedRole, assignedRole === 'admin' ? department : null);

  const user = { id, name, email, role: assignedRole, department: assignedRole === 'admin' ? department : null };
  logAction({
    user: req.user,
    action: 'user.create',
    entityType: 'user',
    entityId: id,
    details: { name, email, role: user.role, department: user.department },
  });
  res.status(201).json({ user, token: signToken(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required.' });
  }

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (row.status === 'Inactive') {
    return res.status(401).json({ error: 'This account has been deactivated.' });
  }

  const user = { id: row.id, name: row.name, email: row.email, role: row.role, department: row.department };
  logAction({ user, action: 'auth.login', entityType: 'user', entityId: user.id });
  res.json({ user, token: signToken(user) });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

router.put('/change-password', authenticate, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password and new_password are required.' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, row.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  const passwordHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, req.user.id);
  logAction({ user: req.user, action: 'user.change_password', entityType: 'user', entityId: req.user.id });
  res.json({ success: true });
});

module.exports = router;
