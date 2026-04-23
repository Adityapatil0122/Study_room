import { randomUUID } from "crypto";
import { AppError } from "../utils/AppError.js";
import { query, queryOne, withTransaction } from "../db/connection.js";
import { toBoolean, toDateString } from "../utils/data.js";
import { buildUpdateClause } from "../utils/sql.js";
import { recordAudit, listAuditHistory } from "./audit.service.js";
import { getDefaultWorkspaceOwner } from "./auth.service.js";
import { createAdminNotification } from "./notifications.service.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function mapStudent(row) {
  return {
    ...row,
    registration_paid: toBoolean(row.registration_paid),
    is_active: toBoolean(row.is_active),
    join_date: toDateString(row.join_date),
    renewal_date: toDateString(row.renewal_date),
  };
}

async function getStudentOrThrow(studentId, workspaceOwnerId, connection) {
  const row = await queryOne(
    "SELECT * FROM students WHERE id = ? AND workspace_owner_id = ? LIMIT 1",
    [studentId, workspaceOwnerId],
    connection
  );

  if (!row) {
    throw new AppError("Student not found", 404);
  }

  return row;
}

export async function listStudents(workspaceOwnerId, { search, isActive } = {}) {
  const filters = ["workspace_owner_id = ?"];
  const params = [workspaceOwnerId];

  if (typeof isActive === "boolean") {
    filters.push("is_active = ?");
    params.push(isActive);
  }

  if (search) {
    const pattern = `%${search}%`;
    filters.push(
      "(LOWER(name) LIKE LOWER(?) OR LOWER(phone) LIKE LOWER(?) OR LOWER(email) LIKE LOWER(?) OR LOWER(aadhaar) LIKE LOWER(?))"
    );
    params.push(pattern, pattern, pattern, pattern);
  }

  const rows = await query(
    `
      SELECT *
      FROM students
      WHERE ${filters.join(" AND ")}
      ORDER BY name ASC
    `,
    params
  );

  return rows.map(mapStudent);
}

