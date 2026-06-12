const jwt = require('jsonwebtoken');
const db = require('../db');

const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND status != ?').get(decoded.id, 'Inactive');
    if (!user) return res.status(401).json({ error: 'User not found or inactive' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const superAdmin = (req, res, next) => {
  if (req.user.role !== 'Super Admin') {
    return res.status(403).json({ error: 'Super Admin access required' });
  }
  next();
};

module.exports = { auth, superAdmin };
