import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getProfile,
  updateProfile,
  listAvailablePlans,
  getSubscription,
  listStudentPayments,
  createRazorpayOrderForStudent,
  verifyRazorpayPaymentForStudent,
  createQrPaymentRequest,
  listSeatsForStudent,
  selectSeatForStudent,
  createRazorpayOrderForScheduledRequest,
  verifyAndFulfillScheduledRequest,
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

export const postRequestQrPayment = asyncHandler(async (req, res) => {
  const { studentId, workspaceOwnerId } = req.studentAuth;
  const data = await createQrPaymentRequest(studentId, workspaceOwnerId, req.body ?? {});
  res.status(201).json({ data });
});

export const getAvailableSeats = asyncHandler(async (req, res) => {
  const { workspaceOwnerId } = req.studentAuth;
  const data = await listSeatsForStudent(workspaceOwnerId);
  res.json({ data });
});

export const postSelectSeat = asyncHandler(async (req, res) => {
  const { studentId, workspaceOwnerId } = req.studentAuth;
  const { seat_id } = req.body ?? {};
  const data = await selectSeatForStudent(studentId, workspaceOwnerId, seat_id);
  res.json({ data });
});

// Student pays a scheduled payment request sent by admin
export const postCreateScheduledOrder = asyncHandler(async (req, res) => {
  const { studentId, workspaceOwnerId } = req.studentAuth;
  const { request_id } = req.body ?? {};
  const data = await createRazorpayOrderForScheduledRequest(studentId, workspaceOwnerId, request_id);
  res.status(201).json({ data });
});

export const postVerifyScheduledPayment = asyncHandler(async (req, res) => {
  const { studentId, workspaceOwnerId } = req.studentAuth;
  const data = await verifyAndFulfillScheduledRequest(studentId, workspaceOwnerId, req.body ?? {});
  res.json({ data });
});
