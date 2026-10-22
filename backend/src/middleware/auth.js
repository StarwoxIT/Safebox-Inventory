const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication token missing.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const current = db.prepare('SELECT id, name, email, role, department, status FROM users WHERE id = ?').get(payload.id);
    if (!current) {
      return res.status(401).json({ error: 'This account no longer exists. Please sign in again.' });
    }
    if (current.status === 'Inactive') {
      return res.status(401).json({ error: 'This account has been deactivated.' });
    }
    req.user = current;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    next();
  };
}

function authorizeDepartment(...allowedDepartments) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (req.user.role === 'super_admin') return next();
    if (req.user.role !== 'admin' || !allowedDepartments.includes(req.user.department)) {
      return res.status(403).json({ error: 'Your department does not have access to this module.' });
    }
    return next();
  };
}

module.exports = { authenticate, authorize, authorizeDepartment, JWT_SECRET };
