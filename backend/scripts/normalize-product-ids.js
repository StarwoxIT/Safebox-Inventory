#!/usr/bin/env node
/**
 * One-off migration: rewrites any product whose id does NOT already match the
 * app's generated format (PRD-001, PRD-002, ...) to a proper sequential PRD-XXX
 * id, and updates every table that references products.id so nothing goes
 * stale. Needed because products created before nextId('PRD','products') was
 * wired up (e.g. rows carried over from an older seed/import) can have
 * non-conforming ids (UUIDs, etc.) that don't match what the app now generates
 * for brand-new products.
 *
 * Same logic is also exposed to super admins in-app (see routes/products.js
 * POST/GET /products/normalize-ids) for use against production, where nobody
 * has direct database/server access to run this script.
 *
 * Always takes a timestamped backup copy of the database file first (skipped
 * in --dry-run), and writes a JSON log of every old-id -> new-id mapping next
 * to the backup so the change is traceable after the fact.
 *
 * Usage:
 *   node scripts/normalize-product-ids.js [--dry-run]
 */
const { previewProductIdMapping, applyProductIdMapping } = require('../src/services/productIdService');

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const mapping = previewProductIdMapping();

  if (mapping.length === 0) {
    console.log('All products already use the PRD-XXX format — nothing to do.');
    return;
  }

  console.log(`${dryRun ? '[DRY RUN] ' : ''}${mapping.length} product(s) need a new id:`);
  mapping.forEach((m) => console.log(`  ${m.oldId}  ->  ${m.newId}   (${[m.brand, m.model].filter(Boolean).join(' ')})`));

  if (dryRun) {
    console.log('\nDry run only — nothing was written. Re-run without --dry-run to apply for real.');
    return;
  }

  const { backupPath } = applyProductIdMapping();
  console.log(`\nBacked up database to ${backupPath} before making any changes.`);
  console.log(`Wrote old-id -> new-id mapping to ${backupPath}.id-mapping.json`);
  console.log('\nMigration complete.');
}

main();
