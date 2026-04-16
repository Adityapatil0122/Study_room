import { AppError } from "../utils/AppError.js";
import { verifyAuthToken } from "../utils/auth.js";
import { findStudentByIdWithCredentials } from "../services/studentAuth.service.js";

export async function requireStudentAuth(req, _res, next) {
  if (req.method === "OPTIONS") {
    return next();
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    throw new AppError("Unauthorized", 401);
  }

  let payload;
  try {
    payload = verifyAuthToken(token);
  } catch {
    throw new AppError("Unauthorized", 401);
  }

  if (payload?.type !== "student") {
    throw new AppError("Unauthorized", 401);
  }

  const student = await findStudentByIdWithCredentials(payload.sub);
  if (!student || !student.is_active) {
    throw new AppError("Unauthorized", 401);
  }

  req.token = token;
  req.student = student;
  req.studentAuth = {
    studentId: student.id,
    workspaceOwnerId: student.workspace_owner_id,
  };
  return next();
}