export async function createStudent(workspaceOwnerId, payload, audit = null, connection) {
  const name = payload?.name?.trim();
  if (!name) {
    throw new AppError("Student name is required", 400);
  }

  const id = randomUUID();
  await query(
    `
      INSERT INTO students (
        id,
        workspace_owner_id,
        name,
        phone,
        email,
        gender,
        aadhaar,
        pan_card,
        address,
        city,
        state,
        pincode,
        preferred_shift,
        fee_plan_type,
        fee_cycle,
        limited_days,
        registration_paid,
        join_date,
        is_active,
        current_plan_id,
        current_seat_id,
        renewal_date,
        registration_source,
        registered_by_role,
        photo_url,
        deposit_amount,
        aadhaar_file_url,
        aadhaar_file_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      workspaceOwnerId,
      name,
      payload.phone ?? null,
      payload.email?.trim() || null,
      payload.gender ?? null,
      payload.aadhaar ?? null,
      payload.pan_card ?? null,
      payload.address ?? null,
      payload.city ?? null,
      payload.state ?? null,
      payload.pincode ?? null,
      payload.preferred_shift ?? "Morning",
      payload.fee_plan_type ?? "monthly",
      payload.fee_cycle ?? "calendar",
      payload.fee_plan_type === "limited" ? payload.limited_days ?? null : null,
      Boolean(payload.registration_paid),
      payload.join_date ?? today(),
      payload.is_active !== false,
      payload.current_plan_id ?? null,
      payload.current_seat_id ?? null,
      payload.renewal_date ?? null,
      payload.registration_source ?? "admin_panel",
      payload.registered_by_role ?? null,
      payload.photo_url ?? null,
      Number(payload.deposit_amount ?? 0) || 0,
      payload.aadhaar_file_url ?? null,
      payload.aadhaar_file_type ?? null,
    ],
    connection
  );

  // Self-registration (from mobile / public enrollment) → notify admin.
  const source = payload.registration_source ?? "admin_panel";
  if (source !== "admin_panel") {
    try {
      await createAdminNotification(
        {
          workspaceOwnerId,
          type: "student-registered",
          title: "New user created",
          message: `${name}${payload.phone ? ` (${payload.phone})` : ""} created a student account${
            Number(payload.deposit_amount)
              ? ` with deposit ₹${Number(payload.deposit_amount)}`
              : ""
          }. Send them a plan.`,
          objectType: "students",
          objectId: id,
        },
        connection
      );
    } catch {
      // Non-fatal: registration should still succeed even if notification insert fails.
    }
  }

  await recordAudit(
    {
      workspaceOwnerId,
      objectType: "students",
      objectId: id,
      action: "create",
      actorId: audit?.actor_id,
      actorRole: audit?.actor_role,
      metadata: {
        name,
        phone: payload.phone ?? null,
      },
    },
    connection
  );

  const row = await queryOne("SELECT * FROM students WHERE id = ?", [id], connection);
  return mapStudent(row);
}

export async function updateStudent(studentId, workspaceOwnerId, updates, audit = null, connection) {
  await getStudentOrThrow(studentId, workspaceOwnerId, connection);

  const patch = {
    name: updates.name !== undefined ? String(updates.name).trim() : undefined,
    phone: updates.phone,
    email:
      updates.email === undefined
        ? undefined
        : updates.email?.trim()
        ? updates.email.trim()
        : null,
    gender: updates.gender,
    aadhaar: updates.aadhaar,
    pan_card: updates.pan_card,
    address: updates.address,
    city: updates.city,
    state: updates.state,
    pincode: updates.pincode,
    preferred_shift: updates.preferred_shift,
    fee_plan_type: updates.fee_plan_type,
    fee_cycle: updates.fee_cycle,
    limited_days:
      updates.fee_plan_type === "limited"
        ? updates.limited_days ?? null
        : updates.fee_plan_type
        ? null
        : updates.limited_days,
    registration_paid:
      updates.registration_paid === undefined ? undefined : Boolean(updates.registration_paid),
    join_date: updates.join_date,
    is_active: updates.is_active === undefined ? undefined : Boolean(updates.is_active),
    current_plan_id: updates.current_plan_id,
    current_seat_id: updates.current_seat_id,
    renewal_date: updates.renewal_date,
    registration_source: updates.registration_source,
    registered_by_role: updates.registered_by_role,
    photo_url: updates.photo_url,
    deposit_amount:
      updates.deposit_amount === undefined
        ? undefined
        : Number(updates.deposit_amount) || 0,
    aadhaar_file_url: updates.aadhaar_file_url,
    aadhaar_file_type: updates.aadhaar_file_type,
  };

  Object.keys(patch).forEach((key) => {
    if (patch[key] === undefined) {
      delete patch[key];
    }
  });

  if ("name" in patch && !patch.name) {
    throw new AppError("Student name cannot be empty", 400);
  }

  const { clause, values } = buildUpdateClause(patch);
  if (clause) {
    await query(
      `UPDATE students SET ${clause} WHERE id = ? AND workspace_owner_id = ?`,
      [...values, studentId, workspaceOwnerId],
      connection
    );
  }

  await recordAudit(
    {
      workspaceOwnerId,
      objectType: "students",
      objectId: studentId,
      action: "update",
      actorId: audit?.actor_id,
      actorRole: audit?.actor_role,
      metadata: patch,
    },
    connection
  );

  const row = await queryOne("SELECT * FROM students WHERE id = ?", [studentId], connection);
  return mapStudent(row);
}

export async function toggleStudentActive(studentId, workspaceOwnerId, audit = null, connection) {
  const student = await getStudentOrThrow(studentId, workspaceOwnerId, connection);
  const nextValue = !toBoolean(student.is_active);

  await query(
    "UPDATE students SET is_active = ? WHERE id = ? AND workspace_owner_id = ?",
    [nextValue, studentId, workspaceOwnerId],
    connection
  );

  await recordAudit(
    {
      workspaceOwnerId,
      objectType: "students",
      objectId: studentId,
      action: nextValue ? "activate" : "deactivate",
      actorId: audit?.actor_id,
      actorRole: audit?.actor_role,
      metadata: {
        previous_active: toBoolean(student.is_active),
        is_active: nextValue,
      },
    },
    connection
  );

  const row = await queryOne("SELECT * FROM students WHERE id = ?", [studentId], connection);
  return mapStudent(row);
}

export async function updateStudentPlan(studentId, workspaceOwnerId, planId, renewalDate, connection) {
  await query(
    `
      UPDATE students
      SET current_plan_id = ?, renewal_date = ?
      WHERE id = ? AND workspace_owner_id = ?
    `,
    [planId, renewalDate ?? null, studentId, workspaceOwnerId],
    connection
  );

  const row = await queryOne("SELECT * FROM students WHERE id = ?", [studentId], connection);
  return mapStudent(row);
}

export async function clearStudentSeat(studentId, workspaceOwnerId, connection) {
  await query(
    `
      UPDATE students
      SET current_seat_id = NULL
      WHERE id = ? AND workspace_owner_id = ?
    `,
    [studentId, workspaceOwnerId],
    connection
  );

  const row = await queryOne("SELECT * FROM students WHERE id = ?", [studentId], connection);
  return mapStudent(row);
}

export async function assignSeatToStudent(studentId, workspaceOwnerId, seatId, connection) {
  await query(
    `
      UPDATE students
      SET current_seat_id = ?
      WHERE id = ? AND workspace_owner_id = ?
    `,
    [seatId, studentId, workspaceOwnerId],
    connection
  );

  const row = await queryOne("SELECT * FROM students WHERE id = ?", [studentId], connection);
  return mapStudent(row);
}

export async function listStudentHistory(workspaceOwnerId, studentId) {
  await getStudentOrThrow(studentId, workspaceOwnerId);
  return listAuditHistory(workspaceOwnerId, {
    objectType: "students",
    objectId: studentId,
    limit: 50,
  });
}

export async function importStudents(workspaceOwnerId, rows, audit = null) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  return withTransaction(async (connection) => {
    const inserted = [];
    for (const row of rows) {
      inserted.push(await createStudent(workspaceOwnerId, row, audit, connection));
    }
    return inserted;
  });
}

export async function createPublicEnrollment(payload) {
  const workspaceOwner = await getDefaultWorkspaceOwner();
  return createStudent(workspaceOwner.id, payload, {
    actor_role: payload.registered_by_role ?? "Self",
    actor_id: null,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Membership Hold / Resume
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Put a student's membership on hold.
 * - Sets membership_status = 'on_hold' on the student row.
 * - Snapshots the current renewal_date so we can restore + extend it on resume.
 * - Inserts a membership_holds row with hold_start = today.
 */
export async function holdMembership(workspaceOwnerId, studentId, notes, audit = null) {
  return withTransaction(async (connection) => {
    const student = await getStudentOrThrow(studentId, workspaceOwnerId, connection);

    if (student.membership_status === "on_hold") {
      throw new AppError("Membership is already on hold", 400);
    }

    const holdStart = new Date().toISOString().slice(0, 10);

    // Snapshot current renewal_date so resume can calculate days credited.
    await query(
      `UPDATE students
       SET membership_status = 'on_hold',
           hold_start = ?,
           hold_renewal_snapshot = renewal_date
       WHERE id = ? AND workspace_owner_id = ?`,
      [holdStart, studentId, workspaceOwnerId],
      connection
    );

    const holdId = randomUUID();
    await query(
      `INSERT INTO membership_holds
         (id, workspace_owner_id, student_id, hold_start, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [holdId, workspaceOwnerId, studentId, holdStart, notes ?? null],
      connection
    );

    await recordAudit(
      {
        workspaceOwnerId,
        objectType: "students",
        objectId: studentId,
        action: "membership-hold",
        actorId: audit?.actor_id,
        actorRole: audit?.actor_role,
        metadata: { hold_start: holdStart, renewal_snapshot: toDateString(student.renewal_date) },
      },
      connection
    );

    const row = await queryOne("SELECT * FROM students WHERE id = ?", [studentId], connection);
    return { student: mapStudent(row), hold_id: holdId };
  });
}

