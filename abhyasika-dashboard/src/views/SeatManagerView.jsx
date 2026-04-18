import React, { useMemo } from "react";
import jsPDF from "jspdf";

const STATUS_STYLES = {
  available:
    "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100 dark:hover:bg-emerald-500/20",
  occupied:
    "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-100 dark:hover:bg-indigo-500/20",
  maintenance:
    "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20",
};

const buildCsv = (headers, rows) => {
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
};

const downloadBlob = (content, filename, type = "text/plain") => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const sortSeatsByNumber = (items = []) =>
  [...items].sort((left, right) =>
    String(left?.seat_number ?? "").localeCompare(
      String(right?.seat_number ?? ""),
      undefined,
      { numeric: true, sensitivity: "base" }
    )
  );

const getRenewalAlert = (student) => {
  if (!student) return null;
  if (!student.renewal_date) {
    return {
      label: "No plan",
      tone: "bg-slate-100 text-slate-600 dark:text-slate-300",
      accent: "ring-2 ring-slate-200 focus:ring-slate-300",
    };
  }
  const today = new Date();
  const due = new Date(student.renewal_date);
  const diffDays = Math.ceil(
    (due.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) /
      (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) {
    return {
      label: "Expired",
      tone: "bg-rose-100 text-rose-700",
      accent: "ring-2 ring-rose-300 focus:ring-rose-400",
    };
  }
  if (diffDays <= 7) {
    return {
      label: `Due ${diffDays === 0 ? "today" : `in ${diffDays}d`}`,
      tone: "bg-amber-100 text-amber-700",
      accent: "ring-2 ring-amber-300 focus:ring-amber-400",
    };
  }
  return null;
};

function SeatManagerView({ seats, students, onOpenModal }) {
  const studentMap = useMemo(() => {
    const map = new Map();
    students.forEach((student) => map.set(student.id, student));
    return map;
  }, [students]);

  const sortedSeats = useMemo(() => sortSeatsByNumber(seats), [seats]);

  const seatRows = useMemo(
    () =>
      sortedSeats.map((seat) => {
        const student = studentMap.get(seat.current_student_id);
        return {
          id: seat.id,
          number: seat.seat_number,
          status: seat.status,
          studentName: student?.name ?? "Unassigned",
          studentPhone: student?.phone ?? "-",
          renewalDate: student?.renewal_date
            ? new Date(student.renewal_date).toLocaleDateString()
            : "-",
        };
      }),
    [sortedSeats, studentMap]
  );

  const exportCsv = () => {
    const rows = seatRows.map((row) => [
      row.number,
      row.status,
      row.studentName,
      row.studentPhone,
      row.renewalDate,
    ]);
    const csv = buildCsv(
      ["Seat", "Status", "Student", "Phone", "Renewal"],
      rows
    );
    downloadBlob(csv, "seat-manager.csv", "text/csv;charset=utf-8;");
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Seat Manager Report", 14, 18);
    doc.setFontSize(10);
    let y = 30;
    doc.text("Seat | Status | Student | Phone | Renewal", 14, y);
    y += 8;
    seatRows.forEach((row) => {
      const line = [
        row.number,
        row.status,
        row.studentName,
        row.studentPhone,
        row.renewalDate,
      ].join(" | ");
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 14, y);
      y += 8;
    });
    doc.save("seat-manager.pdf");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Seat Manager</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Visualize seat allocation and handle assignments in real time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 transition hover:border-indigo-300 hover:text-indigo-600"
          >
            Export CSV
          </button>
          <button
            onClick={exportPdf}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 transition hover:border-indigo-300 hover:text-indigo-600"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedSeats.map((seat) => {
            const occupant = studentMap.get(seat.current_student_id);
            const renewalAlert =
              seat.status === "occupied" ? getRenewalAlert(occupant) : null;
            return (
              <button
                key={seat.id}
                onClick={() =>
                  onOpenModal(
                    seat.status === "available"
                      ? "assignSeat"
                      : "seatDetails",
                    { seat, student: occupant }
                  )
                }
                className={`flex flex-col items-start rounded-2xl border px-4 py-4 text-left shadow-sm transition focus:outline-none ${
                  STATUS_STYLES[seat.status] ?? ""
                } ${renewalAlert?.accent ?? "focus:ring-2 focus:ring-indigo-200"}`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm font-semibold uppercase tracking-wide text-slate-900 dark:text-slate-100">
                    {seat.seat_number}
                  </span>
                  <div className="flex items-center gap-2">
                    {renewalAlert ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${renewalAlert.tone}`}
                      >
                        {renewalAlert.label}
                      </span>
                    ) : null}
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                      {seat.status}
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-sm text-slate-700 dark:text-slate-200">
                  {seat.status === "occupied" ? (
                    <>
                      <p className="font-semibold">{occupant?.name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Renewal:{" "}
                        {occupant?.renewal_date
                          ? new Date(
                              occupant.renewal_date
                            ).toLocaleDateString()
                          : "—"}
                      </p>
                    </>
                  ) : seat.status === "maintenance" ? (
                    <p className="font-medium">Under maintenance</p>
                  ) : (
                    <p className="font-medium text-emerald-700 dark:text-emerald-200">
                      Tap to assign
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default SeatManagerView;
