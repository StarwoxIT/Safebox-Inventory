const { v4: uuid } = require('uuid');
const db = require('../db');

function computeItemTotal(quantity, unitCost) {
  return Math.round(quantity * unitCost * 100) / 100;
}

function computeTotals(items, markupPercent) {
  const subtotal = items.reduce((sum, item) => sum + computeItemTotal(item.quantity, item.unit_cost), 0);
  const grandTotal = subtotal + (subtotal * (markupPercent || 0)) / 100;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
  };
}

function replaceQuotationItems(quotationId, items) {
  db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(quotationId);
  const insert = db.prepare(
    `INSERT INTO quotation_items (id, quotation_id, sn, product_id, name, quantity, quantity_label, unit_cost, total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  items.forEach((item, index) => {
    const total = computeItemTotal(item.quantity, item.unit_cost);
    insert.run(
      uuid(),
      quotationId,
      index + 1,
      item.product_id || null,
      item.name,
      item.quantity,
      item.quantity_label || null,
      item.unit_cost,
      total
    );
  });
}

function getQuotationWithItems(quotationId) {
  const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(quotationId);
  if (!quotation) return null;
  const items = db
    .prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sn')
    .all(quotationId);
  return { ...quotation, items };
}

function snapshotAndVersion(quotationId, changeType, userId) {
  const snapshot = getQuotationWithItems(quotationId);
  const lastVersion = db
    .prepare(
      'SELECT MAX(version_number) AS v FROM quotation_versions WHERE quotation_id = ?'
    )
    .get(quotationId);
  const versionNumber = (lastVersion.v || 0) + 1;
  db.prepare(
    `INSERT INTO quotation_versions (id, quotation_id, version_number, change_type, snapshot_json, changed_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(uuid(), quotationId, versionNumber, changeType, JSON.stringify(snapshot), userId);
}

function createQuotation({ projectId, optionNumber, title, powerDescription, markupPercent, items, userId }) {
  const { subtotal, grandTotal } = computeTotals(items, markupPercent);
  const id = uuid();
  db.prepare(
    `INSERT INTO quotations (id, project_id, option_number, title, power_description, markup_percent, subtotal, grand_total, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, projectId, optionNumber, title || `OPTION ${optionNumber}`, powerDescription || null, markupPercent || 0, subtotal, grandTotal, userId);

  replaceQuotationItems(id, items);
  snapshotAndVersion(id, 'create', userId);
  return getQuotationWithItems(id);
}

function updateQuotation(id, { title, powerDescription, markupPercent, items, status, userId }) {
  const existing = db.prepare('SELECT * FROM quotations WHERE id = ?').get(id);
  if (!existing) return null;

  const finalItems = items || db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sn').all(id);
  const finalMarkup = markupPercent ?? existing.markup_percent;
  const { subtotal, grandTotal } = computeTotals(finalItems, finalMarkup);

  const changeType = markupPercent !== undefined && markupPercent !== existing.markup_percent ? 'markup_change' : 'edit';

  db.prepare(
    `UPDATE quotations
     SET title = ?, power_description = ?, markup_percent = ?, subtotal = ?, grand_total = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    title ?? existing.title,
    powerDescription ?? existing.power_description,
    finalMarkup,
    subtotal,
    grandTotal,
    status ?? existing.status,
    id
  );

  if (items) {
    replaceQuotationItems(id, items);
  }

  snapshotAndVersion(id, changeType, userId);
  return getQuotationWithItems(id);
}

module.exports = {
  computeTotals,
  createQuotation,
  updateQuotation,
  getQuotationWithItems,
  snapshotAndVersion,
};
