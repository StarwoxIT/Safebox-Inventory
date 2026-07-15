const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const quoteService = require('../services/quoteService');
const { isValidBusinessModelPaymentCategory, getProjectWithCosts } = require('../services/projectService');
const { renderProposalPdf } = require('../services/pdfService');
const { logAction } = require('../services/auditService');
const { nextId } = require('../services/idService');
const { isApprovalRequired } = require('../services/settingsService');
const { getCurrentStock } = require('../services/stockService');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const projects = db
    .prepare(
      `SELECT p.*, u.name AS created_by_name,
              (SELECT COUNT(*) FROM quotations q WHERE q.project_id = p.id) AS quotation_count
       FROM projects p
       LEFT JOIN users u ON u.id = p.created_by
       ORDER BY p.created_at DESC`
    )
    .all();
  res.json(projects);
});

router.get('/:id', authenticate, (req, res) => {
  const project = getProjectWithCosts(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  project.engineers = db
    .prepare('SELECT * FROM project_engineers WHERE project_id = ? ORDER BY date_assigned DESC')
    .all(project.id);
  project.materials = db
    .prepare(
      `SELECT pm.*, pr.model AS product_name, pr.unit, pr.unit_cost
       FROM project_materials pm LEFT JOIN products pr ON pr.id = pm.product_id
       WHERE pm.project_id = ? ORDER BY pm.date DESC`
    )
    .all(project.id);
  project.costs = db
    .prepare('SELECT * FROM project_costs WHERE project_id = ? ORDER BY created_at DESC')
    .all(project.id);
  res.json(project);
});

// GET /projects/:id/proposal/pdf -> combined cover + profile + all quotation options for the project
router.get('/:id/proposal/pdf', authenticate, async (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  const quotationRows = db
    .prepare('SELECT id FROM quotations WHERE project_id = ? ORDER BY option_number')
    .all(project.id);
  if (quotationRows.length === 0) {
    return res.status(400).json({ error: 'This project has no quotations yet.' });
  }
  const quotations = quotationRows.map((q) => quoteService.getQuotationWithItems(q.id));

  try {
    const pdfBuffer = await renderProposalPdf(project, quotations);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="proposal-${project.id}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Proposal PDF generation failed:', err);
    res.status(500).json({ error: 'Failed to generate proposal PDF.', detail: err.message });
  }
});

router.post('/', authenticate, authorize('admin', 'super_admin'), (req, res) => {
  const {
    name,
    client_name,
    client_address,
    client_contact,
    description,
    manager,
    system_size_kwp,
    business_model,
    payment_category,
    sector,
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required.' });
  }
  if (!isValidBusinessModelPaymentCategory(business_model, payment_category)) {
    return res.status(400).json({ error: `payment_category '${payment_category}' is not valid for business model '${business_model}'.` });
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO projects (id, name, client_name, client_address, client_contact, description, manager, system_size_kwp, business_model, payment_category, sector, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    client_name || null,
    client_address || null,
    client_contact || null,
    description || null,
    manager || null,
    system_size_kwp || 0,
    business_model || null,
    payment_category || null,
    sector || null,
    req.user.id
  );
  logAction({ user: req.user, action: 'project.create', entityType: 'project', entityId: id, details: { name } });
  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
});

router.put('/:id', authenticate, authorize('admin', 'super_admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const {
    name,
    client_name,
    client_address,
    client_contact,
    description,
    manager,
    system_size_kwp,
    business_model,
    payment_category,
    start_date,
    end_date,
    notes,
    status,
    sector,
  } = req.body;

  // Business model / payment category can only be changed by an admin while the project is
  // still a prospect; once quoting has moved on, only a super_admin can revise it.
  const changingModelOrCategory =
    (business_model !== undefined && business_model !== existing.business_model) ||
    (payment_category !== undefined && payment_category !== existing.payment_category);
  if (changingModelOrCategory && existing.status !== 'prospect' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only a super admin can change the business model or payment category once quoting has moved past prospect.' });
  }
  if (status !== undefined && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only a super admin can set project status directly.' });
  }

  const finalBusinessModel = business_model ?? existing.business_model;
  const finalPaymentCategory = payment_category ?? existing.payment_category;
  if (!isValidBusinessModelPaymentCategory(finalBusinessModel, finalPaymentCategory)) {
    return res.status(400).json({ error: `payment_category '${finalPaymentCategory}' is not valid for business model '${finalBusinessModel}'.` });
  }

  db.prepare(
    `UPDATE projects SET
       name = ?, client_name = ?, client_address = ?, client_contact = ?, description = ?,
       manager = ?, system_size_kwp = ?, business_model = ?, payment_category = ?, sector = ?,
       start_date = ?, end_date = ?, notes = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    name ?? existing.name,
    client_name ?? existing.client_name,
    client_address ?? existing.client_address,
    client_contact ?? existing.client_contact,
    description ?? existing.description,
    manager ?? existing.manager,
    system_size_kwp ?? existing.system_size_kwp,
    finalBusinessModel,
    finalPaymentCategory,
    sector ?? existing.sector,
    start_date ?? existing.start_date,
    end_date ?? existing.end_date,
    notes ?? existing.notes,
    status ?? existing.status,
    req.params.id
  );
  logAction({ user: req.user, action: 'project.update', entityType: 'project', entityId: req.params.id });
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

router.delete('/:id', authenticate, authorize('super_admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  logAction({ user: req.user, action: 'project.delete', entityType: 'project', entityId: req.params.id, details: { name: existing?.name } });
  res.status(204).send();
});

// ── Engineers ────────────────────────────────────────────────────────────
router.post('/:id/engineers', authenticate, (req, res) => {
  const { name, role, date_assigned, date_completed, notes } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required.' });
  }
  const id = uuid();
  db.prepare(
    `INSERT INTO project_engineers (id, project_id, name, role, date_assigned, date_completed, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, req.params.id, name, role || null, date_assigned || new Date().toISOString().slice(0, 10), date_completed || null, notes || null, req.user.id);
  logAction({ user: req.user, action: 'project.engineer_assign', entityType: 'project_engineer', entityId: id, details: { project_id: req.params.id, name } });
  res.status(201).json(db.prepare('SELECT * FROM project_engineers WHERE id = ?').get(id));
});

router.put('/engineers/:engineerId', authenticate, (req, res) => {
  const existing = db.prepare('SELECT * FROM project_engineers WHERE id = ?').get(req.params.engineerId);
  if (!existing) {
    return res.status(404).json({ error: 'Engineer assignment not found.' });
  }
  const { name, role, date_assigned, date_completed, notes } = req.body;
  db.prepare(
    'UPDATE project_engineers SET name = ?, role = ?, date_assigned = ?, date_completed = ?, notes = ? WHERE id = ?'
  ).run(name ?? existing.name, role ?? existing.role, date_assigned ?? existing.date_assigned, date_completed ?? existing.date_completed, notes ?? existing.notes, req.params.engineerId);
  logAction({ user: req.user, action: 'project.engineer_update', entityType: 'project_engineer', entityId: req.params.engineerId });
  res.json(db.prepare('SELECT * FROM project_engineers WHERE id = ?').get(req.params.engineerId));
});

// ── Materials ────────────────────────────────────────────────────────────
// Logging a material on a project must stay in sync with inventory: only in-stock, approved
// products can be selected, and logging one creates a matching "Used in Project (OUT)" stock
// movement so the product's current stock reflects the usage (once that movement is approved).
router.post('/:id/materials', authenticate, (req, res) => {
  const { date, product_id, quantity } = req.body;
  if (!product_id || !quantity) {
    return res.status(400).json({ error: 'product_id and quantity are required.' });
  }
  const qty = Number(quantity);
  if (!(qty > 0)) {
    return res.status(400).json({ error: 'quantity must be greater than zero.' });
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product || product.status !== 'Approved') {
    return res.status(400).json({ error: 'Only approved, in-catalog products can be used on a project.' });
  }
  const currentStock = getCurrentStock(product_id);
  if (qty > currentStock) {
    return res.status(400).json({ error: `Insufficient stock for ${product.model}. Only ${currentStock} ${product.unit} available.` });
  }

  const materialDate = date || new Date().toISOString().slice(0, 10);
  const id = uuid();
  db.prepare(
    `INSERT INTO project_materials (id, date, project_id, product_id, quantity, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, materialDate, req.params.id, product_id, qty, req.user.id);
  logAction({ user: req.user, action: 'project.material_log', entityType: 'project_material', entityId: id, details: { project_id: req.params.id, product_id, quantity: qty } });

  const movementId = nextId('MV', 'stock_movements');
  const autoApprove = req.user.role === 'super_admin' || !isApprovalRequired();
  const status = autoApprove ? 'Approved' : 'Pending';
  const approvedBy = autoApprove ? req.user.id : null;
  const approvedAt = autoApprove ? new Date().toISOString() : null;
  db.prepare(
    `INSERT INTO stock_movements (id, date, product_id, movement_type, quantity, condition, source, recorded_by, status, approved_by, approved_at, notes)
     VALUES (?, ?, ?, 'Used in Project (OUT)', ?, 'New', ?, ?, ?, ?, ?, ?)`
  ).run(movementId, materialDate, product_id, qty, `Project: ${project.name}`, req.user.id, status, approvedBy, approvedAt, `Logged from project material usage (project_material ${id})`);
  logAction({ user: req.user, action: 'stock_movement.create', entityType: 'stock_movement', entityId: movementId, details: { movement_type: 'Used in Project (OUT)', quantity: qty, product_id, status } });

  res.status(201).json(db.prepare('SELECT * FROM project_materials WHERE id = ?').get(id));
});

// ── Costs ────────────────────────────────────────────────────────────────
router.post('/:id/costs', authenticate, (req, res) => {
  const { item_name, cost, notes } = req.body;
  if (!item_name || cost === undefined) {
    return res.status(400).json({ error: 'item_name and cost are required.' });
  }
  const id = uuid();
  db.prepare(
    `INSERT INTO project_costs (id, project_id, item_name, cost, notes, logged_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, req.params.id, item_name, cost, notes || null, req.user.id);
  logAction({ user: req.user, action: 'project.cost_log', entityType: 'project_cost', entityId: id, details: { project_id: req.params.id, item_name, cost } });
  res.status(201).json(db.prepare('SELECT * FROM project_costs WHERE id = ?').get(id));
});

module.exports = router;
