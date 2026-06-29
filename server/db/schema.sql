-- SafeBox Energy IMS Database Schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL CHECK(role IN ('Super Admin','Admin')),
  status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive','Invited')),
  invited INTEGER DEFAULT 0,
  invite_token TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subcategories (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE(category_id, name)
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  subcategory TEXT,
  brand TEXT,
  model TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'Unit',
  min_threshold INTEGER NOT NULL DEFAULT 0,
  max_threshold INTEGER NOT NULL DEFAULT 100,
  unit_cost REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected')),
  created_by TEXT REFERENCES users(id),
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id),
  movement_type TEXT NOT NULL,
  quantity REAL NOT NULL,
  source TEXT,
  recorded_by TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected')),
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  client TEXT,
  project_type TEXT,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'Planning' CHECK(status IN ('Planning','Active','Completed','On Hold','Cancelled')),
  manager TEXT,
  system_size_kwp REAL DEFAULT 0,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_materials (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_engineers (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  role TEXT,
  date_assigned TEXT,
  date_completed TEXT,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS returns (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  return_type TEXT NOT NULL CHECK(return_type IN ('Client Return','Project Return')),
  project_id TEXT REFERENCES projects(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL,
  reason TEXT,
  oem TEXT,
  sent_to_oem_date TEXT,
  oem_response TEXT,
  reconciled INTEGER DEFAULT 0,
  notes TEXT,
  logged_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_costs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  item_name TEXT NOT NULL,
  cost REAL NOT NULL DEFAULT 0,
  notes TEXT,
  logged_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS battery_collections (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  battery_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  collected_from TEXT NOT NULL,
  notes TEXT,
  logged_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  timestamp TEXT DEFAULT (datetime('now')),
  user_id TEXT REFERENCES users(id),
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  detail TEXT,
  ip_address TEXT
);
