import {
  listAdminNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notifications.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getNotifications = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit ?? 50);
  const [notifications, unread] = await Promise.all([
    listAdminNotifications(req.auth.workspaceOwnerId, { limit }),
    countUnreadNotifications(req.auth.workspaceOwnerId),
  ]);
  res.json({ data: { notifications, unread } });
});

export const postMarkNotificationRead = asyncHandler(async (req, res) => {
  await markNotificationRead(req.auth.workspaceOwnerId, req.params.id);
  res.json({ data: { id: req.params.id, is_read: true } });
});

export const postMarkAllNotificationsRead = asyncHandler(async (req, res) => {
  await markAllNotificationsRead(req.auth.workspaceOwnerId);
  res.json({ data: { ok: true } });
});
