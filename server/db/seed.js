require('dotenv').config();
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || '/data/safebox.db';
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// Never delete an existing database — preserve all user data
const isNew = !fs.existsSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Always apply schema (CREATE TABLE IF NOT EXISTS — safe on existing DBs)
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

const now = new Date().toISOString();

const seed = db.transaction(() => {
  // ── Super Admin ─────────────────────────────────────────────────────────
  // Only insert if no users exist at all (truly fresh database)
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount === 0) {
    const hash = bcrypt.hashSync('Ebuka123@', 10);
    db.prepare(
      `INSERT INTO users (id,name,email,password_hash,role,status,invited,created_at)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run('USR-001', 'Ebuka Azubuike', 'ebuka@safebox.ng', hash, 'Super Admin', 'Active', 0, now);
    console.log('👤  Super Admin created: ebuka@safebox.ng / Ebuka123@');
  } else {
    console.log(`👤  ${userCount} existing user(s) preserved — skipping user seed`);
  }

  // ── Categories ───────────────────────────────────────────────────────────
  // Use INSERT OR IGNORE so existing categories are never overwritten
  const insertCat = db.prepare(`INSERT OR IGNORE INTO categories (id,name,created_at) VALUES (?,?,?)`);
  const insertSub = db.prepare(`INSERT OR IGNORE INTO subcategories (id,category_id,name) VALUES (?,?,?)`);

  const cats = [
    ['CAT-001', 'Battery'],
    ['CAT-002', 'Solar Panel'],
    ['CAT-003', 'Inverter'],
    ['CAT-004', 'Cable'],
    ['CAT-005', 'Charge Controller'],
    ['CAT-006', 'Mounting'],
    ['CAT-007', 'Protection'],
    ['CAT-008', 'Accessories'],
  ];
  const subs = {
    'CAT-001': ['Lithium (LiFePO4)', 'Lead Acid (AGM)', 'Gel'],
    'CAT-002': ['Monocrystalline', 'Polycrystalline', 'Bifacial', 'Thin Film'],
    'CAT-003': ['Hybrid', 'Off-Grid', 'Grid-Tied', 'Micro'],
    'CAT-004': ['DC Solar Cable', 'AC Cable', 'Battery Cable', 'Earthing Cable'],
    'CAT-005': ['MPPT', 'PWM'],
    'CAT-006': ['Roof Mount', 'Ground Mount', 'Carport Mount'],
    'CAT-007': ['DC MCB', 'AC MCB', 'Surge Protector', 'Fuse'],
    'CAT-008': ['MC4 Connector', 'Cable Tray', 'Junction Box', 'Battery Monitor'],
  };
  cats.forEach(([id, name]) => {
    insertCat.run(id, name, now);
    (subs[id] || []).forEach((s, i) => insertSub.run(`${id}-S${i + 1}`, id, s));
  });

  // ── Settings ─────────────────────────────────────────────────────────────
  const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key,value,updated_at) VALUES (?,?,?)`);
  [
    ['currency', 'NGN'],
    ['timezone', 'Africa/Lagos'],
    ['company_name', 'SafeBox Energy'],
    ['company_email', 'info@safebox.ng'],
    ['low_stock_alert', 'true'],
    ['require_approval', 'true'],
  ].forEach(([k, v]) => insertSetting.run(k, v, now));

  // ── Audit entry (only on genuinely new databases) ────────────────────────
  if (isNew) {
    db.prepare(
      `INSERT INTO audit_log (id,timestamp,user_id,user_name,action,entity_type,entity_id,detail)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(uuidv4(), now, 'USR-001', 'Ebuka Azubuike', 'Database seeded', 'system', 'all', 'Fresh database initialized for SafeBox Energy IMS');
  }
});

seed();
console.log('✅ Database seed complete — existing data preserved.');
db.close();
