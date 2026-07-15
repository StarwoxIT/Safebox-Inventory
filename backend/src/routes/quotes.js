const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const quoteService = require('../services/quoteService');
const { renderQuotationPdf } = require('../services/pdfService');
const { logAction } = require('../services/auditService');

const router = express.Router();

// GET /quotes/:projectId -> list all quotation options for a project
router.get('/:projectId', authenticate, (req, res) => {
  const quotations = db
    .prepare('SELECT * FROM quotations WHERE project_id = ? ORDER BY option_number')
    .all(req.params.projectId);
  const withItems = quotations.map((q) => quoteService.getQuotationWithItems(q.id));
  res.json(withItems);
});

// GET /quotes/detail/:id -> single quotation with items
router.get('/detail/:id', authenticate, (req, res) => {
  const quotation = quoteService.getQuotationWithItems(req.params.id);
  if (!quotation) {
    return res.status(404).json({ error: 'Quotation not found.' });
  }
  res.json(quotation);
});

// GET /quotes/:id/versions -> version/history list
router.get('/:id/versions', authenticate, (req, res) => {
  const versions = db
    .prepare(
      `SELECT v.id, v.version_number, v.change_type, v.created_at, u.name AS changed_by_name
       FROM quotation_versions v
       LEFT JOIN users u ON u.id = v.changed_by
       WHERE v.quotation_id = ?
       ORDER BY v.version_number DESC`
    )
    .all(req.params.id);
  res.json(versions);
});

// GET /quotes/:id/pdf -> generate and stream PDF
router.get('/:id/pdf', authenticate, async (req, res) => {
  const quotation = quoteService.getQuotationWithItems(req.params.id);
  if (!quotation) {
    return res.status(404).json({ error: 'Quotation not found.' });
  }
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(quotation.project_id);
  try {
    const pdfBuffer = await renderQuotationPdf(quotation, project);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="quotation-${quotation.option_number}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation failed:', err);
    res.status(500).json({ error: 'Failed to generate PDF.', detail: err.message });
  }
});

// POST /quotes -> create a new quotation option for a project (only while the project is a 'prospect')
router.post('/', authenticate, authorize('admin', 'super_admin'), (req, res) => {
  const { project_id, option_number, title, power_description, markup_percent, items } = req.body;

  if (!project_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'project_id and a non-empty items array are required.' });
  }

  const project = db.prepare('SELECT id, status FROM projects WHERE id = ?').get(project_id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  if (project.status !== 'prospect') {
    return res.status(409).json({ error: 'Quotation options can only be added while the project is in prospect status.' });
  }

  const quotation = quoteService.createQuotation({
    projectId: project_id,
    optionNumber: option_number || 1,
    title,
    powerDescription: power_description,
    markupPercent: markup_percent || 0,
    items,
    userId: req.user.id,
  });

  logAction({
    user: req.user,
    action: 'quote.create',
    entityType: 'quotation',
    entityId: quotation.id,
    details: { project_id, option_number: quotation.option_number },
  });
  res.status(201).json(quotation);
});

// PUT /quotes/:id/select -> mark this option as the one the client picked (or unmark it)
router.put('/:id/select', authenticate, authorize('admin', 'super_admin'), (req, res) => {
  const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
  if (!quotation) {
    return res.status(404).json({ error: 'Quotation not found.' });
  }

  const selected = req.body.selected !== false;

  if (selected) {
    db.prepare(
      "UPDATE quotations SET is_selected = 0, selected_at = NULL, selected_by = NULL WHERE project_id = ?"
    ).run(quotation.project_id);
    db.prepare(
      "UPDATE quotations SET is_selected = 1, selected_at = datetime('now'), selected_by = ? WHERE id = ?"
    ).run(req.user.id, req.params.id);
    db.prepare(
      "UPDATE projects SET status = 'quote_accepted', updated_at = datetime('now') WHERE id = ? AND status = 'prospect'"
    ).run(quotation.project_id);
  } else {
    db.prepare(
      "UPDATE quotations SET is_selected = 0, selected_at = NULL, selected_by = NULL WHERE id = ?"
    ).run(req.params.id);
  }

  logAction({
    user: req.user,
    action: selected ? 'quote.select' : 'quote.unselect',
    entityType: 'quotation',
    entityId: req.params.id,
    details: { project_id: quotation.project_id, option_number: quotation.option_number },
  });

  res.json(quoteService.getQuotationWithItems(req.params.id));
});

// PUT /quotes/:id -> edit quotation (items, markup, description, status)
// Allowed for admin only while the project is still 'prospect'; once quoting has moved past
// prospect (a quote was selected), only a super_admin can still edit the locked/selected quote.
router.put('/:id', authenticate, authorize('admin', 'super_admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Quotation not found.' });
  }
  const project = db.prepare('SELECT status FROM projects WHERE id = ?').get(existing.project_id);
  if (project.status !== 'prospect' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Quoting is locked for this project. Only a super admin can edit it now.' });
  }

  const { title, power_description, markup_percent, items, status } = req.body;

  const updated = quoteService.updateQuotation(req.params.id, {
    title,
    powerDescription: power_description,
    markupPercent: markup_percent,
    items,
    status,
    userId: req.user.id,
  });

  logAction({ user: req.user, action: 'quote.update', entityType: 'quotation', entityId: req.params.id });
  res.json(updated);
});

router.delete('/:id', authenticate, authorize('super_admin'), (req, res) => {
  const result = db.prepare('DELETE FROM quotations WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Quotation not found.' });
  }
  logAction({ user: req.user, action: 'quote.delete', entityType: 'quotation', entityId: req.params.id });
  res.status(204).send();
});

module.exports = router;
