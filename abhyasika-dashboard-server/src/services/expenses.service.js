import { AppError } from "../utils/AppError.js";
import { randomUUID } from "crypto";
import { query, queryOne } from "../db/connection.js";
import { toDateString } from "../utils/data.js";
import { recordAudit } from "./audit.service.js";

function mapExpense(row) {
  return {
    ...row,
    expense_date: toDateString(row.expense_date),
  };
}

export async function listExpenses(workspaceOwnerId) {
  const rows = await query(
    `
      SELECT *
      FROM expenses
      WHERE workspace_owner_id = ?
      ORDER BY expense_date DESC, created_at DESC
    `,
    [workspaceOwnerId]
  );

  return rows.map(mapExpense);
}

export async function createExpense(workspaceOwnerId, payload, audit = null, connection) {
  if (!payload?.title || payload?.amount === undefined || payload?.amount === null) {
    throw new AppError("Title and amount are required", 400);
  }

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError("Amount must be zero or greater", 400);
  }

  const expenseId = randomUUID();
  await query(
    `
      INSERT INTO expenses (
        id,
        workspace_owner_id,
        title,
        category,
        amount,
        paid_via,
        expense_date,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      expenseId,
      workspaceOwnerId,
      payload.title,
      payload.category ?? "misc",
      amount,
      payload.paid_via ?? "cash",
      payload.expense_date ?? new Date().toISOString().slice(0, 10),
      payload.notes ?? null,
    ],
    connection
  );

  await recordAudit(
    {
      workspaceOwnerId,
      objectType: "expenses",
      objectId: expenseId,
      action: "create",
      actorId: audit?.actor_id,
      actorRole: audit?.actor_role,
      metadata: {
        amount,
        category: payload.category ?? "misc",
        paid_via: payload.paid_via ?? "cash",
      },
    },
    connection
  );

  const row = await queryOne("SELECT * FROM expenses WHERE id = ?", [expenseId], connection);
  return mapExpense(row);
}

function mapExpenseCategory(row) {
  return row;
}

export async function listExpenseCategories(workspaceOwnerId) {
  const rows = await query(
    `
      SELECT *
      FROM expense_categories
      WHERE workspace_owner_id = ?
      ORDER BY name ASC
    `,
    [workspaceOwnerId]
  );

  return rows.map(mapExpenseCategory);
}

export async function createExpenseCategory(workspaceOwnerId, payload, audit = null, connection) {
  const name = payload?.name?.trim();
  const value = payload?.value?.trim();

  if (!name || !value) {
    throw new AppError("Category name and value are required", 400);
  }

  const existing = await queryOne(
    `
      SELECT id
      FROM expense_categories
      WHERE workspace_owner_id = ? AND value = ?
      LIMIT 1
    `,
    [workspaceOwnerId, value],
    connection
  );
  if (existing) {
    throw new AppError("Category already exists", 409);
  }

  const categoryId = randomUUID();
  await query(
    `
      INSERT INTO expense_categories (
        id,
        workspace_owner_id,
        name,
        value
      ) VALUES (?, ?, ?, ?)
    `,
    [categoryId, workspaceOwnerId, name, value],
    connection
  );

  await recordAudit(
    {
      workspaceOwnerId,
      objectType: "expense_categories",
      objectId: categoryId,
      action: "create",
      actorId: audit?.actor_id,
      actorRole: audit?.actor_role,
      metadata: { name, value },
    },
    connection
  );

  const row = await queryOne("SELECT * FROM expense_categories WHERE id = ?", [categoryId], connection);
  return mapExpenseCategory(row);
}

export async function deleteExpenseCategory(workspaceOwnerId, categoryId, audit = null, connection) {
  const row = await queryOne(
    `
      SELECT *
      FROM expense_categories
      WHERE id = ? AND workspace_owner_id = ?
      LIMIT 1
    `,
    [categoryId, workspaceOwnerId],
    connection
  );

  if (!row) {
    throw new AppError("Category not found", 404);
  }

  await query(
    "DELETE FROM expense_categories WHERE id = ? AND workspace_owner_id = ?",
    [categoryId, workspaceOwnerId],
    connection
  );

  await recordAudit(
    {
      workspaceOwnerId,
      objectType: "expense_categories",
      objectId: categoryId,
      action: "delete",
      actorId: audit?.actor_id,
      actorRole: audit?.actor_role,
      metadata: { name: row.name, value: row.value },
    },
    connection
  );

  return mapExpenseCategory(row);
}

export async function importExpenses(workspaceOwnerId, rows, audit = null) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const created = [];
  for (const row of rows) {
    created.push(await createExpense(workspaceOwnerId, row, audit));
  }
  return created;
}
