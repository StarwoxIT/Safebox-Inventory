const { v4: uuid } = require('uuid');
const db = require('../db');
const { nextId } = require('./idService');

const DOC_PREFIX = { invoice: 'INV', receipt: 'RCT' };

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function computeTotals(items, vatPercent, amountPaid) {
  const subtotal = round2(items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unit_cost || 0), 0));
  const vatAmount = round2((subtotal * Number(vatPercent || 0)) / 100);
  const grandTotal = round2(subtotal + vatAmount);
  const balance = round2(Math.max(grandTotal - Number(amountPaid || 0), 0));
  return { subtotal, vatAmount, grandTotal, balance };
}

function rowToDocument(row) {
  return {
    id: row.id,
    type: row.type,
    docNumber: row.doc_number,
    projectId: row.project_id,
    quotationId: row.quotation_id,
    clientName: row.client_name,
    clientAddress: row.client_address,
    clientContact: row.client_contact,
    issueDate: row.issue_date,
    items: JSON.parse(row.items_json || '[]'),
    subtotal: row.subtotal,
    vatPercent: row.vat_percent,
    vatAmount: row.vat_amount,
    grandTotal: row.grand_total,
    amountPaid: row.amount_paid,
    balance: row.balance,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function listDocuments({ type } = {}) {
  const rows = db
    .prepare(
      `SELECT d.*, p.name AS project_name, u.name AS created_by_name
       FROM documents d
       LEFT JOIN projects p ON p.id = d.project_id
       LEFT JOIN users u ON u.id = d.created_by
       WHERE (? IS NULL OR d.type = ?)
       ORDER BY d.created_at DESC`
    )
    .all(type || null, type || null);
  return rows.map((r) => ({ ...rowToDocument(r), projectName: r.project_name, createdByName: r.created_by_name }));
}

function getDocument(id) {
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  return row ? rowToDocument(row) : null;
}

function createDocument({ type, projectId, quotationId, clientName, clientAddress, clientContact, issueDate, items, vatPercent, amountPaid, notes, userId }) {
  if (!DOC_PREFIX[type]) {
    const err = new Error("type must be 'invoice' or 'receipt'.");
    err.status = 400;
    throw err;
  }
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('At least one line item is required.');
    err.status = 400;
    throw err;
  }

  const normalizedItems = items.map((i) => ({
    description: i.description || i.name || '',
    quantity: Number(i.quantity) || 0,
    unit_cost: Number(i.unit_cost) || 0,
    total: round2((Number(i.quantity) || 0) * (Number(i.unit_cost) || 0)),
  }));

  const { subtotal, vatAmount, grandTotal, balance } = computeTotals(normalizedItems, vatPercent, amountPaid);

  const id = uuid();
  const docNumber = nextId(DOC_PREFIX[type], 'documents', 'doc_number');
  db.prepare(
    `INSERT INTO documents
      (id, type, doc_number, project_id, quotation_id, client_name, client_address, client_contact, issue_date,
       items_json, subtotal, vat_percent, vat_amount, grand_total, amount_paid, balance, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    type,
    docNumber,
    projectId || null,
    quotationId || null,
    clientName || null,
    clientAddress || null,
    clientContact || null,
    issueDate || new Date().toISOString().slice(0, 10),
    JSON.stringify(normalizedItems),
    subtotal,
    Number(vatPercent) || 0,
    vatAmount,
    grandTotal,
    Number(amountPaid) || 0,
    balance,
    notes || null,
    userId
  );

  return getDocument(id);
}

function deleteDocument(id) {
  return db.prepare('DELETE FROM documents WHERE id = ?').run(id).changes > 0;
}

module.exports = { listDocuments, getDocument, createDocument, deleteDocument };
