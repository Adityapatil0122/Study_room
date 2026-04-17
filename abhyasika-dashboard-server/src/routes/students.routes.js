import { Router } from "express";
import {
  getStudents,
  getStudentHistory,
  postImportStudents,
  postStudent,
  postUploadStudentProof,
  putStudent,
  patchStudentToggleActive,
  postHoldMembership,
  postResumeMembership,
  getStudentHolds,
} from "../controllers/students.controller.js";
import { uploadStudentProof } from "../middleware/upload.js";

const router = Router();

router.get("/", getStudents);
router.post("/upload-id-proof", uploadStudentProof.single("file"), postUploadStudentProof);
router.post("/import", postImportStudents);
router.post("/", postStudent);
router.get("/:id/history", getStudentHistory);
router.get("/:id/holds", getStudentHolds);
router.post("/:id/hold", postHoldMembership);
router.post("/:id/resume", postResumeMembership);
router.put("/:id", putStudent);
router.patch("/:id/toggle-active", patchStudentToggleActive);

export default router;
