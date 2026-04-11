import {
  listSeats,
  assignSeat,
  deallocateSeat,
  createSeat,
} from "../services/seats.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getSeats = asyncHandler(async (req, res) => {
  const seats = await listSeats(req.auth.workspaceOwnerId);
  res.json({ data: seats });
});

export const postCreateSeat = asyncHandler(async (req, res) => {
  const seat = await createSeat(
    req.auth.workspaceOwnerId,
    req.body ?? {},
    req.body?.audit ?? null
  );
  res.status(201).json({ data: seat });
});

export const postAssignSeat = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { studentId, audit } = req.body ?? {};
  const result = await assignSeat(req.auth.workspaceOwnerId, id, studentId, audit ?? null);
  res.json({ data: result });
});

export const postDeallocateSeat = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await deallocateSeat(
    req.auth.workspaceOwnerId,
    id,
    req.body?.audit ?? null
  );
  res.json({ data: result });
});
