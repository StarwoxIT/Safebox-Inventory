const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const documentService = require('../services/documentService');
const { renderDocumentPdf } = require('../services/pdfService');
const { logAction } = require('../services/auditService');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const { type } = req.query;
  res.json(documentService.listDocuments({ type }));
});

router.get('/:id', authenticate, (req, res) => {
  const doc = documentService.getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  res.json(doc);
});

router.get('/:id/pdf', authenticate, async (req, res) => {
  const doc = documentService.getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  try {
    const pdfBuffer = await renderDocumentPdf(doc);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${doc.docNumber}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Document PDF generation failed:', err);
    res.status(500).json({ error: 'Failed to generate PDF.', detail: err.message });
  }
});

router.post('/', authenticate, authorize('admin', 'super_admin'), (req, res) => {
  const { type, project_id, quotation_id, client_name, client_address, client_contact, issue_date, items, vat_percent, amount_paid, notes } = req.body;
  try {
    const doc = documentService.createDocument({
      type,
      projectId: project_id,
      quotationId: quotation_id,
      clientName: client_name,
      clientAddress: client_address,
      clientContact: client_contact,
      issueDate: issue_date,
      items,
      vatPercent: vat_percent,
      amountPaid: amount_paid,
      notes,
      userId: req.user.id,
    });
    logAction({
      user: req.user,
      action: `document.${type}_create`,
      entityType: 'document',
      entityId: doc.id,
      details: { docNumber: doc.docNumber, grandTotal: doc.grandTotal, projectId: doc.projectId },
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to create document.' });
  }
});

router.delete('/:id', authenticate, authorize('super_admin'), (req, res) => {
  const doc = documentService.getDocument(req.params.id);
  const deleted = documentService.deleteDocument(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Document not found.' });
  logAction({ user: req.user, action: 'document.delete', entityType: 'document', entityId: req.params.id, details: { docNumber: doc?.docNumber } });
  res.status(204).send();
});

module.exports = router;
