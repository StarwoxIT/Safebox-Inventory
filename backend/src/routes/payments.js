const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const paymentService = require('../services/paymentService');
const { logAction } = require('../services/auditService');

const router = express.Router();

// GET /payments/project/:projectId -> all payment plans for a project (usually just one)
router.get('/project/:projectId', authenticate, (req, res) => {
  const plans = db.prepare('SELECT id FROM payment_plans WHERE project_id = ?').all(req.params.projectId);
  res.json(plans.map((p) => paymentService.getPaymentPlanWithSchedule(p.id)));
});

// GET /payments/plan/:id -> a single plan with its full milestone/usage schedule
router.get('/plan/:id', authenticate, (req, res) => {
  const plan = paymentService.getPaymentPlanWithSchedule(req.params.id);
  if (!plan) {
    return res.status(404).json({ error: 'Payment plan not found.' });
  }
  res.json(plan);
});

// POST /payments/plans -> create a payment plan for a project's selected quotation
router.post('/plans', authenticate, authorize('admin', 'super_admin'), (req, res) => {
  const { project_id, quotation_id, deposit_percent, installment_count, frequency } = req.body;
  if (!project_id || !quotation_id) {
    return res.status(400).json({ error: 'project_id and quotation_id are required.' });
  }
  try {
    const plan = paymentService.createPaymentPlan({
      projectId: project_id,
      quotationId: quotation_id,
      depositPercent: deposit_percent,
      installmentCount: installment_count,
      frequency,
      userId: req.user.id,
    });
    logAction({
      user: req.user,
      action: 'payment_plan.create',
      entityType: 'payment_plan',
      entityId: plan.id,
      details: { project_id, quotation_id, category: plan.category, total_amount: plan.total_amount },
    });
    res.status(201).json(plan);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to create payment plan.' });
  }
});

// PUT /payments/milestones/:id/pay -> record a milestone/installment as paid
router.put('/milestones/:id/pay', authenticate, authorize('admin', 'super_admin'), (req, res) => {
  try {
    const plan = paymentService.recordMilestonePayment(req.params.id, req.user.id);
    logAction({ user: req.user, action: 'payment_milestone.pay', entityType: 'payment_milestone', entityId: req.params.id });
    res.json(plan);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to record payment.' });
  }
});

// POST /payments/plans/:id/usage -> log a Pay as you Go usage billing period
router.post('/plans/:id/usage', authenticate, authorize('admin', 'super_admin'), (req, res) => {
  const { period_start, period_end, units_consumed, rate_per_unit } = req.body;
  if (!period_start || !period_end || units_consumed === undefined || rate_per_unit === undefined) {
    return res.status(400).json({ error: 'period_start, period_end, units_consumed and rate_per_unit are required.' });
  }
  try {
    const period = paymentService.recordUsagePeriod({
      planId: req.params.id,
      periodStart: period_start,
      periodEnd: period_end,
      unitsConsumed: units_consumed,
      ratePerUnit: rate_per_unit,
      userId: req.user.id,
    });
    logAction({ user: req.user, action: 'usage_period.create', entityType: 'usage_billing_period', entityId: period.id, details: { plan_id: req.params.id } });
    res.status(201).json(period);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to log usage.' });
  }
});

// PUT /payments/usage/:id/pay -> mark a usage billing period as paid
router.put('/usage/:id/pay', authenticate, authorize('admin', 'super_admin'), (req, res) => {
  try {
    const period = paymentService.markUsagePeriodPaid(req.params.id, req.user.id);
    logAction({ user: req.user, action: 'usage_period.pay', entityType: 'usage_billing_period', entityId: req.params.id });
    res.json(period);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to record usage payment.' });
  }
});

module.exports = router;
