import { AppError } from "../utils/AppError.js";
import { randomUUID } from "crypto";
import { query, queryOne, withTransaction } from "../db/connection.js";
import { toBoolean, toDateString } from "../utils/data.js";
import { recordAudit } from "./audit.service.js";
import { updateStudentPlan } from "./students.service.js";
// Note: recordAudit is re-used in scheduled payment helpers below.

function today() {
  return new Date().toISOString().slice(0, 10);
}

function mapPayment(row) {
  return {
    ...row,
    includes_registration: toBoolean(row.includes_registration),
    valid_from: toDateString(row.valid_from),
    valid_until: toDateString(row.valid_until),
  };
}

export async function listPayments(workspaceOwnerId, { limit = 100, startDate, endDate } = {}) {
  const filters = ["workspace_owner_id = ?"];
  const params = [workspaceOwnerId];

  if (startDate) {
    filters.push("payment_date >= ?");
    params.push(`${startDate} 00:00:00`);
  }
  if (endDate) {
    filters.push("payment_date <= ?");
    params.push(`${endDate} 23:59:59`);
  }

  params.push(limit);

  const rows = await query(
    `
      SELECT *
      FROM payments
      WHERE ${filters.join(" AND ")}
      ORDER BY payment_date DESC
      LIMIT ?
    `,
    params
  );

  return rows.map(mapPayment);
}

