import { Router } from "express";
import { postImportLog } from "../controllers/imports.controller.js";

const router = Router();

router.post("/logs", postImportLog);

export default router;
