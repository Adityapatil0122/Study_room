import React, { useMemo, useState, useEffect } from "react";
import ThemeSelect from "../components/common/ThemeSelect.jsx";
import LucideIcon from "../components/icons/LucideIcon.jsx";
import Modal from "../components/common/Modal.jsx";

function ExpenseModal({ open, onClose, onSubmit, categories = [] }) {
  const [form, setForm] = useState(() => ({
    title: "",
    category: categories[0]?.value ?? "",
    amount: "",
    paid_via: "upi",
    expense_date: new Date().toISOString().slice(0, 10),
    notes: "",
  }));

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      category: categories[0]?.value ?? "",
    }));
  }, [categories]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) {
      alert("Title is required.");
      return;
    }
    if (!form.amount) {
      alert("Amount is required.");
      return;
    }
    await onSubmit({
      ...form,
      title: form.title.trim(),
      notes: form.notes.trim(),
    });
    setForm((prev) => ({ ...prev, title: "", amount: "", notes: "" }));
  };

  return (
    <Modal open={open} onClose={onClose} title="Log Expense" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex flex-col text-sm font-medium text-slate-700">
          Expense Title
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            placeholder="e.g. Monthly rent"
            required
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Category
            <ThemeSelect
              name="category"
              value={form.category}
              onChange={handleChange}
              className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Select category</option>
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </ThemeSelect>
          </label>

          <label className="flex flex-col text-sm font-medium text-slate-700">
            Amount (₹)
            <input
              name="amount"
              type="number"
              value={form.amount}
              onChange={handleChange}
              className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              min="0"
            />
          </label>

          <label className="flex flex-col text-sm font-medium text-slate-700">
            Paid Via
            <ThemeSelect
              name="paid_via"
              value={form.paid_via}
              onChange={handleChange}
              className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="upi">UPI / Bank</option>
              <option value="cash">Cash</option>
            </ThemeSelect>
          </label>

          <label className="flex flex-col text-sm font-medium text-slate-700">
            Expense Date
            <input
              name="expense_date"
              type="date"
              value={form.expense_date}
              onChange={handleChange}
              className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
        </div>

        <label className="flex flex-col text-sm font-medium text-slate-700">
          Notes
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            placeholder="Remarks, vendor details..."
          />
        </label>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-gradient-primary rounded-xl px-4 py-2 text-sm font-semibold"
          >
            Save Expense
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ExpensesView({
  expenses = [],
  onCreateExpense,
  categories = [],
  onOpenModal = () => {},
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const categoryOptions = useMemo(
    () =>
      (categories || []).map((category) => ({
        value: category.value || category.name || "",
        label: category.label || category.name || category.value || "",
      })),
    [categories]
  );
  const categoryMap = useMemo(() => {
    const map = new Map();
    categoryOptions.forEach((item) => map.set(item.value, item.label));
    return map;
  }, [categoryOptions]);

  const totalSpend = expenses.reduce((sum, item) => sum + item.amount, 0);
  const rentSpend = expenses
    .filter((item) => item.category === "rent")
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Expenses & Rentals
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track rent, maintenance, cleaning crew, and miscellaneous spends.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onOpenModal?.("importData", { entity: "expenses" })}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
          >
            <LucideIcon name="upload" className="h-4 w-4" />
            Import
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="btn-gradient-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
          >
            <LucideIcon name="wallet" className="h-4 w-4" />
            Add Expense
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Total Spend
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">
            ₹{totalSpend.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-indigo-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Rent & Lease
          </p>
          <p className="mt-2 text-2xl font-semibold text-indigo-700">
            ₹{rentSpend.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Entries
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">
            {expenses.length}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                Title
              </th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                Category
              </th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                Amount
              </th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                Paid Via
              </th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                Date
              </th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-sm text-slate-500"
                >
                  No expenses logged yet.
                </td>
              </tr>
            ) : (
              expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">
                    {expense.title}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {categoryMap.get(expense.category) ?? expense.category}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    ₹{expense.amount.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {expense.paid_via === "upi" ? "UPI" : "Cash"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {new Date(expense.expense_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {expense.notes || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ExpenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        categories={categoryOptions}
        onSubmit={async (payload) => {
          await onCreateExpense(payload);
          setModalOpen(false);
        }}
      />
    </div>
  );
}

export default ExpensesView;
