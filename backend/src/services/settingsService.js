const db = require('../db');

function getSetting(key, defaultValue = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

function isApprovalRequired() {
  return getSetting('require_approval', 'true') !== 'false';
}

module.exports = { getSetting, isApprovalRequired };
