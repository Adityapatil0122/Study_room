import {
  createPayment,
  importPayments,
  listPayments,
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
