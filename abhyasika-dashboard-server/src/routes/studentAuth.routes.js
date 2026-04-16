import { Router } from "express";
import {
  postRegister,
  postLogin,
  getMe,
} from "../controllers/studentAuth.controller.js";
import { requireStudentAuth } from "../middleware/studentAuth.js";

const router = Router();

router.post("/register", postRegister);
router.post("/login", postLogin);
router.get("/me", requireStudentAuth, getMe);

export default router;