export async function createPayment(workspaceOwnerId, payload, audit = null) {
  return withTransaction(async (connection) => {
    const { student_id, plan_id } = payload;

    const student = await queryOne(
      `
        SELECT *
        FROM students
        WHERE id = ? AND workspace_owner_id = ?
        LIMIT 1
      `,
      [student_id, workspaceOwnerId],
      connection
    );
    if (!student) {
      throw new AppError("Student not found", 404);
    }

    const plan = await queryOne(
      `
        SELECT *
        FROM plans
        WHERE id = ? AND workspace_owner_id = ?
        LIMIT 1
      `,
      [plan_id, workspaceOwnerId],
      connection
    );
    if (!plan) {
      throw new AppError("Plan not found", 404);
    }

    const validFrom = payload.valid_from ?? today();
    const validUntil =
      payload.valid_until ??
      new Date(Date.parse(validFrom) + Number(plan.duration_days) * 86400000)
        .toISOString()
        .slice(0, 10);
    const amount =
      payload.amount_paid !== undefined && payload.amount_paid !== null && payload.amount_paid !== ""
        ? Number(payload.amount_paid)
        : Number(plan.price);

    if (!Number.isFinite(amount) || amount < 0) {
      throw new AppError("Amount must be zero or greater", 400);
    }

    const paymentId = randomUUID();
    await query(
      `
        INSERT INTO payments (
          id,
          workspace_owner_id,
          student_id,
          plan_id,
          collected_role_id,
          amount_paid,
          valid_from,
          valid_until,
          payment_mode,
          includes_registration,
          notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        paymentId,
        workspaceOwnerId,
        student_id,
        plan_id,
        payload.collected_role_id ?? null,
        amount,
        validFrom,
        validUntil,
        payload.payment_mode ?? "upi",
        Boolean(payload.includes_registration),
        payload.notes ?? null,
      ],
      connection
    );

    await query(
      `
        UPDATE students
        SET registration_paid = ?, current_plan_id = ?, renewal_date = ?
        WHERE id = ? AND workspace_owner_id = ?
      `,
      [
        toBoolean(student.registration_paid) || Boolean(payload.includes_registration),
        plan_id,
        validUntil,
        student_id,
        workspaceOwnerId,
      ],
      connection
    );

    const payment = await queryOne("SELECT * FROM payments WHERE id = ?", [paymentId], connection);
    const updatedStudent = await updateStudentPlan(
      student_id,
      workspaceOwnerId,
      plan_id,
      validUntil,
      connection
    );

    if (payload.includes_registration) {
      updatedStudent.registration_paid = true;
    }

    await recordAudit(
      {
        workspaceOwnerId,
        objectType: "payments",
        objectId: paymentId,
        action: "create",
        actorId: audit?.actor_id,
        actorRole: audit?.actor_role,
        metadata: {
          student_id,
          plan_id,
          amount_paid: amount,
          payment_mode: payload.payment_mode ?? "upi",
          includes_registration: Boolean(payload.includes_registration),
        },
      },
      connection
    );

    await recordAudit(
      {
        workspaceOwnerId,
        objectType: "students",
        objectId: student_id,
        action: "payment-applied",
        actorId: audit?.actor_id,
        actorRole: audit?.actor_role,
        metadata: {
          plan_id,
          renewal_date: validUntil,
          registration_paid: updatedStudent.registration_paid,
        },
      },
      connection
    );

    return { payment: mapPayment(payment), student: updatedStudent };
  });
}

export async function importPayments(workspaceOwnerId, rows, audit = null) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const created = [];
  for (const row of rows) {
    created.push(await createPayment(workspaceOwnerId, row, audit));
  }
  return created;
}

// ---------- Pending (QR) Payment Management ----------

export async function listPendingPayments(workspaceOwnerId) {
  const rows = await query(
    `SELECT pp.*,
            s.name  AS student_name,
            s.phone AS student_phone,
            p.name  AS plan_name
     FROM pending_payments pp
     JOIN students s ON s.id = pp.student_id
     JOIN plans    p ON p.id = pp.plan_id
     WHERE pp.workspace_owner_id = ? AND pp.status = 'pending'
     ORDER BY pp.created_at DESC`,
    [workspaceOwnerId]
  );
  return rows.map((row) => ({
    ...row,
    valid_from: toDateString(row.valid_from),
    valid_until: toDateString(row.valid_until),
  }));
}

export async function approvePendingPayment(workspaceOwnerId, pendingId, audit = null) {
  const pending = await queryOne(
    "SELECT * FROM pending_payments WHERE id = ? AND workspace_owner_id = ? LIMIT 1",
    [pendingId, workspaceOwnerId]
  );
  if (!pending) throw new AppError("Pending payment not found", 404);
  if (pending.status !== "pending") {
    throw new AppError(`Payment is already ${pending.status}`, 400);
  }

  const { payment, student } = await createPayment(
    workspaceOwnerId,
    {
      student_id: pending.student_id,
      plan_id: pending.plan_id,
      amount_paid: Number(pending.amount),
      valid_from: toDateString(pending.valid_from),
      valid_until: toDateString(pending.valid_until),
      payment_mode: "qr",
      notes: pending.notes ?? "Approved QR payment",
    },
    audit
  );

  await query(
    "UPDATE pending_payments SET status = 'approved' WHERE id = ?",
    [pendingId]
  );

  // Mark any open scheduled_payment_request for this student as 'paid'
  // so the student's home screen no longer shows the "Pay Now" banner.
  await query(
    `UPDATE scheduled_payment_requests
     SET status = 'paid'
     WHERE student_id = ? AND workspace_owner_id = ? AND status = 'sent'`,
    [pending.student_id, workspaceOwnerId]
  );

  return { payment, student };
}

export async function rejectPendingPayment(workspaceOwnerId, pendingId, audit = null) {
  const pending = await queryOne(
    "SELECT * FROM pending_payments WHERE id = ? AND workspace_owner_id = ? LIMIT 1",
    [pendingId, workspaceOwnerId]
  );
  if (!pending) throw new AppError("Pending payment not found", 404);
  if (pending.status !== "pending") {
    throw new AppError(`Payment is already ${pending.status}`, 400);
  }

  await query(
    "UPDATE pending_payments SET status = 'rejected' WHERE id = ?",
    [pendingId]
  );

  return { id: pendingId, status: "rejected" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduled Payment Requests (Admin → Student)
// type: 'custom' | 'half_month'
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Admin creates a scheduled payment request for a student.
 * type 'custom'     – admin sets exact amount + date range (e.g. remaining days this month).
 * type 'half_month' – 15-day lumpsum; amount = round(plan.price * 15 / 30).
 */
export async function createScheduledPaymentRequest(workspaceOwnerId, payload, audit = null) {
  const { student_id, plan_id, type = "custom", notes } = payload;

  const student = await queryOne(
    "SELECT * FROM students WHERE id = ? AND workspace_owner_id = ? LIMIT 1",
    [student_id, workspaceOwnerId]
  );
  if (!student) throw new AppError("Student not found", 404);

  const plan = await queryOne(
    "SELECT * FROM plans WHERE id = ? AND workspace_owner_id = ? LIMIT 1",
    [plan_id, workspaceOwnerId]
  );
  if (!plan) throw new AppError("Plan not found", 404);

  let amount;
  let valid_from;
  let valid_until;

  if (type === "half_month") {
    // 15-day lumpsum: start from today, end = today + 14 days.
    const planPrice = Number(plan.price);
    amount = Math.round(planPrice * 15 / 30);
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 14 * 86400000);
    valid_from = startDate.toISOString().slice(0, 10);
    valid_until = endDate.toISOString().slice(0, 10);
  } else {
    // custom: admin provides all values.
    if (!payload.amount || !payload.valid_from || !payload.valid_until) {
      throw new AppError("Custom request requires amount, valid_from, and valid_until", 400);
    }
    amount = Number(payload.amount);
    valid_from = payload.valid_from;
    valid_until = payload.valid_until;
    if (!Number.isFinite(amount) || amount < 0) {
      throw new AppError("Amount must be zero or greater", 400);
    }
  }

  // Deposit + discount (discount only permitted on long plans ≥ 180 days).
  const deposit = Math.max(0, Number(payload.deposit_amount ?? 0) || 0);
  const discountEnabled = Boolean(payload.discount_enabled);
  const canDiscount = Number(plan.duration_days) >= 180;
  let discount = 0;
  if (discountEnabled && canDiscount) {
    discount = Math.max(0, Number(payload.discount_amount ?? 0) || 0);
  }
  const lateFeeEnabled = Boolean(payload.late_fee_enabled);
  const lateFee = lateFeeEnabled
    ? Math.max(0, Number(payload.late_fee_amount ?? 0) || 0)
    : 0;
  const allowSeatSelection = Boolean(payload.allow_seat_selection);
  if (allowSeatSelection) {
    if (student.current_seat_id) {
      throw new AppError("Seat selection can only be sent to students without an assigned seat", 400);
    }
    const availableSeat = await queryOne(
      `SELECT id
       FROM seats
       WHERE workspace_owner_id = ? AND status = 'available'
       LIMIT 1`,
      [workspaceOwnerId]
    );
    if (!availableSeat) {
      throw new AppError("No available seats to offer", 400);
    }
  }

  const total = Math.max(0, amount + deposit + lateFee - discount);

  const id = randomUUID();
  await query(
    `INSERT INTO scheduled_payment_requests
       (id, workspace_owner_id, student_id, plan_id, type, amount,
        valid_from, valid_until, notes, status,
        deposit_amount, discount_enabled, discount_amount, total_amount,
        late_fee_enabled, late_fee_amount, allow_seat_selection)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, workspaceOwnerId, student_id, plan_id, type, amount,
      valid_from, valid_until, notes ?? null,
      deposit, discountEnabled && canDiscount ? 1 : 0, discount, total,
      lateFeeEnabled ? 1 : 0, lateFee, allowSeatSelection ? 1 : 0,
    ]
  );

  await recordAudit(
    {
      workspaceOwnerId,
      objectType: "payments",
      objectId: id,
      action: "scheduled-request-created",
      actorId: audit?.actor_id,
      actorRole: audit?.actor_role,
      metadata: {
        student_id, plan_id, type, amount, valid_from, valid_until,
        deposit_amount: deposit,
        discount_amount: discount,
        late_fee_amount: lateFee,
        allow_seat_selection: allowSeatSelection,
        total_amount: total,
      },
    }
  );

  return {
    id, student_id, plan_id, type, amount,
    valid_from, valid_until, notes: notes ?? null, status: "sent",
    deposit_amount: deposit,
    discount_enabled: discountEnabled && canDiscount,
    discount_amount: discount,
    late_fee_enabled: lateFeeEnabled,
    late_fee_amount: lateFee,
    allow_seat_selection: allowSeatSelection,
    total_amount: total,
    student_name: student.name, student_phone: student.phone, plan_name: plan.name,
  };
}

/**
 * List all pending (status='sent') scheduled requests for a workspace.
 */
export async function listScheduledPaymentRequests(workspaceOwnerId, { status } = {}) {
  const filters = ["spr.workspace_owner_id = ?"];
  const params = [workspaceOwnerId];
  if (status) {
    filters.push("spr.status = ?");
    params.push(status);
  }

  const rows = await query(
    `SELECT spr.*,
            s.name  AS student_name,
            s.phone AS student_phone,
            p.name  AS plan_name
     FROM scheduled_payment_requests spr
     JOIN students s ON s.id = spr.student_id
     JOIN plans    p ON p.id = spr.plan_id
     WHERE ${filters.join(" AND ")}
     ORDER BY spr.created_at DESC`,
    params
  );
  return rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
    deposit_amount: Number(r.deposit_amount ?? 0),
    discount_enabled: toBoolean(r.discount_enabled),
    discount_amount: Number(r.discount_amount ?? 0),
    late_fee_enabled: toBoolean(r.late_fee_enabled),
    late_fee_amount: Number(r.late_fee_amount ?? 0),
    allow_seat_selection: toBoolean(r.allow_seat_selection),
    total_amount:
      r.total_amount !== null && r.total_amount !== undefined
        ? Number(r.total_amount)
        : Number(r.amount) +
          Number(r.deposit_amount ?? 0) +
          Number(r.late_fee_amount ?? 0) -
          Number(r.discount_amount ?? 0),
    valid_from: toDateString(r.valid_from),
    valid_until: toDateString(r.valid_until),
  }));
}

