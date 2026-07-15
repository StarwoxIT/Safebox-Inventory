const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { listAuditLog } = require('../services/auditService');

const router = express.Router();

router.get('/', authenticate, authorize('super_admin'), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  res.json(listAuditLog({ limit, offset }));
});

module.exports = router;
