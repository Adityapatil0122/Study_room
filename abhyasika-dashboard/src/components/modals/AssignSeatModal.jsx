import React, { useEffect, useMemo, useState } from "react";
import Modal from "../common/Modal.jsx";

function AssignSeatModal({ open, onClose, seat, students, onSubmit }) {
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedId("");
      setQuery("");
    }
  }, [open, seat?.id]);

  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return students;
    return students.filter((student) =>
      student.name?.toLowerCase().includes(normalizedQuery)
    );
  }, [students, query]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!selectedId) {
      alert("Please select a student.");
      return;
    }
    onSubmit(selectedId);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={seat ? `Assign Seat ${seat.seat_number}` : "Assign Seat"}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Assigning{" "}
          <span className="font-semibold text-slate-900">
            {seat?.seat_number ?? "seat"}
          </span>{" "}
          to an active student without a seat.
        </div>

        <div className="space-y-2">
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Search Student
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search student by name..."
              className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-100 bg-white">
            {students.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-slate-500">
                No available students.
              </p>
            ) : filteredStudents.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-slate-500">
                No students match that name.
              </p>
            ) : (
              filteredStudents.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => setSelectedId(student.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                    selectedId === student.id
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>
                    <span className="block font-semibold">{student.name}</span>
                    <span className="text-xs text-slate-400">
                      {student.phone || student.email || "No contact"}
                    </span>
                  </span>
                  {selectedId === student.id ? (
                    <span className="text-xs font-semibold text-indigo-600">
                      Selected
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-gradient-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:bg-none disabled:bg-slate-400"
            disabled={students.length === 0 || !selectedId}
          >
            Assign Seat
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default AssignSeatModal;

