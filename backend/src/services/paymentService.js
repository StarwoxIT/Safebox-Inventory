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

// Builds the Payment Tracker view of a plan: computed paid/remaining totals, a
// human status label tailored to its category, and the next amount due (if any).
//   - pay_as_you_go: "Running" while active (no fixed schedule, so no due dates/alerts).
//   - full_payment / installments, nothing left pending: "Paid".
//   - full_payment, still pending: "Ongoing" (or "Overdue by N days" past due).
//   - installments, still pending: "N weeks/months left" (or "Overdue by N days" past due).
function buildPlanSummary(plan) {
  const project = db.prepare('SELECT name, status AS project_status FROM projects WHERE id = ?').get(plan.project_id);
  const today = new Date().toISOString().slice(0, 10);
  const milestones = plan.milestones || [];
  const usagePeriods = plan.usage_periods || [];

  const paidMilestonesAmount = milestones.filter((m) => m.status === 'paid').reduce((sum, m) => sum + m.amount, 0);
  const paidUsageAmount = usagePeriods.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount_due, 0);
  const amountPaid = round2(paidMilestonesAmount + paidUsageAmount);

  let amountRemaining = null;
  let statusType;
  let statusLabel;
  let nextDue = null;
  let isOverdue = false;
  let isDueSoon = false;

  if (plan.category === 'pay_as_you_go') {
    if (plan.status === 'active') {
      statusType = 'running';
      statusLabel = 'Running';
    } else {
      statusType = plan.status;
      statusLabel = plan.status.charAt(0).toUpperCase() + plan.status.slice(1);
    }
  } else {
    amountRemaining = round2(plan.total_amount - amountPaid);
    const pending = milestones
      .filter((m) => m.status === 'pending')
      .sort((a, b) => (a.due_date || '9999-99-99').localeCompare(b.due_date || '9999-99-99'));

    if (pending.length === 0) {
      statusType = 'paid';
      statusLabel = 'Paid';
    } else {
      const next = pending[0];
      nextDue = { milestoneId: next.id, label: next.label, dueDate: next.due_date, amount: next.amount };

      let daysLeft = null;
      if (next.due_date) {
        daysLeft = Math.round((new Date(next.due_date) - new Date(today)) / 86400000);
        isOverdue = daysLeft < 0;
        isDueSoon = daysLeft >= 0 && daysLeft <= 7;
      }

      if (isOverdue) {
        statusType = 'overdue';
        const days = Math.abs(daysLeft);
        statusLabel = `Overdue by ${days} day${days === 1 ? '' : 's'}`;
      } else if (plan.category === 'installments' && daysLeft !== null) {
        statusType = 'countdown';
        if (daysLeft < 14) {
          const weeks = Math.max(1, Math.round(daysLeft / 7));
          statusLabel = `${weeks} week${weeks === 1 ? '' : 's'} left`;
        } else {
          const months = Math.max(1, Math.round(daysLeft / 30));
          statusLabel = `${months} month${months === 1 ? '' : 's'} left`;
        }
      } else {
        statusType = 'ongoing';
        statusLabel = 'Ongoing';
      }
    }
  }

  return {
    ...plan,
    projectName: project?.name || null,
    projectStatus: project?.project_status || null,
    amountPaid,
    amountRemaining,
    statusType,
    statusLabel,
    nextDue,
    isOverdue,
    isDueSoon,
  };
}

function getPaymentPlanSummary(planId) {
  const plan = getPaymentPlanWithSchedule(planId);
  if (!plan) return null;
  return buildPlanSummary(plan);
}

function listAllPaymentPlanSummaries() {
  const planIds = db.prepare('SELECT id FROM payment_plans ORDER BY created_at DESC').all();
  return planIds.map((row) => getPaymentPlanSummary(row.id)).filter(Boolean);
}

// Pending milestones due within `withinDays` (including already-overdue ones), for
// full_payment/installments plans only — used to drive the dashboard due-payment alert.
function listDuePaymentMilestones(withinDays = 7) {
  const rows = db
    .prepare(
      `SELECT pm.id, pm.label, pm.due_date, pm.amount, pp.id AS payment_plan_id, pp.category, pp.project_id, p.name AS project_name
       FROM payment_milestones pm
       JOIN payment_plans pp ON pp.id = pm.payment_plan_id
       JOIN projects p ON p.id = pp.project_id
       WHERE pm.status = 'pending' AND pp.category IN ('full_payment', 'installments') AND pm.due_date IS NOT NULL`
    )
    .all();

  const today = new Date().toISOString().slice(0, 10);
  return rows
    .map((r) => {
      const daysLeft = Math.round((new Date(r.due_date) - new Date(today)) / 86400000);
      return { ...r, daysLeft, isOverdue: daysLeft < 0 };
    })
    .filter((r) => r.daysLeft <= withinDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

module.exports = {
  createPaymentPlan,
  getPaymentPlanWithSchedule,
  getPaymentPlanSummary,
  listAllPaymentPlanSummaries,
  listDuePaymentMilestones,
  recordMilestonePayment,
  recordUsagePeriod,
  markUsagePeriodPaid,
};
