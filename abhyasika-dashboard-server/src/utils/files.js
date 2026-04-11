import path from "path";
import { config } from "../config/env.js";

export function toRelativeUploadPath(filePath) {
  return path.relative(config.uploadsDir, filePath).replace(/\\/g, "/");
}

export function buildPublicFileUrl(relativePath) {
  if (!relativePath) return "";
  const normalized = relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
  return `${config.appUrl.replace(/\/+$/, "")}/uploads/${normalized}`;
}
