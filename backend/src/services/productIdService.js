const fs = require('fs');
const db = require('../db');

const PRD_RE = /^PRD-(\d+)$/;

const REFERENCING_TABLES = ['stock_movements', 'returns', 'project_materials', 'quotation_items'];

function nextSequenceStart() {
  const max = db
    .prepare('SELECT id FROM products')
    .all()
    .map((p) => PRD_RE.exec(p.id))
    .filter(Boolean)
    .map((m) => parseInt(m[1], 10))
    .reduce((a, b) => Math.max(a, b), 0);
  return max + 1;
}

// Products not yet using the app's generated PRD-XXX id format (e.g. rows carried
// over from an older seed/import), oldest first, each paired with the new id it
// would get. Read-only — safe to call for a preview/confirmation UI.
function previewProductIdMapping() {
  const products = db.prepare('SELECT id, brand, model, created_at FROM products ORDER BY created_at ASC, id ASC').all();
  const nonConforming = products.filter((p) => !PRD_RE.test(p.id));
  let seq = nextSequenceStart();
  return nonConforming.map((p) => ({
    oldId: p.id,
    newId: `PRD-${String(seq++).padStart(3, '0')}`,
    brand: p.brand,
    model: p.model,
  }));
}

// Backs up the database file, then rewrites every non-conforming product id to a
// sequential PRD-XXX id and updates all tables that reference products.id
// (stock_movements, returns, project_materials, quotation_items) so nothing goes
// stale. audit_log.entity_id is deliberately left alone — it's a historical
// record of what an id was at the time of the logged action, not a live
// reference. Returns the applied mapping and the backup file path.
function applyProductIdMapping() {
  const mapping = previewProductIdMapping();
  if (mapping.length === 0) return { mapping, backupPath: null };

  const dbPath = db.name; // better-sqlite3 exposes the open file path as `.name`
  const backupPath = `${dbPath}.bak.${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(dbPath, backupPath);

  const updateProduct = db.prepare('UPDATE products SET id = ? WHERE id = ?');
  const updateRefs = REFERENCING_TABLES.map((table) => db.prepare(`UPDATE ${table} SET product_id = ? WHERE product_id = ?`));

  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    mapping.forEach(({ oldId, newId }) => {
      updateProduct.run(newId, oldId);
      updateRefs.forEach((stmt) => stmt.run(newId, oldId));
    });
  })();
  db.pragma('foreign_keys = ON');

  fs.writeFileSync(`${backupPath}.id-mapping.json`, JSON.stringify(mapping, null, 2));

  return { mapping, backupPath };
}

module.exports = { previewProductIdMapping, applyProductIdMapping };
