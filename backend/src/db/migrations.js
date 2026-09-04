const STATUS_MAP = {
  Planning: 'prospect',
  Active: 'on_going',
  'On Hold': 'on_going',
  Completed: 'completed',
  Cancelled: 'rejected',
};

const VALID_SECTORS = ['Residential', 'Commercial', 'Industrial', 'Agricultural', 'Telecom', 'Street Lighting', 'Other'];

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

function getTableSql(db, table) {
  return (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table) || {}).sql || '';
}

function isOldUsersShape(db) {
  return getTableSql(db, 'users').includes("'Super Admin'");
}

function isOldProjectsShape(db) {
  return getTableSql(db, 'projects').includes("'Planning'");
}

function migrateUsers(db) {
  const rows = db.prepare('SELECT * FROM users').all().filter((u) => u.password_hash);
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.exec(`CREATE TABLE users_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'super_admin')) DEFAULT 'admin',
      status TEXT NOT NULL CHECK (status IN ('Active', 'Inactive')) DEFAULT 'Active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    const insert = db.prepare(
      'INSERT INTO users_new (id, name, email, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    rows.forEach((u) => {
      const role = u.role === 'Super Admin' ? 'super_admin' : 'admin';
      const status = u.status === 'Inactive' ? 'Inactive' : 'Active';
      insert.run(u.id, u.name, u.email, u.password_hash, role, status, u.created_at);
    });
    db.exec('DROP TABLE users');
    db.exec('ALTER TABLE users_new RENAME TO users');
  })();
  db.pragma('foreign_keys = ON');
  console.log(`[migration] users table upgraded to new schema (${rows.length} rows kept).`);
}

function migrateProjects(db) {
  const rows = db.prepare('SELECT * FROM projects').all();
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.exec(`CREATE TABLE projects_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      client_name TEXT,
      client_address TEXT,
      client_contact TEXT,
      description TEXT,
      status TEXT NOT NULL CHECK (
        status IN ('prospect', 'quote_accepted', 'on_going', 'active_eaas', 'completed', 'rejected')
      ) DEFAULT 'prospect',
      business_model TEXT CHECK (
        business_model IN ('outright_purchase', 'eaas', 'repair_service', 'maintenance_service', 'upgrade')
      ),
      sector TEXT CHECK (
        sector IN ('Residential', 'Commercial', 'Industrial', 'Agricultural', 'Telecom', 'Street Lighting', 'Other')
      ),
      payment_category TEXT CHECK (
        payment_category IN ('full_payment', 'installments', 'pay_as_you_go')
      ),
      manager TEXT,
      system_size_kwp REAL NOT NULL DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    const insert = db.prepare(
      `INSERT INTO projects_new
         (id, name, client_name, status, sector, manager, system_size_kwp, start_date, end_date, notes, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    rows.forEach((p) => {
      const status = STATUS_MAP[p.status] || 'prospect';
      const sector = VALID_SECTORS.includes(p.project_type) ? p.project_type : (p.project_type ? 'Other' : null);
      insert.run(
        p.id, p.name, p.client || null, status, sector,
        p.manager || null, p.system_size_kwp || 0,
        p.start_date || null, p.end_date || null, p.notes || null,
        p.created_by, p.created_at
      );
    });
    db.exec('DROP TABLE projects');
    db.exec('ALTER TABLE projects_new RENAME TO projects');
  })();
  db.pragma('foreign_keys = ON');
  console.log(`[migration] projects table upgraded to new schema (${rows.length} rows migrated).`);
}

// All migrations run on every boot — each check is a no-op if already applied.
function runMigrations(db) {
  // ── Additive / rename migrations (always safe) ──────────────────────────
  addColumnIfMissing(db, 'stock_movements', 'condition', "TEXT NOT NULL DEFAULT 'New'");
  renameColumnIfNeeded(db, 'audit_log', 'timestamp', 'created_at');
  renameColumnIfNeeded(db, 'audit_log', 'detail', 'details');

  // ── Schema-shape migrations (old standalone inventory → unified portal) ──
  // Detects old CHECK constraint values and rebuilds the table if needed.
  // No-op on an already-migrated or freshly-created database. Must run before the
  // additive projects.* columns below — migrateProjects() rebuilds the table from
  // a column list that predates those columns, so adding them first would just
  // have the rebuild silently drop them again.
  if (isOldUsersShape(db)) {
    console.log('[migration] Detected old users schema — migrating...');
    migrateUsers(db);
  }
  if (isOldProjectsShape(db)) {
    console.log('[migration] Detected old projects schema — migrating...');
    migrateProjects(db);
  }

  // Admin-initiated / super-admin-approved project deletion — added after the original schema.
  addColumnIfMissing(db, 'projects', 'deletion_requested_by', 'TEXT REFERENCES users(id)');
  addColumnIfMissing(db, 'projects', 'deletion_requested_at', 'TEXT');
}

module.exports = { runMigrations };
