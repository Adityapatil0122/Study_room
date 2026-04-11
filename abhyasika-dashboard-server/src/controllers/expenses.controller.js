import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createExpense,
  createExpenseCategory,
  deleteExpenseCategory,
  importExpenses,
  listExpenseCategories,
  listExpenses,
} from "../services/expenses.service.js";

export const getExpenses = asyncHandler(async (req, res) => {
  const data = await listExpenses(req.auth.workspaceOwnerId);
  res.json({ data });
});

export const postExpense = asyncHandler(async (req, res) => {
  const expense = await createExpense(
    req.auth.workspaceOwnerId,
    req.body ?? {},
    req.body?.audit ?? null
  );
  res.status(201).json({ data: expense });
});

export const getExpenseCategories = asyncHandler(async (req, res) => {
  const data = await listExpenseCategories(req.auth.workspaceOwnerId);
  res.json({ data });
});

export const postExpenseCategory = asyncHandler(async (req, res) => {
  const data = await createExpenseCategory(
    req.auth.workspaceOwnerId,
    req.body ?? {},
    req.body?.audit ?? null
  );
  res.status(201).json({ data });
});

export const deleteExpenseCategoryById = asyncHandler(async (req, res) => {
  const data = await deleteExpenseCategory(
    req.auth.workspaceOwnerId,
    req.params.id,
    req.body?.audit ?? null
  );
  res.json({ data });
});

export const postImportExpenses = asyncHandler(async (req, res) => {
  const data = await importExpenses(
    req.auth.workspaceOwnerId,
    req.body?.rows ?? [],
    req.body?.audit ?? null
  );
  res.status(201).json({ data });
});
