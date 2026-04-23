import React, { useState } from "react";
import ThemeSelect from "../components/common/ThemeSelect.jsx";
import LucideIcon from "../components/icons/LucideIcon.jsx";

function halfMonthDates() {
  const start = new Date();
  const end = new Date(start.getTime() + 14 * 86400000);
  const fmt = (date) => date.toISOString().slice(0, 10);
  return { valid_from: fmt(start), valid_until: fmt(end) };
}

const EMPTY_FORM = {
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
  late_fee_enabled: false,
  late_fee_amount: "",
  allow_seat_selection: false,
};

const isDiscountEligiblePlan = (plan) =>
  plan && Number(plan.duration_days) >= 180;

function SendPaymentRequestView({
  students = [],
  plans = [],
  seats = [],
  scheduledRequests = [],
  onCreateScheduledRequest,
  onCancelScheduledRequest,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState(null);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => {
      const updated = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };

      if (name === "student_id") {
        const student = students.find((item) => item.id === value);
        if (!student || student.current_seat_id) {
          updated.allow_seat_selection = false;
        }
      }

      if (name === "plan_id") {
        const plan = plans.find((item) => item.id === value);
        const planPrice = plan ? Number(plan.price) || 0 : "";
        updated.amount =
          prev.type === "half_month" && plan
            ? String(Math.round(planPrice * 15 / 30))
            : plan
            ? String(planPrice)
            : "";

        if (!isDiscountEligiblePlan(plan)) {
          updated.discount_enabled = false;
          updated.discount_amount = "";
        }
      }

      if (name === "type") {
        const plan = plans.find((item) => item.id === updated.plan_id);
        const planPrice = plan ? Number(plan.price) || 0 : "";
        if (value === "half_month") {
          const { valid_from, valid_until } = halfMonthDates();
          return {
            ...updated,
            valid_from,
            valid_until,
            amount: plan ? String(Math.round(planPrice * 15 / 30)) : "",
          };
        }
        return {
          ...updated,
          amount: plan ? String(planPrice) : "",
        };
      }

      return updated;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!onCreateScheduledRequest) return;
    setError("");

    if (!form.student_id || !form.plan_id) {
      setError("Student and plan are required.");
      return;
    }
    if (!form.amount || !form.valid_from || !form.valid_until) {
      setError("Amount and date range are required.");
      return;
    }

    setSaving(true);
    try {
      const selectedPlan = plans.find((item) => item.id === form.plan_id);
      const canDiscount = isDiscountEligiblePlan(selectedPlan);
      await onCreateScheduledRequest({
        student_id: form.student_id,
        plan_id: form.plan_id,
        type: form.type,
        amount: Number(form.amount),
        valid_from: form.valid_from,
        valid_until: form.valid_until,
        notes: form.notes || null,
        deposit_amount: Number(form.deposit_amount) || 0,
        discount_enabled: canDiscount ? form.discount_enabled : false,
        discount_amount:
          canDiscount && form.discount_enabled
            ? Number(form.discount_amount) || 0
            : 0,
        late_fee_enabled: form.late_fee_enabled,
        late_fee_amount: form.late_fee_enabled
          ? Number(form.late_fee_amount) || 0
          : 0,
        allow_seat_selection: form.allow_seat_selection && canOfferSeatSelection,
      });
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err.message ?? "Failed to send request.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (requestId) => {
    if (!onCancelScheduledRequest) return;
    setCancellingId(requestId);
    try {
      await onCancelScheduledRequest(requestId);
    } finally {
      setCancellingId(null);
    }
  };

  const selectedPlan = plans.find((item) => item.id === form.plan_id);
  const selectedStudent = students.find((item) => item.id === form.student_id);
  const availableSeats = seats.filter((seat) => seat.status === "available");
  const canDiscount = isDiscountEligiblePlan(selectedPlan);
  const planAmount = Number(form.amount) || 0;
  const deposit = Number(form.deposit_amount) || 0;
  const discount =
    canDiscount && form.discount_enabled ? Number(form.discount_amount) || 0 : 0;
  const lateFee = form.late_fee_enabled
    ? Number(form.late_fee_amount) || 0
    : 0;
  const canOfferSeatSelection =
    selectedStudent && !selectedStudent.current_seat_id && availableSeats.length > 0;
  const total = Math.max(0, planAmount + deposit + lateFee - discount);

  const inputBase =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
  const labelBase =
    "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500";

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
          <LucideIcon name="Send" className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Send Payment Request
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Create a payment request for a student and track pending requests.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
          <LucideIcon name="UserPlus" className="h-4 w-4 text-indigo-600" />
          <h2 className="text-sm font-semibold text-slate-800">
            Send Payment Request to Student
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          {/* Section: Recipient & Plan */}
          <section>
            <div className="mb-2 flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                1
              </span>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Recipient & Plan
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelBase}>Student</label>
                <div className="relative">
                  <LucideIcon
                    name="User"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  />
                  <ThemeSelect
                    name="student_id"
                    value={form.student_id}
                    onChange={handleChange}
                    className={`${inputBase} pl-9 pr-8`}
                    required
                  >
                    <option value="">Select student...</option>
                    {students
                      .filter((student) => student.is_active)
                      .map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name}
                          {student.phone ? ` - ${student.phone}` : ""}
                        </option>
                      ))}
                  </ThemeSelect>
                </div>
              </div>
              <div>
                <label className={labelBase}>Plan</label>
                <div className="relative">
                  <LucideIcon
                    name="Package"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  />
                  <ThemeSelect
                    name="plan_id"
                    value={form.plan_id}
                    onChange={handleChange}
                    className={`${inputBase} pl-9 pr-8`}
                    required
                  >
                    <option value="">Select plan...</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} - Rs {Number(plan.price).toLocaleString("en-IN")}
                      </option>
                    ))}
                  </ThemeSelect>
                </div>
              </div>
            </div>
          </section>

          <div className="h-px bg-slate-100" />

          {/* Section: Request Type */}
          <section>
            <div className="mb-2 flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                2
              </span>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Request Type</h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition ${
                  form.type === "custom"
                    ? "border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-100"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value="custom"
                  checked={form.type === "custom"}
                  onChange={handleChange}
                  className="h-3.5 w-3.5 accent-indigo-600"
                />
                <LucideIcon
                  name="Settings2"
                  className={`h-3.5 w-3.5 shrink-0 ${form.type === "custom" ? "text-indigo-600" : "text-slate-400"}`}
                />
                <div>
                  <span className="block text-sm font-semibold text-slate-900">Custom</span>
                  <span className="text-xs text-slate-500">Admin sets exact amount and dates</span>
                </div>
              </label>
              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition ${
                  form.type === "half_month"
                    ? "border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-100"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value="half_month"
                  checked={form.type === "half_month"}
                  onChange={handleChange}
                  className="h-3.5 w-3.5 accent-indigo-600"
                />
                <LucideIcon
                  name="CalendarClock"
                  className={`h-3.5 w-3.5 shrink-0 ${form.type === "half_month" ? "text-indigo-600" : "text-slate-400"}`}
                />
                <div>
                  <span className="block text-sm font-semibold text-slate-900">15-Day Lumpsum</span>
                  <span className="text-xs text-slate-500">Half-month fee, auto-calculated</span>
                </div>
              </label>
            </div>
          </section>

          <div className="h-px bg-slate-100" />

          {/* Section: Amount & Validity */}
          <section>
            <div className="mb-2 flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                3
              </span>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Amount & Validity
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={labelBase}>Amount (Rs)</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                    Rs
                  </span>
                  <input
                    type="number"
                    name="amount"
                    value={form.amount}
                    onChange={handleChange}
                    placeholder="Select a plan"
                    readOnly={form.type === "half_month"}
                    className={`${inputBase} pl-8 read-only:bg-slate-50 read-only:text-slate-500`}
                    required
                  />
                </div>
              </div>
              <div>
                <label className={labelBase}>Valid From</label>
                <input
                  type="date"
                  name="valid_from"
                  value={form.valid_from}
                  onChange={handleChange}
                  readOnly={form.type === "half_month"}
                  className={`${inputBase} read-only:bg-slate-50`}
                  required
                />
              </div>
              <div>
                <label className={labelBase}>Valid Until</label>
                <input
                  type="date"
                  name="valid_until"
                  value={form.valid_until}
                  onChange={handleChange}
                  readOnly={form.type === "half_month"}
                  className={`${inputBase} read-only:bg-slate-50`}
                  required
                />
              </div>
            </div>
          </section>

          <div className="h-px bg-slate-100" />

          {/* Section: Adjustments */}
          <section>
            <div className="mb-2 flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                4
              </span>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Adjustments
              </h3>
              <span className="text-[11px] text-slate-400">- deposit, late fee, discount</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <LucideIcon name="PiggyBank" className="h-3 w-3 text-emerald-600" />
                  Deposit (Rs)
                  <span className="ml-auto text-[10px] font-normal normal-case text-slate-400">optional</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">Rs</span>
                  <input type="number" name="deposit_amount" value={form.deposit_amount} onChange={handleChange} placeholder="0" min="0" className={`${inputBase} pl-8`} />
                </div>
              </div>

              <div className={`rounded-lg border p-3 transition ${form.late_fee_enabled ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-slate-50/50"}`}>
                <label className="mb-1 flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <input type="checkbox" name="late_fee_enabled" checked={form.late_fee_enabled} onChange={handleChange} className="h-3 w-3 accent-amber-600" />
                  <LucideIcon name="AlertCircle" className="h-3 w-3 text-amber-600" />
                  Late Fee (Rs)
                  <span className="ml-auto text-[10px] font-normal normal-case text-slate-400">end-of-month</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">Rs</span>
                  <input type="number" name="late_fee_amount" value={form.late_fee_amount} onChange={handleChange} placeholder="0" min="0" disabled={!form.late_fee_enabled} className={`${inputBase} pl-8 disabled:bg-slate-100 disabled:opacity-60`} />
                </div>
              </div>

              {canDiscount ? (
                <div className={`rounded-lg border p-3 transition ${form.discount_enabled ? "border-rose-200 bg-rose-50/50" : "border-slate-200 bg-slate-50/50"}`}>
                  <label className="mb-1 flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <input type="checkbox" name="discount_enabled" checked={form.discount_enabled} onChange={handleChange} className="h-3 w-3 accent-rose-600" />
                    <LucideIcon name="BadgePercent" className="h-3 w-3 text-rose-600" />
                    Discount (Rs)
                    <span className="ml-auto truncate text-[10px] font-normal normal-case text-slate-400">{selectedPlan?.name}</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">Rs</span>
                    <input type="number" name="discount_amount" value={form.discount_amount} onChange={handleChange} placeholder="0" min="0" disabled={!form.discount_enabled} className={`${inputBase} pl-8 disabled:bg-slate-100 disabled:opacity-60`} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/40 p-3 text-xs text-slate-500">
                  <LucideIcon name="Info" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  Discount available for plans &gt;= 6 months (180 days).
                </div>
              )}
            </div>
          </section>

          <div className="h-px bg-slate-100" />

          {/* Seat option */}
          <label
            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition ${
              canOfferSeatSelection
                ? "cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100/60"
                : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500"
            }`}
          >
            <input
              type="checkbox"
              name="allow_seat_selection"
              checked={form.allow_seat_selection}
              onChange={handleChange}
              disabled={!canOfferSeatSelection}
              className="h-3.5 w-3.5 accent-emerald-600 disabled:opacity-50"
            />
            <LucideIcon
              name="Armchair"
              className={`h-4 w-4 shrink-0 ${canOfferSeatSelection ? "text-emerald-600" : "text-slate-400"}`}
            />
            <span className="flex-1">
              <span className="font-semibold">Send available seats option to student</span>
              <span className="ml-2 text-xs opacity-75">
                {selectedStudent?.current_seat_id
                  ? "Student already has a seat assigned."
                  : availableSeats.length
                  ? `${availableSeats.length} available seats will be shown after payment so the student can choose any one.`
                  : "No seats currently available."}
              </span>
            </span>
          </label>

          {/* Total */}
          <div className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-2.5">
            <LucideIcon name="Calculator" className="h-4 w-4 shrink-0 text-indigo-600" />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              <span className="font-semibold uppercase tracking-wide text-indigo-700">Total to Collect</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Plan: <strong className="ml-0.5">Rs {planAmount.toLocaleString("en-IN")}</strong>
              </span>
              {deposit > 0 && <span className="inline-flex items-center gap-1 text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />+Deposit: <strong className="ml-0.5">Rs {deposit.toLocaleString("en-IN")}</strong></span>}
              {lateFee > 0 && <span className="inline-flex items-center gap-1 text-amber-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />+Late Fee: <strong className="ml-0.5">Rs {lateFee.toLocaleString("en-IN")}</strong></span>}
              {discount > 0 && <span className="inline-flex items-center gap-1 text-rose-600"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" />-Discount: <strong className="ml-0.5">Rs {discount.toLocaleString("en-IN")}</strong></span>}
            </div>
            <span className="ml-auto text-base font-bold text-indigo-700 whitespace-nowrap">
              = Rs {total.toLocaleString("en-IN")}
            </span>
          </div>

          {/* Note */}
          <div>
            <label className={labelBase}>Note to Student (optional)</label>
            <div className="relative">
              <LucideIcon name="MessageSquare" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="e.g. Remaining days for April"
                className={`${inputBase} pl-9`}
              />
            </div>
          </div>

          {error ? (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <LucideIcon name="AlertTriangle" className="h-4 w-4" />
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <p className="mr-auto text-xs text-slate-400">The student will receive this request instantly.</p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:from-indigo-500 hover:to-violet-500 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <LucideIcon name="Loader2" className="h-4 w-4 animate-spin" />
              ) : (
                <LucideIcon name="Send" className="h-4 w-4" />
              )}
              Send Request to Student
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
          <LucideIcon name="ClipboardList" className="h-4 w-4 text-indigo-600" />
          <h2 className="text-sm font-semibold text-slate-800">
            Sent & Pending Requests
          </h2>
          {scheduledRequests.length > 0 ? (
            <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              {scheduledRequests.length}
            </span>
          ) : null}
        </div>
        {scheduledRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <LucideIcon name="Inbox" className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">No pending scheduled requests.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                    Student
                  </th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                    Plan Amt
                  </th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                    Deposit
                  </th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                    Late Fee
                  </th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                    Discount
                  </th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                    Seat
                  </th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                    Period
                  </th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                    Note
                  </th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                    Sent
                  </th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scheduledRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {request.student_name}
                      <div className="text-xs font-normal text-slate-400">
                        {request.student_phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          request.type === "half_month"
                            ? "bg-violet-50 text-violet-700"
                            : "bg-indigo-50 text-indigo-700"
                        }`}
                      >
                        {request.type === "half_month" ? "15-Day" : "Custom"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      Rs {Number(request.amount).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-sm text-emerald-600">
                      {Number(request.deposit_amount) > 0
                        ? `+Rs ${Number(request.deposit_amount).toLocaleString(
                            "en-IN"
                          )}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-amber-600">
                      {request.late_fee_enabled &&
                      Number(request.late_fee_amount) > 0
                        ? `+Rs ${Number(request.late_fee_amount).toLocaleString(
                            "en-IN"
                          )}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-rose-600">
                      {request.discount_enabled &&
                      Number(request.discount_amount) > 0
                        ? `-Rs ${Number(request.discount_amount).toLocaleString(
                            "en-IN"
                          )}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {request.allow_seat_selection ? "Available seats" : "-"}
                    </td>
                    <td className="px-4 py-3 font-bold text-indigo-700">
                      Rs{" "}
                      {Number(
                        request.total_amount ?? request.amount
                      ).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {request.valid_from} - {request.valid_until}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {request.notes || "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {request.created_at
                        ? new Date(request.created_at).toLocaleDateString(
                            "en-IN",
                            { day: "2-digit", month: "short" }
                          )
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={cancellingId === request.id}
                        onClick={() => handleCancel(request.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                      >
                        {cancellingId === request.id ? (
                          <LucideIcon
                            name="Loader2"
                            className="h-3 w-3 animate-spin"
                          />
                        ) : (
                          <LucideIcon name="XCircle" className="h-3 w-3" />
                        )}
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
  );
}

export default SendPaymentRequestView;
