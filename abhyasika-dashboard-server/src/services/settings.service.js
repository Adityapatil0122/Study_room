import { query, queryOne } from "../db/connection.js";
import { AppError } from "../utils/AppError.js";
import { buildPublicFileUrl } from "../utils/files.js";
import { parseJson } from "../utils/data.js";

export async function getAdminSettings(adminId) {
  const row = await queryOne(
    "SELECT preferences FROM admin_settings WHERE admin_id = ? LIMIT 1",
    [adminId]
  );

  if (!row) {
    return null;
  }

  const preferences = parseJson(row.preferences, {});
  if (preferences?.logoPath) {
    preferences.logoUrl = buildPublicFileUrl(preferences.logoPath);
  }

  return preferences;
}

export async function upsertAdminSettings(adminId, preferences) {
  try {
    await query(
      `
        INSERT INTO admin_settings (admin_id, preferences)
        VALUES (?, ?)
        ON CONFLICT (admin_id) DO UPDATE
          SET preferences = EXCLUDED.preferences,
              updated_at = CURRENT_TIMESTAMP
      `,
      [adminId, JSON.stringify(preferences ?? {})]
    );
  } catch (error) {
    throw new AppError(error.message, 500);
  }

  return getAdminSettings(adminId);
}
