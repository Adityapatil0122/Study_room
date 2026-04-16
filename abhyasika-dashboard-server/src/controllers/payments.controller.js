import {
  createPayment,
  importPayments,
  listPayments,
  listPendingPayments,
  approvePendingPayment,
  rejectPendingPayment,
} from "../services/payments.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getPayments = asyncHandler(async (req, res) => {
  const { limit, startDate, endDate } = req.query;
  const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 100, 500) : 100;
  const payments = await listPayments(req.auth.workspaceOwnerId, {
    limit: parsedLimit,
    startDate,
    endDate,
  });
  res.json({ data: payments });
});

export const postPayment = asyncHandler(async (req, res) => {
  const result = await createPayment(
    req.auth.workspaceOwnerId,
    req.body ?? {},
    req.body?.audit ?? null
  );
  res.status(201).json({ data: result });
});

export const postImportPayments = asyncHandler(async (req, res) => {
  const data = await importPayments(
    req.auth.workspaceOwnerId,
    req.body?.rows ?? [],
    req.body?.audit ?? null
  );
  res.status(201).json({ data });
});

export const listPending = asyncHandler(async (req, res) => {
  const data = await listPendingPayments(req.auth.workspaceOwnerId);
  res.json({ data });
});

export const approvePending = asyncHandler(async (req, res) => {
  const audit = { actor_id: req.auth.adminId, actor_role: req.auth.role ?? "Admin" };
  const data = await approvePendingPayment(req.auth.workspaceOwnerId, req.params.id, audit);
  res.json({ data });
});

export const rejectPending = asyncHandler(async (req, res) => {
  const audit = { actor_id: req.auth.adminId, actor_role: req.auth.role ?? "Admin" };
  const data = await rejectPendingPayment(req.auth.workspaceOwnerId, req.params.id, audit);
  res.json({ data });
});
