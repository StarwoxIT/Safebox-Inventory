function columnExists(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((col) => col.name === column);
}

function addColumnIfMissing(db, table, column, definition) {
  if (!columnExists(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function renameColumnIfNeeded(db, table, from, to) {
  if (columnExists(db, table, from) && !columnExists(db, table, to)) {
    db.exec(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to}`);
  }
}

// Add future incremental schema changes here. Keep these additive/renaming only
// (safe to run on every boot, including against a reused pre-unification database)
// — changes that alter a CHECK constraint or require remapping existing data
// (e.g. the old inventory schema's users.role/projects.status enums) belong in
// scripts/migrate-schema-in-place.js instead, since those need a full table
// rebuild and must be run deliberately, not silently on every startup.
function runMigrations(db) {
  // stock_movements.condition was added after the original standalone inventory
  // schema — backfill it on a reused pre-unification database.
  addColumnIfMissing(db, 'stock_movements', 'condition', "TEXT NOT NULL DEFAULT 'New'");

  // audit_log columns were renamed when the schema unified.
  renameColumnIfNeeded(db, 'audit_log', 'timestamp', 'created_at');
  renameColumnIfNeeded(db, 'audit_log', 'detail', 'details');
}

module.exports = { runMigrations };
