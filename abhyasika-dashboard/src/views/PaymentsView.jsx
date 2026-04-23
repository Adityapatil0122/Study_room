import React, { useMemo, useState } from "react";
import ThemeSelect from "../components/common/ThemeSelect.jsx";
import LucideIcon from "../components/icons/LucideIcon.jsx";
import { useAuth } from "../context/AuthContext.jsx";

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
}) {
  const [activeTab, setActiveTab] = useState("payments");
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: "payment_date",
    direction: "desc",
  });
  const { hasPermission } = useAuth();
  const canCreatePayment = hasPermission("payments", "add");

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
    if (!key) return "-";
    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
              className="btn-gradient-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
            >
              <LucideIcon name="CreditCard" className="h-4 w-4" />
              New Payment
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total Revenue",
            value: `Rs ${totalRevenue.toLocaleString("en-IN")}`,
            bg: "bg-emerald-50",
            text: "text-emerald-700",
          },
          {
            label: "Registration Fees",
            value: `Rs ${registrationRevenue.toLocaleString("en-IN")}`,
            bg: "bg-indigo-50",
            text: "text-indigo-700",
          },
          {
            label: "UPI Entries",
            value: filteredPayments.filter(
              (payment) => payment.payment_mode === "upi"
            ).length,
            bg: "bg-amber-50",
            text: "text-amber-700",
          },
          {
            label: "Cash Entries",
            value: filteredPayments.filter(
              (payment) => payment.payment_mode === "cash"
            ).length,
            bg: "bg-rose-50",
            text: "text-rose-700",
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border border-slate-100 p-4 shadow-sm ${card.bg}`}
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {card.label}
            </p>
            <p className={`mt-2 text-2xl font-semibold ${card.text}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pb-0">
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
          {pendingPayments.length > 0 ? (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
              {pendingPayments.length}
            </span>
          ) : null}
        </button>
      </div>

      {activeTab === "pending" ? (
        <div className="rounded-b-2xl rounded-tr-2xl border border-slate-100 bg-white px-5 pb-5 pt-3 shadow-sm">
          {pendingPayments.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No pending QR payment requests.
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
                      Plan
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                      Valid Period
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                      Submitted
                    </th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingPayments.map((pending) => (
                    <tr key={pending.id} className="hover:bg-amber-50/40">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                        {pending.student_name || "-"}
                        <div className="text-xs font-normal text-slate-400">
                          {pending.student_phone || ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {pending.plan_name || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-600">
                        Rs {Number(pending.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {pending.valid_from} - {pending.valid_until}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {pending.created_at
                          ? new Date(pending.created_at).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }
                            )
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={
                              approvingId === pending.id ||
                              rejectingId === pending.id
                            }
                            onClick={() => handleApprove(pending.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                          >
                            {approvingId === pending.id ? (
                              <LucideIcon
                                name="Loader2"
                                className="h-3 w-3 animate-spin"
                              />
                            ) : (
                              <LucideIcon
                                name="CheckCircle"
                                className="h-3 w-3"
                              />
                            )}
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={
                              approvingId === pending.id ||
                              rejectingId === pending.id
                            }
                            onClick={() => handleReject(pending.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                          >
                            {rejectingId === pending.id ? (
                              <LucideIcon
                                name="Loader2"
                                className="h-3 w-3 animate-spin"
                              />
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
      ) : (
        <div className="rounded-b-2xl rounded-tr-2xl border border-slate-100 bg-white px-5 pb-5 pt-3 shadow-sm">
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
                  placeholder="Search by student name..."
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
              <ThemeSelect
                value={filters.mode ?? "all"}
                onChange={(event) =>
                  onFiltersChange({ ...filters, mode: event.target.value })
                }
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 sm:w-40"
              >
                <option value="all">All Modes</option>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
              </ThemeSelect>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
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
                          {plan?.name || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-emerald-600">
                          Rs {payment.amount_paid.toLocaleString("en-IN")}
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
