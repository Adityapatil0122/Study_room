import { AppError } from "../utils/AppError.js";
import { verifyAuthToken } from "../utils/auth.js";
import { findAdminById, buildSessionUser } from "../services/auth.service.js";

export async function requireAuth(req, _res, next) {
  if (req.method === "OPTIONS") {
    return next();
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return next(new AppError("Unauthorized", 401));
  }

  let payload;
  try {
    payload = verifyAuthToken(token);
  } catch {
    return next(new AppError("Unauthorized", 401));
  }

  let admin;
  try {
    admin = await findAdminById(payload.sub);
  } catch (err) {
    return next(err);
  }

  if (!admin || !admin.is_active) {
    return next(new AppError("Unauthorized", 401));
  }

  req.token = token;
  req.auth = {
    admin,
    workspaceOwnerId: admin.owner_id || admin.id,
  };
  req.user = buildSessionUser(admin);
  return next();
}
