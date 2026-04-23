import React, { useEffect, useMemo, useState } from "react";
import Modal from "../common/Modal.jsx";
import ThemeSelect from "../common/ThemeSelect.jsx";
import LucideIcon from "../icons/LucideIcon.jsx";
import { createApiClient } from "../../lib/apiClient.js";

const FEE_PLAN_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "rolling", label: "Rolling 30 Days" },
  { value: "limited", label: "Limited Days" },
];

const GENDERS = ["Male", "Female", "Other"];
const ID_PROOF_OPTIONS = [
  { value: "aadhaar", label: "Aadhaar" },
  { value: "pan", label: "PAN" },
];

const ToggleSwitch = ({ checked, onToggle, disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => (disabled ? null : onToggle(!checked))}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
      checked ? "toggle-gradient-on" : "bg-slate-300"
    } ${disabled ? "cursor-not-allowed opacity-60" : "focus:outline-none focus:ring-2 focus:ring-indigo-300"}`}
    disabled={disabled}
  >
    <span
      className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
        checked ? "translate-x-5" : "translate-x-1"
      }`}
    />
  </button>
);

function StudentModal({ open, onClose, onSubmit, student, plans, seats }) {
  const api = useMemo(() => createApiClient(), []);
  const isEdit = Boolean(student);
  const [form, setForm] = useState(() => ({
    name: student?.name ?? "",
    phone: student?.phone ?? "",
    email: student?.email ?? "",
    gender: student?.gender ?? "",
    address: student?.address ?? "",
    state: student?.state ?? "",
    pincode: student?.pincode ?? "",
    id_proof_type: "aadhaar",
    id_proof_file: null,
    fee_plan_type: student?.fee_plan_type ?? "monthly",
    fee_cycle: student?.fee_cycle ?? "calendar",
    limited_days: student?.limited_days ?? "",
    registration_paid: student?.registration_paid ?? false,
    join_date: student?.join_date ?? new Date().toISOString().slice(0, 10),
    current_plan_id: student?.current_plan_id ?? "",
    renewal_date: student?.renewal_date ?? "",
    is_active: student?.is_active ?? true,
    initialPayment: {
      enabled: false,
      plan_id: student?.current_plan_id ?? plans?.[0]?.id ?? "",
      amount_paid: "",
      payment_mode: "upi",
      valid_from: new Date().toISOString().slice(0, 10),
      valid_until: new Date().toISOString().slice(0, 10),
      includes_registration: false,
      notes: "",
    },
  }));
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const assignedSeat = useMemo(
    () => seats.find((seat) => seat.id === student?.current_seat_id),
    [seats, student?.current_seat_id]
  );

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      if (!open || !student?.id) {
        if (active) {
          setHistory([]);
          setHistoryLoading(false);
        }
        return;
      }
      setHistoryLoading(true);
      try {
        const data = await api.getStudentHistory(student.id);
        if (!active) return;
        setHistory(data ?? []);
      } catch (error) {
        if (!active) return;
        console.warn("Student history load failed", error.message);
        setHistory([]);
      }
      setHistoryLoading(false);
    }
    loadHistory();
    return () => {
      active = false;
    };
  }, [api, open, student?.id]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    let nextValue = type === "checkbox" ? checked : value;
    setForm((prev) => ({
      ...prev,
      [name]: nextValue,
    }));
  };

  const feeSummary =
    form.fee_plan_type === "limited"
      ? `${form.limited_days || "—"} days`
      : form.fee_plan_type === "rolling" || form.fee_cycle === "rolling"
      ? "Rolling 30 days"
      : "Calendar month";

  const uploadIdProofFile = async (file, existingPath = null, proofType = "aadhaar") => {
    if (!file) return existingPath;
    const upload = await api.uploadStudentProof(file, proofType);
    return upload?.path ?? existingPath;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const phoneDigits = form.phone.replace(/\D/g, "");
    const phoneRegex = /^\d{10}$/;
    const emailRegex = /.+@.+\..+/;
    const pincodeRegex = /^\d{6}$/;

    if (!form.name.trim()) {
      alert("Name is required.");
      return;
    }
    if (!phoneRegex.test(phoneDigits)) {
      alert("Phone must be a 10 digit number.");
      return;
    }
    if (form.email && !emailRegex.test(form.email.trim())) {
      alert("Enter a valid email address.");
      return;
    }
    if (!form.gender) {
      alert("Gender selection is required.");
      return;
    }
    if (!form.address.trim()) {
      alert("Address is required.");
      return;
    }
    if (!form.state.trim()) {
      alert("State is required.");
      return;
    }
    if (!pincodeRegex.test(form.pincode.trim())) {
      alert("Pincode must be a 6 digit number.");
      return;
    }

    const existingIdProofPath = student?.photo_url ?? null;
    if (!existingIdProofPath && !form.id_proof_file) {
      alert("Please upload an ID proof file.");
      return;
    }
    if (form.id_proof_file) {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowedTypes.includes(form.id_proof_file.type)) {
        alert("ID proof must be JPG, PNG, WEBP, or PDF.");
        return;
      }
      const maxSizeMb = 2;
      if (form.id_proof_file.size > maxSizeMb * 1024 * 1024) {
        alert(`ID proof must be under ${maxSizeMb} MB.`);
        return;
      }
    }

    let proofPath = existingIdProofPath;
    if (form.id_proof_file) {
      try {
        proofPath = await uploadIdProofFile(
          form.id_proof_file,
          student?.photo_url,
          form.id_proof_type
        );
      } catch (uploadErr) {
        alert(uploadErr?.message ?? "Failed to upload ID proof.");
        return;
      }
    }

    const payload = {
      name: form.name.trim(),
      phone: phoneDigits,
      email: form.email.trim() || null,
      gender: form.gender,
      address: form.address.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      fee_plan_type: form.fee_plan_type,
      fee_cycle: form.fee_cycle,
      limited_days:
        form.fee_plan_type === "limited"
          ? Number(form.limited_days) || null
          : null,
      registration_paid: form.registration_paid,
      join_date: form.join_date,
      photo_url: proofPath,
      initialPayment: form.initialPayment,
    };

    if (isEdit) {
      payload.current_plan_id = form.current_plan_id || null;
      payload.renewal_date = form.renewal_date || null;
      payload.is_active = form.is_active;
    }

    onSubmit(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "View / Edit Student" : "Create New Student"}
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Full Name
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="Enter full name"
              required
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Mobile Number
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="Contact number"
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Email
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="Email address"
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Gender
            <ThemeSelect
              name="gender"
              value={form.gender}
              onChange={handleChange}
              className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              required
            >
              <option value="">Select</option>
              {GENDERS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </ThemeSelect>
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700 md:col-span-2">
            Address
            <textarea
              name="address"
              value={form.address}
              onChange={handleChange}
              rows={3}
              className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="Flat / Street / Landmark"
              required
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700">
            State
            <input
              name="state"
              value={form.state}
              onChange={handleChange}
              className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="State"
              required
            />
          </label>
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Pincode
            <input
              name="pincode"
              value={form.pincode}
              onChange={handleChange}
              className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="6-digit pin"
              maxLength={10}
              required
            />
          </label>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col text-sm font-medium text-slate-700">
              ID Proof Type
              <ThemeSelect
                name="id_proof_type"
                value={form.id_proof_type}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                {ID_PROOF_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </ThemeSelect>
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Upload ID Proof (JPG/PNG/PDF)
              <div className="mt-1">
                <label className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300">
                  <LucideIcon name="Upload" className="h-4 w-4" />
                  <span className="flex-1 truncate text-left">
                    {form.id_proof_file ? form.id_proof_file.name : "Choose file"}
                  </span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      setForm((prev) => ({
                        ...prev,
                        id_proof_file: file || null,
                      }));
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </label>
          </div>
          {form.id_proof_file ? (
            <div className="relative rounded-xl border border-slate-200 bg-white p-3">
              {form.id_proof_file.type.startsWith("image/") ? (
                <img
                  src={URL.createObjectURL(form.id_proof_file)}
                  alt="ID proof preview"
                  className="h-40 w-full rounded-lg object-cover"
                />
              ) : (
                <p className="text-sm text-slate-600">
                  {form.id_proof_file.name} ready to upload.
                </p>
              )}
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, id_proof_file: null }))}
                className="absolute top-3 right-3 rounded-full bg-red-500 p-1 text-white hover:bg-red-600 transition"
                aria-label="Remove file"
              >
                <LucideIcon name="X" className="h-4 w-4" />
              </button>
            </div>
          ) : student?.photo_url ? (
            <p className="text-xs text-slate-500">
              Existing ID proof on file. Upload a new file to replace it.
            </p>
          ) : null}
          <p className="text-xs text-slate-500">
            Upload clear scans under 500KB. Accepted formats: JPG, PNG,PDF.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
          <p className="text-sm font-semibold text-slate-700">Fee Structure</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Plan Type
              <ThemeSelect
                name="fee_plan_type"
                value={form.fee_plan_type}
                onChange={handleChange}
                className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                {FEE_PLAN_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </ThemeSelect>
            </label>
            {form.fee_plan_type === "limited" ? (
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Number of Days
                <input
                  name="limited_days"
                  type="number"
                  min="1"
                  value={form.limited_days}
                  onChange={handleChange}
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="e.g. 15"
                />
              </label>
            ) : null}
            <label className="flex items-center justify-between rounded-xl border border-white/60 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
              <span>Registration fee received</span>
              <ToggleSwitch
                checked={form.registration_paid}
                onToggle={(next) =>
                  handleChange({
                    target: {
                      name: "registration_paid",
                      type: "checkbox",
                      checked: next,
                    },
                  })
                }
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Summary: {feeSummary}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">
              Initial Payment (optional)
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span>Enable</span>
              <ToggleSwitch
                checked={form.initialPayment.enabled}
                onToggle={(next) =>
                  setForm((prev) => ({
                    ...prev,
                    initialPayment: {
                      ...prev.initialPayment,
                      enabled: next,
                    },
                  }))
                }
              />
            </div>
          </div>
          {form.initialPayment.enabled ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Plan
                <ThemeSelect
                  name="plan_id"
                  value={form.initialPayment.plan_id}
                  onChange={(event) => {
                    const nextPlanId = event.target.value;
                    setForm((prev) => {
                      const selectedPlan = plans.find(
                        (plan) => plan.id === nextPlanId
                      );
                      const nextValidUntil =
                        selectedPlan && prev.initialPayment.valid_from
                          ? new Date(
                              Date.parse(prev.initialPayment.valid_from) +
                                selectedPlan.duration_days * 86400000
                            )
                              .toISOString()
                              .slice(0, 10)
                          : prev.initialPayment.valid_until;
                      return {
                        ...prev,
                        initialPayment: {
                          ...prev.initialPayment,
                          plan_id: nextPlanId,
                          amount_paid:
                            selectedPlan?.price ?? prev.initialPayment.amount_paid,
                          valid_until: nextValidUntil,
                        },
                      };
                    });
                  }}
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">Select plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} — ₹{plan.price?.toLocaleString("en-IN")}
                    </option>
                  ))}
                </ThemeSelect>
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Amount (₹)
                <input
                  name="amount_paid"
                  type="number"
                  value={form.initialPayment.amount_paid}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      initialPayment: {
                        ...prev.initialPayment,
                        amount_paid: event.target.value,
                      },
                    }))
                  }
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  min="0"
                />
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Paid Via
                <ThemeSelect
                  name="payment_mode"
                  value={form.initialPayment.payment_mode}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      initialPayment: {
                        ...prev.initialPayment,
                        payment_mode: event.target.value,
                      },
                    }))
                  }
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="upi">UPI / Online</option>
                  <option value="cash">Cash</option>
                </ThemeSelect>
              </label>
                <label className="flex flex-col text-sm font-medium text-slate-700">
                  Valid From
                  <input
                    type="date"
                    value={form.initialPayment.valid_from}
                    readOnly
                    className="mt-1 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 outline-none"
                  />
                </label>
              <label className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 md:col-span-2">
                <span>Include registration fees</span>
                <ToggleSwitch
                  checked={form.initialPayment.includes_registration}
                  onToggle={(next) =>
                    setForm((prev) => ({
                      ...prev,
                      initialPayment: {
                        ...prev.initialPayment,
                        includes_registration: next,
                      },
                    }))
                  }
                />
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700 md:col-span-2">
                Notes (optional)
                <textarea
                  value={form.initialPayment.notes}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      initialPayment: {
                        ...prev.initialPayment,
                        notes: event.target.value,
                      },
                    }))
                  }
                  rows={2}
                  className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Payment comments"
                />
              </label>
            </div>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col text-sm font-medium text-slate-700">
            Join Date
            <input
              name="join_date"
              type="date"
              value={form.join_date}
              onChange={handleChange}
              className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          {isEdit && (
            <>
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Current Plan
                <ThemeSelect
                  name="current_plan_id"
                  value={form.current_plan_id || ""}
                  onChange={handleChange}
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">Not Assigned</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </ThemeSelect>
              </label>

              <label className="flex flex-col text-sm font-medium text-slate-700">
                Renewal Date
                <input
                  name="renewal_date"
                  type="date"
                  value={form.renewal_date || ""}
                  onChange={handleChange}
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <label className="flex flex-col text-sm font-medium text-slate-700">
                Status
                <div className="mt-2 flex items-center gap-3">
                  <ToggleSwitch
                    checked={form.is_active}
                    onToggle={(next) =>
                      handleChange({
                        target: {
                          name: "is_active",
                          type: "checkbox",
                          checked: next,
                        },
                      })
                    }
                  />
                  <span>{form.is_active ? "Active" : "Inactive"}</span>
                </div>
              </label>

              <div className="flex flex-col text-sm font-medium text-slate-700">
                Assigned Seat
                <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {assignedSeat ? assignedSeat.seat_number : "No seat assigned"}
                </div>
              </div>
            </>
          )}
        </div>

        {isEdit ? (
          <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LucideIcon name="history" className="h-4 w-4 text-indigo-500" />
                <p className="text-sm font-semibold text-slate-800">Recent activity</p>
              </div>
              {historyLoading ? (
                <span className="text-xs text-slate-500">Loading…</span>
              ) : null}
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {historyLoading ? null : history.length === 0 ? (
                <p className="text-xs text-slate-500">No activity logged yet.</p>
              ) : (
                history.map((entry) => {
                  const when = entry.created_at
                    ? new Date(entry.created_at).toLocaleString()
                    : "";
                  const meta = entry.metadata || {};
                  const metaPreview =
                    Object.entries(meta)
                      .slice(0, 2)
                      .map(([key, value]) => `${key}: ${String(value)}`)
                      .join(" • ") || null;
                  return (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs text-slate-700"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold capitalize">{entry.action}</span>
                        <span className="text-[11px] text-slate-500">{when}</span>
                      </div>
                      {entry.actor_role || entry.actor_id ? (
                        <p className="text-[11px] text-slate-500">
                          {entry.actor_role ? `${entry.actor_role}` : "User"} {entry.actor_id ?? ""}
                        </p>
                      ) : null}
                      {metaPreview ? (
                        <p className="text-[11px] text-slate-500">{metaPreview}</p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        <div className="flex justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-xs text-slate-500">
            <LucideIcon name="shield" className="h-4 w-4 text-indigo-500" />
            Aadhaar and KYC are stored securely for desk verification.
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-gradient-primary rounded-xl px-4 py-2 text-sm font-semibold"
            >
              {isEdit ? "Save Changes" : "Create Student"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default StudentModal;
   
