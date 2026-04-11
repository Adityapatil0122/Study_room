import { AppError } from "../utils/AppError.js";
import { randomUUID } from "crypto";
import { query, queryOne, withTransaction } from "../db/connection.js";
import { createTemporaryPassword, hashPassword } from "../utils/auth.js";
import { parseJson } from "../utils/data.js";
import { recordAudit } from "./audit.service.js";

function mapRole(row) {
  return {
    ...row,
    permissions: parseJson(row.permissions, {}),
  };
}

function sanitizeUserResponse(user, role = null) {
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    user_metadata: {
      full_name: user.full_name || user.email,
      name: user.full_name || user.email,
      owner_id: user.owner_id || user.id,
      role_ids: role ? [role.id] : [],
      role_names: role ? [role.name] : [],
    },
    app_metadata: {
      owner_id: user.owner_id || user.id,
      roles: role ? [role.name] : [],
    },
  };
}

async function getRoleForWorkspace(roleId, workspaceOwnerId, connection) {
  if (!roleId) {
    throw new AppError("Role is required", 400);
  }

  const row = await queryOne(
    `
      SELECT *
      FROM admin_roles
      WHERE id = ? AND created_by = ?
      LIMIT 1
    `,
    [roleId, workspaceOwnerId],
    connection
  );

  if (!row) {
    throw new AppError("Role not found for this workspace", 404);
  }

  return mapRole(row);
}

export async function listRoles(workspaceOwnerId) {
  const rows = await query(
    `
      SELECT *
      FROM admin_roles
      WHERE created_by = ?
      ORDER BY name ASC
    `,
    [workspaceOwnerId]
  );

  return rows.map(mapRole);
}

export async function createRole(workspaceOwnerId, payload, audit = null) {
  const name = payload?.name?.trim();
  if (!name) {
    throw new AppError("Role name is required", 400);
  }

  const existing = await queryOne(
    `
      SELECT id
      FROM admin_roles
      WHERE created_by = ? AND LOWER(name) = LOWER(?)
      LIMIT 1
    `,
    [workspaceOwnerId, name]
  );
  if (existing) {
    throw new AppError("Role with this name already exists", 409);
  }

  const id = randomUUID();
  await query(
    `
      INSERT INTO admin_roles (
        id,
        created_by,
        name,
        description,
        permissions
      ) VALUES (?, ?, ?, ?, ?)
    `,
    [
      id,
      workspaceOwnerId,
      name,
      payload.description?.trim() || null,
      JSON.stringify(payload.permissions ?? {}),
    ]
  );

  await recordAudit({
    workspaceOwnerId,
    objectType: "admin_roles",
    objectId: id,
    action: "create",
    actorId: audit?.actor_id,
    actorRole: audit?.actor_role,
    metadata: { name },
  });

  const row = await queryOne("SELECT * FROM admin_roles WHERE id = ?", [id]);
  return mapRole(row);
}

export async function deleteRole(workspaceOwnerId, roleId, audit = null) {
  return withTransaction(async (connection) => {
    const role = await getRoleForWorkspace(roleId, workspaceOwnerId, connection);

    await query(
      "UPDATE admins SET role_id = NULL WHERE owner_id = ? AND role_id = ?",
      [workspaceOwnerId, roleId],
      connection
    );
    await query(
      "DELETE FROM admin_roles WHERE id = ? AND created_by = ?",
      [roleId, workspaceOwnerId],
      connection
    );

    await recordAudit(
      {
        workspaceOwnerId,
        objectType: "admin_roles",
        objectId: roleId,
        action: "delete",
        actorId: audit?.actor_id,
        actorRole: audit?.actor_role,
        metadata: { name: role.name },
      },
      connection
    );

    return role;
  });
}

export async function createTeamMemberAccount({
  email,
  password,
  fullName,
  roleId,
  workspaceOwnerId,
  audit = null,
}) {
  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  return withTransaction(async (connection) => {
    const role = await getRoleForWorkspace(roleId, workspaceOwnerId, connection);
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await queryOne(
      "SELECT id FROM admins WHERE LOWER(email) = LOWER(?) LIMIT 1",
      [normalizedEmail],
      connection
    );
    if (existing) {
      throw new AppError("Email is already in use", 409);
    }

    const userId = randomUUID();
    const passwordHash = await hashPassword(password);
    await query(
      `
        INSERT INTO admins (
          id,
          owner_id,
          role_id,
          email,
          password_hash,
          full_name,
          is_owner,
          is_active,
          invite_status
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, 'active')
      `,
      [
        userId,
        workspaceOwnerId,
        role.id,
        normalizedEmail,
        passwordHash,
        fullName?.trim() || normalizedEmail,
      ],
      connection
    );

    const user = await queryOne("SELECT * FROM admins WHERE id = ?", [userId], connection);
    await recordAudit(
      {
        workspaceOwnerId,
        objectType: "admins",
        objectId: userId,
        action: "create",
        actorId: audit?.actor_id,
        actorRole: audit?.actor_role,
        metadata: { email: normalizedEmail, role: role.name },
      },
      connection
    );

    return sanitizeUserResponse(user, role);
  });
}

export async function inviteTeamMember({
  email,
  fullName,
  roleId,
  workspaceOwnerId,
  audit = null,
}) {
  if (!email) {
    throw new AppError("Email is required", 400);
  }

  const temporaryPassword = createTemporaryPassword();
  const user = await createTeamMemberAccount({
    email,
    password: temporaryPassword,
    fullName,
    roleId,
    workspaceOwnerId,
    audit,
  });

  return {
    ...user,
    temporaryPassword,
    invite_mode: "manual-share",
  };
}
