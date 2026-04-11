import { asyncHandler } from "../utils/asyncHandler.js";
import { createSession, findAdminById, loginAdmin } from "../services/auth.service.js";

export const postLogin = asyncHandler(async (req, res) => {
  const session = await loginAdmin(req.body ?? {});
  res.json({ data: { session } });
});

export const getMe = asyncHandler(async (req, res) => {
  const admin = await findAdminById(req.auth.admin.id);
  const session = createSession(admin, req.token);
  res.json({ data: { session } });
});
