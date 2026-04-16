import { AppError } from "../utils/AppError.js";
import { randomUUID } from "crypto";
import { query, queryOne, withTransaction } from "../db/connection.js";
import { toBoolean, toDateString } from "../utils/data.js";
import { recordAudit } from "./audit.service.js";
import { updateStudentPlan } from "./students.service.js";

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
