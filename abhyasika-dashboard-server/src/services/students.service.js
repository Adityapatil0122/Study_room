import { randomUUID } from "crypto";
import { AppError } from "../utils/AppError.js";
import { query, queryOne, withTransaction } from "../db/connection.js";
import { toBoolean, toDateString } from "../utils/data.js";
import { buildUpdateClause } from "../utils/sql.js";
import { recordAudit, listAuditHistory } from "./audit.service.js";
import { getDefaultWorkspaceOwner } from "./auth.service.js";

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
    filters.push("(name ILIKE ? OR phone ILIKE ? OR email ILIKE ? OR aadhaar ILIKE ?)");
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
        photo_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    ],
    connection
  );

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
