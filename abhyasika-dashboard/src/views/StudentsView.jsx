import React, { useCallback, useMemo, useState } from "react";
import ThemeSelect from "../components/common/ThemeSelect.jsx";
import LucideIcon from "../components/icons/LucideIcon.jsx";
import { useAuth } from "../context/AuthContext.jsx";

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

function StudentsView({
  students,
  seats,
  plans,
  onOpenModal,
  onToggleActive,
  busyIds,
  onNavigate = () => {},
  onHoldMembership,
  onResumeMembership,
}) {
  const [holdingId, setHoldingId] = useState(null);
  const { hasPermission } = useAuth();
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [openMenuId, setOpenMenuId] = useState(null);
  const canCreateStudent = hasPermission("students", "add");
  const canEditStudent = hasPermission("students", "edit");
  const canToggleStatus = hasPermission("students", "delete");

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
            .some((field) => String(field).toLowerCase().includes(trimmedQuery))
        : true;
      const matchPlan =
        planFilter === "all" ? true : student.fee_plan_type === planFilter;
      return student.is_active && matchQuery && matchPlan;
    });
  }, [students, query, planFilter]);

  const renderActions = useCallback(
    (student, busy) => {
      const hasAnyActions = canEditStudent || canToggleStatus;
      if (!hasAnyActions) {
        return <span className="text-xs text-slate-400">No permissions</span>;
      }

      return (
        <>
          <button
            onClick={() =>
              setOpenMenuId((prev) => (prev === student.id ? null : student.id))
            }
            className="inline-flex items-center rounded-full border border-slate-200 px-2 py-1 text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
          >
            <LucideIcon name="MoreHorizontal" className="h-4 w-4" />
          </button>
          {openMenuId === student.id ? (
            <div className="absolute right-4 top-11 z-20 w-44 rounded-2xl border border-slate-100 bg-white p-2 text-sm shadow-lg">
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
              {canToggleStatus ? (
                <button
                  onClick={() => {
                    onToggleActive(student.id);
                    setOpenMenuId(null);
                  }}
                  disabled={busy}
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <LucideIcon name="UserX" className="h-4 w-4" />
                  Deactivate
                </button>
              ) : null}
              {student.current_plan_id ? (
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
        </>
      );
    },
    [
      canEditStudent,
      canToggleStatus,
      holdingId,
      onHoldMembership,
      onOpenModal,
      onResumeMembership,
      onToggleActive,
      openMenuId,
    ]
  );

  const renderDesktopRow = useCallback(
    (student, index) => {
      const seat = seatMap.get(student.current_seat_id);
      const plan = planMap.get(student.current_plan_id);
      const busy = busyIds.includes(student.id);
      const feeInfo = feeTypeMap[student.fee_plan_type] || feeTypeMap.monthly;

      return (
        <tr key={student.id} className="hover:bg-slate-50/70">
          <td className="px-4 py-3 text-xs font-semibold text-slate-400">
            {index + 1}
          </td>
          <td className="px-4 py-3">
            <div className="font-semibold text-slate-900">{student.name}</div>
            <p className="text-xs text-slate-500">{student.email || "No email"}</p>
          </td>
          <td className="px-4 py-3 text-sm text-slate-600">
            {student.phone || "-"}
            <p className="text-xs text-slate-400">
              {student.preferred_shift || "General"}
            </p>
          </td>
          <td className="px-4 py-3 text-sm text-slate-600">
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
          <td className="px-4 py-3 text-sm text-slate-600">
            {seat ? seat.seat_number : "Unassigned"}
            <p className="text-xs text-slate-400">
              Joined{" "}
              {student.join_date
                ? new Date(student.join_date).toLocaleDateString()
                : "-"}
            </p>
          </td>
          <td className="px-4 py-3">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                student.membership_status === "on_hold"
                  ? "bg-amber-50 text-amber-600"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  student.membership_status === "on_hold"
                    ? "bg-amber-400"
                    : "bg-emerald-500"
                }`}
              />
              {student.membership_status === "on_hold" ? "On Hold" : "Active"}
            </span>
          </td>
          <td className="relative px-4 py-3 text-right">
            {renderActions(student, busy)}
          </td>
        </tr>
      );
    },
    [busyIds, planMap, renderActions, seatMap]
  );

  return (
    <div className="w-full space-y-5">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800">Active Students</h1>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {summary.active} active
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-400">
            Manage currently active learners, plans, and seats.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            onClick={() => onOpenModal("importData", { entity: "students" })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
          >
            <LucideIcon name="Upload" className="h-3.5 w-3.5" />
            Import
          </button>
          {canCreateStudent ? (
            <button
              onClick={() => onOpenModal("createStudent")}
              className="btn-gradient-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
            >
              <LucideIcon name="userPlus" className="h-3.5 w-3.5" />
              New Student
            </button>
          ) : null}
          <button
            onClick={() => onNavigate("admissions")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-white"
          >
            <LucideIcon name="qrCode" className="h-3.5 w-3.5" />
            QR Enroll
          </button>
        </div>
      </div>

      <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Active",
            value: summary.active,
            bg: "bg-emerald-50",
            text: "text-emerald-700",
            icon: "badgeCheck",
          },
          {
            title: "Monthly Plans",
            value: summary.monthly,
            bg: "bg-indigo-50",
            text: "text-indigo-700",
            icon: "calendarDays",
          },
          {
            title: "Limited Plans",
            value: summary.limited,
            bg: "bg-amber-50",
            text: "text-amber-700",
            icon: "disc",
          },
          {
            title: "Reg. Pending",
            value: summary.registrationsPending,
            bg: "bg-rose-50",
            text: "text-rose-700",
            icon: "alertCircle",
          },
        ].map((chip) => (
          <div
            key={chip.title}
            className={`flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 ${chip.bg}`}
          >
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                {chip.title}
              </p>
              <p className={`text-2xl font-bold ${chip.text}`}>{chip.value}</p>
            </div>
            <LucideIcon
              name={chip.icon}
              className={`h-5 w-5 ${chip.text} opacity-60`}
            />
          </div>
        ))}
      </div>

      <div className="flex w-full flex-col gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <ThemeSelect
              value={planFilter}
              onChange={(event) => setPlanFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 sm:w-40"
            >
              <option value="all">All Plans</option>
              <option value="monthly">Monthly Cycle</option>
              <option value="limited">Limited Days</option>
            </ThemeSelect>
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {filtered.length} students
          </p>
        </div>

        <section className="w-full space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Active Students
              </p>
              <p className="text-xs text-slate-400">
                Showing only currently active learners.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
              {filtered.length} active
            </span>
          </div>
          <div
            className="overflow-x-auto"
            style={{ scrollbarWidth: "thin" }}
          >
            <table className="min-w-full table-auto divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">Seat</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      No active students match the current filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((student, index) =>
                    renderDesktopRow(student, index)
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export default React.memo(StudentsView);
