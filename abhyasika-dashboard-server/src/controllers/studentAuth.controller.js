import { asyncHandler } from "../utils/asyncHandler.js";
import {
  registerStudent,
  loginStudent,
  getStudentSessionById,
} from "../services/studentAuth.service.js";

export const postRegister = asyncHandler(async (req, res) => {
  const session = await registerStudent(req.body ?? {});
  res.status(201).json({ data: { session } });
});

export const postLogin = asyncHandler(async (req, res) => {
  const session = await loginStudent(req.body ?? {});
  res.json({ data: { session } });
});

export const getMe = asyncHandler(async (req, res) => {
  const session = await getStudentSessionById(req.studentAuth.studentId);
  res.json({
    data: {
      session: {
        access_token: req.token,
        ...session,
      },
    },
  });
});
