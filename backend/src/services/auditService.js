const { v4: uuid } = require('uuid');
const db = require('../db');

function logAction({ user, action, entityType, entityId, details }) {
  db.prepare(
    `INSERT INTO audit_log (id, user_id, user_name, action, entity_type, entity_id, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuid(),
    user?.id || null,
    user?.name || null,
    action,
    entityType || null,
    entityId || null,
    details ? JSON.stringify(details) : null
  );
}

function listAuditLog({ limit = 50, offset = 0 } = {}) {
  const rows = db
    .prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) AS c FROM audit_log').get().c;
  return {
    total,
    entries: rows.map((row) => ({ ...row, details: row.details ? JSON.parse(row.details) : null })),
  };
}

module.exports = { logAction, listAuditLog };
