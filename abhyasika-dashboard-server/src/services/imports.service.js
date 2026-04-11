import { randomUUID } from "crypto";
import { query, queryOne } from "../db/connection.js";
import { parseJson } from "../utils/data.js";

function mapImportLog(row) {
  return {
    ...row,
    metadata: parseJson(row.metadata, {}),
  };
}

export async function recordImportLog(workspaceOwnerId, entry, connection) {
  if (!entry) return null;

  const id = randomUUID();
  await query(
    `
      INSERT INTO import_logs (
        id,
        workspace_owner_id,
        table_name,
        file_name,
        total_rows,
        success_rows,
        duplicate_rows,
        invalid_rows,
        created_by,
        actor_role,
        metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      workspaceOwnerId,
      entry.table,
      entry.fileName ?? null,
      entry.totalRows ?? 0,
      entry.successRows ?? 0,
      entry.duplicateRows ?? 0,
      entry.invalidRows ?? 0,
      entry.actorId ?? null,
      entry.actorRole ?? null,
      JSON.stringify(entry.metadata ?? {}),
    ],
    connection
  );

  const row = await queryOne("SELECT * FROM import_logs WHERE id = ?", [id], connection);
  return mapImportLog(row);
}
