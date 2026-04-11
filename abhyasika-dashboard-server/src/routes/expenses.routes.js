import { Router } from "express";
import {
  deleteExpenseCategoryById,
  getExpenseCategories,
  getExpenses,
  postExpense,
  postExpenseCategory,
  postImportExpenses,
} from "../controllers/expenses.controller.js";

const router = Router();

router.get("/categories", getExpenseCategories);
router.post("/categories", postExpenseCategory);
router.delete("/categories/:id", deleteExpenseCategoryById);
router.post("/import", postImportExpenses);
router.get("/", getExpenses);
router.post("/", postExpense);

export default router;
