import React, { useMemo } from "react";
import LucideIcon from "../components/icons/LucideIcon.jsx";
import jsPDF from "jspdf";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const formatCurrency = (value = 0) =>
  currencyFormatter.format(Number(value) || 0);

function buildCsv(headers, rows) {
  const safeHeaders = headers
    .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
    .join(",");
  const lines = [safeHeaders];
  rows.forEach((row) => {
    const safeRow = row
      .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
      .join(",");
    lines.push(safeRow);
  });
  return lines.join("\n");
}

function downloadBlob(content, filename, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportPdf({ filename, title, headers, rows }) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 18);
  doc.setFontSize(10);
  let y = 30;
  doc.text(headers.join(" | "), 14, y);
  y += 8;
  rows.forEach((row) => {
    const line = row.map((cell) => String(cell ?? "")).join(" | ");
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 14, y);
    y += 8;
  });
  doc.save(filename);
}

function ReportsView({
  seats = [],
  students = [],
  payments = [],
  expenses = [],
  plans = [],
}) {
  const studentIndex = useMemo(() => {
    const index = new Map();
    students.forEach((student) => index.set(student.id, student));
    return index;
  }, [students]);

  const planIndex = useMemo(() => {
    const index = new Map();
    plans.forEach((plan) => index.set(plan.id, plan));
    return index;
  }, [plans]);

  const occupancyRows = useMemo(() => {
    return seats
      .slice()
      .sort((a, b) => a.seat_number.localeCompare(b.seat_number))
      .map((seat) => {
        const occupant = seat.current_student_id
          ? studentIndex.get(seat.current_student_id)
          : null;
        return {
          id: seat.id,
          seat: seat.seat_number,
          status: seat.status,
          student: occupant ? occupant.name : "Unassigned",
        };
      });
  }, [seats, studentIndex]);

  const expenseRows = useMemo(() => {
    return expenses
      .slice()
      .sort(
        (a, b) =>
          new Date(b.expense_date || 0).getTime() -
          new Date(a.expense_date || 0).getTime()
      )
      .map((expense) => ({
        id: expense.id,
        title: expense.title,
        category: expense.category,
        date: expense.expense_date
          ? new Date(expense.expense_date).toLocaleDateString("en-IN")
          : "Not set",
        amount: Number(expense.amount) || 0,
        paidVia: (expense.paid_via || "cash").toUpperCase(),
        notes: expense.notes || "",
      }));
  }, [expenses]);

  const collectionRows = useMemo(() => {
    return payments
      .slice()
      .sort(
        (a, b) =>
          new Date(b.payment_date || 0).getTime() -
          new Date(a.payment_date || 0).getTime()
      )
      .map((payment) => {
        const student = studentIndex.get(payment.student_id);
        const plan = planIndex.get(payment.plan_id);
        return {
          id: payment.id,
          date: payment.payment_date
            ? new Date(payment.payment_date).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Not set",
          student: student ? student.name : "Unknown",
          plan: plan ? plan.name : "Custom",
          amount: Number(payment.amount_paid) || 0,
          mode: (payment.payment_mode || "upi").toUpperCase(),
          validUntil: payment.valid_until
            ? new Date(payment.valid_until).toLocaleDateString("en-IN")
            : "Not set",
          notes: payment.notes || "",
        };
      });
  }, [payments, studentIndex, planIndex]);

  const totalSeats = seats.length || occupancyRows.length;

  const summary = useMemo(() => {
    const occupiedCount = occupancyRows.filter(
      (row) => row.status === "occupied"
    ).length;
    const availableCount = Math.max(totalSeats - occupiedCount, 0);
    const totalCollections = collectionRows.reduce(
      (sum, row) => sum + row.amount,
      0
    );
    const totalExpenses = expenseRows.reduce(
      (sum, row) => sum + row.amount,
      0
    );
    return {
      occupiedCount,
      availableCount,
      totalCollections,
      totalExpenses,
    };
  }, [occupancyRows, collectionRows, expenseRows, totalSeats]);

  const exportCollectionsCsv = () => {
    const rows = collectionRows.map((row) => [
      row.date,
      row.student,
      row.plan,
      row.mode,
      row.amount,
      row.validUntil,
      row.notes,
    ]);
    const csv = buildCsv(
      ["Date", "Student", "Plan", "Mode", "Amount", "Valid Until", "Notes"],
      rows
    );
    downloadBlob(csv, "collections-report.csv", "text/csv;charset=utf-8;");
  };

  const exportCollectionsPdf = () =>
    exportPdf({
      filename: "collections-report.pdf",
      title: "Collections Report",
      headers: ["Date", "Student", "Plan", "Mode", "Amount", "Valid Until"],
      rows: collectionRows.map((row) => [
        row.date,
        row.student,
        row.plan,
        row.mode,
        formatCurrency(row.amount),
        row.validUntil,
      ]),
    });

  const exportExpensesCsv = () => {
    const rows = expenseRows.map((row) => [
      row.date,
      row.title,
      row.category,
      row.paidVia,
      row.amount,
      row.notes,
    ]);
    const csv = buildCsv(
      ["Date", "Title", "Category", "Mode", "Amount", "Notes"],
      rows
    );
    downloadBlob(csv, "expenses-report.csv", "text/csv;charset=utf-8;");
  };

  const exportExpensesPdf = () =>
    exportPdf({
      filename: "expenses-report.pdf",
      title: "Expenses Report",
      headers: ["Date", "Title", "Category", "Mode", "Amount"],
      rows: expenseRows.map((row) => [
        row.date,
        row.title,
        row.category,
        row.paidVia,
        formatCurrency(row.amount),
      ]),
    });

  const SectionHeader = ({
    title,
    description,
    onExportCsv,
    onExportPdf,
  }) => (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onExportCsv}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600"
        >
          <LucideIcon name="fileDown" className="h-4 w-4" />
          CSV
        </button>
        <button
          onClick={onExportPdf}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600"
        >
          <LucideIcon name="fileText" className="h-4 w-4" />
          PDF
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Business Health
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          Reports & Exports
        </h1>
        <p className="text-sm text-slate-500">
          Download ready-to-share summaries for occupancy, collections, and
          expenses whenever you need them.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Seats Occupied",
            value: summary.occupiedCount,
            sub: `Out of ${totalSeats} total seats`,
            bg: "bg-emerald-50",
            text: "text-emerald-700",
          },
          {
            label: "Seats Available",
            value: summary.availableCount,
            sub: "Ready to be assigned",
            bg: "bg-indigo-50",
            text: "text-indigo-700",
          },
          {
            label: "Collections",
            value: formatCurrency(summary.totalCollections),
            sub: `Across ${collectionRows.length} payments`,
            bg: "bg-amber-50",
            text: "text-amber-700",
          },
          {
            label: "Expenses",
            value: formatCurrency(summary.totalExpenses),
            sub: `Across ${expenseRows.length} entries`,
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
            <p className="text-xs text-slate-500">{card.sub}</p>
          </div>
        ))}
      </div>

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <SectionHeader
          title="Collections Report"
          description="All incoming fees, whether cash or UPI."
          onExportCsv={exportCollectionsCsv}
          onExportPdf={exportCollectionsPdf}
        />
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Student</th>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Mode</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Valid Until</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {collectionRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2 text-slate-600">{row.date}</td>
                  <td className="px-4 py-2 font-semibold text-slate-900">
                    {row.student}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{row.plan}</td>
                  <td className="px-4 py-2 text-xs font-semibold uppercase text-indigo-600">
                    {row.mode}
                  </td>
                  <td className="px-4 py-2 font-semibold text-slate-900">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{row.validUntil}</td>
                </tr>
              ))}
              {collectionRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No payments recorded yet. Use the Log Payment action to add
                    your first collection.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <SectionHeader
          title="Expenses Report"
          description="Track rent, upkeep, supplies, and every outgoing rupee."
          onExportCsv={exportExpensesCsv}
          onExportPdf={exportExpensesPdf}
        />
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Mode</th>
                <th className="px-4 py-2">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenseRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2 text-slate-600">{row.date}</td>
                  <td className="px-4 py-2 font-semibold text-slate-900">
                    {row.title}
                  </td>
                  <td className="px-4 py-2 capitalize text-slate-600">
                    {row.category}
                  </td>
                  <td className="px-4 py-2 text-xs font-semibold uppercase text-rose-600">
                    {row.paidVia}
                  </td>
                  <td className="px-4 py-2 font-semibold text-slate-900">
                    {formatCurrency(row.amount)}
                  </td>
                </tr>
              ))}
              {expenseRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No expenses logged yet. Use the Expenses screen to capture
                    your spending.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default ReportsView;
