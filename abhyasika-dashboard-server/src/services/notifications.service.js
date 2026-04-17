import { randomUUID } from "crypto";
import { query, queryOne } from "../db/connection.js";
import { toBoolean } from "../utils/data.js";

function mapNotification(row) {
  return {
    ...row,
    is_read: toBoolean(row.is_read),
  };
}

/**
 * Create an admin notification. Safe to call even if no admins are online —
 * the dashboard bell pulls unread notifications on poll/focus.
 */
export async function createAdminNotification(
  {
    workspaceOwnerId,
    type,
    title,
    message = null,
    objectType = null,
    objectId = null,
  },
  connection
) {
  const id = randomUUID();
  await query(
    `INSERT INTO admin_notifications
       (id, workspace_owner_id, type, title, message, object_type, object_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, workspaceOwnerId, type, title, message, objectType, objectId],
    connection
  );
  return id;
}

export async function listAdminNotifications(workspaceOwnerId, { limit = 50 } = {}) {
  const rows = await query(
    `SELECT * FROM admin_notifications
     WHERE workspace_owner_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [workspaceOwnerId, Number(limit) || 50]
  );
  return rows.map(mapNotification);
}

export async function countUnreadNotifications(workspaceOwnerId) {
  const row = await queryOne(
    `SELECT COUNT(*) AS count FROM admin_notifications
     WHERE workspace_owner_id = ? AND is_read = 0`,
    [workspaceOwnerId]
  );
  return Number(row?.count ?? 0);
}

export async function markNotificationRead(workspaceOwnerId, notificationId) {
  await query(
    `UPDATE admin_notifications SET is_read = 1
     WHERE id = ? AND workspace_owner_id = ?`,
    [notificationId, workspaceOwnerId]
  );
}

export async function markAllNotificationsRead(workspaceOwnerId) {
  await query(
    `UPDATE admin_notifications SET is_read = 1
     WHERE workspace_owner_id = ? AND is_read = 0`,
    [workspaceOwnerId]
  );
}
