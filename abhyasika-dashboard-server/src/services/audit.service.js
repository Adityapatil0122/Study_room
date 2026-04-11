import { randomUUID } from "crypto";
import { query, queryOne } from "../db/connection.js";
import { parseJson } from "../utils/data.js";

export async function recordAudit(
  {
    workspaceOwnerId,
    objectType,
    objectId,
    action,
    actorId = null,
    actorRole = null,
    metadata = null,
  },
  connection
) {
  if (!workspaceOwnerId || !objectType || !objectId || !action) {
    return null;
  }

  const id = randomUUID();
  await query(
    `
      INSERT INTO audit_log (
        id,
        workspace_owner_id,
        object_type,
        object_id,
        action,
        actor_id,
        actor_role,
        metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      workspaceOwnerId,
      objectType,
      objectId,
      action,
      actorId,
      actorRole,
      metadata ? JSON.stringify(metadata) : null,
    ],
    connection
  );

  return id;
}

function mapAuditRow(row) {
  return {
    ...row,
    metadata: parseJson(row.metadata, {}),
  };
}

export async function listAuditHistory(
  workspaceOwnerId,
  { objectType, objectId, limit = 200 } = {},
  connection
) {
  const params = [workspaceOwnerId];
  const filters = ["workspace_owner_id = ?"];

  if (objectType) {
    filters.push("object_type = ?");
    params.push(objectType);
  }

  if (objectId) {
    filters.push("object_id = ?");
    params.push(objectId);
  }

  params.push(limit);

  const rows = await query(
    `
      SELECT *
      FROM audit_log
      WHERE ${filters.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT ?
    `,
    params,
    connection
  );

  return rows.map(mapAuditRow);
}

export async function getLatestAuditEntry(workspaceOwnerId, objectType, objectId, connection) {
  const row = await queryOne(
    `
      SELECT *
      FROM audit_log
      WHERE workspace_owner_id = ? AND object_type = ? AND object_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [workspaceOwnerId, objectType, objectId],
    connection
  );

  return row ? mapAuditRow(row) : null;
}
