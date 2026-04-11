import React, { useMemo, useState } from "react";
import readXlsxFile from "read-excel-file/browser";
import Modal from "../common/Modal.jsx";
import LucideIcon from "../icons/LucideIcon.jsx";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".csv", ".xlsx"];

const ENTITY_CONFIG = {
  students: {
    label: "Students",
    requiredHeaders: ["name", "phone", "plan_id", "join_date"],
    optionalHeaders: [
      "email",
      "gender",
      "aadhaar",
      "preferred_shift",
      "fee_plan_type",
      "fee_cycle",
      "limited_days",
      "registration_paid",
      "seat_id",
    ],
    previewFields: ["name", "phone", "plan_id", "join_date"],
  },
  payments: {
    label: "Payments",
    requiredHeaders: ["student_id", "plan_id", "amount_paid", "valid_from"],
    optionalHeaders: [
      "valid_until",
      "payment_mode",
      "includes_registration",
      "notes",
      "collected_role_id",
    ],
    previewFields: ["student_id", "plan_id", "amount_paid", "valid_from"],
  },
  expenses: {
    label: "Expenses",
    requiredHeaders: ["title", "category", "amount", "expense_date"],
    optionalHeaders: ["paid_via", "notes"],
    previewFields: ["title", "category", "amount", "expense_date"],
  },
};

const formatStatus = (status) => {
  switch (status) {
    case "valid":
      return "Valid";
    case "duplicate":
      return "Duplicate";
    default:
      return "Error";
  }
};

const statusTone = (status) => {
  switch (status) {
    case "valid":
      return "text-emerald-600";
    case "duplicate":
      return "text-amber-600";
    default:
      return "text-rose-600";
  }
};

const normalizeBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    return ["true", "1", "yes", "y"].includes(normalized);
  }
  return false;
};

