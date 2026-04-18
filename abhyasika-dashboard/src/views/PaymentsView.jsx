import React, { useMemo, useState } from "react";
import LucideIcon from "../components/icons/LucideIcon.jsx";
import { useAuth } from "../context/AuthContext.jsx";

// Default dates for 15-day lumpsum: today → today+14
function halfMonthDates() {
  const start = new Date();
  const end = new Date(start.getTime() + 14 * 86400000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { valid_from: fmt(start), valid_until: fmt(end) };
}

const EMPTY_SCHED_FORM = {
  type: "custom",
  student_id: "",
  plan_id: "",
  amount: "",
  valid_from: "",
  valid_until: "",
  notes: "",
  deposit_amount: "",
  discount_enabled: false,
  discount_amount: "",
};

// Discount is only allowed for long-term plans (>= 180 days / ~6 months).
const isDiscountEligiblePlan = (plan) =>
  plan && Number(plan.duration_days) >= 180;

function PaymentsView({
  payments,
  students = [],
  plans = [],
  filters,
  onFiltersChange,
  onOpenModal,
  roles = [],
  pendingPayments = [],
  onApprovePending,
  onRejectPending,
  scheduledRequests = [],
  onCreateScheduledRequest,
  onCancelScheduledRequest,
}) {
  const [activeTab, setActiveTab] = useState("payments"); // "payments" | "pending" | "scheduled"
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [schedForm, setSchedForm] = useState(EMPTY_SCHED_FORM);
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedError, setSchedError] = useState("");

  const handleApprove = async (id) => {
    if (!onApprovePending) return;
    setApprovingId(id);
    try {
      await onApprovePending(id);
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (id) => {
    if (!onRejectPending) return;
    setRejectingId(id);
    try {
      await onRejectPending(id);
    } finally {
      setRejectingId(null);
    }
  };

  const handleCancelScheduled = async (id) => {
    if (!onCancelScheduledRequest) return;
    setCancellingId(id);
    try {
      await onCancelScheduledRequest(id);
    } finally {
      setCancellingId(null);
    }
  };

  const handleSchedFormChange = (e) => {
    const { name, value, type: inputType, checked } = e.target;
    setSchedForm((prev) => {
      const updated = {
        ...prev,
        [name]: inputType === "checkbox" ? checked : value,
      };
      // If plan changes and new plan is not discount-eligible, clear discount toggle.
      if (name === "plan_id") {
        const plan = plans.find((p) => p.id === value);
        if (!isDiscountEligiblePlan(plan)) {
          updated.discount_enabled = false;
          updated.discount_amount = "";
        }
      }
      // Auto-fill dates for half_month type
      if (name === "type" && value === "half_month") {
        const { valid_from, valid_until } = halfMonthDates();
        // Auto-fill amount from selected plan
        const plan = plans.find((p) => p.id === updated.plan_id);
        const halfAmount = plan ? Math.round(Number(plan.price) * 15 / 30) : "";
        return { ...updated, valid_from, valid_until, amount: String(halfAmount) };
      }
      // If plan changes on half_month, recalc amount
      if (name === "plan_id" && prev.type === "half_month") {
        const plan = plans.find((p) => p.id === value);
        const halfAmount = plan ? Math.round(Number(plan.price) * 15 / 30) : "";
        return { ...updated, amount: String(halfAmount) };
      }
      return updated;
    });
  };

  const handleSendScheduled = async (e) => {
    e.preventDefault();
    if (!onCreateScheduledRequest) return;
    setSchedError("");
    if (!schedForm.student_id || !schedForm.plan_id) {
      setSchedError("Student and plan are required.");
      return;
    }
    if (schedForm.type === "custom" && (!schedForm.amount || !schedForm.valid_from || !schedForm.valid_until)) {
      setSchedError("Amount and date range are required for custom requests.");
      return;
    }
    setSchedSaving(true);
    try {
      const selectedPlan = plans.find((p) => p.id === schedForm.plan_id);
      const canDiscount = isDiscountEligiblePlan(selectedPlan);
      await onCreateScheduledRequest({
        student_id: schedForm.student_id,
        plan_id: schedForm.plan_id,
        type: schedForm.type,
        amount: schedForm.type === "custom" ? Number(schedForm.amount) : undefined,
        valid_from: schedForm.type === "custom" ? schedForm.valid_from : undefined,
        valid_until: schedForm.type === "custom" ? schedForm.valid_until : undefined,
        notes: schedForm.notes || null,
        deposit_amount: Number(schedForm.deposit_amount) || 0,
        discount_enabled: canDiscount ? schedForm.discount_enabled : false,
        discount_amount: canDiscount && schedForm.discount_enabled ? Number(schedForm.discount_amount) || 0 : 0,
      });
      setSchedForm(EMPTY_SCHED_FORM);
    } catch (err) {
      setSchedError(err.message ?? "Failed to send request.");
    } finally {
      setSchedSaving(false);
    }
  };
  const dateKey = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDate = (value) => {
    const key = dateKey(value);
    if (!key) return "—";
    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const [sortConfig, setSortConfig] = useState({
    key: "payment_date",
    direction: "desc",
  });
  const { hasPermission } = useAuth();
  const canCreatePayment = hasPermission("payments", "add");

  const studentMap = useMemo(() => {
    const map = new Map();
    students.forEach((student) => map.set(student.id, student));
    return map;
  }, [students]);

  const planMap = useMemo(() => {
    const map = new Map();
    plans.forEach((plan) => map.set(plan.id, plan));
    return map;
  }, [plans]);

  const roleMap = useMemo(() => {
    const map = new Map();
    roles.forEach((role) => map.set(role.id, role));
    return map;
  }, [roles]);

  const filteredPayments = useMemo(() => {
    return payments
      .filter((payment) => {
        if (filters.search) {
          const student = studentMap.get(payment.student_id);
          const match = student?.name
            ?.toLowerCase()
            .includes(filters.search.toLowerCase());
          if (!match) return false;
        }
        const paymentDate = dateKey(payment.payment_date);
        if (filters.startDate) {
          if (!paymentDate || paymentDate < filters.startDate) return false;
        }
        if (filters.endDate) {
          if (!paymentDate || paymentDate > filters.endDate) return false;
        }
        if (filters.mode && filters.mode !== "all") {
          if (payment.payment_mode !== filters.mode) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const { key, direction } = sortConfig;
        const order = direction === "asc" ? 1 : -1;
        if (key === "payment_date") {
          const aDate = dateKey(a.payment_date);
          const bDate = dateKey(b.payment_date);
          return aDate.localeCompare(bDate) * order;
        }
        if (key === "amount_paid") {
          return (a.amount_paid - b.amount_paid) * order;
        }
        if (key === "student") {
          const nameA = studentMap.get(a.student_id)?.name ?? "";
          const nameB = studentMap.get(b.student_id)?.name ?? "";
          return nameA.localeCompare(nameB) * order;
        }
        if (key === "plan") {
          const planA = planMap.get(a.plan_id)?.name ?? "";
          const planB = planMap.get(b.plan_id)?.name ?? "";
          return planA.localeCompare(planB) * order;
        }
        return 0;
      });
  }, [payments, filters, sortConfig, studentMap, planMap]);

  const totalRevenue = filteredPayments.reduce(
    (sum, payment) => sum + payment.amount_paid,
    0
  );
  const registrationRevenue = filteredPayments
    .filter((payment) => payment.includes_registration)
    .reduce((sum, payment) => sum + payment.amount_paid, 0);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: key === "payment_date" ? "desc" : "asc" };
    });
  };

  const renderSortIndicator = (key) => {
    if (sortConfig.key !== key) return null;
    return (
      <span className="ml-1 text-xs font-semibold text-indigo-500">
        {sortConfig.direction === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Payments</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track revenue split by mode and registration fees.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onOpenModal("importData", { entity: "payments" })}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
          >
            <LucideIcon name="Upload" className="h-4 w-4" />
            Import
          </button>
          {canCreatePayment ? (
            <button
              onClick={() => onOpenModal("logPayment")}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"
            >
              <LucideIcon name="CreditCard" className="h-4 w-4" />
              New Payment
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Total Revenue
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            ₹{totalRevenue.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Registration Fees
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            ₹{registrationRevenue.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            UPI Entries
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {
              filteredPayments.filter((payment) => payment.payment_mode === "upi")
                .length
            }
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Cash Entries
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {
              filteredPayments.filter((payment) => payment.payment_mode === "cash")
                .length
            }
          </p>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        <button
          type="button"
          onClick={() => setActiveTab("payments")}
          className={`-mb-px rounded-t-xl border border-b-0 px-4 py-2 text-sm font-semibold transition ${
            activeTab === "payments"
              ? "border-slate-200 bg-white text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          All Payments
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={`-mb-px flex items-center gap-2 rounded-t-xl border border-b-0 px-4 py-2 text-sm font-semibold transition ${
            activeTab === "pending"
              ? "border-slate-200 bg-white text-amber-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Pending QR
          {pendingPayments.length > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
              {pendingPayments.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("scheduled")}
          className={`-mb-px flex items-center gap-2 rounded-t-xl border border-b-0 px-4 py-2 text-sm font-semibold transition ${
            activeTab === "scheduled"
              ? "border-slate-200 bg-white text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Scheduled
          {scheduledRequests.length > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
              {scheduledRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Pending QR payments panel */}
      {activeTab === "pending" && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          {pendingPayments.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No pending QR payment requests.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">Student</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">Plan</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">Valid Period</th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">Submitted</th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingPayments.map((pending) => (
                    <tr key={pending.id} className="hover:bg-amber-50/40">
                      <td className="px-4 py-3 text-sm text-slate-800 font-semibold">
                        {pending.student_name || "—"}
                        <div className="text-xs font-normal text-slate-400">{pending.student_phone || ""}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{pending.plan_name || "—"}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-600">
                        ₹{Number(pending.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {pending.valid_from} → {pending.valid_until}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {pending.created_at
                          ? new Date(pending.created_at).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={approvingId === pending.id || rejectingId === pending.id}
                            onClick={() => handleApprove(pending.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                          >
                            {approvingId === pending.id ? (
                              <LucideIcon name="Loader2" className="h-3 w-3 animate-spin" />
                            ) : (
                              <LucideIcon name="CheckCircle" className="h-3 w-3" />
                            )}
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={approvingId === pending.id || rejectingId === pending.id}
                            onClick={() => handleReject(pending.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                          >
                            {rejectingId === pending.id ? (
                              <LucideIcon name="Loader2" className="h-3 w-3 animate-spin" />
                            ) : (
                              <LucideIcon name="XCircle" className="h-3 w-3" />
                            )}
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Scheduled Payment Requests panel */}
      {activeTab === "scheduled" && (
        <div className="space-y-5">
          {/* Create new request form */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-slate-800">Send Payment Request to Student</h3>
            <form onSubmit={handleSendScheduled} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Student</label>
                  <select
                    name="student_id"
                    value={schedForm.student_id}
                    onChange={handleSchedFormChange}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    required
                  >
                    <option value="">Select student…</option>
                    {students.filter((s) => s.is_active).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}{s.phone ? ` · ${s.phone}` : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</label>
                  <select
                    name="plan_id"
                    value={schedForm.plan_id}
                    onChange={handleSchedFormChange}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    required
                  >
                    <option value="">Select plan…</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — ₹{Number(p.price).toLocaleString("en-IN")}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Request Type</label>
                <div className="flex gap-3">
                  <label className={`flex flex-1 cursor-pointer items-center gap-2 rounded-xl border-2 p-3 transition ${schedForm.type === "custom" ? "border-indigo-500 bg-indigo-50" : "border-slate-200"}`}>
                    <input type="radio" name="type" value="custom" checked={schedForm.type === "custom"} onChange={handleSchedFormChange} className="accent-indigo-600" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Custom</p>
                      <p className="text-xs text-slate-500">Admin sets exact amount &amp; dates</p>
                    </div>
                  </label>
                  <label className={`flex flex-1 cursor-pointer items-center gap-2 rounded-xl border-2 p-3 transition ${schedForm.type === "half_month" ? "border-indigo-500 bg-indigo-50" : "border-slate-200"}`}>
                    <input type="radio" name="type" value="half_month" checked={schedForm.type === "half_month"} onChange={handleSchedFormChange} className="accent-indigo-600" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">15-Day Lumpsum</p>
                      <p className="text-xs text-slate-500">Half-month fee, auto-calculated</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Amount (₹)</label>
                  <input
                    type="number"
                    name="amount"
                    value={schedForm.amount}
                    onChange={handleSchedFormChange}
                    placeholder="e.g. 500"
                    readOnly={schedForm.type === "half_month"}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 read-only:bg-slate-100 read-only:text-slate-500"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Valid From</label>
                  <input
                    type="date"
                    name="valid_from"
                    value={schedForm.valid_from}
                    onChange={handleSchedFormChange}
                    readOnly={schedForm.type === "half_month"}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 read-only:bg-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Valid Until</label>
                  <input
                    type="date"
                    name="valid_until"
                    value={schedForm.valid_until}
                    onChange={handleSchedFormChange}
                    readOnly={schedForm.type === "half_month"}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 read-only:bg-slate-100"
                    required
                  />
                </div>
              </div>

              {/* Deposit + Discount row */}
              {(() => {
                const selectedPlan = plans.find((p) => p.id === schedForm.plan_id);
                const canDiscount = isDiscountEligiblePlan(selectedPlan);
                const planAmt = schedForm.type === "half_month" && selectedPlan
                  ? Math.round(Number(selectedPlan.price) * 15 / 30)
                  : Number(schedForm.amount) || 0;
                const deposit = Number(schedForm.deposit_amount) || 0;
                const discount = canDiscount && schedForm.discount_enabled
                  ? Number(schedForm.discount_amount) || 0
                  : 0;
                const total = Math.max(0, planAmt + deposit - discount);

                return (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Deposit Amount (₹) <span className="font-normal text-slate-400">optional</span>
                        </label>
                        <input
                          type="number"
                          name="deposit_amount"
                          value={schedForm.deposit_amount}
                          onChange={handleSchedFormChange}
                          placeholder="0"
                          min="0"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>

                      {canDiscount ? (
                        <div>
                          <label className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <input
                              type="checkbox"
                              name="discount_enabled"
                              checked={schedForm.discount_enabled}
                              onChange={handleSchedFormChange}
                              className="accent-indigo-600"
                            />
                            Discount (₹)
                            <span className="font-normal normal-case text-slate-400">
                              — eligible for {selectedPlan?.name}
                            </span>
                          </label>
                          <input
                            type="number"
                            name="discount_amount"
                            value={schedForm.discount_amount}
                            onChange={handleSchedFormChange}
                            placeholder="0"
                            min="0"
                            disabled={!schedForm.discount_enabled}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
                          />
                        </div>
                      ) : (
                        <div className="flex items-end pb-2">
                          <p className="text-xs text-slate-400">
                            Discount available for plans ≥ 6 months (180 days).
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Live total breakdown */}
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-500">
                        Total to Collect
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
                        <span>Plan/Fee: <strong>₹{planAmt.toLocaleString("en-IN")}</strong></span>
                        {deposit > 0 && (
                          <span className="text-emerald-700">+ Deposit: <strong>₹{deposit.toLocaleString("en-IN")}</strong></span>
                        )}
                        {discount > 0 && (
                          <span className="text-rose-600">− Discount: <strong>₹{discount.toLocaleString("en-IN")}</strong></span>
                        )}
                        <span className="ml-auto font-bold text-indigo-700 text-base">
                          = ₹{total.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </>
                );
              })()}

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Note to Student (optional)</label>
                <input
                  type="text"
                  name="notes"
                  value={schedForm.notes}
                  onChange={handleSchedFormChange}
                  placeholder="e.g. Remaining days for April"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {schedError && (
                <p className="text-sm text-rose-600">{schedError}</p>
              )}

              <button
                type="submit"
                disabled={schedSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-500 disabled:opacity-60"
              >
                {schedSaving ? (
                  <LucideIcon name="Loader2" className="h-4 w-4 animate-spin" />
                ) : (
                  <LucideIcon name="Send" className="h-4 w-4" />
                )}
                Send Request to Student
              </button>
            </form>
          </div>

          {/* Active scheduled requests list */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-slate-800">Sent &amp; Pending Requests</h3>
            {scheduledRequests.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No pending scheduled requests.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">Student</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">Type</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">Plan Amt</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">Deposit</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">Discount</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">Total</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">Period</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">Note</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">Sent</th>
                      <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scheduledRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {req.student_name}
                          <div className="text-xs font-normal text-slate-400">{req.student_phone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            req.type === "half_month"
                              ? "bg-violet-50 text-violet-700"
                              : "bg-indigo-50 text-indigo-700"
                          }`}>
                            {req.type === "half_month" ? "15-Day" : "Custom"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          ₹{Number(req.amount).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-emerald-600 text-sm">
                          {Number(req.deposit_amount) > 0
                            ? `+₹${Number(req.deposit_amount).toLocaleString("en-IN")}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-rose-600 text-sm">
                          {req.discount_enabled && Number(req.discount_amount) > 0
                            ? `−₹${Number(req.discount_amount).toLocaleString("en-IN")}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 font-bold text-indigo-700">
                          ₹{Number(req.total_amount ?? req.amount).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {req.valid_from} → {req.valid_until}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{req.notes || "—"}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {req.created_at ? new Date(req.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={cancellingId === req.id}
                            onClick={() => handleCancelScheduled(req.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                          >
                            {cancellingId === req.id
                              ? <LucideIcon name="Loader2" className="h-3 w-3 animate-spin" />
                              : <LucideIcon name="XCircle" className="h-3 w-3" />}
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* All Payments table */}
      {activeTab === "payments" && (
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative w-full sm:max-w-xs">
              <LucideIcon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={filters.search}
                onChange={(event) =>
                  onFiltersChange({
                    ...filters,
                    search: event.target.value,
                  })
                }
                placeholder="Search by student name…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="flex gap-3 sm:w-auto">
              <span>from</span>
              <input
                type="date"
                value={filters.startDate}
                onChange={(event) =>
                  onFiltersChange({
                    ...filters,
                    startDate: event.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
              <span>to</span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(event) =>
                  onFiltersChange({
                    ...filters,
                    endDate: event.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <select
              value={filters.mode ?? "all"}
              onChange={(event) =>
                onFiltersChange({ ...filters, mode: event.target.value })
              }
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 sm:w-40"
            >
              <option value="all">All Modes</option>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {filteredPayments.length} records
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th
                  className="cursor-pointer px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500"
                  onClick={() => handleSort("payment_date")}
                >
                  Date
                  {renderSortIndicator("payment_date")}
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                  Time
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500"
                  onClick={() => handleSort("student")}
                >
                  Student
                  {renderSortIndicator("student")}
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500"
                  onClick={() => handleSort("plan")}
                >
                  Plan
                  {renderSortIndicator("plan")}
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500"
                  onClick={() => handleSort("amount_paid")}
                >
                  Amount Paid
                  {renderSortIndicator("amount_paid")}
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                  Mode
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                  Collected By
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                  Valid Until
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                  Notes
                </th>
                <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
                  Receipt #
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    No payment records match the current filters.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment, index) => {
                  const student = studentMap.get(payment.student_id);
                  const plan = planMap.get(payment.plan_id);
                  const collectorRole = roleMap.get(payment.collected_role_id);
                  return (
                    <tr
                      key={payment.id}
                      className={`hover:bg-slate-50/60 ${
                        index % 2 === 1 ? "bg-slate-50/40" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                        {formatDate(payment.payment_date)}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-500">
                        {formatTime(payment.payment_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {student?.name || "Unknown student"}
                        <div className="text-xs text-slate-400">
                          {student?.phone || ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {plan?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-600">
                        ₹{payment.amount_paid.toLocaleString("en-IN")}
                        {payment.includes_registration ? (
                          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600">
                            Reg.
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            payment.payment_mode === "upi"
                              ? "bg-indigo-50 text-indigo-600"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {payment.payment_mode === "upi" ? "UPI" : "Cash"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {collectorRole?.name || "Role not tagged"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {formatDate(payment.valid_until)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {payment.notes || "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-slate-500">
                        {payment.id.slice(0, 8).toUpperCase()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}

export default PaymentsView;
