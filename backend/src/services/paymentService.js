const { v4: uuid } = require('uuid');
const db = require('../db');

const FREQUENCY_DAYS = { day: 1, week: 7, month: 30 };

function round2(n) {
  return Math.round(n * 100) / 100;
}

function addInterval(date, frequency, count) {
  const days = (FREQUENCY_DAYS[frequency] || 30) * count;
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getPaymentPlanWithSchedule(planId) {
  const plan = db.prepare('SELECT * FROM payment_plans WHERE id = ?').get(planId);
  if (!plan) return null;
  const milestones = db
    .prepare('SELECT * FROM payment_milestones WHERE payment_plan_id = ? ORDER BY sequence')
    .all(planId);
  const usagePeriods = db
    .prepare('SELECT * FROM usage_billing_periods WHERE payment_plan_id = ? ORDER BY period_start')
    .all(planId);
  return { ...plan, milestones, usage_periods: usagePeriods };
}

function insertMilestone(planId, sequence, label, dueDate, amount) {
  const id = uuid();
  db.prepare(
    `INSERT INTO payment_milestones (id, payment_plan_id, sequence, label, due_date, amount)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, planId, sequence, label, dueDate || null, round2(amount));
  return id;
}

function createPaymentPlan({ projectId, quotationId, depositPercent, installmentCount, frequency, userId }) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw Object.assign(new Error('Project not found.'), { status: 404 });
  }
  const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(quotationId);
  if (!quotation || quotation.project_id !== projectId) {
    throw Object.assign(new Error('Quotation not found for this project.'), { status: 404 });
  }
  if (project.status !== 'quote_accepted') {
    throw Object.assign(new Error("A payment plan can only be created once the project status is 'quote_accepted'."), { status: 409 });
  }
  if (!quotation.is_selected) {
    throw Object.assign(new Error('Only the selected quotation option can have a payment plan.'), { status: 409 });
  }
  if (!project.payment_category) {
    throw Object.assign(new Error('This project has no payment category set.'), { status: 400 });
  }

  const category = project.payment_category;
  const totalAmount = quotation.grand_total;
  const deposit = round2(totalAmount * ((depositPercent || 0) / 100));
  const planId = uuid();

  db.prepare(
    `INSERT INTO payment_plans (id, project_id, quotation_id, category, total_amount, deposit_percent, deposit_amount, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(planId, projectId, quotationId, category, totalAmount, depositPercent || 0, deposit, userId);

  const today = new Date().toISOString().slice(0, 10);

  if (category === 'full_payment') {
    insertMilestone(planId, 1, 'Deposit', today, deposit);
    insertMilestone(planId, 2, 'Balance on Completion', null, round2(totalAmount - deposit));
  } else if (category === 'installments') {
    const count = Math.max(1, installmentCount || 1);
    const remainder = round2(totalAmount - deposit);
    const perInstallment = Math.floor((remainder / count) * 100) / 100;
    insertMilestone(planId, 1, 'Deposit', today, deposit);
    let runningTotal = 0;
    for (let i = 1; i <= count; i += 1) {
      const isLast = i === count;
      const amount = isLast ? round2(remainder - runningTotal) : perInstallment;
      runningTotal = round2(runningTotal + amount);
      insertMilestone(planId, i + 1, `Installment ${i}`, addInterval(today, frequency, i), amount);
    }
  } else if (category === 'pay_as_you_go') {
    if (deposit > 0) {
      insertMilestone(planId, 1, 'Deployment Deposit', today, deposit);
    }
    // Usage is billed over time via usage_billing_periods — no schedule generated up front.
  }

  const nextStatus = project.business_model === 'eaas' ? 'active_eaas' : 'on_going';
  db.prepare("UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ?").run(nextStatus, projectId);

  return getPaymentPlanWithSchedule(planId);
}

function recognizeIncome({ planId, projectId, quotationId, amountPaid, userId }) {
  const plan = db.prepare('SELECT * FROM payment_plans WHERE id = ?').get(planId);
  const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(quotationId);
  const markupAmount = quotation.grand_total - quotation.subtotal;
  const incomePortion = plan.total_amount > 0 ? round2((amountPaid * markupAmount) / plan.total_amount) : 0;
  db.prepare(
    `INSERT INTO income_records (id, payment_plan_id, quotation_id, project_id, amount, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(uuid(), planId, quotationId, projectId, incomePortion, userId);
}

function maybeCompletePlan(planId) {
  const plan = db.prepare('SELECT * FROM payment_plans WHERE id = ?').get(planId);
  if (plan.category === 'pay_as_you_go') return; // open-ended; completed manually by a super_admin

  const pendingMilestones = db
    .prepare("SELECT COUNT(*) AS c FROM payment_milestones WHERE payment_plan_id = ? AND status = 'pending'")
    .get(planId).c;
  if (pendingMilestones === 0) {
    db.prepare("UPDATE payment_plans SET status = 'completed' WHERE id = ?").run(planId);
    db.prepare(
      "UPDATE quotations SET payment_status = 'paid', paid_at = datetime('now') WHERE id = ?"
    ).run(plan.quotation_id);
    db.prepare("UPDATE projects SET status = 'completed', updated_at = datetime('now') WHERE id = ?").run(plan.project_id);
  }
}

function recordMilestonePayment(milestoneId, userId) {
  const milestone = db.prepare('SELECT * FROM payment_milestones WHERE id = ?').get(milestoneId);
  if (!milestone) {
    throw Object.assign(new Error('Milestone not found.'), { status: 404 });
  }
  if (milestone.status === 'paid') {
    return getPaymentPlanWithSchedule(milestone.payment_plan_id);
  }
  const plan = db.prepare('SELECT * FROM payment_plans WHERE id = ?').get(milestone.payment_plan_id);

  db.prepare("UPDATE payment_milestones SET status = 'paid', paid_at = datetime('now'), paid_by = ? WHERE id = ?").run(userId, milestoneId);
  recognizeIncome({ planId: plan.id, projectId: plan.project_id, quotationId: plan.quotation_id, amountPaid: milestone.amount, userId });
  maybeCompletePlan(plan.id);

  return getPaymentPlanWithSchedule(plan.id);
}

function recordUsagePeriod({ planId, periodStart, periodEnd, unitsConsumed, ratePerUnit, userId }) {
  const plan = db.prepare('SELECT * FROM payment_plans WHERE id = ?').get(planId);
  if (!plan) {
    throw Object.assign(new Error('Payment plan not found.'), { status: 404 });
  }
  if (plan.category !== 'pay_as_you_go') {
    throw Object.assign(new Error('Usage billing only applies to Pay as you Go plans.'), { status: 400 });
  }
  const amountDue = round2(unitsConsumed * ratePerUnit);
  const id = uuid();
  db.prepare(
    `INSERT INTO usage_billing_periods (id, payment_plan_id, period_start, period_end, units_consumed, rate_per_unit, amount_due, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, planId, periodStart, periodEnd, unitsConsumed, ratePerUnit, amountDue, userId);
  return db.prepare('SELECT * FROM usage_billing_periods WHERE id = ?').get(id);
}

function markUsagePeriodPaid(periodId, userId) {
  const period = db.prepare('SELECT * FROM usage_billing_periods WHERE id = ?').get(periodId);
  if (!period) {
    throw Object.assign(new Error('Usage billing period not found.'), { status: 404 });
  }
  if (period.status === 'paid') {
    return period;
  }
  const plan = db.prepare('SELECT * FROM payment_plans WHERE id = ?').get(period.payment_plan_id);

  db.prepare("UPDATE usage_billing_periods SET status = 'paid', paid_at = datetime('now'), paid_by = ? WHERE id = ?").run(userId, periodId);
  recognizeIncome({ planId: plan.id, projectId: plan.project_id, quotationId: plan.quotation_id, amountPaid: period.amount_due, userId });

  return db.prepare('SELECT * FROM usage_billing_periods WHERE id = ?').get(periodId);
}

module.exports = {
  createPaymentPlan,
  getPaymentPlanWithSchedule,
  recordMilestonePayment,
  recordUsagePeriod,
  markUsagePeriodPaid,
};
