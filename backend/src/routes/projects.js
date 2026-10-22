const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { authenticate, authorize, authorizeDepartment } = require('../middleware/auth');
const quoteService = require('../services/quoteService');
const {
  nextProjectReference,
  isValidBusinessModelPaymentCategory,
  PROJECT_STATUS_VALUES,
  PROJECT_SECTORS,
  PROJECT_BUSINESS_MODELS,
  PROJECT_PAYMENT_CATEGORIES,
  getProjectWithCosts,
} = require('../services/projectService');
const { renderProposalPdf } = require('../services/pdfService');
const { logAction } = require('../services/auditService');
const { nextId } = require('../services/idService');
const { isApprovalRequired } = require('../services/settingsService');
const { getCurrentStock } = require('../services/stockService');

const router = express.Router();

function validateProjectFields(fields, { creating = false } = {}) {
  if (creating) {
    const requiredFields = ['name', 'client_name', 'client_address', 'manager', 'sector', 'business_model', 'payment_category', 'status'];
    for (const field of requiredFields) {
      if (typeof fields[field] !== 'string' || !fields[field].trim()) {
        return `${field} is required.`;
      }
    }
  }
  for (const field of ['name', 'client_name', 'client_address', 'manager']) {
    if (fields[field] !== undefined && fields[field] !== null && typeof fields[field] !== 'string') {
      return `${field} must be text.`;
    }
  }
  if (fields.name !== undefined && (typeof fields.name !== 'string' || fields.name.trim().length > 160)) {
    return 'Project name must be 160 characters or fewer.';
  }
  for (const field of ['client_contact', 'description']) {
    if (fields[field] !== undefined && fields[field] !== null && typeof fields[field] !== 'string') {
      return `${field} must be text.`;
    }
  }
  if (fields.sector !== undefined && fields.sector !== null && fields.sector !== '' && !PROJECT_SECTORS.includes(fields.sector)) return 'Select a valid project sector.';
  if (fields.business_model !== undefined && fields.business_model !== null && fields.business_model !== '' && !PROJECT_BUSINESS_MODELS.includes(fields.business_model)) return 'Select a valid business model.';
  if (fields.payment_category !== undefined && fields.payment_category !== null && fields.payment_category !== '' && !PROJECT_PAYMENT_CATEGORIES.includes(fields.payment_category)) return 'Select a valid payment type.';
  if (fields.status !== undefined && !PROJECT_STATUS_VALUES.includes(fields.status)) return 'Select a valid project status.';
  return null;
}

router.get('/', authenticate, authorizeDepartment('finance', 'engineering'), (req, res) => {
  const projects = db
    .prepare(
      `SELECT p.*, u.name AS created_by_name, du.name AS deletion_requested_by_name,
              (SELECT COUNT(*) FROM quotations q WHERE q.project_id = p.id) AS quotation_count
       FROM projects p
       LEFT JOIN users u ON u.id = p.created_by
       LEFT JOIN users du ON du.id = p.deletion_requested_by
       ORDER BY p.created_at DESC`
    )
    .all();
  res.json(projects);
});

router.get('/:id', authenticate, authorizeDepartment('finance', 'engineering'), (req, res) => {
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
  project.planned_materials = db
    .prepare(
      `SELECT ppm.*, p.model AS product_name, p.unit, p.category
       FROM planned_project_materials ppm
       JOIN products p ON p.id = ppm.product_id
       WHERE ppm.project_id = ?
       ORDER BY ppm.created_at DESC`
    )
    .all(project.id);
  project.costs = db
    .prepare('SELECT * FROM project_costs WHERE project_id = ? ORDER BY created_at DESC')
    .all(project.id);
  res.json(project);
});

