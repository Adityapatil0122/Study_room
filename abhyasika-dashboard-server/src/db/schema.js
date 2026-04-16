import fs from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { config } from "../config/env.js";
import { pool, query, queryOne } from "./connection.js";
import { logger } from "../utils/logger.js";
import { getDefaultWorkspaceOwner } from "../services/auth.service.js";

async function ensureUploadsDir() {
  await fs.mkdir(config.uploadsDir, { recursive: true });
  await fs.mkdir(path.join(config.uploadsDir, "branding"), { recursive: true });
  await fs.mkdir(path.join(config.uploadsDir, "students"), { recursive: true });
}

async function ensureUpdatedAtTrigger() {
  // Create a reusable trigger function that bumps updated_at on UPDATE.
  await query(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
}

async function attachUpdatedAtTrigger(tableName) {
  const triggerName = `trg_${tableName}_set_updated_at`;
  await query(
    `DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName}`
  );
  await query(
    `CREATE TRIGGER ${triggerName}
     BEFORE UPDATE ON ${tableName}
     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`
  );
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
      is_owner BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      invite_status VARCHAR(32) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_admin_owner_id ON admins (owner_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_admin_role_id ON admins (role_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_roles (
      id CHAR(36) PRIMARY KEY,
      created_by CHAR(36) NOT NULL,
      name VARCHAR(120) NOT NULL,
      description TEXT NULL,
      permissions JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uniq_role_name_per_owner UNIQUE (created_by, name)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_roles_created_by ON admin_roles (created_by)`);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      admin_id CHAR(36) PRIMARY KEY,
      preferences JSONB NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS plans (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      name VARCHAR(120) NOT NULL,
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      duration_days INT NOT NULL DEFAULT 30,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uniq_plan_name_per_workspace UNIQUE (workspace_owner_id, name)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_plans_workspace_owner ON plans (workspace_owner_id)`);

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
      registration_paid BOOLEAN NOT NULL DEFAULT FALSE,
      join_date DATE NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      current_plan_id CHAR(36) NULL,
      current_seat_id CHAR(36) NULL,
      renewal_date DATE NULL,
      registration_source VARCHAR(64) NOT NULL DEFAULT 'admin_panel',
      registered_by_role VARCHAR(120) NULL,
      photo_url TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_students_workspace_owner ON students (workspace_owner_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_students_current_plan ON students (current_plan_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_students_current_seat ON students (current_seat_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS seats (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      seat_number VARCHAR(120) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'available',
      current_student_id CHAR(36) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uniq_seat_number_per_workspace UNIQUE (workspace_owner_id, seat_number)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_seats_workspace_owner ON seats (workspace_owner_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS payments (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      student_id CHAR(36) NOT NULL,
      plan_id CHAR(36) NOT NULL,
      collected_role_id CHAR(36) NULL,
      amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
      valid_from DATE NULL,
      valid_until DATE NULL,
      payment_mode VARCHAR(32) NOT NULL DEFAULT 'upi',
      includes_registration BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT NULL,
      payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_payments_workspace_owner ON payments (workspace_owner_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments (student_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_payments_plan_id ON payments (plan_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(120) NOT NULL DEFAULT 'misc',
      amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      paid_via VARCHAR(32) NOT NULL DEFAULT 'cash',
      expense_date DATE NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_expenses_workspace_owner ON expenses (workspace_owner_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS expense_categories (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      name VARCHAR(120) NOT NULL,
      value VARCHAR(120) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uniq_category_value_per_workspace UNIQUE (workspace_owner_id, value)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_expense_categories_workspace_owner ON expense_categories (workspace_owner_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      object_type VARCHAR(120) NOT NULL,
      object_id CHAR(36) NOT NULL,
      action VARCHAR(120) NOT NULL,
      actor_id CHAR(36) NULL,
      actor_role VARCHAR(120) NULL,
      metadata JSONB NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_workspace_owner ON audit_log (workspace_owner_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_object ON audit_log (object_type, object_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS student_credentials (
      id CHAR(36) PRIMARY KEY,
      student_id CHAR(36) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_student_credentials_student ON student_credentials (student_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS student_payments (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      student_id CHAR(36) NOT NULL,
      plan_id CHAR(36) NOT NULL,
      amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      currency VARCHAR(8) NOT NULL DEFAULT 'INR',
      razorpay_order_id VARCHAR(255) NOT NULL,
      razorpay_payment_id VARCHAR(255) NULL,
      razorpay_signature VARCHAR(255) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'created',
      payment_date TIMESTAMP NULL,
      linked_payment_id CHAR(36) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_student_payments_workspace ON student_payments (workspace_owner_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_student_payments_student ON student_payments (student_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_student_payments_order ON student_payments (razorpay_order_id)`);

  // Add valid_from / valid_until to student_payments if they don't exist yet (safe migration).
  await query(`ALTER TABLE student_payments ADD COLUMN IF NOT EXISTS valid_from DATE NULL`);
  await query(`ALTER TABLE student_payments ADD COLUMN IF NOT EXISTS valid_until DATE NULL`);

  await query(`
    CREATE TABLE IF NOT EXISTS pending_payments (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      student_id CHAR(36) NOT NULL,
      plan_id CHAR(36) NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      valid_from DATE NOT NULL,
      valid_until DATE NOT NULL,
      payment_mode VARCHAR(32) NOT NULL DEFAULT 'qr',
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_pending_payments_workspace ON pending_payments (workspace_owner_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pending_payments_student ON pending_payments (student_id)`);

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
      metadata JSONB NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_import_logs_workspace_owner ON import_logs (workspace_owner_id)`);

  // Attach updated_at triggers to every table that has an updated_at column.
  const tablesWithUpdatedAt = [
    "admins",
    "admin_roles",
    "admin_settings",
    "plans",
    "students",
    "seats",
    "payments",
    "expenses",
    "expense_categories",
    "student_credentials",
    "student_payments",
    "pending_payments",
  ];
  for (const table of tablesWithUpdatedAt) {
    await attachUpdatedAtTrigger(table);
  }
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
        SET full_name = ?, password_hash = ?, is_owner = TRUE, is_active = TRUE, invite_status = 'active'
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
      ) VALUES (?, ?, ?, ?, ?, TRUE, TRUE, 'active')
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

async function ensureSeedData() {
  let owner;
  try {
    owner = await getDefaultWorkspaceOwner();
  } catch {
    // No workspace owner yet (first boot before admin is seeded) — skip.
    return;
  }

  // Seed default ₹1000/month plan if none exist for this workspace.
  const existingPlan = await queryOne(
    "SELECT id FROM plans WHERE workspace_owner_id = ? LIMIT 1",
    [owner.id]
  );
  if (!existingPlan) {
    await query(
      `INSERT INTO plans (id, workspace_owner_id, name, price, duration_days, is_active)
       VALUES (?, ?, 'Monthly', 1000, 30, TRUE)`,
      [randomUUID(), owner.id]
    );
    logger.info("Seeded default Monthly plan at ₹1000");
  }

  // Seed 64 seats if none exist for this workspace.
  const existingSeat = await queryOne(
    "SELECT id FROM seats WHERE workspace_owner_id = ? LIMIT 1",
    [owner.id]
  );
  if (!existingSeat) {
    for (let i = 1; i <= 64; i++) {
      await query(
        `INSERT INTO seats (id, workspace_owner_id, seat_number, status)
         VALUES (?, ?, ?, 'available')`,
        [randomUUID(), owner.id, String(i)]
      );
    }
    logger.info("Seeded 64 seats (1–64)");
  }
}

export async function initializeDatabase() {
  await ensureUploadsDir();
  // Verify DB reachable.
  await pool.query("SELECT 1");
  await ensureUpdatedAtTrigger();
  await ensureTables();
  await ensureSeedAdmin();
  await ensureSeedData();
}
