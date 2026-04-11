import { Router } from "express";
import { postEnrollment } from "../controllers/public.controller.js";

const router = Router();

router.post("/enrollments", postEnrollment);

export default router;
