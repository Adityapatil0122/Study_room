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

const EDITABLE_FIELDS = [
  "name",
  "email",
  "address",
  "city",
  "state",
  "pincode",
  "preferred_shift",
];

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
     WHERE workspace_owner_id = ? AND is_active = 1
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

  return {
    plan,
    seat,
    renewal_date: student.renewal_date,
    days_remaining: daysRemaining,
    registration_paid: student.registration_paid,
    fee_plan_type: student.fee_plan_type,
    preferred_shift: student.preferred_shift,
  };
}

export async function listStudentPayments(studentId, workspaceOwnerId) {
  const onlinePayments = await query(
    `SELECT sp.*, p.name AS plan_name
     FROM student_payments sp
     LEFT JOIN plans p ON p.id = sp.plan_id
     WHERE sp.student_id = ? AND sp.workspace_owner_id = ?
     ORDER BY sp.created_at DESC`,
    [studentId, workspaceOwnerId]
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
      payment_date: row.payment_date,
    })),
    all: offlinePayments.map((row) => ({
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
  { plan_id }
) {
  if (!plan_id) {
    throw new AppError("plan_id is required", 400);
  }

  const plan = await queryOne(
    `SELECT id, name, price, duration_days FROM plans WHERE id = ? AND workspace_owner_id = ? LIMIT 1`,
    [plan_id, workspaceOwnerId]
  );
  if (!plan) throw new AppError("Plan not found", 404);

  const amount = Number(plan.price);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError("Plan has an invalid price", 400);
  }

  const amountPaise = Math.round(amount * 100);
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
        amount, currency, razorpay_order_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'created')
    `,
    [id, workspaceOwnerId, studentId, plan_id, amount, "INR", order.id]
  );

  return {
    id,
    razorpay_order_id: order.id,
    razorpay_key_id: getPublicKeyId(),
    amount: amountPaise,
    currency: order.currency ?? "INR",
    plan: {
      id: plan.id,
      name: plan.name,
      price: amount,
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
  const { payment, student } = await createPayment(
    workspaceOwnerId,
    {
      student_id: studentId,
      plan_id: pending.plan_id,
      amount_paid: Number(pending.amount),
      payment_mode: "razorpay",
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

  return {
    status: "paid",
    student_payment_id: pending.id,
    payment,
    student,
  };
}
