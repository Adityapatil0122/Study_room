import { asyncHandler } from "../utils/asyncHandler.js";
import { listAuditHistory } from "../services/audit.service.js";

export const getHistory = asyncHandler(async (req, res) => {
  const { object_type, limit } = req.query;
  const data = await listAuditHistory(req.auth.workspaceOwnerId, {
    objectType: object_type || undefined,
    limit: limit ? Math.min(parseInt(limit, 10) || 200, 500) : 200,
  });
  res.json({ data });
});
