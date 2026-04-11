import React, { useEffect, useState } from "react";
import Modal from "../common/Modal.jsx";
import LucideIcon from "../icons/LucideIcon.jsx";

const defaultForm = {
  name: "",
  price: "",
  duration_days: 30,
  is_active: true,
};

function PlanModal({ open, onClose, plan, onSubmit, isSystem = false }) {
  const isEdit = Boolean(plan);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setError("");
    }
    if (plan) {
      setForm({
        name: plan.name ?? "",
        price: plan.price ?? "",
        duration_days: plan.duration_days ?? 30,
        is_active: plan.is_active ?? true,
      });
    } else {
      setForm(defaultForm);
    }
  }, [plan, open]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Plan name is required.");
      return;
    }
    if (!form.price || Number(form.price) <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    if (!form.duration_days || Number(form.duration_days) <= 0) {
      setError("Duration must be a positive number of days.");
      return;
    }
    if (typeof onSubmit !== "function") {
      setError("Plan actions are unavailable.");
      return;
    }

    try {
      setSaving(true);
      await onSubmit({
        name: form.name.trim(),
        price: Number(form.price),
        duration_days: Number(form.duration_days),
        is_active: form.is_active,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Unable to save plan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Plan" : "Add Plan"}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          These plans appear in student, renewal, and payment forms. Updating a plan keeps existing student billing untouched.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
            Plan name
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              disabled={isSystem}
              className={`mt-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${
                isSystem ? "cursor-not-allowed opacity-70" : ""
              }`}
              placeholder="Monthly Unlimited"
            />
            {isSystem ? (
              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Core plan name is locked.
              </span>
            ) : null}
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
            Amount (₹)
            <input
              name="price"
              type="number"
              min="1"
              value={form.price}
              onChange={handleChange}
              className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="2500"
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
            Duration (days)
            <input
              name="duration_days"
              type="number"
              min="1"
              value={form.duration_days}
              onChange={handleChange}
              disabled={isSystem}
              className={`mt-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${
                isSystem ? "cursor-not-allowed opacity-70" : ""
              }`}
              placeholder="30"
            />
            {isSystem ? (
              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Core plan duration is fixed.
              </span>
            ) : null}
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
            Status
            <div className="mt-3 inline-flex items-center gap-2">
              <input
                type="checkbox"
                name="is_active"
                checked={form.is_active}
                onChange={handleChange}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {form.is_active ? "Active" : "Archived"}
              </span>
            </div>
          </label>
        </div>
        {error ? (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
            <LucideIcon name="AlertTriangle" className="h-4 w-4" />
            {error}
          </div>
        ) : null}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-200 transition hover:border-slate-300 hover:bg-white dark:hover:bg-gray-800"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {saving ? (
              <>
                <LucideIcon name="Loader2" className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <LucideIcon name="Save" className="h-4 w-4" />
                {isEdit ? "Update Plan" : "Create Plan"}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default PlanModal;
