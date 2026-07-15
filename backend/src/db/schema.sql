-- Safebox Portal schema (Inventory + Quotation + Payments, unified)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'super_admin')) DEFAULT 'admin',
  status TEXT NOT NULL CHECK (status IN ('Active', 'Inactive')) DEFAULT 'Active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subcategories (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE (category_id, name)
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Rejected')) DEFAULT 'Pending',
  created_by TEXT REFERENCES users(id),
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Projects: the single entry point covering quoting through execution.
CREATE TABLE IF NOT EXISTS projects (
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
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id),
  movement_type TEXT NOT NULL,
  quantity REAL NOT NULL,
  condition TEXT NOT NULL DEFAULT 'New',
  source TEXT,
  recorded_by TEXT REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Rejected')) DEFAULT 'Pending',
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS returns (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  return_type TEXT NOT NULL CHECK (return_type IN ('Client Return', 'Project Return')),
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL,
  reason TEXT,
  oem TEXT,
  sent_to_oem_date TEXT,
  oem_response TEXT,
  reconciled INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  logged_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS battery_collections (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  battery_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  collected_from TEXT NOT NULL,
  notes TEXT,
  logged_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_materials (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_engineers (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  date_assigned TEXT,
  date_completed TEXT,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_costs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  cost REAL NOT NULL DEFAULT 0,
  notes TEXT,
  logged_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  option_number INTEGER NOT NULL DEFAULT 1,
  title TEXT,
  power_description TEXT,
  markup_percent REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('draft', 'final')) DEFAULT 'draft',
  is_selected INTEGER NOT NULL DEFAULT 0,
  selected_at TEXT,
  selected_by TEXT REFERENCES users(id),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('unpaid', 'paid')) DEFAULT 'unpaid',
  paid_at TEXT,
  paid_by TEXT REFERENCES users(id),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id TEXT PRIMARY KEY,
  quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  sn INTEGER NOT NULL,
  product_id TEXT REFERENCES products(id),
  name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  quantity_label TEXT,
  unit_cost REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quotation_versions (
  id TEXT PRIMARY KEY,
  quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'edit', 'markup_change')),
  snapshot_json TEXT NOT NULL,
  changed_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS company_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  reg_number TEXT,
  address_lines TEXT NOT NULL DEFAULT '[]',
  email TEXT,
  phone TEXT,
  who_we_are TEXT,
  mission TEXT,
  vision TEXT,
  products_intro TEXT,
  products_note TEXT,
  products_list TEXT NOT NULL DEFAULT '[]',
  product_photo_data_uri TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Payments: one plan per accepted quotation, category fixed by the project's payment_category.
CREATE TABLE IF NOT EXISTS payment_plans (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('full_payment', 'installments', 'pay_as_you_go')),
  total_amount REAL NOT NULL,
  deposit_percent REAL NOT NULL DEFAULT 0,
  deposit_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Milestones cover both full_payment (Deposit + Balance on Completion) and installments (Deposit + N installments).
CREATE TABLE IF NOT EXISTS payment_milestones (
  id TEXT PRIMARY KEY,
  payment_plan_id TEXT NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  label TEXT NOT NULL,
  due_date TEXT,
  amount REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid')) DEFAULT 'pending',
  paid_at TEXT,
  paid_by TEXT REFERENCES users(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Usage billing periods cover pay_as_you_go (metered/EaaS) plans.
CREATE TABLE IF NOT EXISTS usage_billing_periods (
  id TEXT PRIMARY KEY,
  payment_plan_id TEXT NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  units_consumed REAL NOT NULL DEFAULT 0,
  rate_per_unit REAL NOT NULL DEFAULT 0,
  amount_due REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid')) DEFAULT 'pending',
  paid_at TEXT,
  paid_by TEXT REFERENCES users(id),
  recorded_by TEXT REFERENCES users(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Income recognized (markup) as payments come in — proportional to each milestone/usage-period paid.
CREATE TABLE IF NOT EXISTS income_records (
  id TEXT PRIMARY KEY,
  payment_plan_id TEXT REFERENCES payment_plans(id) ON DELETE CASCADE,
  quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  recorded_by TEXT REFERENCES users(id),
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_quotations_project_id ON quotations(project_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_versions_quotation_id ON quotation_versions(quotation_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_project_materials_project_id ON project_materials(project_id);
CREATE INDEX IF NOT EXISTS idx_project_engineers_project_id ON project_engineers(project_id);
CREATE INDEX IF NOT EXISTS idx_project_costs_project_id ON project_costs(project_id);
CREATE INDEX IF NOT EXISTS idx_returns_project_id ON returns(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_project_id ON payment_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_plan_id ON payment_milestones(payment_plan_id);
CREATE INDEX IF NOT EXISTS idx_usage_billing_periods_plan_id ON usage_billing_periods(payment_plan_id);
CREATE INDEX IF NOT EXISTS idx_income_records_project_id ON income_records(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
