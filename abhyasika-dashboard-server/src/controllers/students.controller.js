import {
  listStudents,
  createStudent,
  updateStudent,
  toggleStudentActive,
  importStudents,
  listStudentHistory,
  holdMembership,
  resumeMembership,
  listStudentHolds,
} from "../services/students.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { buildPublicFileUrl, toRelativeUploadPath } from "../utils/files.js";

export const getStudents = asyncHandler(async (req, res) => {
  const { search, is_active } = req.query;
  const filters = {};
  if (typeof is_active !== "undefined") {
    filters.isActive = is_active === "true";
  }
  if (search) {
    filters.search = search;
  }
  const students = await listStudents(req.auth.workspaceOwnerId, filters);
  res.json({ data: students });
});

export const postStudent = asyncHandler(async (req, res) => {
  const student = await createStudent(
    req.auth.workspaceOwnerId,
    req.body ?? {},
    req.body?.audit ?? null
  );
  res.status(201).json({ data: student });
});

export const putStudent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const student = await updateStudent(
    id,
    req.auth.workspaceOwnerId,
    req.body ?? {},
    req.body?.audit ?? null
  );
  res.json({ data: student });
});

export const patchStudentToggleActive = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const student = await toggleStudentActive(
    id,
    req.auth.workspaceOwnerId,
    req.body?.audit ?? null
  );
  res.json({ data: student });
});

export const getStudentHistory = asyncHandler(async (req, res) => {
  const data = await listStudentHistory(req.auth.workspaceOwnerId, req.params.id);
  res.json({ data });
});

export const postImportStudents = asyncHandler(async (req, res) => {
  const rows = req.body?.rows ?? [];
  const data = await importStudents(
    req.auth.workspaceOwnerId,
    rows,
    req.body?.audit ?? null
  );
  res.status(201).json({ data });
});

export const postUploadStudentProof = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: {
        message: "File is required",
        status: 400,
      },
    });
  }

  const path = toRelativeUploadPath(req.file.path);
  res.status(201).json({
    data: {
      path,
      url: buildPublicFileUrl(path),
      mimeType: req.file.mimetype,
      size: req.file.size,
    },
  });
});

export const postHoldMembership = asyncHandler(async (req, res) => {
  const audit = { actor_id: req.auth.adminId, actor_role: req.auth.role ?? "Admin" };
  const data = await holdMembership(
    req.auth.workspaceOwnerId,
    req.params.id,
    req.body?.notes ?? null,
    audit
  );
  res.json({ data });
});

export const postResumeMembership = asyncHandler(async (req, res) => {
  const audit = { actor_id: req.auth.adminId, actor_role: req.auth.role ?? "Admin" };
  const data = await resumeMembership(
    req.auth.workspaceOwnerId,
    req.params.id,
    req.body?.notes ?? null,
    audit
  );
  res.json({ data });
});

export const getStudentHolds = asyncHandler(async (req, res) => {
  const data = await listStudentHolds(req.auth.workspaceOwnerId, req.params.id);
  res.json({ data });
});
