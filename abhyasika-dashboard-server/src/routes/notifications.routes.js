import { Router } from "express";
import {
  getNotifications,
  postMarkNotificationRead,
  postMarkAllNotificationsRead,
} from "../controllers/notifications.controller.js";

const router = Router();

router.get("/", getNotifications);
router.post("/read-all", postMarkAllNotificationsRead);
router.post("/:id/read", postMarkNotificationRead);

export default router;
