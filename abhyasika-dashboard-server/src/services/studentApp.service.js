import { randomUUID } from "crypto";
import { AppError } from "../utils/AppError.js";
import { query, queryOne, withTransaction } from "../db/connection.js";
import { toBoolean, toDateString } from "../utils/data.js";
import { createPayment } from "./payments.service.js";
import {
  createOrder,
  verifySignature,
  getPublicKeyId,
} from "./razorpay.service.js";
import { parseJson } from "../utils/data.js";

const EDITABLE_FIELDS = [
  "name",
  "email",
  "address",
  "city",
  "state",
  "pincode",
  "preferred_shift",
];

/**
 * Calculate billing dates for a student payment.
 *
 * Calendar-cycle rule:
 *   - If joining on the 1st → full fee, valid_until = last day of that month.
 *   - Otherwise → prorated fee (days from join to end of month), valid_until = last day of that month.
 *   - Subsequent renewals are always 1st–last of the next month at full fee.
 *
 * @param {string} joinDateStr  "YYYY-MM-DD"  (student's join_date or today for renewal)
 * @param {number} monthlyFee
 * @param {boolean} isRenewal   true = skip proration, use 1st of NEXT month
 * @returns {{ valid_from: string, valid_until: string, amount: number, prorated: boolean }}
 */
function calcBillingDates(joinDateStr, monthlyFee, isRenewal = false) {
  const fee = Number(monthlyFee);

  if (isRenewal) {
    // Next month, 1st → last
    const today = new Date();
    const year = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
    const month = (today.getMonth() + 1) % 12; // 0-indexed next month
    const firstOfNext = new Date(year, month, 1);
    const lastOfNext = new Date(year, month + 1, 0);
    return {
      valid_from: firstOfNext.toISOString().slice(0, 10),
      valid_until: lastOfNext.toISOString().slice(0, 10),
      amount: fee,
      prorated: false,
    };
  }

  // First payment — check join day
  const join = new Date(joinDateStr);
  const joinDay = join.getDate();
  const joinYear = join.getFullYear();
  const joinMonth = join.getMonth(); // 0-indexed

  // Last day of join month
  const lastOfMonth = new Date(joinYear, joinMonth + 1, 0);
  const daysInMonth = lastOfMonth.getDate();

  if (joinDay === 1) {
    return {
      valid_from: joinDateStr,
      valid_until: lastOfMonth.toISOString().slice(0, 10),
      amount: fee,
      prorated: false,
    };
  }

  // Prorate: inclusive days from joinDay to end of month
  const daysFromJoin = daysInMonth - joinDay + 1;
  const proratedAmount = Math.round(fee * daysFromJoin / daysInMonth);

  return {
    valid_from: joinDateStr,
    valid_until: lastOfMonth.toISOString().slice(0, 10),
    amount: proratedAmount,
    prorated: true,
    days_remaining_in_month: daysFromJoin,
    days_in_month: daysInMonth,
  };
}

function mapStudent(row) {
  if (!row) return null;
  return {
    ...row,
    registration_paid: toBoolean(row.registration_paid),
    is_active: toBoolean(row.is_active),
    join_date: toDateString(row.join_date),
    renewal_date: toDateString(row.renewal_date),
  };
}

async function getStudent(studentId, workspaceOwnerId) {
  const row = await queryOne(
    `SELECT * FROM students WHERE id = ? AND workspace_owner_id = ? LIMIT 1`,
    [studentId, workspaceOwnerId]
  );
  if (!row) throw new AppError("Student not found", 404);
  return mapStudent(row);
}

export async function getProfile(studentId, workspaceOwnerId) {
  return getStudent(studentId, workspaceOwnerId);
}

export async function updateProfile(studentId, workspaceOwnerId, updates) {
  const allowedUpdates = {};
  for (const field of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updates ?? {}, field)) {
      allowedUpdates[field] = updates[field];
    }
  }

  if (Object.keys(allowedUpdates).length === 0) {
    return getStudent(studentId, workspaceOwnerId);
  }

  const setClauses = Object.keys(allowedUpdates).map((key) => `${key} = ?`);
  const params = Object.values(allowedUpdates);
  params.push(studentId, workspaceOwnerId);

  await query(
    `UPDATE students SET ${setClauses.join(", ")} WHERE id = ? AND workspace_owner_id = ?`,
    params
  );

  return getStudent(studentId, workspaceOwnerId);
}

