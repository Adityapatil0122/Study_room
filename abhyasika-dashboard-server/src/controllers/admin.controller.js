import {
  createRole,
  createTeamMemberAccount,
  deleteRole,
  inviteTeamMember,
  listRoles,
} from "../services/admin.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getRoles = asyncHandler(async (req, res) => {
  const data = await listRoles(req.auth.workspaceOwnerId);
  res.json({ data });
});

export const postRole = asyncHandler(async (req, res) => {
  const data = await createRole(
    req.auth.workspaceOwnerId,
    req.body ?? {},
    req.body?.audit ?? null
  );
  res.status(201).json({ data });
});

export const deleteRoleById = asyncHandler(async (req, res) => {
  const data = await deleteRole(
    req.auth.workspaceOwnerId,
    req.params.id,
    req.body?.audit ?? null
  );
  res.json({ data });
});

export const postManualTeamMember = asyncHandler(async (req, res) => {
  const { email, password, fullName, role_id } = req.body ?? {};

  const user = await createTeamMemberAccount({
    email,
    password,
    fullName,
    roleId: role_id,
    workspaceOwnerId: req.auth.workspaceOwnerId,
    audit: req.body?.audit ?? null,
  });

  res.status(201).json({ data: user });
});

export const postInviteTeamMember = asyncHandler(async (req, res) => {
  const { email, fullName, role_id } = req.body ?? {};

  const user = await inviteTeamMember({
    email,
    fullName,
    roleId: role_id,
    workspaceOwnerId: req.auth.workspaceOwnerId,
    audit: req.body?.audit ?? null,
  });

  res.status(201).json({ data: user });
});
