import mysql from "mysql2/promise";
import { config } from "../config/env.js";

export const pool = mysql.createPool({
  host: config.mysqlHost,
  port: config.mysqlPort,
  user: config.mysqlUser,
  password: config.mysqlPassword || undefined,
  database: config.mysqlDatabase,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
  dateStrings: true,
  ssl: config.mysqlSsl ? { rejectUnauthorized: false } : undefined,
});

async function runQuery(executor, sql, params) {
  const values = Array.isArray(params) ? params : [];
  const [rows] = await executor.query(sql, values);
  return rows;
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
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // ignore rollback errors
    }
    throw error;
  } finally {
    connection.release();
  }
}
