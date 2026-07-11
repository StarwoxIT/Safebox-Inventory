const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAction } = require('../services/auditService');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach((row) => {
    settings[row.key] = row.value;
  });
  res.json(settings);
});

router.put('/', authenticate, authorize('super_admin'), (req, res) => {
  const updates = req.body || {};
  const upsert = db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
  );
  const run = db.transaction((entries) => {
    entries.forEach(([key, value]) => upsert.run(key, String(value)));
  });
  run(Object.entries(updates));
  logAction({ user: req.user, action: 'settings.update', entityType: 'settings', entityId: 'all' });

  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach((row) => {
    settings[row.key] = row.value;
  });
  res.json(settings);
});

module.exports = router;
