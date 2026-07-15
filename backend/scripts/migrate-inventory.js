#!/usr/bin/env node
/**
 * One-off migration: imports data from the old standalone Safebox-Inventory SQLite
 * database into this unified portal's database.
 *
 * Usage:
 *   node scripts/migrate-inventory.js <path-to-inventory-db> [--dry-run] [--force]
 *
 * --dry-run   Reads the source DB and prints what would be imported, without writing.
 * --force     Allows running even if the destination already has products/categories
 *             (normally refused, since inventory's PRD-/CAT-/MV-/... IDs would collide
 *             with anything already seeded — run this against a fresh, unseeded database).
 *
 * Notes on field mapping (verified against the actual old schema — server/db/schema.sql
 * on the pre-unification azu/development branch):
 *  - users.role: 'Super Admin' -> 'super_admin', 'Admin' -> 'admin'. Users with no
 *    password_hash (never accepted their invite) are skipped — they can't log in anyway.
 *  - projects.status: Planning->prospect, Active->on_going, 'On Hold'->on_going,
 *    Completed->completed, Cancelled->rejected. Flagged as best-effort; review manually.
 *  - projects.system_size_kwp <- system_size_kwp: same column name and unit in both
 *    schemas, carried over as-is.
 *  - business_model and payment_category have no equivalent field in the old schema
 *    (there is no sale_type column) and are left null on every migrated project — set
 *    these manually per project after migration.
 */
const path = require('path');
const Database = require('better-sqlite3');
const db = require('../src/db');

const STATUS_MAP = {
  Planning: 'prospect',
  Active: 'on_going',
  'On Hold': 'on_going',
  Completed: 'completed',
  Cancelled: 'rejected',
};

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const dbPath = args.find((a) => !a.startsWith('--'));
  if (!dbPath) {
    console.error('Usage: node scripts/migrate-inventory.js <path-to-inventory-db> [--dry-run] [--force]');
    process.exit(1);
  }
  return { dbPath: path.resolve(dbPath), dryRun, force };
}

