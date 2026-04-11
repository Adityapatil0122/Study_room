import fs from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";
import { config } from "../config/env.js";
import { pool, query, queryOne } from "./connection.js";
import { logger } from "../utils/logger.js";

async function ensureUploadsDir() {
  await fs.mkdir(config.uploadsDir, { recursive: true });
  await fs.mkdir(path.join(config.uploadsDir, "branding"), { recursive: true });
  await fs.mkdir(path.join(config.uploadsDir, "students"), { recursive: true });
}

async function ensureDatabaseExists() {
  const connection = await mysql.createConnection({
    host: config.mysqlHost,
    port: config.mysqlPort,
    user: config.mysqlUser,
    password: config.mysqlPassword,
  });

  try {
    const databaseName = config.mysqlDatabase.replace(/`/g, "");
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

async function ensureTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS admins (
      id CHAR(36) PRIMARY KEY,
      owner_id CHAR(36) NULL,
      role_id CHAR(36) NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NULL,
      is_owner TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      invite_status VARCHAR(32) NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_admin_owner_id (owner_id),
      INDEX idx_admin_role_id (role_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_roles (
      id CHAR(36) PRIMARY KEY,
      created_by CHAR(36) NOT NULL,
      name VARCHAR(120) NOT NULL,
      description TEXT NULL,
      permissions JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_role_name_per_owner (created_by, name),
      INDEX idx_roles_created_by (created_by)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      admin_id CHAR(36) PRIMARY KEY,
      preferences JSON NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS plans (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      name VARCHAR(120) NOT NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      duration_days INT NOT NULL DEFAULT 30,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_plan_name_per_workspace (workspace_owner_id, name),
      INDEX idx_plans_workspace_owner (workspace_owner_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS students (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(32) NULL,
      email VARCHAR(255) NULL,
      gender VARCHAR(32) NULL,
      aadhaar VARCHAR(32) NULL,
      pan_card VARCHAR(32) NULL,
      address TEXT NULL,
      city VARCHAR(120) NULL,
      state VARCHAR(120) NULL,
      pincode VARCHAR(16) NULL,
      preferred_shift VARCHAR(64) NOT NULL DEFAULT 'Morning',
      fee_plan_type VARCHAR(32) NOT NULL DEFAULT 'monthly',
      fee_cycle VARCHAR(32) NOT NULL DEFAULT 'calendar',
      limited_days INT NULL,
      registration_paid TINYINT(1) NOT NULL DEFAULT 0,
      join_date DATE NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      current_plan_id CHAR(36) NULL,
      current_seat_id CHAR(36) NULL,
      renewal_date DATE NULL,
      registration_source VARCHAR(64) NOT NULL DEFAULT 'admin_panel',
      registered_by_role VARCHAR(120) NULL,
      photo_url TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_students_workspace_owner (workspace_owner_id),
      INDEX idx_students_current_plan (current_plan_id),
      INDEX idx_students_current_seat (current_seat_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS seats (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      seat_number VARCHAR(120) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'available',
      current_student_id CHAR(36) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_seat_number_per_workspace (workspace_owner_id, seat_number),
      INDEX idx_seats_workspace_owner (workspace_owner_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS payments (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      student_id CHAR(36) NOT NULL,
      plan_id CHAR(36) NOT NULL,
      collected_role_id CHAR(36) NULL,
      amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
      valid_from DATE NULL,
      valid_until DATE NULL,
      payment_mode VARCHAR(32) NOT NULL DEFAULT 'upi',
      includes_registration TINYINT(1) NOT NULL DEFAULT 0,
      notes TEXT NULL,
      payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_payments_workspace_owner (workspace_owner_id),
      INDEX idx_payments_student_id (student_id),
      INDEX idx_payments_plan_id (plan_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(120) NOT NULL DEFAULT 'misc',
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      paid_via VARCHAR(32) NOT NULL DEFAULT 'cash',
      expense_date DATE NULL,
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_expenses_workspace_owner (workspace_owner_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS expense_categories (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      name VARCHAR(120) NOT NULL,
      value VARCHAR(120) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_category_value_per_workspace (workspace_owner_id, value),
      INDEX idx_expense_categories_workspace_owner (workspace_owner_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      object_type VARCHAR(120) NOT NULL,
      object_id CHAR(36) NOT NULL,
      action VARCHAR(120) NOT NULL,
      actor_id CHAR(36) NULL,
      actor_role VARCHAR(120) NULL,
      metadata JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_workspace_owner (workspace_owner_id),
      INDEX idx_audit_object (object_type, object_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS import_logs (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      table_name VARCHAR(120) NOT NULL,
      file_name VARCHAR(255) NULL,
      total_rows INT NOT NULL DEFAULT 0,
      success_rows INT NOT NULL DEFAULT 0,
      duplicate_rows INT NOT NULL DEFAULT 0,
      invalid_rows INT NOT NULL DEFAULT 0,
      created_by CHAR(36) NULL,
      actor_role VARCHAR(120) NULL,
      metadata JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_import_logs_workspace_owner (workspace_owner_id)
    )
  `);
}

async function ensureSeedAdmin() {
  if (!config.seedAdminEmail || !config.seedAdminPassword) {
    logger.warn("Seed admin credentials not configured; skipping automatic admin creation.");
    return;
  }

  const existing = await queryOne(
    "SELECT id FROM admins WHERE email = ? LIMIT 1",
    [config.seedAdminEmail.trim().toLowerCase()]
  );

  const passwordHash = await bcrypt.hash(config.seedAdminPassword, 10);

  if (existing) {
    await query(
      `
        UPDATE admins
        SET full_name = ?, password_hash = ?, is_owner = 1, is_active = 1, invite_status = 'active'
        WHERE id = ?
      `,
      [config.seedAdminName, passwordHash, existing.id]
    );
    await query("UPDATE admins SET owner_id = ? WHERE id = ?", [existing.id, existing.id]);
    logger.info({ email: config.seedAdminEmail }, "Seed admin refreshed");
    return;
  }

  const adminId = randomUUID();
  await query(
    `
      INSERT INTO admins (
        id,
        owner_id,
        email,
        password_hash,
        full_name,
        is_owner,
        is_active,
        invite_status
      ) VALUES (?, ?, ?, ?, ?, 1, 1, 'active')
    `,
    [
      adminId,
      adminId,
      config.seedAdminEmail.trim().toLowerCase(),
      passwordHash,
      config.seedAdminName,
    ]
  );

  logger.info({ email: config.seedAdminEmail }, "Seed admin created");
}

export async function initializeDatabase() {
  await ensureUploadsDir();
  await ensureDatabaseExists();
  await pool.query("SELECT 1");
  await ensureTables();
  await ensureSeedAdmin();
}