/**
 * Resume a student's membership after a hold.
 * - Calculates days_on_hold = today - hold_start.
 * - Adds those days to the snapshotted renewal_date → new renewal_date.
 * - Sets membership_status = 'active', clears hold columns.
 * - Closes the open membership_holds row.
 */
export async function resumeMembership(workspaceOwnerId, studentId, notes, audit = null) {
  return withTransaction(async (connection) => {
    const student = await getStudentOrThrow(studentId, workspaceOwnerId, connection);

    if (student.membership_status !== "on_hold") {
      throw new AppError("Membership is not currently on hold", 400);
    }

    const today = new Date().toISOString().slice(0, 10);
    const holdStart = toDateString(student.hold_start);
    const renewalSnapshot = toDateString(student.hold_renewal_snapshot);

    // Calculate how many days they were on hold.
    let newRenewalDate = renewalSnapshot;
    if (holdStart && renewalSnapshot) {
      const holdStartMs = Date.parse(holdStart);
      const resumeMs = Date.parse(today);
      const daysOnHold = Math.max(0, Math.round((resumeMs - holdStartMs) / 86400000));
      const extendedMs = Date.parse(renewalSnapshot) + daysOnHold * 86400000;
      newRenewalDate = new Date(extendedMs).toISOString().slice(0, 10);
    }

    await query(
      `UPDATE students
       SET membership_status = 'active',
           hold_start = NULL,
           hold_renewal_snapshot = NULL,
           renewal_date = ?
       WHERE id = ? AND workspace_owner_id = ?`,
      [newRenewalDate, studentId, workspaceOwnerId],
      connection
    );

    // Close the open hold record.
    await query(
      `UPDATE membership_holds
       SET hold_end = ?, resumed_at = CURRENT_TIMESTAMP, notes = COALESCE(?, notes)
       WHERE student_id = ? AND workspace_owner_id = ? AND hold_end IS NULL`,
      [today, notes ?? null, studentId, workspaceOwnerId],
      connection
    );

    await recordAudit(
      {
        workspaceOwnerId,
        objectType: "students",
        objectId: studentId,
        action: "membership-resume",
        actorId: audit?.actor_id,
        actorRole: audit?.actor_role,
        metadata: {
          hold_start: holdStart,
          resume_date: today,
          old_renewal: renewalSnapshot,
          new_renewal: newRenewalDate,
        },
      },
      connection
    );

    const row = await queryOne("SELECT * FROM students WHERE id = ?", [studentId], connection);
    return mapStudent(row);
  });
}

/**
 * List all hold records for a student.
 */
export async function listStudentHolds(workspaceOwnerId, studentId) {
  await getStudentOrThrow(studentId, workspaceOwnerId);
  const rows = await query(
    `SELECT * FROM membership_holds
     WHERE workspace_owner_id = ? AND student_id = ?
     ORDER BY hold_start DESC`,
    [workspaceOwnerId, studentId]
  );
  return rows.map((r) => ({
    ...r,
    hold_start: toDateString(r.hold_start),
    hold_end: toDateString(r.hold_end),
  }));
}
