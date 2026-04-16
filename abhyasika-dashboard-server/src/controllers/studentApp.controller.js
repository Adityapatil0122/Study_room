import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getProfile,
  updateProfile,
  listAvailablePlans,
  getSubscription,
  listStudentPayments,
  createRazorpayOrderForStudent,
  verifyRazorpayPaymentForStudent,
} from "../services/studentApp.service.js";

export const getMyProfile = asyncHandler(async (req, res) => {
  const { studentId, workspaceOwnerId } = req.studentAuth;
  const data = await getProfile(studentId, workspaceOwnerId);
  res.json({ data });
});

export const putMyProfile = asyncHandler(async (req, res) => {
  const { studentId, workspaceOwnerId } = req.studentAuth;
  const data = await updateProfile(studentId, workspaceOwnerId, req.body ?? {});
  res.json({ data });
});

export const getPlans = asyncHandler(async (req, res) => {
  const { workspaceOwnerId } = req.studentAuth;
  const data = await listAvailablePlans(workspaceOwnerId);
  res.json({ data });
});

export const getMySubscription = asyncHandler(async (req, res) => {
  const { studentId, workspaceOwnerId } = req.studentAuth;
  const data = await getSubscription(studentId, workspaceOwnerId);
  res.json({ data });
});

export const getMyPayments = asyncHandler(async (req, res) => {
  const { studentId, workspaceOwnerId } = req.studentAuth;
  const data = await listStudentPayments(studentId, workspaceOwnerId);
  res.json({ data });
});

export const postCreateOrder = asyncHandler(async (req, res) => {
  const { studentId, workspaceOwnerId } = req.studentAuth;
  const data = await createRazorpayOrderForStudent(
    studentId,
    workspaceOwnerId,
    req.body ?? {}
  );
  res.status(201).json({ data });
});

export const postVerifyPayment = asyncHandler(async (req, res) => {
  const { studentId, workspaceOwnerId } = req.studentAuth;
  const data = await verifyRazorpayPaymentForStudent(
    studentId,
    workspaceOwnerId,
    req.body ?? {}
  );
  res.json({ data });
});