export async function listAvailablePlans(workspaceOwnerId) {
  return query(
    `SELECT id, name, price, duration_days, is_active
     FROM plans
     WHERE workspace_owner_id = ? AND is_active = TRUE
     ORDER BY price ASC`,
    [workspaceOwnerId]
  );
}

export async function getSubscription(studentId, workspaceOwnerId) {
  const student = await getStudent(studentId, workspaceOwnerId);

  let plan = null;
  if (student.current_plan_id) {
    plan = await queryOne(
      `SELECT id, name, price, duration_days FROM plans WHERE id = ? LIMIT 1`,
      [student.current_plan_id]
    );
  }

  let seat = null;
  if (student.current_seat_id) {
    seat = await queryOne(
      `SELECT id, seat_number, status FROM seats WHERE id = ? LIMIT 1`,
      [student.current_seat_id]
    );
  }

  let daysRemaining = null;
  if (student.renewal_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const renewal = new Date(student.renewal_date);
    renewal.setHours(0, 0, 0, 0);
    daysRemaining = Math.ceil((renewal - today) / 86400000);
  }

  // Check if there's a pending QR payment awaiting admin approval
  const pendingQr = await queryOne(
    `SELECT id, amount, valid_from, valid_until, created_at
     FROM pending_payments
     WHERE student_id = ? AND status = 'pending'
     ORDER BY created_at DESC LIMIT 1`,
    [studentId]
  );

  // Check for a pending scheduled payment request from admin
  const scheduledRequest = await queryOne(
    `SELECT spr.*, p.name AS plan_name
     FROM scheduled_payment_requests spr
     JOIN plans p ON p.id = spr.plan_id
     WHERE spr.student_id = ? AND spr.status = 'sent'
     ORDER BY spr.created_at DESC LIMIT 1`,
    [studentId]
  );

  return {
    plan,
    seat,
    renewal_date: student.renewal_date,
    days_remaining: daysRemaining,
    registration_paid: student.registration_paid,
    fee_plan_type: student.fee_plan_type,
    preferred_shift: student.preferred_shift,
    membership_status: student.membership_status ?? "active",
    hold_start: toDateString(student.hold_start),
    pending_qr: pendingQr
      ? {
          id: pendingQr.id,
          amount: Number(pendingQr.amount),
          valid_from: toDateString(pendingQr.valid_from),
          valid_until: toDateString(pendingQr.valid_until),
          submitted_at: pendingQr.created_at,
        }
      : null,
    scheduled_request: scheduledRequest
      ? {
          id: scheduledRequest.id,
          plan_id: scheduledRequest.plan_id,
          type: scheduledRequest.type,
          amount: Number(scheduledRequest.amount),
          deposit_amount: Number(scheduledRequest.deposit_amount ?? 0),
          discount_enabled: Boolean(scheduledRequest.discount_enabled),
          discount_amount: Number(scheduledRequest.discount_amount ?? 0),
          total_amount:
            scheduledRequest.total_amount != null
              ? Number(scheduledRequest.total_amount)
              : Math.max(
                  0,
                  Number(scheduledRequest.amount) +
                    Number(scheduledRequest.deposit_amount ?? 0) -
                    Number(scheduledRequest.discount_amount ?? 0)
                ),
          valid_from: toDateString(scheduledRequest.valid_from),
          valid_until: toDateString(scheduledRequest.valid_until),
          plan_name: scheduledRequest.plan_name,
          notes: scheduledRequest.notes,
        }
      : null,
  };
}

