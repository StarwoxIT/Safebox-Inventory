const db = require('../db');

// Generates human-friendly sequential IDs like PRD-001, MV-014 (used for inventory-domain records).
function nextId(prefix, table, column = 'id') {
  const row = db
    .prepare(`SELECT ${column} FROM ${table} WHERE ${column} LIKE ? ORDER BY ${column} DESC LIMIT 1`)
    .get(`${prefix}-%`);
  if (!row) return `${prefix}-001`;
  const n = parseInt(row[column].replace(`${prefix}-`, ''), 10) + 1;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

module.exports = { nextId };
