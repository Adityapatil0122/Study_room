import React, { useMemo, useState, useEffect } from "react";
import Modal from "../common/Modal.jsx";
import ThemeSelect from "../common/ThemeSelect.jsx";

const PAYMENT_MODES = [
  { value: "upi", label: "UPI / Online" },
  { value: "cash", label: "Cash" },
];

function PaymentModal({
  open,
  onClose,
  onSubmit,
  plans,
  students,
  roles = [],
  defaultStudent,
}) {
  const studentOptions = useMemo(
    () => [...students].sort((a, b) => a.name.localeCompare(b.name)),
    [students]
  );

  const buildInitialState = () => {
    const studentId = defaultStudent?.id ?? "";
    const planId = defaultStudent?.current_plan_id ?? plans[0]?.id ?? "";
    const validFrom = new Date().toISOString().slice(0, 10);
    const plan = plans.find((item) => item.id === planId);
    const validUntil = plan
      ? new Date(Date.parse(validFrom) + plan.duration_days * 86400000)
          .toISOString()
          .slice(0, 10)
      : validFrom;
    return {
      student_id: studentId,
      plan_id: planId,
      amount_paid: plan?.price ?? "",
      valid_from: validFrom,
      valid_until: validUntil,
      payment_mode: "upi",
      includes_registration: false,
      notes: "",
      collected_role_id: roles[0]?.id ?? "",
    };
  };

  const [form, setForm] = useState(buildInitialState);

  useEffect(() => {
    if (!defaultStudent) return;
    setForm((prev) => ({
      ...prev,
      student_id: defaultStudent.id,
      plan_id: defaultStudent.current_plan_id ?? prev.plan_id,
    }));
  }, [defaultStudent]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      collected_role_id: prev.collected_role_id || roles[0]?.id || "",
    }));
  }, [roles]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => {
      const next = { ...prev, [name]: type === "checkbox" ? checked : value };
      if (name === "plan_id") {
        const plan = plans.find((item) => item.id === value);
        if (plan) {
          next.amount_paid = plan.price;
          if (next.valid_from) {
            next.valid_until = new Date(
              Date.parse(next.valid_from) + plan.duration_days * 86400000
            )
              .toISOString()
              .slice(0, 10);
          }
        }
      }
      if (name === "valid_from" && next.plan_id) {
        const plan = plans.find((item) => item.id === next.plan_id);
        if (plan) {
          next.valid_until = new Date(
            Date.parse(value) + plan.duration_days * 86400000
          )
            .toISOString()
            .slice(0, 10);
        }
      }
      return next;
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const amount = Number(form.amount_paid);

    if (!form.student_id) {
      alert("Please select a student.");
      return;
    }
    if (!form.plan_id) {
      alert("Please select a plan.");
      return;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      alert("Enter a valid amount greater than zero.");
      return;
    }
    if (!form.collected_role_id) {
      alert("Please select which role collected this payment.");
      return;
    }
    onSubmit({
      student_id: form.student_id,
      plan_id: form.plan_id,
      amount_paid: amount,
      valid_from: form.valid_from,
      valid_until: form.valid_until,
      payment_mode: form.payment_mode,
      includes_registration: form.includes_registration,
      notes: form.notes.trim(),
      collected_role_id: form.collected_role_id,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Log Payment" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Student
            <ThemeSelect
              name="student_id"
              value={form.student_id}
              onChange={handleChange}
              disabled={!!defaultStudent}
              className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="">Select student</option>
              {studentOptions.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </ThemeSelect>
          </label>

          <label className="flex flex-col text-sm font-medium text-slate-700">
            Plan
            <ThemeSelect
              name="plan_id"
              value={form.plan_id}
              onChange={handleChange}
              className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Select plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — ₹{plan.price.toLocaleString("en-IN")}
                </option>
              ))}
            </ThemeSelect>
          </label>

          <label className="flex flex-col text-sm font-medium text-slate-700">
            Amount Paid (₹)
            <input
              name="amount_paid"
              type="number"
              value={form.amount_paid}
              onChange={handleChange}
              className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              min="0"
              step="0.01"
            />
          </label>

          <label className="flex flex-col text-sm font-medium text-slate-700">
            Valid From
            <input
              name="valid_from"
              type="date"
              value={form.valid_from}
              onChange={handleChange}
              className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <label className="flex flex-col text-sm font-medium text-slate-700">
            Valid Until
            <input
              name="valid_until"
              type="date"
              value={form.valid_until}
              onChange={handleChange}
              className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <label className="flex flex-col text-sm font-medium text-slate-700">
            Payment Mode
            <ThemeSelect
              name="payment_mode"
              value={form.payment_mode}
              onChange={handleChange}
              className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              {PAYMENT_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </ThemeSelect>
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700 sm:col-span-2">
            Collected By (Role)
            <ThemeSelect
              name="collected_role_id"
              value={form.collected_role_id}
              onChange={handleChange}
              className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              disabled={roles.length === 0}
            >
              <option value="">
                {roles.length === 0 ? "Create a role in Settings first" : "Select role"}
              </option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </ThemeSelect>
            {roles.length === 0 ? (
              <p className="mt-1 text-xs text-amber-600">
                No roles found. Head to Settings → Role Directory to add one.
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                Helps identify which team role handled this payment.
              </p>
            )}
          </label>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
          <span>Include registration fees</span>
          <button
            type="button"
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                includes_registration: !prev.includes_registration,
              }))
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              form.includes_registration ? "toggle-gradient-on" : "bg-slate-300"
            }`}
            aria-pressed={form.includes_registration}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                form.includes_registration ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <label className="flex flex-col text-sm font-medium text-slate-700">
          Notes (optional)
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            placeholder="Ex: Locker upgrade, includes deposit refund, etc."
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
            Log Payment
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default PaymentModal;
