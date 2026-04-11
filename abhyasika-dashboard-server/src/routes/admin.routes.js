import { Router } from "express";
import {
  deleteRoleById,
  getRoles,
  postRole,
  postInviteTeamMember,
  postManualTeamMember,
} from "../controllers/admin.controller.js";

const router = Router();

router.get("/roles", getRoles);
router.post("/roles", postRole);
router.delete("/roles/:id", deleteRoleById);
router.post("/team-members/manual", postManualTeamMember);
router.post("/team-members/invite", postInviteTeamMember);

export default router;
