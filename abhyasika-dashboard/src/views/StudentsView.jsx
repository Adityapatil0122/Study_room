import React, { useCallback, useEffect, useMemo, useState } from "react";
import LucideIcon from "../components/icons/LucideIcon.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const PAGE_SIZE = 10;
const feeTypeMap = {
  monthly: {
    label: "Monthly",
    tone: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-200",
  },
  limited: {
    label: "Limited Days",
    tone: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-100",
  },
};

const formatRegistrationSource = (source, role) => {
  if (!source) return role || "Unknown";
  switch (source) {
    case "qr_self":
      return "QR Self-Enroll";
    case "admin_panel":
      return role ? `Admin - ${role}` : "Admin Panel";
    case "staff":
      return role ? `Staff - ${role}` : "Staff";
    default:
      return role || source;
  }
};

function StudentsView({
  students,
  seats,
  plans,
  onOpenModal,
  onToggleActive,
  busyIds,
  onNavigate = () => {},
  payments = [],
  roles = [],
  onHoldMembership,
  onResumeMembership,
}) {
  const [holdingId, setHoldingId] = useState(null);
  const { hasPermission } = useAuth();
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isCompact, setIsCompact] = useState(false);
  const canCreateStudent = hasPermission("students", "add");
  const canEditStudent = hasPermission("students", "edit");
  const canToggleStatus = hasPermission("students", "delete");
  const canLogPayment = hasPermission("payments", "add");

  const seatMap = useMemo(() => {
    const map = new Map();
    seats.forEach((seat) => map.set(seat.id, seat));
    return map;
  }, [seats]);

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

  // OPTIMIZED: Sort once, iterate once instead of O(n²) comparisons
  const latestPaymentByStudent = useMemo(() => {
    if (payments.length === 0) return new Map();

    const map = new Map();
    // Sort payments by date descending (most recent first)
    const sortedPayments = [...payments].sort((a, b) =>
      new Date(b.payment_date) - new Date(a.payment_date)
    );

    // Only keep first (most recent) payment for each student
    for (const payment of sortedPayments) {
      if (!map.has(payment.student_id)) {
        map.set(payment.student_id, payment);
      }
    }

    return map;
  }, [payments]);

  const summary = useMemo(() => {
    const totals = {
      active: 0,
      limited: 0,
      monthly: 0,
      registrationsPending: 0,
    };
    students.forEach((student) => {
      if (student.is_active) totals.active += 1;
      if (student.fee_plan_type === "limited") totals.limited += 1;
      if (student.fee_plan_type === "monthly") totals.monthly += 1;
      if (!student.registration_paid) totals.registrationsPending += 1;
    });
    return totals;
  }, [students]);

  const filtered = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    if (!students.length) return [];
    return students.filter((student) => {
      const matchQuery = trimmedQuery
        ? [student.name, student.phone, student.email, student.aadhaar]
            .filter((field) => field !== null && field !== undefined)
            .some((field) =>
              String(field).toLowerCase().includes(trimmedQuery)
            )
        : true;
      const matchPlan =
        planFilter === "all" ? true : student.fee_plan_type === planFilter;
      return matchQuery && matchPlan;
    });
  }, [students, query, planFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    const updateCompact = () => {
      if (typeof window !== "undefined") {
        setIsCompact(window.innerWidth < 1024);
      }
    };
    updateCompact();
    window.addEventListener("resize", updateCompact);
    return () => window.removeEventListener("resize", updateCompact);
  }, []);

  const activeOnly = useMemo(
    () => filtered.filter((student) => student.is_active),
    [filtered]
  );

  // OPTIMIZED: Memoize render function to prevent recreation on every render
  const renderDesktopRow = useCallback((student, index, baseIndex = 0) => {
    const seat = seatMap.get(student.current_seat_id);
    const plan = planMap.get(student.current_plan_id);
    const busy = busyIds.includes(student.id);
    const feeInfo = feeTypeMap[student.fee_plan_type] || feeTypeMap.monthly;
    const lastPayment = latestPaymentByStudent.get(student.id);
    const collectorRole = lastPayment
      ? roleMap.get(lastPayment.collected_role_id)
      : null;
    const hasAnyActions = canEditStudent || canLogPayment || canToggleStatus;
    const registrationLabel = formatRegistrationSource(
      student.registration_source,
      student.registered_by_role
    );

    return (
      <tr key={student.id} className="hover:bg-slate-50/70 dark:hover:bg-gray-800/40">
        <td className="px-4 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500">
          {baseIndex + index + 1}
        </td>
        <td className="px-4 py-3">
          <div className="font-semibold text-slate-900 dark:text-slate-100">{student.name}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{student.email || "No email"}</p>
        </td>
        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
          {student.phone || "—"}
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {student.preferred_shift || "General"}
          </p>
        </td>
        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
          <div className="flex flex-col gap-1">
            <span>{plan ? plan.name : "Not set"}</span>
            <span
              className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${feeInfo.tone}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {feeInfo.label}
            </span>
            <span className="text-xs text-slate-500">
              {student.fee_plan_type === "limited"
                ? `${student.limited_days || plan?.duration_days || 0} days`
                : student.fee_cycle === "rolling"
                ? "Rolling 30 days"
                : "Calendar month"}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
          {seat ? seat.seat_number : "Unassigned"}
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Joined{" "}
            {student.join_date
            ? new Date(student.join_date).toLocaleDateString()
            : "—"}
          </p>
        </td>
        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
          {registrationLabel}
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {student.registration_paid ? "Reg. paid" : "Reg. pending"}
          </p>
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              student.is_active
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200"
                : "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-slate-300"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                student.membership_status === "on_hold"
                  ? "bg-amber-400"
                  : student.is_active ? "bg-emerald-500" : "bg-slate-400"
              }`}
            />
            {student.membership_status === "on_hold"
              ? "On Hold"
              : student.is_active ? "Active" : "Inactive"}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
          {lastPayment
            ? lastPayment.payment_mode === "cash"
              ? "Cash"
              : "UPI"
            : "—"}
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {lastPayment
              ? collectorRole?.name ?? "Role not tagged"
              : "No payments"}
          </p>
        </td>
        <td className="relative px-4 py-3 text-right">
          {hasAnyActions ? (
            <>
              <button
                onClick={() =>
                  setOpenMenuId((prev) => (prev === student.id ? null : student.id))
                }
                className="inline-flex items-center rounded-full border border-slate-200 px-2 py-1 text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 dark:border-gray-700 dark:text-slate-300"
              >
                <LucideIcon name="MoreHorizontal" className="h-4 w-4" />
              </button>
              {openMenuId === student.id ? (
                <div className="absolute right-4 top-11 z-20 w-44 rounded-2xl border border-slate-100 bg-white p-2 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  {canEditStudent ? (
                    <button
                      onClick={() => {
                        onOpenModal("editStudent", { student });
                        setOpenMenuId(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-slate-600 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-gray-800"
                    >
                      <LucideIcon name="UserSquare" className="h-4 w-4" />
                      View / Edit
                    </button>
                  ) : null}
                  {canLogPayment ? (
                    <button
                      onClick={() => {
                        onOpenModal("logPayment", { student });
                        setOpenMenuId(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-slate-600 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-gray-800"
                    >
                      <LucideIcon name="CreditCard" className="h-4 w-4" />
                      Log Payment
                    </button>
                  ) : null}
                  {canToggleStatus ? (
                    <button
                      onClick={() => {
                        onToggleActive(student.id);
                        setOpenMenuId(null);
                      }}
                      disabled={busy}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-gray-800"
                    >
                      <LucideIcon name="Power" className="h-4 w-4" />
                      {student.is_active ? "Deactivate" : "Activate"}
                    </button>
                  ) : null}
                  {/* Membership Hold / Resume */}
                  {student.is_active && student.current_plan_id ? (
                    student.membership_status === "on_hold" ? (
                      <button
                        onClick={async () => {
                          setHoldingId(student.id);
                          setOpenMenuId(null);
                          await onResumeMembership?.(student.id);
                          setHoldingId(null);
                        }}
                        disabled={holdingId === student.id}
                        className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-emerald-900/20"
                      >
                        <LucideIcon name="PlayCircle" className="h-4 w-4" />
                        Resume Membership
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          setHoldingId(student.id);
                          setOpenMenuId(null);
                          await onHoldMembership?.(student.id);
                          setHoldingId(null);
                        }}
                        disabled={holdingId === student.id}
                        className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-amber-600 transition hover:bg-amber-50 disabled:opacity-50 dark:hover:bg-amber-900/20"
                      >
                        <LucideIcon name="PauseCircle" className="h-4 w-4" />
                        Hold Membership
                      </button>
                    )
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <span className="text-xs text-slate-400">No permissions</span>
          )}
        </td>
      </tr>
    );
  }, [seatMap, planMap, latestPaymentByStudent, roleMap, busyIds, holdingId, canEditStudent, canLogPayment, canToggleStatus, onOpenModal, onToggleActive, onHoldMembership, onResumeMembership, openMenuId]);

  // OPTIMIZED: Memoize mobile card render function
  const renderMobileCard = useCallback((student, index, baseIndex = 0) => {
    const seat = seatMap.get(student.current_seat_id);
    const plan = planMap.get(student.current_plan_id);
    const lastPayment = latestPaymentByStudent.get(student.id);
    const collectorRole = lastPayment
      ? roleMap.get(lastPayment.collected_role_id)
      : null;
    const registrationLabel = formatRegistrationSource(
      student.registration_source,
      student.registered_by_role
    );
    const hasAnyActions = canEditStudent || canLogPayment || canToggleStatus;
    const busy = busyIds.includes(student.id);

    return (
      <div
        key={`card-${student.id}`}
        className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              #{baseIndex + index + 1}
            </p>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {student.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{student.email || "No email"}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{student.phone || "—"}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              student.membership_status === "on_hold"
                ? "bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200"
                : student.is_active
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200"
                : "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-slate-300"
            }`}
          >
            {student.membership_status === "on_hold"
              ? "On Hold"
              : student.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 dark:border-gray-800">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Plan</span>
            <span className="text-right">
              {plan ? plan.name : "Not set"}
              <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                {student.fee_cycle === "rolling"
                  ? "Rolling 30 days"
                  : student.fee_plan_type === "limited"
                  ? `${student.limited_days || plan?.duration_days || 0} days`
                  : "Calendar month"}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 dark:border-gray-800">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Seat</span>
            <span className="text-right">
              {seat ? seat.seat_number : "Unassigned"}
              <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                Joined{" "}
                {student.join_date
                  ? new Date(student.join_date).toLocaleDateString()
                  : "—"}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 dark:border-gray-800">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Registered via</span>
            <span className="text-right">{registrationLabel}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 dark:border-gray-800">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Payments</span>
            <span className="text-right">
              {lastPayment
                ? `${lastPayment.payment_mode === "cash" ? "Cash" : "UPI"}`
                : "No payments"}
              <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                {lastPayment
                  ? collectorRole?.name ?? "Role not tagged"
                  : null}
              </span>
            </span>
          </div>
        </div>
        {hasAnyActions ? (
          <div className="mt-3 flex items-center justify-end">
            <button
              onClick={() =>
                setOpenMenuId((prev) => (prev === student.id ? null : student.id))
              }
              className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 dark:border-gray-700 dark:text-slate-300"
            >
              Actions
              <LucideIcon name="chevronDown" className="ml-1 h-4 w-4" />
            </button>
            {openMenuId === student.id ? (
              <div className="absolute z-20 mt-2 w-44 rounded-2xl border border-slate-100 bg-white p-2 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900">
                {canEditStudent ? (
                  <button
                    onClick={() => {
                      onOpenModal("editStudent", { student });
                      setOpenMenuId(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-slate-600 transition hover:bg-slate-50"
                  >
                    <LucideIcon name="UserSquare" className="h-4 w-4" />
                    View / Edit
                  </button>
                ) : null}
                {canLogPayment ? (
                  <button
                    onClick={() => {
                      onOpenModal("logPayment", { student });
                      setOpenMenuId(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-slate-600 transition hover:bg-slate-50"
                  >
                    <LucideIcon name="CreditCard" className="h-4 w-4" />
                    Log Payment
                  </button>
                ) : null}
                {canToggleStatus ? (
                  <button
                    onClick={() => {
                      onToggleActive(student.id);
                      setOpenMenuId(null);
                    }}
                    disabled={busy}
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <LucideIcon name="Power" className="h-4 w-4" />
                    {student.is_active ? "Deactivate" : "Activate"}
                  </button>
                ) : null}
                {student.is_active && student.current_plan_id ? (
                  student.membership_status === "on_hold" ? (
                    <button
                      onClick={async () => {
                        setHoldingId(student.id);
                        setOpenMenuId(null);
                        await onResumeMembership?.(student.id);
                        setHoldingId(null);
                      }}
                      disabled={holdingId === student.id}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                    >
                      <LucideIcon name="PlayCircle" className="h-4 w-4" />
                      Resume Membership
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        setHoldingId(student.id);
                        setOpenMenuId(null);
                        await onHoldMembership?.(student.id);
                        setHoldingId(null);
                      }}
                      disabled={holdingId === student.id}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-amber-600 transition hover:bg-amber-50 disabled:opacity-50"
                    >
                      <LucideIcon name="PauseCircle" className="h-4 w-4" />
                      Hold Membership
                    </button>
                  )
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }, [seatMap, planMap, latestPaymentByStudent, roleMap, busyIds, holdingId, canEditStudent, canLogPayment, canToggleStatus, onOpenModal, onToggleActive, onHoldMembership, onResumeMembership, openMenuId]);

  return (
    <div className="space-y-6 w-full">
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Student Management
            </h1>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-gray-800 dark:text-slate-300">
              {students.length} total
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage KYC, plans, seats, and billing for every reader.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            onClick={() => onOpenModal("importData", { entity: "students" })}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 dark:border-gray-700 dark:text-slate-200"
          >
            <LucideIcon name="Upload" className="h-3.5 w-3.5" />
            Import
          </button>
          {canCreateStudent ? (
            <button
              onClick={() => onOpenModal("createStudent")}
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              <LucideIcon name="userPlus" className="h-3.5 w-3.5" />
              New Student
            </button>
          ) : null}
          <button
            onClick={() => onNavigate("admissions")}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-white dark:border-gray-700 dark:text-slate-200 dark:hover:bg-gray-900/60"
          >
            <LucideIcon name="qrCode" className="h-3.5 w-3.5" />
            QR Enroll
          </button>
        </div>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
        {
          title: "Active",
          value: summary.active,
          tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-100",
          icon: "badgeCheck",
        },
        {
          title: "Monthly Plans",
          value: summary.monthly,
          tone: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-100",
          icon: "calendarDays",
        },
        {
          title: "Limited Plans",
          value: summary.limited,
          tone: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-100",
          icon: "disc",
        },
        {
          title: "Reg. Pending",
          value: summary.registrationsPending,
          tone: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-100",
          icon: "alertCircle",
        },
        ].map((chip) => (
          <div
            key={chip.title}
            className={`flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3 ${chip.tone} dark:border-gray-800 dark:bg-gray-900/70`}
          >
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">
                {chip.title}
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {chip.value}
              </p>
            </div>
            <LucideIcon name={chip.icon} className="h-5 w-5" />
          </div>
        ))}
      </div>

      <div className="flex w-full flex-col gap-4 rounded-2xl border border-slate-100 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full flex-col gap-3 lg:flex-row lg:flex-wrap">
            <div className="relative w-full sm:max-w-xs">
              <LucideIcon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, Aadhaar, or phone..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-slate-100 dark:focus:border-indigo-400"
              />
            </div>
            <select
              value={planFilter}
              onChange={(event) => setPlanFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 sm:w-40 dark:border-gray-700 dark:bg-gray-800 dark:text-slate-100"
            >
              <option value="all">All Plans</option>
              <option value="monthly">Monthly Cycle</option>
              <option value="limited">Limited Days</option>
            </select>
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {filtered.length} students
          </p>
        </div>

        <div className="space-y-5">
          <section className="space-y-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm w-full dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Active Students
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Showing only currently active learners.
                </p>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-300">
                {activeOnly.length} active
              </span>
            </div>
            {isCompact ? (
              activeOnly.length === 0 ? (
                <p className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  No active students match the current filters.
                </p>
              ) : (
                <div className="space-y-3">
                  {activeOnly.map((student, index) =>
                    renderMobileCard(student, index, 0)
                  )}
                </div>
              )
            ) : (
              <div
                className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-gray-800"
                style={{ scrollbarWidth: "thin" }}
              >
                <table className="min-w-full table-auto divide-y divide-slate-100 text-sm dark:divide-gray-800">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-gray-900 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3 text-left dark:text-slate-300">#</th>
                      <th className="px-4 py-3 text-left dark:text-slate-300">Student</th>
                      <th className="px-4 py-3 text-left dark:text-slate-300">Contact</th>
                      <th className="px-4 py-3 text-left dark:text-slate-300">Plan</th>
                      <th className="px-4 py-3 text-left dark:text-slate-300">Seat</th>
                      <th className="px-4 py-3 text-left dark:text-slate-300">Registered Via</th>
                      <th className="px-4 py-3 text-left dark:text-slate-300">Status</th>
                      <th className="px-4 py-3 text-left dark:text-slate-300">Payments</th>
                      <th className="px-4 py-3 text-right dark:text-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800 dark:text-slate-200">
                    {activeOnly.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400"
                        >
                          No active students match the current filters.
                        </td>
                      </tr>
                    ) : (
                      activeOnly.map((student, index) =>
                        renderDesktopRow(student, index, 0)
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm w-full dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  All Students
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Includes both active and inactive records.
                </p>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-300">
                {filtered.length} total
              </span>
            </div>
            {isCompact ? (
              paginatedStudents.length === 0 ? (
                <p className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  No students match the current filters.
                </p>
              ) : (
                <div className="space-y-3">
                  {paginatedStudents.map((student, index) =>
                    renderMobileCard(student, index, (page - 1) * PAGE_SIZE)
                  )}
                </div>
              )
            ) : (
              <div
                className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-gray-800"
                style={{ scrollbarWidth: "thin" }}
              >
                <table className="min-w-full table-auto divide-y divide-slate-100 text-sm dark:divide-gray-800">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-gray-900 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3 text-left dark:text-slate-300">#</th>
                      <th className="px-4 py-3 text-left dark:text-slate-300">Student</th>
                      <th className="px-4 py-3 text-left dark:text-slate-300">Contact</th>
                      <th className="px-4 py-3 text-left dark:text-slate-300">Plan</th>
                      <th className="px-4 py-3 text-left dark:text-slate-300">Seat</th>
                      <th className="px-4 py-3 text-left dark:text-slate-300">Registered Via</th>
                      <th className="px-4 py-3 text-left dark:text-slate-300">Status</th>
                      <th className="px-4 py-3 text-left dark:text-slate-300">Payments</th>
                      <th className="px-4 py-3 text-right dark:text-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800 dark:text-slate-200">
                    {paginatedStudents.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400"
                        >
                          No students match the current filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedStudents.map((student, index) =>
                        renderDesktopRow(student, index, (page - 1) * PAGE_SIZE)
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-gray-900 dark:text-slate-200">
              <span>
                Showing {(page - 1) * PAGE_SIZE + (paginatedStudents.length ? 1 : 0)}-
                {(page - 1) * PAGE_SIZE + paginatedStudents.length} of {filtered.length} students
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold transition hover:border-indigo-200 disabled:opacity-40 dark:border-gray-700 dark:text-slate-200"
                >
                  Prev
                </button>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  Page {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold transition hover:border-indigo-200 disabled:opacity-40 dark:border-gray-700 dark:text-slate-200"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// OPTIMIZED: Wrap with React.memo to prevent unnecessary re-renders
export default React.memo(StudentsView);
