import { randomUUID } from "crypto";
import { AppError } from "../utils/AppError.js";
import { query, queryOne } from "../db/connection.js";
import {
  hashPassword,
  comparePassword,
  signStudentAuthToken,
} from "../utils/auth.js";
import { toBoolean, toDateString } from "../utils/data.js";
import { createStudent } from "./students.service.js";
import { getDefaultWorkspaceOwner } from "./auth.service.js";

function mapStudentRow(row) {
  if (!row) return null;
  return {
    ...row,
    is_active: toBoolean(row.is_active),
    registration_paid: toBoolean(row.registration_paid),
    join_date: toDateString(row.join_date),
    renewal_date: toDateString(row.renewal_date),
  };
}

export async function findStudentByIdWithCredentials(studentId) {
  const row = await queryOne(
    `
      SELECT s.*, c.email AS login_email
      FROM students s
      INNER JOIN student_credentials c ON c.student_id = s.id
      WHERE s.id = ?
      LIMIT 1
    `,
    [studentId]
  );
  return mapStudentRow(row);
}

export async function findStudentCredentialsByEmail(email) {
  return queryOne(
    "SELECT * FROM student_credentials WHERE LOWER(email) = LOWER(?) LIMIT 1",
    [email]
  );
}

export function buildStudentSessionUser(student) {
  return {
    id: student.id,
    email: student.login_email ?? student.email,
    user_metadata: {
      name: student.name,
      phone: student.phone,
      workspace_owner_id: student.workspace_owner_id,
    },
    app_metadata: {
      type: "student",
      workspace_owner_id: student.workspace_owner_id,
    },
  };
}

export function createStudentSession(student) {
  const payload = {
    sub: student.id,
    type: "student",
    workspace_owner_id: student.workspace_owner_id,
    email: student.login_email ?? student.email,
  };

  return {
    access_token: signStudentAuthToken(payload),
    user: buildStudentSessionUser(student),
  };
}

export async function registerStudent(payload) {
  const name = payload?.name?.trim();
  const email = payload?.email?.trim().toLowerCase();
  const password = payload?.password ?? "";
  const phone = payload?.phone?.replace(/\D/g, "") ?? "";

  if (!name) {
    throw new AppError("Full name is required", 400);
  }
  if (!email || !/.+@.+\..+/.test(email)) {
    throw new AppError("A valid email is required", 400);
  }
  if (!password || password.length < 6) {
    throw new AppError("Password must be at least 6 characters", 400);
  }
  if (phone && phone.length !== 10) {
    throw new AppError("Phone number must be 10 digits", 400);
  }

  const existing = await findStudentCredentialsByEmail(email);
  if (existing) {
    throw new AppError("An account with this email already exists", 409);
  }

  const workspaceOwner = await getDefaultWorkspaceOwner();

  const student = await createStudent(
    workspaceOwner.id,
    {
      name,
      email,
      phone,
      gender: payload.gender ?? null,
      address: payload.address ?? null,
      city: payload.city ?? null,
      state: payload.state ?? null,
      pincode: payload.pincode ?? null,
      preferred_shift: payload.preferred_shift ?? "Morning",
      fee_plan_type: payload.fee_plan_type ?? "monthly",
      fee_cycle: payload.fee_cycle ?? "calendar",
      join_date: payload.join_date ?? new Date().toISOString().slice(0, 10),
      deposit_amount: Number(payload.deposit_amount ?? 0) || 0,
      aadhaar_file_url: payload.aadhaar_file_url ?? null,
      aadhaar_file_type: payload.aadhaar_file_type ?? null,
      registration_source: payload.registration_source ?? "student_app",
      registered_by_role: "Self",
    },
    { actor_role: "Self", actor_id: null }
  );

  const passwordHash = await hashPassword(password);
  await query(
    `
      INSERT INTO student_credentials (id, student_id, email, password_hash)
      VALUES (?, ?, ?, ?)
    `,
    [randomUUID(), student.id, email, passwordHash]
  );

  const fullStudent = await findStudentByIdWithCredentials(student.id);
  return createStudentSession(fullStudent);
}

export async function loginStudent({ email, password }) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const credentials = await findStudentCredentialsByEmail(normalizedEmail);
  if (!credentials) {
    throw new AppError("Invalid email or password", 401);
  }

  const matches = await comparePassword(password, credentials.password_hash);
  if (!matches) {
    throw new AppError("Invalid email or password", 401);
  }

  const student = await findStudentByIdWithCredentials(credentials.student_id);
  if (!student) {
    throw new AppError("Student account not found", 404);
  }
  if (!student.is_active) {
    throw new AppError("This account has been deactivated", 403);
  }

  return createStudentSession(student);
}

export async function getStudentSessionById(studentId) {
  const student = await findStudentByIdWithCredentials(studentId);
  if (!student) {
    throw new AppError("Student not found", 404);
  }
  return {
    user: buildStudentSessionUser(student),
  };
}
