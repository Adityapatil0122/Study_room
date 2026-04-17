import { Router } from "express";
import authRoutes from "./auth.routes.js";
import publicRoutes from "./public.routes.js";
import studentAuthRoutes from "./studentAuth.routes.js";
import studentAppRoutes from "./studentApp.routes.js";
import plansRoutes from "./plans.routes.js";
import studentsRoutes from "./students.routes.js";
import seatsRoutes from "./seats.routes.js";
import paymentsRoutes from "./payments.routes.js";
import settingsRoutes from "./settings.routes.js";
import expensesRoutes from "./expenses.routes.js";
import historyRoutes from "./history.routes.js";
import importsRoutes from "./imports.routes.js";
import { requireAuth } from "../middleware/auth.js";
import { requireStudentAuth } from "../middleware/studentAuth.js";
import adminRoutes from "./admin.routes.js";
import notificationsRoutes from "./notifications.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/public", publicRoutes);
router.use("/student-auth", studentAuthRoutes);
router.use("/student", requireStudentAuth, studentAppRoutes);
router.use(requireAuth);
router.use("/plans", plansRoutes);
router.use("/students", studentsRoutes);
router.use("/seats", seatsRoutes);
router.use("/payments", paymentsRoutes);
router.use("/settings", settingsRoutes);
router.use("/expenses", expensesRoutes);
router.use("/history", historyRoutes);
router.use("/imports", importsRoutes);
router.use("/admin", adminRoutes);
router.use("/notifications", notificationsRoutes);

export default router;
