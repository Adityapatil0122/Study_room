import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createPlan,
  deletePlan,
  listPlans,
  updatePlan,
} from "../services/plans.service.js";

export const getPlans = asyncHandler(async (req, res) => {
  const plans = await listPlans(req.auth.workspaceOwnerId);
  res.json({ data: plans });
});

export const postPlan = asyncHandler(async (req, res) => {
  const plan = await createPlan(
    req.auth.workspaceOwnerId,
    req.body ?? {},
    req.body?.audit ?? null
  );
  res.status(201).json({ data: plan });
});

export const putPlan = asyncHandler(async (req, res) => {
  const plan = await updatePlan(
    req.params.id,
    req.auth.workspaceOwnerId,
    req.body ?? {},
    req.body?.audit ?? null
  );
  res.json({ data: plan });
});

export const deletePlanById = asyncHandler(async (req, res) => {
  const deleted = await deletePlan(
    req.params.id,
    req.auth.workspaceOwnerId,
    req.body?.audit ?? null
  );
  res.json({ data: deleted });
});
