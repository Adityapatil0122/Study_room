import { asyncHandler } from "../utils/asyncHandler.js";
import { createPublicEnrollment } from "../services/students.service.js";

export const postEnrollment = asyncHandler(async (req, res) => {
  const student = await createPublicEnrollment(req.body ?? {});
  res.status(201).json({ data: student });
});
