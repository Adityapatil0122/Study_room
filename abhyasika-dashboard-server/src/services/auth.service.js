import { AppError } from "../utils/AppError.js";
import { comparePassword, signAuthToken } from "../utils/auth.js";
import { parseJson, toBoolean } from "../utils/data.js";
import { queryOne } from "../db/connection.js";

function mapRoleFromRow(row) {
  if (!row?.joined_role_id) {
    return null;
  }

  return {
    id: row.joined_role_id,
    name: row.joined_role_name,
    description: row.joined_role_description,
    permissions: parseJson(row.joined_role_permissions, {}),
  };
}

export function mapAdminRow(row) {
  if (!row) return null;

  const role = mapRoleFromRow(row);

  return {
    id: row.id,
    owner_id: row.owner_id || row.id,
    role_id: row.role_id || role?.id || null,
    email: row.email,
    password_hash: row.password_hash,
    full_name: row.full_name,
    is_owner: toBoolean(row.is_owner),
    is_active: toBoolean(row.is_active),
    invite_status: row.invite_status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    role,
  };
}

async function findAdmin(sql, params) {
  const row = await queryOne(
    `
      SELECT
        a.*,
        r.id AS joined_role_id,
        r.name AS joined_role_name,
        r.description AS joined_role_description,
        r.permissions AS joined_role_permissions
      FROM admins a
      LEFT JOIN admin_roles r ON r.id = a.role_id
      ${sql}
      LIMIT 1
    `,
    params
  );

  return mapAdminRow(row);
}

export function buildSessionUser(admin) {
  const roleIds = admin?.role ? [admin.role.id] : [];
  const roleNames = admin?.role ? [admin.role.name] : [];

  return {
    id: admin.id,
    email: admin.email,
    user_metadata: {
      name: admin.full_name || admin.email,
      full_name: admin.full_name || admin.email,
      owner_id: admin.owner_id || admin.id,
      role_ids: roleIds,
      role_names: roleNames,
    },
    app_metadata: {
      owner_id: admin.owner_id || admin.id,
      roles: roleNames,
      is_owner: admin.is_owner,
    },
  };
}

export function createSession(admin, token = null) {
  const payload = {
    sub: admin.id,
    owner_id: admin.owner_id || admin.id,
    role_id: admin.role?.id ?? null,
    email: admin.email,
    full_name: admin.full_name || admin.email,
    is_owner: admin.is_owner,
  };

  return {
    access_token: token ?? signAuthToken(payload),
    user: buildSessionUser(admin),
  };
}

export async function findAdminByEmail(email) {
  return findAdmin("WHERE LOWER(a.email) = LOWER(?)", [email]);
}

export async function findAdminById(id) {
  return findAdmin("WHERE a.id = ?", [id]);
}

export async function getDefaultWorkspaceOwner() {
  const admin = await findAdmin(
    "WHERE a.is_owner = TRUE AND a.is_active = TRUE ORDER BY a.created_at ASC",
    []
  );

  if (!admin) {
    throw new AppError("No workspace owner account is configured yet.", 500);
  }

  return admin;
}

export async function loginAdmin({ email, password }) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const admin = await findAdminByEmail(normalizedEmail);

  if (!admin || !admin.password_hash) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!admin.is_active) {
    throw new AppError("This account is inactive", 403);
  }

  const passwordMatches = await comparePassword(password, admin.password_hash);
  if (!passwordMatches) {
    throw new AppError("Invalid email or password", 401);
  }

  return createSession(admin);
}
