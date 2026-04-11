import { Router } from "express";
import { getMe, postLogin } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/login", postLogin);
router.get("/me", requireAuth, getMe);

export default router;