function main() {
  const { dbPath, dryRun, force } = parseArgs();
  const source = new Database(dbPath, { readonly: true });

  const existingProducts = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  const existingCategories = db.prepare('SELECT COUNT(*) AS c FROM categories').get().c;
  if (!force && (existingProducts > 0 || existingCategories > 0)) {
    console.error(
      `Destination already has ${existingProducts} products / ${existingCategories} categories. ` +
        'Run this against a fresh, unseeded database (or pass --force if you are certain there is no ID overlap).'
    );
    process.exit(1);
  }

  const counts = {};
  const warnings = [];
  const migratedUserIds = new Set();

  const insertOrSkip = (label, rows, insertFn) => {
    counts[label] = rows.length;
    if (dryRun) return;
    const run = db.transaction((items) => {
      items.forEach(insertFn);
    });
    run(rows);
  };

  // ── Users ──────────────────────────────────────────────────────────────
  const sourceUsers = source.prepare('SELECT * FROM users').all();
  const usableUsers = sourceUsers.filter((u) => u.password_hash);
  const skippedUsers = sourceUsers.length - usableUsers.length;
  if (skippedUsers > 0) {
    warnings.push(`${skippedUsers} user(s) skipped (no password_hash — invite never accepted).`);
  }
  insertOrSkip('users', usableUsers, (u) => {
    const role = u.role === 'Super Admin' ? 'super_admin' : 'admin';
    const status = u.status === 'Inactive' ? 'Inactive' : 'Active';
    db.prepare(
      'INSERT INTO users (id, name, email, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(u.id, u.name, u.email, u.password_hash, role, status, u.created_at);
    migratedUserIds.add(u.id);
  });
  const mapUserId = (id) => (id && migratedUserIds.has(id) ? id : null);

  // ── Categories / subcategories / units ───────────────────────────────────
  const categories = source.prepare('SELECT * FROM categories').all();
  insertOrSkip('categories', categories, (c) => {
    db.prepare('INSERT INTO categories (id, name, created_at) VALUES (?, ?, ?)').run(c.id, c.name, c.created_at);
  });

  const subcategories = source.prepare('SELECT * FROM subcategories').all();
  insertOrSkip('subcategories', subcategories, (s) => {
    db.prepare('INSERT INTO subcategories (id, category_id, name) VALUES (?, ?, ?)').run(s.id, s.category_id, s.name);
  });

  const units = source.prepare('SELECT * FROM units').all();
  insertOrSkip('units', units, (u) => {
    db.prepare('INSERT INTO units (id, name, created_at) VALUES (?, ?, ?)').run(u.id, u.name, u.created_at);
  });

  // ── Products ──────────────────────────────────────────────────────────
  const products = source.prepare('SELECT * FROM products').all();
  insertOrSkip('products', products, (p) => {
    db.prepare(
      `INSERT INTO products (id, category, subcategory, brand, model, unit, min_threshold, max_threshold, unit_cost, status, created_by, approved_by, approved_at, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      p.id, p.category, p.subcategory, p.brand, p.model, p.unit, p.min_threshold, p.max_threshold,
      p.unit_cost, p.status, mapUserId(p.created_by), mapUserId(p.approved_by), p.approved_at, p.notes, p.created_at
    );
  });

  // ── Projects ──────────────────────────────────────────────────────────
  const projects = source.prepare('SELECT * FROM projects').all();
  const projectIds = new Set(projects.map((p) => p.id));
  insertOrSkip('projects', projects, (p) => {
    const status = STATUS_MAP[p.status] || 'prospect';
    if (!STATUS_MAP[p.status]) warnings.push(`Project ${p.id}: unrecognized status '${p.status}', defaulted to 'prospect'.`);
    const sector = ['Residential', 'Commercial', 'Industrial', 'Agricultural', 'Telecom', 'Street Lighting'].includes(p.project_type) ? p.project_type : (p.project_type ? 'Other' : null);
    db.prepare(
      `INSERT INTO projects (id, name, client_name, status, sector, manager, system_size_kwp, start_date, end_date, notes, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      p.id, p.name, p.client || null, status, sector,
      p.manager || null, p.system_size_kwp || 0, p.start_date || null, p.end_date || null,
      p.notes || null, mapUserId(p.created_by), p.created_at
    );
  });

  const projectRef = (id) => (id && projectIds.has(id) ? id : null);

  // ── Project materials / engineers / costs ────────────────────────────────
  const materials = source.prepare('SELECT * FROM project_materials').all().filter((m) => projectIds.has(m.project_id));
  insertOrSkip('project_materials', materials, (m) => {
    db.prepare(
      'INSERT INTO project_materials (id, date, project_id, product_id, quantity, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(m.id, m.date, m.project_id, m.product_id, m.quantity, mapUserId(m.created_by), m.created_at);
  });

  const engineers = source.prepare('SELECT * FROM project_engineers').all().filter((e) => projectIds.has(e.project_id));
  insertOrSkip('project_engineers', engineers, (e) => {
    db.prepare(
      'INSERT INTO project_engineers (id, project_id, name, role, date_assigned, date_completed, notes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(e.id, e.project_id, e.name, e.role, e.date_assigned, e.date_completed, e.notes, mapUserId(e.created_by), e.created_at);
  });

  const costs = source.prepare('SELECT * FROM project_costs').all().filter((c) => projectIds.has(c.project_id));
  insertOrSkip('project_costs', costs, (c) => {
    db.prepare(
      'INSERT INTO project_costs (id, project_id, item_name, cost, notes, logged_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(c.id, c.project_id, c.item_name, c.cost, c.notes, mapUserId(c.logged_by), c.created_at);
  });

  // ── Stock movements ───────────────────────────────────────────────────
  const movements = source.prepare('SELECT * FROM stock_movements').all();
  insertOrSkip('stock_movements', movements, (m) => {
    db.prepare(
      `INSERT INTO stock_movements (id, date, product_id, movement_type, quantity, condition, source, recorded_by, status, approved_by, approved_at, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      m.id, m.date, m.product_id, m.movement_type, m.quantity, m.condition || 'New', m.source,
      mapUserId(m.recorded_by), m.status, mapUserId(m.approved_by), m.approved_at, m.notes, m.created_at
    );
  });

  // ── Returns ───────────────────────────────────────────────────────────
  const returns = source.prepare('SELECT * FROM returns').all();
  insertOrSkip('returns', returns, (r) => {
    db.prepare(
      `INSERT INTO returns (id, date, return_type, project_id, product_id, quantity, reason, oem, sent_to_oem_date, oem_response, reconciled, notes, logged_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      r.id, r.date, r.return_type, projectRef(r.project_id), r.product_id, r.quantity, r.reason,
      r.oem, r.sent_to_oem_date, r.oem_response, r.reconciled, r.notes, mapUserId(r.logged_by), r.created_at
    );
  });

  // ── Battery collections ───────────────────────────────────────────────
  const batteries = source.prepare('SELECT * FROM battery_collections').all();
  insertOrSkip('battery_collections', batteries, (b) => {
    db.prepare(
      'INSERT INTO battery_collections (id, date, battery_type, quantity, collected_from, notes, logged_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(b.id, b.date, b.battery_type, b.quantity, b.collected_from, b.notes, mapUserId(b.logged_by), b.created_at);
  });

  // ── Audit log ─────────────────────────────────────────────────────────
  const auditRows = source.prepare('SELECT * FROM audit_log').all();
  insertOrSkip('audit_log', auditRows, (a) => {
    db.prepare(
      'INSERT INTO audit_log (id, user_id, user_name, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(a.id, mapUserId(a.user_id), a.user_name, a.action, a.entity_type, a.entity_id, a.detail, a.timestamp);
  });

  // ── Settings ──────────────────────────────────────────────────────────
  let settingsRows = [];
  try {
    settingsRows = source.prepare('SELECT * FROM settings').all();
  } catch (err) {
    // Source DB predates the settings table — nothing to migrate.
  }
  insertOrSkip('settings', settingsRows, (s) => {
    db.prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(s.key, s.value, s.updated_at || new Date().toISOString());
  });

  source.close();

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Migration summary:`);
  Object.entries(counts).forEach(([label, c]) => console.log(`  ${label}: ${c}`));
  if (warnings.length) {
    console.log('\nWarnings (review these manually after import):');
    warnings.forEach((w) => console.log(`  - ${w}`));
  }
  if (dryRun) {
    console.log('\nDry run only — nothing was written. Re-run without --dry-run to import for real.');
  }
}

main();
