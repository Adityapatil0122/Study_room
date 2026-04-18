import { Router } from "express";
import {
  postRegister,
  postLogin,
  getMe,
} from "../controllers/studentAuth.controller.js";
import { postUploadStudentProof } from "../controllers/students.controller.js";
import { requireStudentAuth } from "../middleware/studentAuth.js";
import { uploadStudentProof } from "../middleware/upload.js";

const router = Router();

router.post("/register", postRegister);
router.post("/login", postLogin);
router.get("/me", requireStudentAuth, getMe);
// Public upload endpoint (no auth) so students can upload Aadhaar at registration time
router.post("/upload-id-proof", uploadStudentProof.single("file"), postUploadStudentProof);

export default router;
