import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getAdminSettings,
  upsertAdminSettings,
} from "../services/settings.service.js";
import { buildPublicFileUrl, toRelativeUploadPath } from "../utils/files.js";

export const getSettings = asyncHandler(async (req, res) => {
  const settings = await getAdminSettings(req.auth.admin.id);
  res.json({
    data: settings,
  });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const preferences = req.body?.preferences;
  if (typeof preferences !== "object" || preferences === null) {
    return res.status(400).json({
      error: {
        message: "Invalid payload. Expected preferences object.",
        status: 400,
      },
    });
  }

  const updated = await upsertAdminSettings(req.auth.admin.id, preferences);
  res.json({ data: updated });
});

export const postLogoUpload = asyncHandler(async (req, res) => {
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
