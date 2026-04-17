import React, { useMemo } from "react";
import StatCard from "../components/common/StatCard.jsx";
import LucideIcon from "../components/icons/LucideIcon.jsx";

function DashboardView({ students, seats, payments, notifications = [] }) {
  const today = new Date();
  const weekAhead = new Date();
  weekAhead.setDate(weekAhead.getDate() + 7);

  const metrics = useMemo(() => {
    const active = students.filter((student) => student.is_active);
    const monthly = active.filter(
      (student) => student.fee_plan_type === "monthly"
    );
    const limited = active.filter(
      (student) => student.fee_plan_type === "limited"
    );
    const regPending = students.filter((student) => !student.registration_paid);
    const renewalsDue = students.filter((student) => {
      if (!student.renewal_date) return false;
      const renewal = new Date(student.renewal_date);
      return renewal >= today && renewal <= weekAhead;
    });
    const occupiedSeats = seats.filter((seat) => seat.status === "occupied");
    const availableSeats = seats.filter((seat) => seat.status === "available");
    const recentPayments = [...payments]
      .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
      .slice(0, 5);

    const revenueTrend = Array.from({ length: 7 }).map((_, idx) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - idx));
      const label = date.toLocaleDateString("en-IN", {
        weekday: "short",
      });
      const dayTotal = payments
        .filter(
          (payment) =>
            payment.payment_date.slice(0, 10) ===
            date.toISOString().slice(0, 10)
        )
        .reduce((sum, payment) => sum + payment.amount_paid, 0);
      return { label, total: dayTotal };
    });

    return {
      active,
      monthly,
      limited,
      regPending,
      renewalsDue,
      occupiedSeats,
      availableSeats,
      recentPayments,
      revenueTrend,
    };
  }, [students, seats, payments]);

  const studentMap = useMemo(() => {
    const map = new Map();
    students.forEach((student) => map.set(student.id, student));
    return map;
  }, [students]);

  const formatDate = (value) =>
    value ? new Date(value).toLocaleDateString() : "—";

  const notificationTone = (type) => {
    switch (type) {
      case "success":
        return "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200";
      case "warning":
        return "border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200";
      case "alert":
        return "border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200";
      default:
        return "border-slate-100 bg-slate-50 text-slate-700 dark:border-gray-700 dark:bg-gray-800 dark:text-slate-200";
    }
  };

  return (
    <div className="space-y-6 transition-colors duration-300">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active Students"
          icon="users"
          value={metrics.active.length}
          subtext="Engaged learners"
          tone="primary"
        />
        <StatCard
          title="Seats Occupied"
          icon="armchair"
          value={metrics.occupiedSeats.length}
          subtext={`${metrics.availableSeats.length} available`}
          tone="success"
        />
        <StatCard
          title="Monthly vs Limited"
          icon="calendarDays"
          value={`${metrics.monthly.length} / ${metrics.limited.length}`}
          subtext="Monthly / Limited"
        />
        <StatCard
          title="Reg. Pending"
          icon="alertCircle"
          value={metrics.regPending.length}
          subtext="Collect enrollment fees"
          tone="warning"
        />
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white/90 p-5 shadow-sm backdrop-blur transition-colors duration-300 dark:border-gray-800 dark:bg-gray-900/80">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Snapshot</p>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Rolling Plans
            </p>
            <p className="text-xl font-semibold text-slate-900 dark:text-white">
              {
                metrics.active.filter(
                  (student) => student.fee_cycle === "rolling"
                ).length
              }
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Students billed 30 days from join date
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Limited Pass Avg.
            </p>
            <p className="text-xl font-semibold text-slate-900 dark:text-white">
              {metrics.limited.length
                ? `${Math.round(
                    metrics.limited.reduce(
                      (sum, item) => sum + (item.limited_days || 0),
                      0
                    ) / metrics.limited.length
                  )} days`
                : "—"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Average duration for limited category
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Renewals This Week
            </p>
            <p className="text-xl font-semibold text-slate-900 dark:text-white">
              {metrics.renewalsDue.length}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Follow up with these learners proactively
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white/90 p-5 shadow-sm backdrop-blur transition-colors duration-300 dark:border-gray-800 dark:bg-gray-900/80">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              7-Day Revenue Trend
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real-time intake from UPI and cash collections
            </p>
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            Total ₹
            {metrics.revenueTrend
              .reduce((sum, day) => sum + day.total, 0)
              .toLocaleString("en-IN")}
          </span>
        </div>
        <div className="mt-6 flex items-end gap-4">
          {metrics.revenueTrend.map((day) => {
            const max = Math.max(
              ...metrics.revenueTrend.map((item) => item.total),
              1
            );
            const height = (day.total / max) * 160 + 8;
            return (
              <div key={day.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  ₹{day.total.toLocaleString("en-IN")}
                </div>
                <div
                  className="w-10 rounded-2xl bg-gradient-to-t from-indigo-200 via-indigo-400 to-indigo-600 shadow dark:from-indigo-900/60 dark:via-indigo-600 dark:to-indigo-400"
                  style={{ height }}
                />
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {day.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-100/80 bg-white/95 shadow-sm backdrop-blur transition-colors duration-300 dark:border-gray-800 dark:bg-gray-900/80">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-gray-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Upcoming Renewals
            </h3>
            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-300">
              {metrics.renewalsDue.length} due
            </span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-gray-800">
            {metrics.renewalsDue.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
                No renewals due in the next 7 days.
              </p>
            ) : (
              metrics.renewalsDue
                .sort(
                  (a, b) => new Date(a.renewal_date) - new Date(b.renewal_date)
                )
                .map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-gray-800"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {student.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {student.fee_plan_type === "limited"
                          ? `${student.limited_days || 0} day pass`
                          : student.fee_cycle === "rolling"
                          ? "Monthly rolling"
                          : "Calendar cycle"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {formatDate(student.renewal_date)}
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100/80 bg-white/95 shadow-sm backdrop-blur transition-colors duration-300 dark:border-gray-800 dark:bg-gray-900/80">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-gray-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Recent Payments
            </h3>
            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-300">
              Last 5
            </span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-gray-800">
            {metrics.recentPayments.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
                No payments recorded yet.
              </p>
            ) : (
              metrics.recentPayments.map((payment) => {
                const student = studentMap.get(payment.student_id);
                return (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-gray-800"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {student ? student.name : "Unknown student"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {payment.payment_mode === "upi" ? "UPI" : "Cash"} •{" "}
                        {new Date(payment.payment_date).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                      ₹{payment.amount_paid.toLocaleString("en-IN")}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100/80 bg-white/95 shadow-sm backdrop-blur transition-colors duration-300 dark:border-gray-800 dark:bg-gray-900/80">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-gray-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Notifications
            </h3>
            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-300">
              {notifications.length} alerts
            </span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-gray-800">
            {notifications.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
                Everything looks good. No alerts at the moment.
              </p>
            ) : (
              notifications.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between px-5 py-4 text-sm ${notificationTone(
                    item.tone
                  )}`}
                >
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-xs opacity-80">{item.message}</p>
                  </div>
                  <LucideIcon
                    name={
                      item.category === "approval"
                        ? "BadgeAlert"
                        : item.category === "renewal"
                        ? "CalendarClock"
                        : item.category === "payment"
                        ? "CreditCard"
                        : item.category === "seat"
                        ? "Armchair"
                        : item.category === "admission"
                        ? "QrCode"
                        : item.tone === "alert"
                        ? "AlertTriangle"
                        : item.tone === "success"
                        ? "BadgeCheck"
                        : "Info"
                    }
                    className="h-4 w-4 opacity-70"
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardView;

