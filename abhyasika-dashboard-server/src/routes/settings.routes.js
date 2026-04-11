import { Router } from "express";
import {
  getSettings,
  postLogoUpload,
  updateSettings,
} from "../controllers/settings.controller.js";
import { uploadLogo } from "../middleware/upload.js";

const router = Router();

router.get("/", getSettings);
router.put("/", updateSettings);
router.post("/logo", uploadLogo.single("file"), postLogoUpload);

export default router;
