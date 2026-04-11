import { randomUUID } from "crypto";
import { query, queryOne } from "../db/connection.js";
import { AppError } from "../utils/AppError.js";
import { toBoolean } from "../utils/data.js";
import { buildUpdateClause } from "../utils/sql.js";
import { recordAudit } from "./audit.service.js";

function mapPlan(row) {
  return {
    ...row,
    is_active: toBoolean(row.is_active),
  };
}

export async function listPlans(workspaceOwnerId) {
  const rows = await query(
    `
      SELECT *
      FROM plans
      WHERE workspace_owner_id = ?
      ORDER BY price ASC, name ASC
    `,
    [workspaceOwnerId]
  );

  return rows.map(mapPlan);
}

export async function createPlan(workspaceOwnerId, payload, audit, connection) {
  const name = payload?.name?.trim();
  if (!name) {
    throw new AppError("Plan name is required", 400);
  }

  const amount = Number(payload.price ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError("Plan amount must be zero or greater", 400);
  }

  const duration = Number(payload.duration_days);
  if (!Number.isInteger(duration) || duration <= 0) {
    throw new AppError("Duration must be a positive whole number of days", 400);
  }

  const existing = await queryOne(
    "SELECT id FROM plans WHERE workspace_owner_id = ? AND LOWER(name) = LOWER(?) LIMIT 1",
    [workspaceOwnerId, name],
    connection
  );
  if (existing) {
    throw new AppError("Plan name already exists", 409);
  }

  const id = randomUUID();
  await query(
    `
      INSERT INTO plans (
        id,
        workspace_owner_id,
        name,
        price,
        duration_days,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [id, workspaceOwnerId, name, amount, duration, payload.is_active === false ? 0 : 1],
    connection
  );

  const row = await queryOne("SELECT * FROM plans WHERE id = ?", [id], connection);
  await recordAudit(
    {
      workspaceOwnerId,
      objectType: "plans",
      objectId: id,
      action: "create",
      actorId: audit?.actor_id,
      actorRole: audit?.actor_role,
      metadata: {
        name,
        price: amount,
        duration_days: duration,
      },
    },
    connection
  );

  return mapPlan(row);
}

export async function updatePlan(planId, workspaceOwnerId, updates, audit, connection) {
  const existing = await queryOne(
    "SELECT * FROM plans WHERE id = ? AND workspace_owner_id = ? LIMIT 1",
    [planId, workspaceOwnerId],
    connection
  );
  if (!existing) {
    throw new AppError("Plan not found", 404);
  }

  const patch = {};

  if (updates.name !== undefined) {
    const name = String(updates.name).trim();
    if (!name) {
      throw new AppError("Plan name cannot be empty", 400);
    }
    const duplicate = await queryOne(
      `
        SELECT id
        FROM plans
        WHERE workspace_owner_id = ? AND LOWER(name) = LOWER(?) AND id <> ?
        LIMIT 1
      `,
      [workspaceOwnerId, name, planId],
      connection
    );
    if (duplicate) {
      throw new AppError("Plan name already exists", 409);
    }
    patch.name = name;
  }

  if (updates.price !== undefined) {
    const amount = Number(updates.price);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new AppError("Plan amount must be zero or greater", 400);
    }
    patch.price = amount;
  }

  if (updates.duration_days !== undefined) {
    const duration = Number(updates.duration_days);
    if (!Number.isInteger(duration) || duration <= 0) {
      throw new AppError("Duration must be a positive whole number of days", 400);
    }
    patch.duration_days = duration;
  }

  if (updates.is_active !== undefined) {
    patch.is_active = updates.is_active ? 1 : 0;
  }

  const { clause, values } = buildUpdateClause(patch);
  if (!clause) {
    return mapPlan(existing);
  }

  await query(
    `UPDATE plans SET ${clause} WHERE id = ? AND workspace_owner_id = ?`,
    [...values, planId, workspaceOwnerId],
    connection
  );

  const row = await queryOne("SELECT * FROM plans WHERE id = ?", [planId], connection);
  await recordAudit(
    {
      workspaceOwnerId,
      objectType: "plans",
      objectId: planId,
      action: "update",
      actorId: audit?.actor_id,
      actorRole: audit?.actor_role,
      metadata: patch,
    },
    connection
  );

  return mapPlan(row);
}

export async function deletePlan(planId, workspaceOwnerId, audit, connection) {
  const existing = await queryOne(
    "SELECT * FROM plans WHERE id = ? AND workspace_owner_id = ? LIMIT 1",
    [planId, workspaceOwnerId],
    connection
  );
  if (!existing) {
    throw new AppError("Plan not found", 404);
  }

  await query(
    "DELETE FROM plans WHERE id = ? AND workspace_owner_id = ?",
    [planId, workspaceOwnerId],
    connection
  );

  await recordAudit(
    {
      workspaceOwnerId,
      objectType: "plans",
      objectId: planId,
      action: "delete",
      actorId: audit?.actor_id,
      actorRole: audit?.actor_role,
      metadata: { name: existing.name },
    },
    connection
  );

  return mapPlan(existing);
}
