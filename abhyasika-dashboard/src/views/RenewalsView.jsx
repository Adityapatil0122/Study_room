import React, { useMemo, useState } from "react";
import LucideIcon from "../components/icons/LucideIcon.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const EMPTY_FORM = {
  plan_id: "",
  amount: "",
  valid_from: "",
  valid_until: "",
  notes: "",
  deposit_amount: "",
  late_fee_enabled: false,
  late_fee_amount: "",
};

function getDiffDays(renewalDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(renewalDate);
  due.setHours(0, 0, 0, 0);
  return Math.floor((due - today) / (1000 * 60 * 60 * 24));
}

function SendRenewalModal({ student, plans, onClose, onSend }) {
  const [form, setForm] = useState(() => {
    const plan = plans.find((p) => p.id === student.current_plan_id);
    const today = new Date().toISOString().slice(0, 10);
    const until = plan
      ? new Date(Date.now() + Number(plan.duration_days || 30) * 86400000)
          .toISOString()
          .slice(0, 10)
      : "";
    return {
      ...EMPTY_FORM,
      plan_id: student.current_plan_id || "",
      amount: plan ? String(Number(plan.price) || "") : "",
      valid_from: today,
      valid_until: until,
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inputBase =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
  const labelBase = "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500";

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: type === "checkbox" ? checked : value };
      if (name === "plan_id") {
        const plan = plans.find((p) => p.id === value);
        if (plan) {
          updated.amount = String(Number(plan.price) || "");
          updated.valid_until = new Date(
            new Date(prev.valid_from || Date.now()).getTime() +
              Number(plan.duration_days || 30) * 86400000
          )
            .toISOString()
            .slice(0, 10);
        }
      }
      if (name === "valid_from" && form.plan_id) {
        const plan = plans.find((p) => p.id === form.plan_id);
        if (plan) {
          updated.valid_until = new Date(
            new Date(value).getTime() + Number(plan.duration_days || 30) * 86400000
          )
            .toISOString()
            .slice(0, 10);
        }
      }
      return updated;
    });
  };

  const planAmount = Number(form.amount) || 0;
  const deposit = Number(form.deposit_amount) || 0;
  const lateFee = form.late_fee_enabled ? Number(form.late_fee_amount) || 0 : 0;
  const total = planAmount + deposit + lateFee;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.plan_id || !form.amount || !form.valid_from || !form.valid_until) {
      setError("Plan, amount and dates are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSend({
        student_id: student.id,
        plan_id: form.plan_id,
        type: "custom",
        amount: Number(form.amount),
        valid_from: form.valid_from,
        valid_until: form.valid_until,
        notes: form.notes || null,
        deposit_amount: deposit,
        discount_enabled: false,
        discount_amount: 0,
        late_fee_enabled: form.late_fee_enabled,
        late_fee_amount: lateFee,
        allow_seat_selection: false,
      });
      onClose();
    } catch (err) {
      setError(err.message ?? "Failed to send request.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
              {student.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{student.name}</p>
              <p className="text-[11px] text-indigo-200">{student.phone || student.email || "—"}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition">
            <LucideIcon name="X" className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-1.5 bg-indigo-50 border-b border-indigo-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">
            Send Renewal Payment Request
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Plan & Amount */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelBase}>Renewal Plan</label>
              <div className="relative">
                <LucideIcon name="Package" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select name="plan_id" value={form.plan_id} onChange={handleChange} className={`${inputBase} appearance-none pl-9 pr-8`} required>
                  <option value="">Select plan…</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ₹{Number(p.price).toLocaleString("en-IN")}
                    </option>
                  ))}
                </select>
                <LucideIcon name="ChevronDown" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            <div>
              <label className={labelBase}>Amount (Rs)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₹</span>
                <input type="number" name="amount" value={form.amount} onChange={handleChange} placeholder="0" className={`${inputBase} pl-7`} required />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelBase}>Valid From</label>
              <input type="date" name="valid_from" value={form.valid_from} onChange={handleChange} className={inputBase} required />
            </div>
            <div>
              <label className={labelBase}>Valid Until</label>
              <input type="date" name="valid_until" value={form.valid_until} onChange={handleChange} className={inputBase} required />
            </div>
          </div>

          {/* Deposit & Late fee */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <LucideIcon name="PiggyBank" className="h-3 w-3 text-emerald-600" />
                Deposit
                <span className="ml-auto text-[10px] font-normal normal-case text-slate-400">optional</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₹</span>
                <input type="number" name="deposit_amount" value={form.deposit_amount} onChange={handleChange} placeholder="0" min="0" className={`${inputBase} pl-7`} />
              </div>
            </div>
            <div className={`rounded-lg border p-3 transition ${form.late_fee_enabled ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-slate-50/50"}`}>
              <label className="mb-1 flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <input type="checkbox" name="late_fee_enabled" checked={form.late_fee_enabled} onChange={handleChange} className="h-3 w-3 accent-amber-600" />
                <LucideIcon name="AlertCircle" className="h-3 w-3 text-amber-600" />
                Late Fee
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₹</span>
                <input type="number" name="late_fee_amount" value={form.late_fee_amount} onChange={handleChange} placeholder="0" min="0" disabled={!form.late_fee_enabled} className={`${inputBase} pl-7 disabled:opacity-50`} />
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className={labelBase}>Note to Student (optional)</label>
            <div className="relative">
              <LucideIcon name="MessageSquare" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="text" name="notes" value={form.notes} onChange={handleChange} placeholder="e.g. Renewal for May" className={`${inputBase} pl-9`} />
            </div>
          </div>

          {/* Total bar */}
          <div className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-2.5">
            <LucideIcon name="Calculator" className="h-4 w-4 shrink-0 text-indigo-600" />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              <span className="font-semibold uppercase tracking-wide text-indigo-700">Total</span>
              <span>Plan: <strong>₹{planAmount.toLocaleString("en-IN")}</strong></span>
              {deposit > 0 && <span className="text-emerald-700">+Deposit: <strong>₹{deposit.toLocaleString("en-IN")}</strong></span>}
              {lateFee > 0 && <span className="text-amber-700">+Late: <strong>₹{lateFee.toLocaleString("en-IN")}</strong></span>}
            </div>
            <span className="ml-auto text-base font-bold text-indigo-700 whitespace-nowrap">
              ₹{total.toLocaleString("en-IN")}
            </span>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <LucideIcon name="AlertTriangle" className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60">
              {saving ? <LucideIcon name="Loader2" className="h-4 w-4 animate-spin" /> : <LucideIcon name="Send" className="h-4 w-4" />}
              Send Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RenewalsView({ students, plans = [], onOpenModal, onCreateScheduledRequest }) {
  const { hasPermission } = useAuth();
  const canLogPayment = hasPermission("payments", "add");

  const [renewalModal, setRenewalModal] = useState(null); // student object
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | overdue | upcoming | noplan

  const planMap = useMemo(() => {
    const map = new Map();
    plans.forEach((p) => map.set(p.id, p));
    return map;
  }, [plans]);

  const { upcoming, overdue, noPlan } = useMemo(() => {
    const bucket = { upcoming: [], overdue: [], noPlan: [] };
    students.forEach((student) => {
      if (!student.is_active) return;
      if (!student.renewal_date) { bucket.noPlan.push(student); return; }
      const diff = getDiffDays(student.renewal_date);
      if (diff < 0) bucket.overdue.push(student);
      else if (diff <= 7) bucket.upcoming.push(student);
    });
    bucket.upcoming.sort((a, b) => new Date(a.renewal_date) - new Date(b.renewal_date));
    bucket.overdue.sort((a, b) => new Date(a.renewal_date) - new Date(b.renewal_date));
    bucket.noPlan.sort((a, b) => a.name.localeCompare(b.name));
    return bucket;
  }, [students]);

  const rows = useMemo(() => {
    const all = [
      ...overdue.map((s) => ({ student: s, status: "overdue" })),
      ...upcoming.map((s) => ({ student: s, status: "upcoming" })),
      ...noPlan.map((s) => ({ student: s, status: "noplan" })),
    ];
    return all.filter(({ student, status }) => {
      if (filter !== "all" && status !== filter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        student.name.toLowerCase().includes(q) ||
        (student.phone || "").includes(q) ||
        (student.email || "").toLowerCase().includes(q)
      );
    });
  }, [overdue, upcoming, noPlan, filter, search]);

  const statusMeta = {
    overdue: { label: "Overdue", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500", urgency: "text-rose-600" },
    upcoming: { label: "Due Soon", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500", urgency: "text-amber-600" },
    noplan: { label: "No Plan", badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400", urgency: "text-slate-500" },
  };

  const summaryCards = [
    { key: "overdue", label: "Past Due", value: overdue.length, bg: "bg-emerald-50", border: "border-emerald-100", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", valueColor: "text-emerald-700", icon: "AlertTriangle" },
    { key: "upcoming", label: "Due This Week", value: upcoming.length, bg: "bg-indigo-50", border: "border-indigo-100", iconBg: "bg-indigo-100", iconColor: "text-indigo-600", valueColor: "text-indigo-700", icon: "CalendarClock" },
    { key: "noplan", label: "No Plan Set", value: noPlan.length, bg: "bg-amber-50", border: "border-amber-100", iconBg: "bg-amber-100", iconColor: "text-amber-600", valueColor: "text-amber-700", icon: "CircleHelp" },
    { key: "all", label: "Total Needing Action", value: overdue.length + upcoming.length + noPlan.length, bg: "bg-rose-50", border: "border-rose-100", iconBg: "bg-rose-100", iconColor: "text-rose-600", valueColor: "text-rose-700", icon: "Users" },
  ];

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 text-white shadow-sm">
            <LucideIcon name="RefreshCw" className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Renewals</h1>
            <p className="mt-0.5 text-sm text-slate-500">Monitor upcoming expiries and send renewal requests proactively.</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <button
            key={card.key}
            onClick={() => setFilter(filter === card.key ? "all" : card.key)}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${card.bg} ${card.border} ${filter === card.key ? "ring-2 ring-indigo-400 ring-offset-1" : ""}`}
          >
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className={`text-2xl font-bold ${card.valueColor}`}>{card.value}</p>
            </div>
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.iconBg} ${card.iconColor}`}>
              <LucideIcon name={card.icon} className="h-4 w-4" />
            </div>
          </button>
        ))}
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3">
          <div className="relative w-full sm:w-72 lg:w-80">
            <LucideIcon name="Search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="flex gap-1.5">
            {[
              { key: "all", label: "All" },
              { key: "overdue", label: "Overdue" },
              { key: "upcoming", label: "This Week" },
              { key: "noplan", label: "No Plan" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  filter === f.key
                    ? "btn-gradient-primary"
                    : "bg-white border border-slate-200 text-slate-500 hover:border-indigo-200 hover:text-indigo-600"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-slate-400">{rows.length} student{rows.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        <div className="p-4 pt-0">
          <div className="overflow-x-auto">
            <table className="min-w-[700px] w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Student", "Plan", "Renewal Date", "Days Left", "Status", "Actions"].map((h, i) => (
                  <th key={h} className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${i === 5 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                        <LucideIcon name="CheckCircle2" className="h-6 w-6 text-emerald-500" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">All renewals look good!</p>
                      <p className="text-xs text-slate-400">No students need renewal action right now.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map(({ student, status }) => {
                  const plan = planMap.get(student.current_plan_id);
                  const diff = student.renewal_date ? getDiffDays(student.renewal_date) : null;
                  const meta = statusMeta[status];
                  return (
                    <tr key={student.id} className="group hover:bg-slate-50/70">
                      {/* Student */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            status === "overdue" ? "bg-rose-100 text-rose-600"
                            : status === "upcoming" ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                          }`}>
                            {student.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{student.name}</p>
                            <p className="text-[11px] text-slate-400">{student.phone || student.email || "—"}</p>
                          </div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="px-4 py-3">
                        {plan ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                            {plan.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Not set</span>
                        )}
                      </td>

                      {/* Renewal date */}
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {student.renewal_date
                          ? new Date(student.renewal_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : <span className="text-slate-400">—</span>}
                      </td>

                      {/* Days left */}
                      <td className="px-4 py-3">
                        {diff === null ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : diff < 0 ? (
                          <span className="text-xs font-semibold text-rose-600">{Math.abs(diff)}d overdue</span>
                        ) : diff === 0 ? (
                          <span className="text-xs font-semibold text-rose-600">Due today</span>
                        ) : (
                          <span className={`text-xs font-semibold ${diff <= 3 ? "text-rose-600" : "text-amber-600"}`}>{diff}d left</span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {onCreateScheduledRequest && (
                            <button
                              onClick={() => setRenewalModal(student)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:from-indigo-500 hover:to-violet-500"
                            >
                              <LucideIcon name="Send" className="h-3 w-3" />
                              Send Renewal
                            </button>
                          )}
                          {canLogPayment && (
                            <button
                              onClick={() => onOpenModal("logPayment", { student })}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
                            >
                              <LucideIcon name="CreditCard" className="h-3 w-3" />
                              Log Payment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Send Renewal Modal */}
      {renewalModal && (
        <SendRenewalModal
          student={renewalModal}
          plans={plans}
          onClose={() => setRenewalModal(null)}
          onSend={onCreateScheduledRequest}
        />
      )}
    </div>
  );
}

export default RenewalsView;
