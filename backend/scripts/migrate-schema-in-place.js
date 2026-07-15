#!/usr/bin/env node
/**
 * One-off migration: upgrades an EXISTING database file that still has the old
 * standalone Safebox-Inventory schema (users.role IN ('Super Admin','Admin'),
 * projects.status IN ('Planning','Active',...), etc.) to the new unified portal
 * schema, IN PLACE. Use this when the new app is deployed against the same
 * database file/volume the old inventory app was already using (DB_DIR points
 * at the same path/volume as before) rather than importing from a separate
 * exported copy of the old database (see migrate-inventory.js for that case).
 *
 * Safe to run against an already-migrated (or brand new) database: it detects
 * the current shape of `users` and `projects` and does nothing where there's
 * nothing to do.
 *
 * Every other table either already matches the new schema exactly (categories,
 * subcategories, units, products, returns, battery_collections, settings,
 * project_materials, project_engineers, project_costs) or only needed a
 * additive/rename change safe enough to run automatically on every boot (see
 * runMigrations() in src/db/migrations.js: stock_movements.condition backfill,
 * audit_log column renames). Brand new tables (quotations, payment_plans,
 * company_profile, ...) are created automatically by schema.sql.
 *
 * Usage:
 *   node scripts/migrate-schema-in-place.js [--dry-run]
 *
 * Always takes a timestamped backup copy of the database file before making
 * any changes (skipped in --dry-run mode). Each table rebuild runs inside its
 * own transaction so it's all-or-nothing.
 */
const fs = require('fs');
const path = require('path');
const db = require('../src/db');

const STATUS_MAP = {
  Planning: 'prospect',
  Active: 'on_going',
  'On Hold': 'on_going',
  Completed: 'completed',
  Cancelled: 'rejected',
};

const VALID_SECTORS = ['Residential', 'Commercial', 'Industrial', 'Agricultural', 'Telecom', 'Street Lighting', 'Other'];

function parseArgs() {
  return { dryRun: process.argv.includes('--dry-run') };
}

function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((col) => col.name === column);
}

function isOldUsersShape() {
  return !columnExists('users', 'role') ? false : !columnExists('users', 'created_at') ? false : (
    (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() || {}).sql || ''
  ).includes("'Super Admin'");
}

function isOldProjectsShape() {
  return (
    (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'").get() || {}).sql || ''
  ).includes("'Planning'");
}

function backupDatabaseFile() {
  const dbPath = db.name; // better-sqlite3 exposes the open file path as `.name`
  const backupPath = `${dbPath}.bak.${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(dbPath, backupPath);
  return backupPath;
}

function migrateUsers(dryRun) {
  const rows = db.prepare('SELECT * FROM users').all();
  const usable = rows.filter((u) => u.password_hash);
  const skipped = rows.length - usable.length;
  console.log(`users: ${rows.length} existing row(s), ${usable.length} will be kept, ${skipped} skipped (no password set — invite never accepted).`);
  if (dryRun) return;

  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.exec(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'super_admin')) DEFAULT 'admin',
        status TEXT NOT NULL CHECK (status IN ('Active', 'Inactive')) DEFAULT 'Active',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    const insert = db.prepare(
      'INSERT INTO users_new (id, name, email, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    usable.forEach((u) => {
      const role = u.role === 'Super Admin' ? 'super_admin' : 'admin';
      const status = u.status === 'Invited' ? 'Active' : u.status === 'Inactive' ? 'Inactive' : 'Active';
      insert.run(u.id, u.name, u.email, u.password_hash, role, status, u.created_at);
    });
    db.exec('DROP TABLE users');
    db.exec('ALTER TABLE users_new RENAME TO users');
  })();
  db.pragma('foreign_keys = ON');
}

function migrateProjects(dryRun) {
  const rows = db.prepare('SELECT * FROM projects').all();
  const warnings = [];
  console.log(`projects: ${rows.length} existing row(s) will be upgraded to the new schema.`);
  rows.forEach((p) => {
    if (!STATUS_MAP[p.status]) warnings.push(`project ${p.id}: unrecognized status '${p.status}', will default to 'prospect'.`);
  });
  warnings.push('business_model and payment_category are not present in the old schema and will be left null on every project — set these manually per project after migration.');
  warnings.forEach((w) => console.log(`  - ${w}`));
  if (dryRun) return;

  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.exec(`
      CREATE TABLE projects_new (
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
      )
    `);
    const insert = db.prepare(
      `INSERT INTO projects_new
         (id, name, client_name, status, sector, manager, system_size_kwp, start_date, end_date, notes, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    rows.forEach((p) => {
      const status = STATUS_MAP[p.status] || 'prospect';
      const sector = VALID_SECTORS.includes(p.project_type) ? p.project_type : (p.project_type ? 'Other' : null);
      insert.run(
        p.id, p.name, p.client || null, status, sector, p.manager || null,
        p.system_size_kwp || 0, p.start_date || null, p.end_date || null, p.notes || null, p.created_by, p.created_at
      );
    });
    db.exec('DROP TABLE projects');
    db.exec('ALTER TABLE projects_new RENAME TO projects');
  })();
  db.pragma('foreign_keys = ON');
}

function main() {
  const { dryRun } = parseArgs();
  const usersOld = isOldUsersShape();
  const projectsOld = isOldProjectsShape();

  if (!usersOld && !projectsOld) {
    console.log('Database is already in the new schema shape (or was created fresh) — nothing to migrate.');
    return;
  }

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Old-shaped tables detected: ${[usersOld && 'users', projectsOld && 'projects'].filter(Boolean).join(', ')}`);

  if (!dryRun) {
    const backupPath = backupDatabaseFile();
    console.log(`Backed up database to ${backupPath} before making any changes.`);
  }

  if (usersOld) migrateUsers(dryRun);
  if (projectsOld) migrateProjects(dryRun);

  if (dryRun) {
    console.log('\nDry run only — nothing was written. Re-run without --dry-run to migrate for real.');
  } else {
    console.log('\nMigration complete.');
  }
}

main();