/**
 * Admin cancels a scheduled request before student pays.
 */
export async function cancelScheduledPaymentRequest(workspaceOwnerId, requestId, audit = null) {
  const req = await queryOne(
    "SELECT * FROM scheduled_payment_requests WHERE id = ? AND workspace_owner_id = ? LIMIT 1",
    [requestId, workspaceOwnerId]
  );
  if (!req) throw new AppError("Scheduled request not found", 404);
  if (req.status !== "sent") throw new AppError(`Request is already ${req.status}`, 400);

  await query(
    "UPDATE scheduled_payment_requests SET status = 'cancelled' WHERE id = ?",
    [requestId]
  );
  return { id: requestId, status: "cancelled" };
}

/**
 * Student pays a scheduled request via Razorpay (called after payment verify).
 * Marks the request as 'paid' and calls createPayment().
 */
export async function fulfillScheduledPaymentRequest(workspaceOwnerId, requestId, paymentMode, audit = null) {
  const req = await queryOne(
    "SELECT * FROM scheduled_payment_requests WHERE id = ? AND workspace_owner_id = ? LIMIT 1",
    [requestId, workspaceOwnerId]
  );
  if (!req) throw new AppError("Scheduled request not found", 404);
  if (req.status !== "sent") throw new AppError(`Request is already ${req.status}`, 400);

  // Charge the full total if present; otherwise use amount + deposit + late fee - discount.
  const chargedAmount =
    req.total_amount !== null && req.total_amount !== undefined
      ? Number(req.total_amount)
      : Number(req.amount) +
        Number(req.deposit_amount ?? 0) -
        Number(req.discount_amount ?? 0) +
        Number(req.late_fee_amount ?? 0);

  const { payment, student } = await createPayment(
    workspaceOwnerId,
    {
      student_id: req.student_id,
      plan_id: req.plan_id,
      amount_paid: Math.max(0, chargedAmount),
      valid_from: toDateString(req.valid_from),
      valid_until: toDateString(req.valid_until),
      payment_mode: paymentMode ?? "razorpay",
      notes:
        req.notes ??
        `Scheduled ${req.type} payment` +
          (Number(req.deposit_amount) ? ` (incl. Rs ${Number(req.deposit_amount)} deposit)` : "") +
          (Number(req.discount_amount) ? ` (-Rs ${Number(req.discount_amount)} discount)` : "") +
          (Number(req.late_fee_amount) ? ` (incl. Rs ${Number(req.late_fee_amount)} late fee)` : ""),
    },
    audit
  );

  // If deposit was collected as part of this scheduled request, persist it on the student row
  // so it shows up on the student profile going forward.
  if (Number(req.deposit_amount) > 0) {
    await query(
      `UPDATE students
         SET deposit_amount = deposit_amount + ?
       WHERE id = ? AND workspace_owner_id = ?`,
      [Number(req.deposit_amount), req.student_id, workspaceOwnerId]
    );
  }

  await query(
    "UPDATE scheduled_payment_requests SET status = 'paid' WHERE id = ?",
    [requestId]
  );

  return { payment, student, request_id: requestId };
}
