const STATUS_MAP = {
  Planning: 'prospect',
  Active: 'on_going',
  'On Hold': 'on_hold',
  Completed: 'completed',
  Cancelled: 'cancelled',
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
      department TEXT CHECK (department IN ('finance', 'engineering')),
      status TEXT NOT NULL CHECK (status IN ('Active', 'Inactive')) DEFAULT 'Active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (
        (role = 'super_admin' AND department IS NULL) OR
        (role = 'admin' AND department IS NOT NULL AND department IN ('finance', 'engineering'))
      )
    )`);
    const insert = db.prepare(
      'INSERT INTO users_new (id, name, email, password_hash, role, department, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    rows.forEach((u) => {
      const role = u.role === 'Super Admin' ? 'super_admin' : 'admin';
      const department = role === 'super_admin'
        ? null
        : (['finance', 'engineering'].includes(u.department) ? u.department : 'finance');
      const status = u.status === 'Inactive' ? 'Inactive' : 'Active';
      insert.run(u.id, u.name, u.email, u.password_hash, role, department, status, u.created_at);
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
        status IN ('prospect', 'quote_accepted', 'on_going', 'active_eaas', 'on_hold', 'completed', 'rejected', 'cancelled')
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

function migrateProjectSchema(db) {
  const tableSql = getTableSql(db, 'projects');
  if (
    tableSql.includes('project_ref TEXT UNIQUE NOT NULL') &&
    tableSql.includes("'cancelled'") &&
    tableSql.includes("'Healthcare'") &&
    tableSql.includes("'Agriculture'") &&
    tableSql.includes("'greenband_eaas'") &&
    tableSql.includes("'one_time_payment'")
  ) return;

  const rows = db.prepare('SELECT * FROM projects ORDER BY created_at, id').all();
  const columns = new Set(db.prepare('PRAGMA table_info(projects)').all().map((column) => column.name));
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.exec(`CREATE TABLE projects_new (
        id TEXT PRIMARY KEY,
        project_ref TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        client_name TEXT,
        client_address TEXT,
        client_contact TEXT,
        description TEXT,
        status TEXT NOT NULL CHECK (
          status IN ('prospect', 'quote_accepted', 'on_going', 'active_eaas', 'on_hold', 'completed', 'rejected', 'not_started', 'in_progress', 'cancelled')
        ) DEFAULT 'not_started',
        business_model TEXT CHECK (
          business_model IN ('outright_purchase', 'eaas', 'repair_service', 'maintenance_service', 'upgrade', 'direct_purchase', 'greenband_eaas', 'upgrade_expansion', 'installation_only', 'maintenance_repair', 'other')
        ),
        sector TEXT CHECK (
          sector IN (
            'Residential', 'Commercial', 'Industrial', 'Agricultural', 'Telecom', 'Street Lighting',
            'Other', 'Residential / Home', 'Commercial / Business', 'Healthcare', 'Education',
            'Agriculture', 'Industrial / Manufacturing', 'Government', 'Religious Organisation'
          )
        ),
        payment_category TEXT CHECK (
          payment_category IN ('full_payment', 'installments', 'pay_as_you_go', 'one_time_payment', 'instalment_payments', 'other')
        ),
        manager TEXT,
        system_size_kwp REAL NOT NULL DEFAULT 0,
        start_date TEXT,
        end_date TEXT,
        notes TEXT,
        created_by TEXT REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deletion_requested_by TEXT REFERENCES users(id),
        deletion_requested_at TEXT
      )`);
      let nextReference = rows.reduce((largest, project) => {
        const match = (columns.has('project_ref') ? project.project_ref : '')?.match(/^PRJ-(\d+)$/);
        return match ? Math.max(largest, Number(match[1])) : largest;
      }, 0);
      const references = new Set();
      const insert = db.prepare(`INSERT INTO projects_new (
        id, project_ref, name, client_name, client_address, client_contact, description, status,
        business_model, sector, payment_category, manager, system_size_kwp, start_date, end_date,
        notes, created_by, created_at, updated_at, deletion_requested_by, deletion_requested_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      rows.forEach((project) => {
        let projectRef = columns.has('project_ref') ? project.project_ref : null;
        if (!projectRef || references.has(projectRef)) {
          do {
            nextReference += 1;
            projectRef = `PRJ-${String(nextReference).padStart(3, '0')}`;
          } while (references.has(projectRef));
        }
        references.add(projectRef);
        insert.run(
          project.id,
          projectRef,
          project.name,
          columns.has('client_name') ? project.client_name : (project.client || null),
          columns.has('client_address') ? project.client_address : null,
          columns.has('client_contact') ? project.client_contact : null,
          project.description || null,
          STATUS_MAP[project.status] || project.status || 'not_started',
          project.business_model || null,
          columns.has('sector') ? project.sector : null,
          project.payment_category || null,
          project.manager || null,
          project.system_size_kwp || 0,
          project.start_date || null,
          project.end_date || null,
          project.notes || null,
          project.created_by || null,
          project.created_at || new Date().toISOString(),
          project.updated_at || project.created_at || new Date().toISOString(),
          columns.has('deletion_requested_by') ? project.deletion_requested_by : null,
          columns.has('deletion_requested_at') ? project.deletion_requested_at : null
        );
      });
      db.exec('DROP TABLE projects');
      db.exec('ALTER TABLE projects_new RENAME TO projects');
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
  console.log(`[migration] projects table upgraded with project references and confirmed-project fields (${rows.length} rows kept).`);
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
  addColumnIfMissing(db, 'users', 'department', "TEXT CHECK (department IN ('finance', 'engineering'))");
  db.prepare(
    `UPDATE users
     SET department = CASE
       WHEN role = 'super_admin' THEN NULL
       WHEN department IN ('finance', 'engineering') THEN department
       ELSE 'finance'
     END`
  ).run();
  if (isOldProjectsShape(db)) {
    console.log('[migration] Detected old projects schema — migrating...');
    migrateProjects(db);
  }

  // Admin-initiated / super-admin-approved project deletion — added after the original schema.
  addColumnIfMissing(db, 'projects', 'deletion_requested_by', 'TEXT REFERENCES users(id)');
  addColumnIfMissing(db, 'projects', 'deletion_requested_at', 'TEXT');
  migrateProjectSchema(db);
}

module.exports = { runMigrations };
