import fs from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { config } from "../config/env.js";
import { query, queryOne } from "./connection.js";
import { logger } from "../utils/logger.js";
import { getDefaultWorkspaceOwner } from "../services/auth.service.js";

async function ensureUploadsDir() {
  await fs.mkdir(config.uploadsDir, { recursive: true });
  await fs.mkdir(path.join(config.uploadsDir, "branding"), { recursive: true });
  await fs.mkdir(path.join(config.uploadsDir, "students"), { recursive: true });
}

async function createIndexIfMissing(indexName, tableName, columns) {
  const existing = await queryOne(
    `
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = ? AND table_name = ? AND index_name = ?
      LIMIT 1
    `,
    [config.mysqlDatabase, tableName, indexName]
  );

  if (!existing) {
    await query(`CREATE INDEX ${indexName} ON ${tableName} (${columns})`);
  }
}

async function addColumnIfMissing(tableName, columnName, definition) {
  const existing = await queryOne(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = ? AND table_name = ? AND column_name = ?
      LIMIT 1
    `,
    [config.mysqlDatabase, tableName, columnName]
  );

  if (!existing) {
    await query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

const COORDINATOR_ROLE_PERMISSIONS = {
  coordinator: { view: true, add: false, edit: false, delete: false },
  dashboard: { view: false, add: false, edit: false, delete: false },
  students: { view: true, add: false, edit: false, delete: false },
  seats: { view: false, add: false, edit: false, delete: false },
  payments: { view: true, add: false, edit: false, delete: false },
  paymentRequests: { view: true, add: true, edit: false, delete: false },
  renewals: { view: true, add: true, edit: false, delete: false },
  reports: { view: false, add: false, edit: false, delete: false },
  admissions: { view: true, add: false, edit: false, delete: false },
  history: { view: false, add: false, edit: false, delete: false },
  expenses: { view: false, add: false, edit: false, delete: false },
  settings: { view: false, add: false, edit: false, delete: false },
};

async function ensureCoordinatorRole(ownerId) {
  const existing = await queryOne(
    `
      SELECT id
      FROM admin_roles
      WHERE created_by = ? AND LOWER(name) = 'coordinator'
      LIMIT 1
    `,
    [ownerId]
  );

  const permissions = JSON.stringify(COORDINATOR_ROLE_PERMISSIONS);
  const description =
    "Limited access for payment requests, renewals, admissions, and payment verification.";

  if (existing) {
    await query(
      `
        UPDATE admin_roles
        SET description = ?, permissions = ?
        WHERE id = ?
      `,
      [description, permissions, existing.id]
    );
    return;
  }

  await query(
    `
      INSERT INTO admin_roles (
        id,
        created_by,
        name,
        description,
        permissions
      ) VALUES (?, ?, 'Coordinator', ?, ?)
    `,
    [randomUUID(), ownerId, description, permissions]
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
      is_owner TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      invite_status VARCHAR(32) NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await createIndexIfMissing("idx_admin_owner_id", "admins", "owner_id");
  await createIndexIfMissing("idx_admin_role_id", "admins", "role_id");

  await query(`
    CREATE TABLE IF NOT EXISTS admin_roles (
      id CHAR(36) PRIMARY KEY,
      created_by CHAR(36) NOT NULL,
      name VARCHAR(120) NOT NULL,
      description TEXT NULL,
      permissions JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT uniq_role_name_per_owner UNIQUE (created_by, name)
    )
  `);
  await createIndexIfMissing("idx_roles_created_by", "admin_roles", "created_by");

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
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      duration_days INT NOT NULL DEFAULT 30,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT uniq_plan_name_per_workspace UNIQUE (workspace_owner_id, name)
    )
  `);
  await createIndexIfMissing("idx_plans_workspace_owner", "plans", "workspace_owner_id");

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
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await createIndexIfMissing("idx_students_workspace_owner", "students", "workspace_owner_id");
  await createIndexIfMissing("idx_students_current_plan", "students", "current_plan_id");
  await createIndexIfMissing("idx_students_current_seat", "students", "current_seat_id");

  await query(`
    CREATE TABLE IF NOT EXISTS seats (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      seat_number VARCHAR(120) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'available',
      current_student_id CHAR(36) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT uniq_seat_number_per_workspace UNIQUE (workspace_owner_id, seat_number)
    )
  `);
  await createIndexIfMissing("idx_seats_workspace_owner", "seats", "workspace_owner_id");

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
      includes_registration TINYINT(1) NOT NULL DEFAULT 0,
      notes TEXT NULL,
      payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await createIndexIfMissing("idx_payments_workspace_owner", "payments", "workspace_owner_id");
  await createIndexIfMissing("idx_payments_student_id", "payments", "student_id");
  await createIndexIfMissing("idx_payments_plan_id", "payments", "plan_id");

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
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await createIndexIfMissing("idx_expenses_workspace_owner", "expenses", "workspace_owner_id");

  await query(`
    CREATE TABLE IF NOT EXISTS expense_categories (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      name VARCHAR(120) NOT NULL,
      value VARCHAR(120) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT uniq_category_value_per_workspace UNIQUE (workspace_owner_id, value)
    )
  `);
  await createIndexIfMissing(
    "idx_expense_categories_workspace_owner",
    "expense_categories",
    "workspace_owner_id"
  );

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
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await createIndexIfMissing("idx_audit_workspace_owner", "audit_log", "workspace_owner_id");
  await createIndexIfMissing("idx_audit_object", "audit_log", "object_type, object_id");

  await query(`
    CREATE TABLE IF NOT EXISTS student_credentials (
      id CHAR(36) PRIMARY KEY,
      student_id CHAR(36) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await createIndexIfMissing("idx_student_credentials_student", "student_credentials", "student_id");

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
      payment_date DATETIME NULL,
      linked_payment_id CHAR(36) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await createIndexIfMissing("idx_student_payments_workspace", "student_payments", "workspace_owner_id");
  await createIndexIfMissing("idx_student_payments_student", "student_payments", "student_id");
  await createIndexIfMissing("idx_student_payments_order", "student_payments", "razorpay_order_id");

  await addColumnIfMissing("student_payments", "valid_from", "DATE NULL");
  await addColumnIfMissing("student_payments", "valid_until", "DATE NULL");

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
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await createIndexIfMissing("idx_pending_payments_workspace", "pending_payments", "workspace_owner_id");
  await createIndexIfMissing("idx_pending_payments_student", "pending_payments", "student_id");

  // scheduled_payment_requests: Admin-initiated custom or 15-day lumpsum requests sent to student.
  // type: 'custom' | 'half_month' (15-day lumpsum)
  // status: 'sent' -> 'paid' | 'rejected' | 'cancelled'
  await query(`
    CREATE TABLE IF NOT EXISTS scheduled_payment_requests (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      student_id CHAR(36) NOT NULL,
      plan_id CHAR(36) NOT NULL,
      type VARCHAR(32) NOT NULL DEFAULT 'custom',
      amount NUMERIC(10,2) NOT NULL,
      valid_from DATE NOT NULL,
      valid_until DATE NOT NULL,
      notes TEXT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'sent',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await createIndexIfMissing("idx_sched_pay_workspace", "scheduled_payment_requests", "workspace_owner_id");
  await createIndexIfMissing("idx_sched_pay_student", "scheduled_payment_requests", "student_id");

  // membership_holds: tracks a paused membership period for a student.
  // When on hold, renewal_date is frozen; days_on_hold is credited back on resume.
  await query(`
    CREATE TABLE IF NOT EXISTS membership_holds (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      student_id CHAR(36) NOT NULL,
      hold_start DATE NOT NULL,
      hold_end DATE NULL,
      resumed_at TIMESTAMP NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await createIndexIfMissing("idx_holds_workspace", "membership_holds", "workspace_owner_id");
  await createIndexIfMissing("idx_holds_student", "membership_holds", "student_id");

  // Safe migrations: add hold columns to students table.
  await addColumnIfMissing("students", "membership_status", "VARCHAR(32) NOT NULL DEFAULT 'active'");
  await addColumnIfMissing("students", "hold_start", "DATE NULL");
  await addColumnIfMissing("students", "hold_renewal_snapshot", "DATE NULL");

  // Deposit + Aadhaar file (image or PDF) captured at registration.
  await addColumnIfMissing("students", "deposit_amount", "NUMERIC(10,2) NOT NULL DEFAULT 0");
  await addColumnIfMissing("students", "aadhaar_file_url", "TEXT NULL");
  await addColumnIfMissing("students", "aadhaar_file_type", "VARCHAR(16) NULL");

  // Admin-customizable duration (months) + deposit + discount on scheduled requests.
  await addColumnIfMissing("plans", "duration_months", "INT NULL");
  await addColumnIfMissing(
    "scheduled_payment_requests",
    "deposit_amount",
    "NUMERIC(10,2) NOT NULL DEFAULT 0"
  );
  await addColumnIfMissing(
    "scheduled_payment_requests",
    "discount_enabled",
    "TINYINT(1) NOT NULL DEFAULT 0"
  );
  await addColumnIfMissing(
    "scheduled_payment_requests",
    "discount_amount",
    "NUMERIC(10,2) NOT NULL DEFAULT 0"
  );
  await addColumnIfMissing(
    "scheduled_payment_requests",
    "total_amount",
    "NUMERIC(10,2) NULL"
  );
  await addColumnIfMissing(
    "scheduled_payment_requests",
    "late_fee_enabled",
    "TINYINT(1) NOT NULL DEFAULT 0"
  );
  await addColumnIfMissing(
    "scheduled_payment_requests",
    "late_fee_amount",
    "NUMERIC(10,2) NOT NULL DEFAULT 0"
  );
  await addColumnIfMissing(
    "scheduled_payment_requests",
    "allow_seat_selection",
    "TINYINT(1) NOT NULL DEFAULT 0"
  );

  // Admin notifications (new-registration, etc.)
  await query(`
    CREATE TABLE IF NOT EXISTS admin_notifications (
      id CHAR(36) PRIMARY KEY,
      workspace_owner_id CHAR(36) NOT NULL,
      type VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NULL,
      object_type VARCHAR(64) NULL,
      object_id CHAR(36) NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await createIndexIfMissing(
    "idx_admin_notifications_workspace",
    "admin_notifications",
    "workspace_owner_id"
  );
  await createIndexIfMissing(
    "idx_admin_notifications_unread",
    "admin_notifications",
    "workspace_owner_id, is_read"
  );

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
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await createIndexIfMissing("idx_import_logs_workspace_owner", "import_logs", "workspace_owner_id");
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

async function ensureSeedData() {
  let owner;
  try {
    owner = await getDefaultWorkspaceOwner();
  } catch {
    // No workspace owner yet (first boot before admin is seeded) - skip.
    return;
  }

  await ensureCoordinatorRole(owner.id);

  const existingPlan = await queryOne(
    "SELECT id FROM plans WHERE workspace_owner_id = ? LIMIT 1",
    [owner.id]
  );
  if (!existingPlan) {
    await query(
      `INSERT INTO plans (id, workspace_owner_id, name, price, duration_days, is_active)
       VALUES (?, ?, 'Monthly', 1000, 30, 1)`,
      [randomUUID(), owner.id]
    );
    logger.info("Seeded default Monthly plan at Rs 1000");
  }

  const existingSeat = await queryOne(
    "SELECT id FROM seats WHERE workspace_owner_id = ? LIMIT 1",
    [owner.id]
  );
  if (!existingSeat) {
    for (let i = 1; i <= 64; i += 1) {
      await query(
        `INSERT INTO seats (id, workspace_owner_id, seat_number, status)
         VALUES (?, ?, ?, 'available')`,
        [randomUUID(), owner.id, String(i)]
      );
    }
    logger.info("Seeded 64 seats (1-64)");
  }
}

export async function initializeDatabase() {
  await ensureUploadsDir();
  await query("SELECT 1");
  await ensureTables();
  await ensureSeedAdmin();
  await ensureSeedData();
}
