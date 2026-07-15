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

// Resolve paths relative to this file so the script works when called from
// any working directory (e.g. inside the container as node /app/scripts/...).
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require(path.resolve(__dirname, '../src/db'));

const { runMigrations } = require(path.resolve(__dirname, '../src/db/migrations'));

function parseArgs() {
  return { dryRun: process.argv.includes('--dry-run') };
}

function backupDatabaseFile() {
  const dbPath = db.name;
  const backupPath = `${dbPath}.bak.${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(dbPath, backupPath);
  return backupPath;
}

function main() {
  const { dryRun } = parseArgs();

  if (dryRun) {
    console.log('[DRY RUN] Would run all pending migrations against:', db.name);
    console.log('Re-run without --dry-run to apply.');
    return;
  }

  const backupPath = backupDatabaseFile();
  console.log(`Backed up database to ${backupPath}`);

  runMigrations(db);
  console.log('Migration complete.');
}

main();
