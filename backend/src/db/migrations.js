// eslint-disable-next-line no-unused-vars
function columnExists(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((col) => col.name === column);
}

// eslint-disable-next-line no-unused-vars
function addColumnIfMissing(db, table, column, definition) {
  if (!columnExists(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// eslint-disable-next-line no-unused-vars
function runMigrations(db) {
  // Add future incremental schema changes here with addColumnIfMissing(db, ...).
}

module.exports = { runMigrations };