// GET /projects/:id/proposal/pdf -> combined cover + profile + all quotation options for the project
router.get('/:id/proposal/pdf', authenticate, authorize('super_admin'), async (req, res) => {
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

router.post('/', authenticate, authorizeDepartment('engineering'), (req, res) => {
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
    status = 'not_started',
  } = req.body;

  const validationError = validateProjectFields({
    name, client_name, client_address, manager, sector, business_model, payment_category, status,
  }, { creating: true });
  if (validationError) return res.status(400).json({ error: validationError });
  if (!isValidBusinessModelPaymentCategory(business_model, payment_category)) {
    return res.status(400).json({ error: `payment_category '${payment_category}' is not valid for business model '${business_model}'.` });
  }

  const id = uuid();
  const createProject = db.transaction(() => {
    const projectRef = nextProjectReference();
    db.prepare(
      `INSERT INTO projects (id, project_ref, name, client_name, client_address, client_contact, description, manager, system_size_kwp, business_model, payment_category, sector, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      projectRef,
      name.trim(),
      client_name.trim(),
      client_address.trim(),
      client_contact?.trim() || null,
      description?.trim() || null,
      manager.trim(),
      system_size_kwp || 0,
      business_model,
      payment_category,
      sector,
      status,
      req.user.id
    );
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  });
  const project = createProject.immediate();
  logAction({ user: req.user, action: 'project.create', entityType: 'project', entityId: id, details: { name, project_ref: project.project_ref } });
  res.status(201).json(project);
});

router.put('/:id', authenticate, authorizeDepartment('engineering'), (req, res) => {
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

  const validationError = validateProjectFields(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const finalBusinessModel = business_model === undefined ? existing.business_model : (business_model || null);
  const finalPaymentCategory = payment_category === undefined ? existing.payment_category : (payment_category || null);
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
    sector === undefined ? existing.sector : (sector || null),
    start_date ?? existing.start_date,
    end_date ?? existing.end_date,
    notes ?? existing.notes,
    status ?? existing.status,
    req.params.id
  );
  logAction({ user: req.user, action: 'project.update', entityType: 'project', entityId: req.params.id });
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

router.post('/:id/planned-materials', authenticate, authorizeDepartment('engineering'), (req, res) => {
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });

  const { product_id, quantity } = req.body;
  const qty = Number(quantity);
  if (!product_id || !Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Select a product and enter a quantity greater than zero.' });
  }
  const product = db.prepare("SELECT id FROM products WHERE id = ? AND status = 'Approved'").get(product_id);
  if (!product) return res.status(400).json({ error: 'Select an approved product from the inventory catalogue.' });

  const id = uuid();
  db.prepare(
    'INSERT INTO planned_project_materials (id, project_id, product_id, quantity, created_by) VALUES (?, ?, ?, ?, ?)'
  ).run(id, req.params.id, product_id, qty, req.user.id);
  logAction({ user: req.user, action: 'project.material_plan_create', entityType: 'planned_project_material', entityId: id, details: { project_id: req.params.id, product_id, quantity: qty } });
  res.status(201).json(
    db.prepare(
      `SELECT ppm.*, p.model AS product_name, p.unit, p.category
       FROM planned_project_materials ppm JOIN products p ON p.id = ppm.product_id
       WHERE ppm.id = ?`
    ).get(id)
  );
});

router.put('/:id/planned-materials/:materialId', authenticate, authorizeDepartment('engineering'), (req, res) => {
  const existing = db.prepare(
    'SELECT * FROM planned_project_materials WHERE id = ? AND project_id = ?'
  ).get(req.params.materialId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Planned material not found.' });

  const productId = req.body.product_id ?? existing.product_id;
  const quantity = Number(req.body.quantity ?? existing.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be greater than zero.' });
  }
  const product = db.prepare("SELECT id FROM products WHERE id = ? AND status = 'Approved'").get(productId);
  if (!product) return res.status(400).json({ error: 'Select an approved product from the inventory catalogue.' });

  db.prepare(
    `UPDATE planned_project_materials
     SET product_id = ?, quantity = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(productId, quantity, existing.id);
  logAction({ user: req.user, action: 'project.material_plan_update', entityType: 'planned_project_material', entityId: existing.id });
  res.json(
    db.prepare(
      `SELECT ppm.*, p.model AS product_name, p.unit, p.category
       FROM planned_project_materials ppm JOIN products p ON p.id = ppm.product_id
       WHERE ppm.id = ?`
    ).get(existing.id)
  );
});

router.delete('/:id/planned-materials/:materialId', authenticate, authorizeDepartment('engineering'), (req, res) => {
  const result = db.prepare(
    'DELETE FROM planned_project_materials WHERE id = ? AND project_id = ?'
  ).run(req.params.materialId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Planned material not found.' });
  logAction({ user: req.user, action: 'project.material_plan_delete', entityType: 'planned_project_material', entityId: req.params.materialId });
  res.status(204).send();
});

// Super admin can delete a project outright.
router.delete('/:id', authenticate, authorize('super_admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  logAction({ user: req.user, action: 'project.delete', entityType: 'project', entityId: req.params.id, details: { name: existing?.name } });
  res.status(204).send();
});

// A regular admin can only flag a project for deletion — a super admin has to approve it
// (see POST /:id/approve-delete) before it's actually removed.
router.post('/:id/request-delete', authenticate, authorizeDepartment('engineering'), (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  db.prepare("UPDATE projects SET deletion_requested_by = ?, deletion_requested_at = datetime('now') WHERE id = ?").run(req.user.id, req.params.id);
  logAction({ user: req.user, action: 'project.delete_request', entityType: 'project', entityId: req.params.id, details: { name: existing.name } });
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

router.post('/:id/cancel-delete-request', authenticate, authorizeDepartment('engineering'), (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  db.prepare('UPDATE projects SET deletion_requested_by = NULL, deletion_requested_at = NULL WHERE id = ?').run(req.params.id);
  logAction({ user: req.user, action: 'project.delete_request_cancel', entityType: 'project', entityId: req.params.id, details: { name: existing.name } });
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

router.post('/:id/approve-delete', authenticate, authorize('super_admin'), (req, res) => {
  const { decision } = req.body;
  if (!['Approved', 'Rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be Approved or Rejected.' });
  }
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  if (!existing.deletion_requested_by) {
    return res.status(400).json({ error: 'This project has no pending deletion request.' });
  }

  if (decision === 'Approved') {
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    logAction({ user: req.user, action: 'project.delete_approve', entityType: 'project', entityId: req.params.id, details: { name: existing.name } });
    return res.status(204).send();
  }

  db.prepare('UPDATE projects SET deletion_requested_by = NULL, deletion_requested_at = NULL WHERE id = ?').run(req.params.id);
  logAction({ user: req.user, action: 'project.delete_reject', entityType: 'project', entityId: req.params.id, details: { name: existing.name } });
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

// ── Engineers ────────────────────────────────────────────────────────────
router.post('/:id/engineers', authenticate, authorizeDepartment('engineering'), (req, res) => {
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

router.put('/engineers/:engineerId', authenticate, authorizeDepartment('engineering'), (req, res) => {
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
router.post('/:id/materials', authenticate, authorizeDepartment('engineering'), (req, res) => {
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
  const createStockOut = db.transaction(() => {
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
    return db.prepare('SELECT * FROM project_materials WHERE id = ?').get(id);
  });

  res.status(201).json(createStockOut());
});

// ── Costs ────────────────────────────────────────────────────────────────
router.post('/:id/costs', authenticate, authorizeDepartment('engineering'), (req, res) => {
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
