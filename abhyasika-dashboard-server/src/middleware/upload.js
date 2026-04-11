import fs from "fs";
import path from "path";
import multer from "multer";
import { randomUUID } from "crypto";
import { config } from "../config/env.js";

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createDiskStorage(folder) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      const target = path.join(config.uploadsDir, folder);
      ensureDirectory(target);
      cb(null, target);
    },
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname || "").toLowerCase() || ".bin";
      cb(null, `${Date.now()}-${randomUUID()}${extension}`);
    },
  });
}

function fileFilter(allowedMimeTypes) {
  return (_req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Unsupported file type"));
  };
}

export const uploadLogo = multer({
  storage: createDiskStorage("branding"),
  limits: { fileSize: 500 * 1024 },
  fileFilter: fileFilter(["image/png", "image/jpeg", "image/webp"]),
});

export const uploadStudentProof = multer({
  storage: createDiskStorage("students"),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: fileFilter([
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/pdf",
  ]),
});