export async function listStudentPayments(studentId, workspaceOwnerId) {
  const onlinePayments = await query(
    `SELECT sp.*, p.name AS plan_name
     FROM student_payments sp
     LEFT JOIN plans p ON p.id = sp.plan_id
     WHERE sp.student_id = ? AND sp.workspace_owner_id = ? AND sp.status = 'paid'
     ORDER BY sp.payment_date DESC`,
    [studentId, workspaceOwnerId]
  );

  // Collect linked_payment_ids from Razorpay rows so we can exclude them from
  // the "all" (offline) list — Razorpay payments land in BOTH tables via createPayment(),
  // so without this filter they'd appear twice in the merged payment history.
  const linkedIds = new Set(
    onlinePayments.map((r) => r.linked_payment_id).filter(Boolean)
  );

  const offlinePayments = await query(
    `SELECT py.*, p.name AS plan_name
     FROM payments py
     LEFT JOIN plans p ON p.id = py.plan_id
     WHERE py.student_id = ? AND py.workspace_owner_id = ?
     ORDER BY py.payment_date DESC`,
    [studentId, workspaceOwnerId]
  );

  return {
    online: onlinePayments.map((row) => ({
      ...row,
      // Normalize field names so mobile can treat both lists uniformly
      amount_paid: Number(row.amount),
      payment_mode: row.payment_mode ?? "razorpay",
      valid_from: toDateString(row.valid_from),
      valid_until: toDateString(row.valid_until),
      payment_date: row.payment_date ?? row.created_at,
    })),
    // Exclude any payments already represented by a Razorpay online entry
    all: offlinePayments
      .filter((row) => !linkedIds.has(row.id))
      .map((row) => ({
        ...row,
        valid_from: toDateString(row.valid_from),
        valid_until: toDateString(row.valid_until),
        includes_registration: toBoolean(row.includes_registration),
      })),
  };
}

export async function createRazorpayOrderForStudent(
  studentId,
  workspaceOwnerId,
  { plan_id, is_renewal }
) {
  if (!plan_id) {
    throw new AppError("plan_id is required", 400);
  }

  const plan = await queryOne(
    `SELECT id, name, price, duration_days FROM plans WHERE id = ? AND workspace_owner_id = ? LIMIT 1`,
    [plan_id, workspaceOwnerId]
  );
  if (!plan) throw new AppError("Plan not found", 404);

  const student = await getStudent(studentId, workspaceOwnerId);

  const billing = calcBillingDates(
    student.join_date ?? new Date().toISOString().slice(0, 10),
    Number(plan.price),
    Boolean(is_renewal)
  );

  if (!Number.isFinite(billing.amount) || billing.amount <= 0) {
    throw new AppError("Plan has an invalid price", 400);
  }

  const amountPaise = Math.round(billing.amount * 100);
  const receipt = `stu_${studentId.slice(0, 8)}_${Date.now()}`.slice(0, 40);

  const order = await createOrder({
    amountPaise,
    currency: "INR",
    receipt,
    notes: {
      student_id: studentId,
      plan_id,
      workspace_owner_id: workspaceOwnerId,
    },
  });

  const id = randomUUID();
  await query(
    `
      INSERT INTO student_payments (
        id, workspace_owner_id, student_id, plan_id,
        amount, currency, razorpay_order_id, status,
        valid_from, valid_until
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'created', ?, ?)
    `,
    [
      id, workspaceOwnerId, studentId, plan_id,
      billing.amount, "INR", order.id,
      billing.valid_from, billing.valid_until,
    ]
  );

  return {
    id,
    razorpay_order_id: order.id,
    razorpay_key_id: getPublicKeyId(),
    amount: amountPaise,
    currency: order.currency ?? "INR",
    valid_from: billing.valid_from,
    valid_until: billing.valid_until,
    prorated: billing.prorated,
    days_remaining_in_month: billing.days_remaining_in_month ?? null,
    plan: {
      id: plan.id,
      name: plan.name,
      price: Number(plan.price),
      duration_days: plan.duration_days,
    },
  };
}

