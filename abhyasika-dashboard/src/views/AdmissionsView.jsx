import React, { useEffect, useMemo, useState } from "react";
import LucideIcon from "../components/icons/LucideIcon.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const PAGE_SIZE = 10;

function AdmissionsView({
  students = [],
  onOpenModal = () => {},
  onToggleActive = () => {},
  busyIds = [],
}) {
  const [studentQuery, setStudentQuery] = useState("");
  const [studentPage, setStudentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);
  const { hasPermission } = useAuth();
  const canEditStudent = hasPermission("students", "edit");
  const canToggleStatus = hasPermission("students", "delete");

  const filteredStudents = useMemo(() => {
    const query = studentQuery.trim().toLowerCase();
    const sorted = [...students].sort((a, b) => {
      const left = a.join_date ? new Date(a.join_date).getTime() : 0;
      const right = b.join_date ? new Date(b.join_date).getTime() : 0;
      return right - left || a.name.localeCompare(b.name);
    });

    if (!query) return sorted;
    return sorted.filter((student) =>
      [student.name, student.email, student.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [students, studentQuery]);

  const totalStudentPages = Math.max(
    1,
    Math.ceil(filteredStudents.length / PAGE_SIZE)
  );

  useEffect(() => {
    if (studentPage > totalStudentPages) {
      setStudentPage(totalStudentPages);
    }
  }, [studentPage, totalStudentPages]);

  const paginatedStudents = useMemo(() => {
    const start = (studentPage - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, studentPage]);

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatAmount = (value) =>
    `Rs ${Number(value || 0).toLocaleString("en-IN")}`;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Admissions
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Complete admission records with registration and deposit details.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <LucideIcon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={studentQuery}
                onChange={(event) => {
                  setStudentQuery(event.target.value);
                  setStudentPage(1);
                }}
                placeholder="Search by name, email, or contact..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {filteredStudents.length} total
            </span>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">Reg Date</th>
                <th className="px-4 py-3 text-left">Deposit</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    No students match the current search.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student) => {
                  const busy = busyIds.includes(student.id);
                  const hasActions = canEditStudent || canToggleStatus;
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {student.name}
                        </div>
                        <span
                          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            student.is_active
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {student.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {student.email || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {student.phone || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(student.join_date || student.created_at)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {formatAmount(student.deposit_amount)}
                      </td>
                      <td className="relative px-4 py-3 text-right">
                        {hasActions ? (
                          <>
                            <button
                              onClick={() =>
                                setOpenMenuId((prev) =>
                                  prev === student.id ? null : student.id
                                )
                              }
                              className="inline-flex items-center rounded-full border border-slate-200 px-2 py-1 text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
                            >
                              <LucideIcon
                                name="MoreHorizontal"
                                className="h-4 w-4"
                              />
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
                                    <LucideIcon
                                      name="UserSquare"
                                      className="h-4 w-4"
                                    />
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
                                    <LucideIcon
                                      name={student.is_active ? "UserX" : "UserCheck"}
                                      className="h-4 w-4"
                                    />
                                    {student.is_active
                                      ? "Deactivate"
                                      : "Activate"}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">
                            No permissions
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-slate-500">
            Showing{" "}
            {(studentPage - 1) * PAGE_SIZE +
              (paginatedStudents.length ? 1 : 0)}
            -{(studentPage - 1) * PAGE_SIZE + paginatedStudents.length} of{" "}
            {filteredStudents.length} students
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStudentPage((prev) => Math.max(1, prev - 1))}
              disabled={studentPage === 1}
              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold transition hover:border-indigo-200 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="text-xs font-semibold text-slate-500">
              {studentPage} / {totalStudentPages}
            </span>
            <button
              onClick={() =>
                setStudentPage((prev) => Math.min(totalStudentPages, prev + 1))
              }
              disabled={studentPage === totalStudentPages}
              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold transition hover:border-indigo-200 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdmissionsView;