const normalizeDateValue = (value) => {
  if (!value && value !== 0) return null;
  if (typeof value === "number") {
    const jsDate = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (Number.isNaN(jsDate.getTime())) return null;
    return jsDate.toISOString().slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const normalizeHeaderKey = (key) => key?.toString().trim().toLowerCase() ?? "";

const normalizeRowKeys = (row) => {
  const normalized = {};
  Object.entries(row).forEach(([key, value]) => {
    const normalizedKey = normalizeHeaderKey(key);
    if (!normalizedKey) return;
    normalized[normalizedKey] = typeof value === "string" ? value.trim() : value;
  });
  return normalized;
};

const rowHasValue = (row) =>
  row.some((value) => String(value ?? "").trim() !== "");

const rowsToObjects = (rows) => {
  const nonEmptyRows = rows.filter(rowHasValue);
  if (!nonEmptyRows.length) return [];

  const headers = nonEmptyRows[0].map(normalizeHeaderKey);
  return nonEmptyRows
    .slice(1)
    .map((row) => {
      const parsed = {};
      headers.forEach((header, index) => {
        if (!header) return;
        parsed[header] = row[index] ?? "";
      });
      return normalizeRowKeys(parsed);
    })
    .filter((row) => Object.keys(row).length > 0 && rowHasValue(Object.values(row)));
};

const parseCsvRows = (text) => {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        value += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === "\"" && value === "") {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
};

const readImportRows = async (file, extension) => {
  if (extension === ".csv") {
    return rowsToObjects(parseCsvRows(await file.text()));
  }

  return rowsToObjects(await readXlsxFile(file));
};

const buildStudentPreview = (rows, context) => {
  const planIds = context.planIds;
  const seatIds = context.seatIds;
  const existingPhones = context.studentPhones;
  const existingEmails = context.studentEmails;
  const seenPhones = new Set();
  const seenEmails = new Set();

  return rows.map((row, index) => {
    const errors = [];
    const normalized = {};
    const phoneDigits = row.phone ? String(row.phone).replace(/\D/g, "") : "";
    if (!phoneDigits || phoneDigits.length < 10) {
      errors.push("Phone is required (10 digits).");
    } else {
      normalized.phone = phoneDigits.slice(-10);
    }
    if (!row.name) {
      errors.push("Name is required.");
    } else {
      normalized.name = row.name;
    }
    if (!row.plan_id) {
      errors.push("plan_id is required.");
    } else if (!planIds.has(row.plan_id)) {
      errors.push(`Plan ${row.plan_id} not found.`);
    } else {
      normalized.plan_id = row.plan_id;
    }
    const joinDate = normalizeDateValue(row.join_date);
    if (!joinDate) {
      errors.push("join_date is invalid.");
    } else {
      normalized.join_date = joinDate;
    }
    if (row.email) {
      const email = row.email.toLowerCase();
      const emailRegex = /.+@.+\..+/;
      if (!emailRegex.test(email)) {
        errors.push("Email format invalid.");
      } else {
        normalized.email = email;
      }
    }
    if (row.gender) {
      normalized.gender = row.gender;
    }
    if (row.aadhaar) {
      normalized.aadhaar = String(row.aadhaar).replace(/\D/g, "");
    }
    if (row.seat_id) {
      if (!seatIds.has(row.seat_id)) {
        errors.push(`Seat ${row.seat_id} not found.`);
      } else {
        normalized.seat_id = row.seat_id;
      }
    }
    normalized.preferred_shift = row.preferred_shift || "Morning";
    normalized.fee_plan_type = row.fee_plan_type || "monthly";
    normalized.fee_cycle = row.fee_cycle || "calendar";
    if (normalized.fee_plan_type === "limited") {
      normalized.limited_days = Number(row.limited_days) || null;
      if (!normalized.limited_days) {
        errors.push("limited_days is required for limited plans.");
      }
    }
    normalized.registration_paid = normalizeBoolean(row.registration_paid);

    let status = "valid";
    if (errors.length) {
      status = "error";
    } else if (
      normalized.phone &&
      (existingPhones.has(normalized.phone) || seenPhones.has(normalized.phone))
    ) {
      status = "duplicate";
    } else if (
      normalized.email &&
      (existingEmails.has(normalized.email) || seenEmails.has(normalized.email))
    ) {
      status = "duplicate";
    }

    if (status === "valid") {
      seenPhones.add(normalized.phone);
      if (normalized.email) {
        seenEmails.add(normalized.email);
      }
    }

    normalized.name = normalized.name || row.name;
    return {
      index: index + 2,
      raw: row,
      normalized,
      status,
      errors,
    };
  });
};

const buildPaymentPreview = (rows, context) => {
  const studentIds = context.studentIds;
  const planIds = context.planIds;
  const existingPayments = context.paymentFingerprints;
  const seenKeys = new Set();

  return rows.map((row, index) => {
    const errors = [];
    const normalized = {};
    if (!row.student_id || !studentIds.has(row.student_id)) {
      errors.push("student_id missing or invalid.");
    } else {
      normalized.student_id = row.student_id;
    }
    if (!row.plan_id || !planIds.has(row.plan_id)) {
      errors.push("plan_id missing or invalid.");
    } else {
      normalized.plan_id = row.plan_id;
    }
    if (row.amount_paid === undefined || row.amount_paid === null) {
      errors.push("amount_paid required.");
    } else {
      const amount = Number(row.amount_paid);
      if (Number.isNaN(amount) || amount <= 0) {
        errors.push("amount_paid must be a positive number.");
      } else {
        normalized.amount_paid = amount;
      }
    }
    const validFrom = normalizeDateValue(row.valid_from);
    if (!validFrom) {
      errors.push("valid_from is invalid.");
    } else {
      normalized.valid_from = validFrom;
    }
    const validUntil = normalizeDateValue(row.valid_until);
    if (validUntil) {
      normalized.valid_until = validUntil;
    }
    normalized.payment_mode = row.payment_mode || "upi";
    normalized.includes_registration = normalizeBoolean(row.includes_registration);
    if (row.notes) normalized.notes = row.notes;
    if (row.collected_role_id) normalized.collected_role_id = row.collected_role_id;

    const fingerprint = `${normalized.student_id || ""}|${normalized.plan_id || ""}|${
      normalized.valid_from || ""
    }|${normalized.amount_paid || 0}|${normalized.payment_mode}|${(normalized.notes || "").toLowerCase()}`;

    let status = "valid";
    if (errors.length) {
      status = "error";
    } else if (existingPayments.has(fingerprint) || seenKeys.has(fingerprint)) {
      status = "duplicate";
    } else {
      seenKeys.add(fingerprint);
    }

    return {
      index: index + 2,
      raw: row,
      normalized,
      status,
      errors,
    };
  });
};

const buildExpensePreview = (rows, context) => {
  const existing = context.expenseFingerprints;
  const seen = new Set();

  return rows.map((row, index) => {
    const errors = [];
    const normalized = {};
    if (!row.title) {
      errors.push("title is required.");
    } else {
      normalized.title = row.title;
    }
    if (!row.category) {
      errors.push("category is required.");
    } else {
      normalized.category = row.category;
    }
    const amount = Number(row.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      errors.push("amount must be positive.");
    } else {
      normalized.amount = amount;
    }
    const expenseDate = normalizeDateValue(row.expense_date);
    if (!expenseDate) {
      errors.push("expense_date invalid.");
    } else {
      normalized.expense_date = expenseDate;
    }
    normalized.paid_via = row.paid_via || "cash";
    if (row.notes) normalized.notes = row.notes;

    const fingerprint = `${normalized.expense_date}|${normalized.amount}|${normalized.category}|${
      normalized.title
    }|${(normalized.notes || "").toLowerCase()}`;

    let status = "valid";
    if (errors.length) {
      status = "error";
    } else if (existing.has(fingerprint) || seen.has(fingerprint)) {
      status = "duplicate";
    } else {
      seen.add(fingerprint);
    }

    return {
      index: index + 2,
      raw: row,
      normalized,
      status,
      errors,
    };
  });
};

const previewFactory = {
  students: buildStudentPreview,
  payments: buildPaymentPreview,
  expenses: buildExpensePreview,
};

function ImportModal({
  open,
  onClose,
  entity,
  onImport,
  students = [],
  plans = [],
  payments = [],
  expenses = [],
  seats = [],
}) {
  const config = ENTITY_CONFIG[entity] ?? ENTITY_CONFIG.students;
  const [fileError, setFileError] = useState("");
  const [previewRows, setPreviewRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const context = useMemo(() => {
    return {
      planIds: new Set(plans.map((plan) => plan.id)),
      seatIds: new Set(seats.map((seat) => seat.id)),
      studentIds: new Set(students.map((student) => student.id)),
      studentPhones: new Set(
        students
          .map((student) => (student.phone ? String(student.phone).replace(/\D/g, "").slice(-10) : null))
          .filter(Boolean)
      ),
      studentEmails: new Set(
        students.map((student) => (student.email ? student.email.toLowerCase() : null)).filter(Boolean)
      ),
      paymentFingerprints: new Set(
        payments.map((payment) => {
          const key = `${payment.student_id || ""}|${payment.plan_id || ""}|${
            payment.valid_from || ""
          }|${Number(payment.amount_paid || 0)}|${payment.payment_mode || ""}|${
            (payment.notes || "").toLowerCase()
          }`;
          return key;
        })
      ),
      expenseFingerprints: new Set(
        expenses.map((expense) => {
          const key = `${expense.expense_date || ""}|${Number(expense.amount || 0)}|${
            expense.category || ""
          }|${expense.title || ""}|${(expense.notes || "").toLowerCase()}`;
          return key;
        })
      ),
    };
  }, [plans, students, payments, expenses, seats]);

  const summary = useMemo(() => {
    const totals = { total: previewRows.length, valid: 0, duplicates: 0, invalid: 0 };
    previewRows.forEach((row) => {
      if (row.status === "valid") totals.valid += 1;
      else if (row.status === "duplicate") totals.duplicates += 1;
      else totals.invalid += 1;
    });
    return totals;
  }, [previewRows]);

  const validRows = previewRows.filter((row) => row.status === "valid");

  const handleFileChange = async (event) => {
    setFileError("");
    setPreviewRows([]);
    setResult(null);
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setFileError("Please upload a CSV or XLSX file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError("File size exceeds the 4MB limit.");
      return;
    }
    try {
      const sheetRows = await readImportRows(file, extension);
      if (!sheetRows.length) {
        setFileError("No data found in the file.");
        return;
      }
      const normalizedRows = sheetRows;
      const allHeaders = new Set(Object.keys(normalizedRows[0]));
      const missing = config.requiredHeaders.filter((header) => !allHeaders.has(header));
      if (missing.length) {
        setFileError(`Missing required columns: ${missing.join(", ")}`);
        return;
      }
      const builder = previewFactory[entity] || buildStudentPreview;
      const previews = builder(normalizedRows, context);
      setPreviewRows(previews);
      setFileName(file.name);
    } catch (err) {
      setFileError(err.message ?? "Unable to read the file.");
    }
  };

  const handleImport = async () => {
    if (!validRows.length) return;
    setImporting(true);
    setFileError("");
    try {
      const imported = await onImport({
        entity,
        rows: validRows.map((row) => row.normalized),
        fileName,
        stats: {
          total: summary.total,
          duplicates: summary.duplicates,
          invalid: summary.invalid,
        },
      });
      setResult({
        imported: imported ?? validRows.length,
        duplicates: summary.duplicates,
        invalid: summary.invalid,
      });
    } catch (err) {
      setFileError(err.message ?? "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Import ${config.label}`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Upload CSV or XLSX</p>
          <p className="text-xs text-slate-500">
            Required columns: {config.requiredHeaders.join(", ")}.
            Optional columns: {config.optionalHeaders.join(", ")}.
          </p>
          <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm">
            <span>{fileName || "Choose file"}</span>
            <input
              type="file"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleFileChange}
            />
            <LucideIcon name="Upload" className="h-4 w-4" />
          </label>
          {fileError ? (
            <p className="mt-2 text-sm text-rose-600">{fileError}</p>
          ) : null}
        </div>

        {previewRows.length ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                Total rows: {summary.total}
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-600">
                Ready: {summary.valid}
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-600">
                Duplicates: {summary.duplicates}
              </span>
              <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-600">
                Errors: {summary.invalid}
              </span>
            </div>

            <div className="max-h-80 overflow-auto rounded-2xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Row</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Message</th>
                    {config.previewFields.map((field) => (
                      <th key={field} className="px-3 py-2 text-left">
                        {field}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewRows.map((row) => (
                    <tr key={row.index} className="bg-white">
                      <td className="px-3 py-2 text-xs text-slate-500">{row.index}</td>
                      <td className={`px-3 py-2 text-xs font-semibold ${statusTone(row.status)}`}>
                        {formatStatus(row.status)}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {row.errors.length ? row.errors.join(" | ") : "Ready"}
                      </td>
                      {config.previewFields.map((field) => (
                        <td key={field} className="px-3 py-2 text-xs text-slate-600">
                          {row.raw[field] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Imported {result.imported} rows. Duplicates: {result.duplicates}. Errors: {result.invalid}.
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!validRows.length || importing}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {importing ? (
              <>
                <LucideIcon name="loader2" className="h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <LucideIcon name="FileSpreadsheet" className="h-4 w-4" />
                Import {validRows.length} rows
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default ImportModal;
