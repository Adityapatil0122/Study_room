import { asyncHandler } from "../utils/asyncHandler.js";
import { recordImportLog } from "../services/imports.service.js";

export const postImportLog = asyncHandler(async (req, res) => {
  const entry = req.body ?? {};
  const data = await recordImportLog(req.auth.workspaceOwnerId, entry);
  res.status(201).json({ data });
});
