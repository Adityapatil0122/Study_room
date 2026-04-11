import { Router } from "express";
import {
  deletePlanById,
  getPlans,
  postPlan,
  putPlan,
} from "../controllers/plans.controller.js";

const router = Router();

router.get("/", getPlans);
router.post("/", postPlan);
router.put("/:id", putPlan);
router.delete("/:id", deletePlanById);

export default router;
