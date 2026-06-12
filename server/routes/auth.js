const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { auth, superAdmin } = require('../middleware/auth');
const audit = require('../middleware/audit');

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim());
  if (!user || user.status === 'Invited') return res.status(401).json({ error: 'Account not found or not yet activated' });
  if (user.status === 'Inactive') return res.status(401).json({ error: 'Account is inactive' });

  const valid = bcrypt.compareSync(password, user.password_hash || '');
  if (!valid) return res.status(401).json({ error: 'Incorrect password' });

  db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id);
  audit(user.id, user.name, 'Sign in', 'user', user.id, `${user.name} signed in`, req.ip);

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
  const { password_hash, invite_token, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

router.post('/invite', auth, superAdmin, (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email || !role) return res.status(400).json({ error: 'Name, email and role required' });

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) return res.status(409).json({ error: 'Email already exists' });

  const id = 'USR-' + String(db.prepare('SELECT COUNT(*) as c FROM users').get().c + 1).padStart(3, '0');
  const token = uuidv4();
  db.prepare('INSERT INTO users (id,name,email,role,status,invited,invite_token,created_at) VALUES (?,?,?,?,?,?,?,datetime(\'now\'))').run(id, name, email, role, 'Invited', 1, token);
  audit(req.user.id, req.user.name, 'User invited', 'user', id, `${name} (${email}) invited as ${role}`, req.ip);

  res.json({ success: true, message: `Invitation created for ${email}`, inviteToken: token, userId: id });
});

router.post('/accept-invite', (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const user = db.prepare('SELECT * FROM users WHERE invite_token = ? AND status = ?').get(token, 'Invited');
  if (!user) return res.status(404).json({ error: 'Invalid or expired invite token' });

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash=?,status=?,invited=0,invite_token=NULL WHERE id=?').run(hash, 'Active', user.id);
  audit(user.id, user.name, 'Invite accepted', 'user', user.id, `${user.name} activated their account`, req.ip);

  res.json({ success: true, message: 'Account activated. You can now sign in.' });
});

router.get('/me', auth, (req, res) => {
  const { password_hash, invite_token, ...user } = req.user;
  res.json(user);
});

router.post('/logout', auth, (req, res) => {
  audit(req.user.id, req.user.name, 'Sign out', 'user', req.user.id, `${req.user.name} signed out`, req.ip);
  res.json({ success: true });
});

router.post('/create-user', auth, superAdmin, (req, res) => {
  const { name, email, role, password } = req.body;
  if (!name || !email || !role || !password) return res.status(400).json({ error: 'Name, email, role and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) return res.status(409).json({ error: 'Email already exists' });
  const id = 'USR-' + String(db.prepare('SELECT COUNT(*) as c FROM users').get().c + 1).padStart(3, '0');
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(`INSERT INTO users (id,name,email,password_hash,role,status,invited,created_at) VALUES (?,?,?,?,?,?,0,datetime('now'))`).run(id, name, email, hash, role, 'Active');
  audit(req.user.id, req.user.name, 'User created', 'user', id, `${name} (${email}) created as ${role}`, req.ip);
  res.status(201).json({ success: true, id, message: `User ${name} created successfully` });
});

router.put('/change-password', auth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password_hash || '')) return res.status(401).json({ error: 'Current password is incorrect' });
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, req.user.id);
  audit(req.user.id, req.user.name, 'Password changed', 'user', req.user.id, `${req.user.name} changed their password`, req.ip);
  res.json({ success: true, message: 'Password changed successfully' });
});

module.exports = router;