export async function verifyRazorpayPaymentForStudent(
  studentId,
  workspaceOwnerId,
  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
) {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new AppError(
      "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
      400
    );
  }

  const valid = verifySignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!valid) {
    await query(
      `UPDATE student_payments SET status = 'failed', razorpay_payment_id = ?, razorpay_signature = ?
       WHERE razorpay_order_id = ? AND student_id = ? AND workspace_owner_id = ?`,
      [
        razorpay_payment_id,
        razorpay_signature,
        razorpay_order_id,
        studentId,
        workspaceOwnerId,
      ]
    );
    throw new AppError("Invalid payment signature", 400);
  }

  const pending = await queryOne(
    `SELECT * FROM student_payments
     WHERE razorpay_order_id = ? AND student_id = ? AND workspace_owner_id = ?
     LIMIT 1`,
    [razorpay_order_id, studentId, workspaceOwnerId]
  );
  if (!pending) {
    throw new AppError("Payment order not found", 404);
  }
  if (pending.status === "paid") {
    return { status: "paid", student_payment_id: pending.id };
  }

  // Record an admin-visible payment in the existing payments table, which
  // also updates the student's current_plan_id and renewal_date.
  // Use the billing dates stored on the student_payments row (set during order creation).
  const { payment, student } = await createPayment(
    workspaceOwnerId,
    {
      student_id: studentId,
      plan_id: pending.plan_id,
      amount_paid: Number(pending.amount),
      payment_mode: "razorpay",
      valid_from: pending.valid_from ? toDateString(pending.valid_from) : undefined,
      valid_until: pending.valid_until ? toDateString(pending.valid_until) : undefined,
      notes: `Razorpay order ${razorpay_order_id} / payment ${razorpay_payment_id}`,
    },
    { actor_id: studentId, actor_role: "Student" }
  );

  await query(
    `UPDATE student_payments
     SET status = 'paid',
         razorpay_payment_id = ?,
         razorpay_signature = ?,
         payment_date = CURRENT_TIMESTAMP,
         linked_payment_id = ?
     WHERE id = ?`,
    [razorpay_payment_id, razorpay_signature, payment.id, pending.id]
  );

  // Mark any open scheduled_payment_request for this student as 'paid'
  // so the student's home screen no longer shows the "Pay Now" banner.
  await query(
    `UPDATE scheduled_payment_requests
     SET status = 'paid'
     WHERE student_id = ? AND workspace_owner_id = ? AND status = 'sent'`,
    [studentId, workspaceOwnerId]
  );

  return {
    status: "paid",
    student_payment_id: pending.id,
    payment,
    student,
  };
}

async function getWorkspaceQrSettings(workspaceOwnerId) {
  const settings = await queryOne(
    "SELECT preferences FROM admin_settings WHERE admin_id = ? LIMIT 1",
    [workspaceOwnerId]
  );
  const prefs = parseJson(settings?.preferences, {});
  return {
    upi_qr_url: prefs.upiQrUrl ?? null,
  };
}

