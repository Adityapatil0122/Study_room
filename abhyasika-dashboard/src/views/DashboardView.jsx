import React, { useMemo } from "react";
import PhosphorIcon from "../components/icons/PhosphorIcon.jsx";

const CURRENCY = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function DashboardView({ students, seats, payments, notifications = [] }) {
  const metrics = useMemo(() => {
    const today = new Date();
    const weekAhead = new Date();
    weekAhead.setDate(weekAhead.getDate() + 7);

    const active = students.filter((s) => s.is_active);
    const monthly = active.filter((s) => s.fee_plan_type === "monthly");
    const limited = active.filter((s) => s.fee_plan_type === "limited");
    const regPending = students.filter((s) => !s.registration_paid);
    const renewalsDue = students.filter((s) => {
      if (!s.renewal_date) return false;
      const renewalDate = new Date(s.renewal_date);
      return renewalDate >= today && renewalDate <= weekAhead;
    });
    const occupiedSeats = seats.filter((s) => s.status === "occupied");
    const availableSeats = seats.filter((s) => s.status === "available");
    const recentPayments = [...payments]
      .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
      .slice(0, 5);

    const revenueTrend = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const label = date.toLocaleDateString("en-IN", { weekday: "short" });
      const isoDate = date.toISOString().slice(0, 10);
      const dayTotal = payments
        .filter((payment) => payment.payment_date.slice(0, 10) === isoDate)
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
  }, [payments, seats, students]);

  const studentMap = useMemo(() => {
    const map = new Map();
    students.forEach((student) => map.set(student.id, student));
    return map;
  }, [students]);

  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "-";

  const trendMax = Math.max(...metrics.revenueTrend.map((day) => day.total), 1);
  const weekRevenue = metrics.revenueTrend.reduce(
    (sum, day) => sum + day.total,
    0
  );

  const notifIcon = (category) => {
    const map = {
      approval: "ShieldWarning",
      renewal: "CalendarCheck",
      payment: "CreditCard",
      seat: "Armchair",
      admission: "QrCode",
    };
    return map[category] || "Bell";
  };

  const quickStats = [
    {
      label: "Rolling Plans",
      value: metrics.active.filter((student) => student.fee_cycle === "rolling")
        .length,
      sub: "billed 30d from join",
    },
    {
      label: "Limited Pass Avg.",
      value: metrics.limited.length
        ? `${Math.round(
            metrics.limited.reduce(
              (sum, item) => sum + (item.limited_days || 0),
              0
            ) / metrics.limited.length
          )}d`
        : "-",
      sub: "avg duration",
    },
    {
      label: "Renewals This Week",
      value: metrics.renewalsDue.length,
      sub: "follow up needed",
    },
  ];

  return (
    <div className="space-y-5 pb-6">
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[960px] grid-cols-3 gap-4">
          <div className="col-span-2 rounded-xl border border-indigo-100 bg-white p-5 shadow-sm">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  7-Day Revenue
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  UPI + Cash collections
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-slate-800">
                  {CURRENCY.format(weekRevenue)}
                </p>
                <p className="text-[11px] text-slate-400">this week</p>
              </div>
            </div>

            <div
              className="flex items-end justify-between gap-1 border-b border-slate-100 pb-3"
              style={{ height: 120 }}
            >
              {metrics.revenueTrend.map((day) => {
                const barHeight = Math.max(
                  Math.round((day.total / trendMax) * 96),
                  3
                );
                const isToday =
                  day.label ===
                  new Date().toLocaleDateString("en-IN", { weekday: "short" });

                return (
                  <div
                    key={day.label}
                    className="flex flex-1 flex-col items-center justify-end gap-1"
                  >
                    {day.total > 0 ? (
                      <p className="mb-0.5 text-[9px] font-semibold text-slate-400">
                        {CURRENCY.format(day.total)}
                      </p>
                    ) : null}
                    <div
                      className={`rounded-sm transition-all duration-500 ${
                        isToday
                          ? "bg-indigo-500"
                          : "bg-indigo-200 hover:bg-indigo-300"
                      }`}
                      style={{ height: barHeight, width: 20 }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-2 flex justify-between">
              {metrics.revenueTrend.map((day) => {
                const isToday =
                  day.label ===
                  new Date().toLocaleDateString("en-IN", { weekday: "short" });
                return (
                  <div key={day.label} className="flex flex-1 justify-center">
                    <p
                      className={`text-[10px] font-semibold ${
                        isToday ? "text-indigo-500" : "text-slate-400"
                      }`}
                    >
                      {day.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {quickStats.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-xl border border-indigo-100 bg-white px-4 py-3.5 shadow-sm transition-colors hover:border-indigo-100"
              >
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.sub}</p>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[960px] grid-cols-3 gap-4">
          <div className="overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm transition-colors hover:border-indigo-100">
            <div className="flex items-center justify-between border-b border-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">
                Upcoming Renewals
              </p>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600">
                {metrics.renewalsDue.length} due
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {metrics.renewalsDue.length === 0 ? (
                <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
                  <PhosphorIcon
                    name="CheckCircle"
                    size={28}
                    weight="duotone"
                    className="text-emerald-400"
                  />
                  <p className="mt-1 text-sm text-slate-500">
                    No renewals this week
                  </p>
                </div>
              ) : (
                metrics.renewalsDue
                  .sort(
                    (left, right) =>
                      new Date(left.renewal_date) - new Date(right.renewal_date)
                  )
                  .slice(0, 5)
                  .map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {student.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {student.fee_plan_type === "limited"
                            ? `${student.limited_days || 0}d pass`
                            : student.fee_cycle === "rolling"
                            ? "Rolling"
                            : "Calendar"}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600">
                        {formatDate(student.renewal_date)}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm transition-colors hover:border-indigo-100">
            <div className="flex items-center justify-between border-b border-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">
                Recent Payments
              </p>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                Last 5
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {metrics.recentPayments.length === 0 ? (
                <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
                  <PhosphorIcon
                    name="CreditCard"
                    size={28}
                    weight="duotone"
                    className="text-slate-300"
                  />
                  <p className="mt-1 text-sm text-slate-500">No payments yet</p>
                </div>
              ) : (
                metrics.recentPayments.map((payment) => {
                  const student = studentMap.get(payment.student_id);
                  return (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {student ? student.name : "Unknown"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {payment.payment_mode === "upi" ? "UPI" : "Cash"} .{" "}
                          {new Date(payment.payment_date).toLocaleDateString(
                            "en-IN",
                            {
                              day: "2-digit",
                              month: "short",
                            }
                          )}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-emerald-600">
                        {CURRENCY.format(payment.amount_paid)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm transition-colors hover:border-indigo-100">
            <div className="flex items-center justify-between border-b border-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">Alerts</p>
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-500">
                {notifications.length}
              </span>
            </div>
            <div className="max-h-64 divide-y divide-slate-50 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
                  <PhosphorIcon
                    name="BellSlash"
                    size={28}
                    weight="duotone"
                    className="text-slate-300"
                  />
                  <p className="mt-1 text-sm text-slate-500">All clear!</p>
                </div>
              ) : (
                notifications.slice(0, 8).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50"
                  >
                    <div
                      className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg ${
                        item.tone === "success"
                          ? "bg-emerald-100 text-emerald-600"
                          : item.tone === "warning"
                          ? "bg-amber-100 text-amber-600"
                          : item.tone === "alert"
                          ? "bg-rose-100 text-rose-600"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <PhosphorIcon
                        name={notifIcon(item.category)}
                        size={13}
                        weight="fill"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800">
                        {item.title}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">
                        {item.message}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardView;
