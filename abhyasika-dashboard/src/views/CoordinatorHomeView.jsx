import React, { useMemo } from "react";
import LucideIcon from "../components/icons/LucideIcon.jsx";

function CoordinatorHomeView({
  students = [],
  payments = [],
  pendingPayments = [],
  scheduledRequests = [],
  onNavigate = () => {},
}) {
  const metrics = useMemo(() => {
    const activeStudents = students.filter((student) => student.is_active).length;
    const registrationsPending = students.filter(
      (student) => !student.registration_paid
    ).length;
    const dueThisWeek = students.filter((student) => {
      if (!student.renewal_date || !student.is_active) return false;
      const due = new Date(student.renewal_date);
      const today = new Date();
      const diffDays = (due - today) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }).length;
    const recentCollections = payments
      .slice()
      .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
      .slice(0, 3);

    return {
      activeStudents,
      registrationsPending,
      dueThisWeek,
      pendingQr: pendingPayments.length,
      sentRequests: scheduledRequests.length,
      recentCollections,
    };
  }, [pendingPayments.length, payments, scheduledRequests.length, students]);

  const cards = [
    {
      label: "Active Students",
      value: metrics.activeStudents,
      icon: "Users",
      tone: "bg-emerald-50 text-emerald-700",
      view: "students",
    },
    {
      label: "Renewals This Week",
      value: metrics.dueThisWeek,
      icon: "CalendarClock",
      tone: "bg-indigo-50 text-indigo-700",
      view: "renewals",
    },
    {
      label: "Pending QR",
      value: metrics.pendingQr,
      icon: "QrCode",
      tone: "bg-amber-50 text-amber-700",
      view: "payments",
    },
    {
      label: "Payment Requests",
      value: metrics.sentRequests,
      icon: "Send",
      tone: "bg-rose-50 text-rose-700",
      view: "paymentRequests",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Coordinator Panel
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Daily coordination
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Send payment requests, monitor renewals, and verify student payments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("paymentRequests")}
          className="btn-gradient-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
        >
          <LucideIcon name="Send" className="h-4 w-4" />
          Send Payment Request
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => onNavigate(card.view)}
            className={`flex items-center justify-between rounded-2xl border border-slate-100 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow ${card.tone}`}
          >
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {card.label}
              </p>
              <p className="mt-2 text-2xl font-semibold">{card.value}</p>
            </div>
            <LucideIcon name={card.icon} className="h-5 w-5 opacity-70" />
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Coordinator Access
              </h2>
              <p className="text-sm text-slate-500">
                Limited workspace tools, no settings or expense access.
              </p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              Limited
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Send payment requests", "Create plan/payment requests for students."],
              ["Track renewals", "View due students and send renewal reminders."],
              ["Verify payments", "Review collections and pending QR payments."],
              ["View admissions", "See registrations without admin settings access."],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <p className="text-sm font-semibold text-slate-800">{title}</p>
                <p className="mt-1 text-xs text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Recent Payments
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("payments")}
              className="text-sm font-semibold text-indigo-600"
            >
              View all
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {metrics.recentCollections.length ? (
              metrics.recentCollections.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {payment.student_name || "Student payment"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {(payment.payment_mode || "-").toUpperCase()}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-600">
                    Rs {Number(payment.amount_paid || 0).toLocaleString("en-IN")}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No payments recorded yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default CoordinatorHomeView;