async function getLatestPendingQrPayment(studentId, workspaceOwnerId) {
  const pendingQr = await queryOne(
    `SELECT id, plan_id, amount, valid_from, valid_until, created_at
     FROM pending_payments
     WHERE student_id = ? AND workspace_owner_id = ? AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [studentId, workspaceOwnerId]
  );

  if (!pendingQr) return null;

  return {
    id: pendingQr.id,
    plan_id: pendingQr.plan_id,
    amount: Number(pendingQr.amount),
    valid_from: toDateString(pendingQr.valid_from),
    valid_until: toDateString(pendingQr.valid_until),
    submitted_at: pendingQr.created_at,
  };
}

async function buildQrPaymentContext(
  studentId,
  workspaceOwnerId,
  { plan_id, is_renewal }
) {
  if (!plan_id) throw new AppError("plan_id is required", 400);

  const plan = await queryOne(
    `SELECT id, name, price, duration_days FROM plans WHERE id = ? AND workspace_owner_id = ? LIMIT 1`,
    [plan_id, workspaceOwnerId]
  );
  if (!plan) throw new AppError("Plan not found", 404);

  const student = await getStudent(studentId, workspaceOwnerId);
  const billing = calcBillingDates(
    student.join_date ?? new Date().toISOString().slice(0, 10),
    Number(plan.price),
    Boolean(is_renewal)
  );
  const qrSettings = await getWorkspaceQrSettings(workspaceOwnerId);

  return {
    plan,
    billing,
    qrSettings,
  };
}

export async function previewQrPayment(
  studentId,
  workspaceOwnerId,
  payload
) {
  const { plan, billing, qrSettings } = await buildQrPaymentContext(
    studentId,
    workspaceOwnerId,
    payload
  );
  const existingPending = await getLatestPendingQrPayment(
    studentId,
    workspaceOwnerId
  );

  return {
    amount: billing.amount,
    valid_from: billing.valid_from,
    valid_until: billing.valid_until,
    prorated: billing.prorated,
    upi_qr_url: qrSettings.upi_qr_url,
    plan: { id: plan.id, name: plan.name, price: Number(plan.price) },
    existing_pending: existingPending,
  };
}

/**
 * Create a QR/offline UPI payment request that awaits admin approval.
 */
export async function createQrPaymentRequest(
  studentId,
  workspaceOwnerId,
  { plan_id, is_renewal, scheduled_request_id }
) {
  const existingPending = await getLatestPendingQrPayment(
    studentId,
    workspaceOwnerId
  );
  if (existingPending) {
    return {
      ...existingPending,
      already_pending: true,
    };
  }

  let usedPlanId, amount, valid_from, valid_until, planRow;

  if (scheduled_request_id) {
    // Use the admin's scheduled request — amount, dates, plan are already fixed there.
    const req = await queryOne(
      `SELECT spr.*, p.name AS plan_name, p.price AS plan_price
       FROM scheduled_payment_requests spr
       JOIN plans p ON p.id = spr.plan_id
       WHERE spr.id = ? AND spr.workspace_owner_id = ? AND spr.student_id = ?
       LIMIT 1`,
      [scheduled_request_id, workspaceOwnerId, studentId]
    );
    if (!req) throw new AppError("Scheduled payment request not found", 404);
    if (req.status !== "sent") throw new AppError(`Request is already ${req.status}`, 400);

    // total_amount = amount + deposit - discount (pre-computed by admin)
    const total =
      req.total_amount !== null && req.total_amount !== undefined
        ? Number(req.total_amount)
        : Math.max(
            0,
            Number(req.amount) +
              Number(req.deposit_amount ?? 0) -
              Number(req.discount_amount ?? 0)
          );

    usedPlanId  = req.plan_id;
    amount      = total;
    valid_from  = toDateString(req.valid_from);
    valid_until = toDateString(req.valid_until);
    planRow     = { id: req.plan_id, name: req.plan_name, price: Number(req.plan_price) };
  } else {
    // No scheduled request — fall back to proration calculation.
    const { plan, billing } = await buildQrPaymentContext(
      studentId,
      workspaceOwnerId,
      { plan_id, is_renewal }
    );
    usedPlanId  = plan_id;
    amount      = billing.amount;
    valid_from  = billing.valid_from;
    valid_until = billing.valid_until;
    planRow     = { id: plan.id, name: plan.name, price: Number(plan.price) };
  }

  const id = randomUUID();
  await query(
    `INSERT INTO pending_payments
       (id, workspace_owner_id, student_id, plan_id, amount, valid_from, valid_until, payment_mode, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'qr', 'pending')`,
    [id, workspaceOwnerId, studentId, usedPlanId, amount, valid_from, valid_until]
  );
  const created = await getLatestPendingQrPayment(studentId, workspaceOwnerId);

  return {
    ...(created ?? {
      id,
      plan_id: usedPlanId,
      amount,
      valid_from,
      valid_until,
      submitted_at: new Date().toISOString(),
    }),
    already_pending: false,
    plan: planRow,
  };
}

/**
 * List available seats (only status=available) for student seat selection.
 */
export async function listSeatsForStudent(workspaceOwnerId) {
  const rows = await query(
    `SELECT id, seat_number FROM seats
     WHERE workspace_owner_id = ? AND status = 'available'
     ORDER BY seat_number ASC`,
    [workspaceOwnerId]
  );
  return rows;
}

/**
 * Student selects a specific seat after their payment is confirmed.
 */
export async function selectSeatForStudent(studentId, workspaceOwnerId, seatId) {
  if (!seatId) throw new AppError("seat_id is required", 400);

  const student = await getStudent(studentId, workspaceOwnerId);

  // Must have an active paid plan
  if (!student.renewal_date) {
    throw new AppError("You must have an active plan before selecting a seat", 400);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const renewal = new Date(student.renewal_date);
  renewal.setHours(0, 0, 0, 0);
  if (renewal < today) {
    throw new AppError("Your plan has expired. Please renew before selecting a seat", 400);
  }

  if (student.current_seat_id) {
    throw new AppError("You already have a seat assigned", 400);
  }

  // Delegate to existing seats service
  const { assignSeat } = await import("./seats.service.js");
  return assignSeat(workspaceOwnerId, seatId, studentId, {
    actor_id: studentId,
    actor_role: "Student",
  });
}

/**
 * Student pays a scheduled request (from admin) via Razorpay.
 * Creates a Razorpay order pre-filled with the exact amount + dates from the request.
 */
export async function createRazorpayOrderForScheduledRequest(studentId, workspaceOwnerId, requestId) {
  const req = await queryOne(
    `SELECT spr.*, p.price AS plan_price
     FROM scheduled_payment_requests spr
     JOIN plans p ON p.id = spr.plan_id
     WHERE spr.id = ? AND spr.workspace_owner_id = ?
     LIMIT 1`,
    [requestId, workspaceOwnerId]
  );
  if (!req) throw new AppError("Scheduled payment request not found", 404);
  if (req.student_id !== studentId) throw new AppError("Not authorised", 403);
  if (req.status !== "sent") throw new AppError(`Request is already ${req.status}`, 400);

  // Use total_amount (plan fee + deposit − discount) if present, otherwise fall back to amount.
  // This ensures deposit and discount are both reflected in the Razorpay charge.
  const chargeAmount =
    req.total_amount !== null && req.total_amount !== undefined
      ? Number(req.total_amount)
      : Math.max(
          0,
          Number(req.amount) +
            Number(req.deposit_amount ?? 0) -
            Number(req.discount_amount ?? 0)
        );

  const amountPaise = Math.round(chargeAmount * 100);
  const order = await createOrder({ amount: amountPaise, currency: "INR" });

  const id = randomUUID();
  await query(
    `INSERT INTO student_payments
       (id, workspace_owner_id, student_id, plan_id,
        amount, currency, razorpay_order_id, status,
        valid_from, valid_until)
     VALUES (?, ?, ?, ?, ?, 'INR', ?, 'created', ?, ?)`,
    [id, workspaceOwnerId, studentId, req.plan_id,
     chargeAmount, order.id,
     toDateString(req.valid_from), toDateString(req.valid_until)]
  );

  return {
    id,
    razorpay_order_id: order.id,
    razorpay_key_id: getPublicKeyId(),
    amount: amountPaise,
    currency: "INR",
    valid_from: toDateString(req.valid_from),
    valid_until: toDateString(req.valid_until),
    scheduled_request_id: requestId,
    type: req.type,
  };
}

/**
 * After Razorpay verify, fulfill the scheduled request and mark it paid.
 */
export async function verifyAndFulfillScheduledRequest(
  studentId,
  workspaceOwnerId,
  { razorpay_order_id, razorpay_payment_id, razorpay_signature, scheduled_request_id }
) {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new AppError("razorpay_order_id, razorpay_payment_id, and razorpay_signature are required", 400);
  }

  const valid = verifySignature({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature });
  if (!valid) throw new AppError("Invalid payment signature", 400);

  const pending = await queryOne(
    `SELECT * FROM student_payments
     WHERE razorpay_order_id = ? AND student_id = ? AND workspace_owner_id = ?
     LIMIT 1`,
    [razorpay_order_id, studentId, workspaceOwnerId]
  );
  if (!pending) throw new AppError("Payment order not found", 404);
  if (pending.status === "paid") return { status: "paid", student_payment_id: pending.id };

  // Use fulfillScheduledPaymentRequest from payments.service to write the payment + update student
  const { fulfillScheduledPaymentRequest } = await import("./payments.service.js");
  const result = await fulfillScheduledPaymentRequest(
    workspaceOwnerId,
    scheduled_request_id,
    "razorpay",
    { actor_id: studentId, actor_role: "Student" }
  );

  await query(
    `UPDATE student_payments
     SET status = 'paid',
         razorpay_payment_id = ?,
         razorpay_signature = ?,
         payment_date = CURRENT_TIMESTAMP,
         linked_payment_id = ?
     WHERE id = ?`,
    [razorpay_payment_id, razorpay_signature, result.payment.id, pending.id]
  );

  return { status: "paid", student_payment_id: pending.id, ...result };
}
