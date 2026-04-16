import pg from "pg";
import { config } from "../config/env.js";

const { Pool, types } = pg;

// Return DECIMAL/NUMERIC as number (matches mysql2's decimalNumbers: true behaviour).
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));
// Return DATE as YYYY-MM-DD string (matches mysql2 dateStrings behaviour).
types.setTypeParser(1082, (val) => val);
// Return TIMESTAMP as ISO-like string instead of Date.
types.setTypeParser(1114, (val) => val);
types.setTypeParser(1184, (val) => val);

export const pool = new Pool({
  host: config.pgHost,
  port: config.pgPort,
  user: config.pgUser,
  // Pass undefined (not empty string) when no password is set — the pg library's
  // SASL implementation throws if it receives an empty string instead of undefined.
  password: config.pgPassword || undefined,
  database: config.pgDatabase,
  max: 10,
  ssl: config.pgSsl ? { rejectUnauthorized: false } : false,
});

/**
 * Translate MySQL-style `?` placeholders into Postgres $1, $2, ...
 * Skips `?` that appear inside single or double-quoted string literals.
 */
export function translatePlaceholders(sql) {
  let out = "";
  let idx = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    if (ch === "'" && !inDouble) {
      // Handle escaped '' inside single-quoted strings
      if (inSingle && sql[i + 1] === "'") {
        out += "''";
        i += 1;
        continue;
      }
      inSingle = !inSingle;
      out += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      out += ch;
      continue;
    }
    if (ch === "?" && !inSingle && !inDouble) {
      idx += 1;
      out += `$${idx}`;
      continue;
    }
    out += ch;
  }
  return out;
}

async function runQuery(executor, sql, params) {
  const text = translatePlaceholders(sql);
  const values = Array.isArray(params) ? params : [];
  const result = await executor.query(text, values);
  return result.rows;
}

export async function query(sql, params = [], connection = null) {
  const executor = connection ?? pool;
  return runQuery(executor, sql, params);
}

export async function queryOne(sql, params = [], connection = null) {
  const rows = await query(sql, params, connection);
  return rows[0] ?? null;
}

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    throw error;
  } finally {
    client.release();
  }
}
