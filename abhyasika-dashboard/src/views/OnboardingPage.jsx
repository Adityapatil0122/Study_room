import React, { useMemo, useState } from "react";
import ThemeSelect from "../components/common/ThemeSelect.jsx";
import LucideIcon from "../components/icons/LucideIcon.jsx";
import { createApiClient } from "../lib/apiClient.js";

const SHIFT_OPTIONS = ["Morning", "Afternoon", "Evening", "Day"];
const PLAN_TYPES = [
  { value: "monthly", label: "Monthly Membership" },
  { value: "limited", label: "Limited Days" },
];
const BILLING_CYCLES = [
  { value: "calendar", label: "1st - 30th" },
  { value: "rolling", label: "Rolling 30 days" },
];

function OnboardingPage() {
  const api = useMemo(() => createApiClient(), []);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ tone: "", message: "" });
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    gender: "",
    aadhaar: "",
    pan: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    attachPhoto: false,
    photoFile: null,
    preferredShift: "Morning",
    planType: "monthly",
    limitedDays: "",
    billingCycle: "calendar",
    registrationPaid: false,
    joinDate: new Date().toISOString().slice(0, 10),
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggle = (name) => {
    setForm((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0] ?? null;
    setForm((prev) => ({ ...prev, photoFile: file }));
  };

  const phoneDigits = form.phone.replace(/\D/g, "");
  const aadhaarDigits = form.aadhaar.replace(/\D/g, "");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ tone: "", message: "" });

    const emailRegex = /.+@.+\..+/;
    const panRegex = /^[A-Z]{5}\d{4}[A-Z]$/;
    const pincodeRegex = /^\d{6}$/;

    if (!form.name.trim()) {
      setStatus({ tone: "error", message: "Full name is required." });
      return;
    }
    if (phoneDigits.length !== 10) {
      setStatus({ tone: "error", message: "Phone number must be 10 digits." });
      return;
    }
    if (form.email && !emailRegex.test(form.email.trim())) {
      setStatus({ tone: "error", message: "Enter a valid email address." });
      return;
    }
    if (!form.gender) {
      setStatus({ tone: "error", message: "Please select a gender." });
      return;
    }
    if (aadhaarDigits.length !== 12) {
      setStatus({ tone: "error", message: "Aadhaar number must be 12 digits." });
      return;
    }
    if (!panRegex.test(form.pan.trim().toUpperCase())) {
      setStatus({
        tone: "error",
        message: "PAN must follow the format ABCDE1234F.",
      });
      return;
    }
    if (!form.address.trim() || !form.city.trim() || !form.state.trim()) {
      setStatus({
        tone: "error",
        message: "Address, city, and state are required.",
      });
      return;
    }
    if (!pincodeRegex.test(form.pincode.trim())) {
      setStatus({ tone: "error", message: "Pincode must be 6 digits." });
      return;
    }
    if (!form.joinDate) {
      setStatus({ tone: "error", message: "Please select a joining date." });
      return;
    }
    if (form.attachPhoto) {
      if (!form.photoFile) {
        setStatus({ tone: "error", message: "Attach an Aadhaar photo." });
        return;
      }
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(form.photoFile.type)) {
        setStatus({
          tone: "error",
          message: "Photo must be JPEG, PNG, or WEBP.",
        });
        return;
      }
      if (form.photoFile.size > 2 * 1024 * 1024) {
        setStatus({
          tone: "error",
          message: "Photo must be under 2 MB.",
        });
        return;
      }
    }

    try {
      setSubmitting(true);
      await api.createStudent({
        name: form.name.trim(),
        phone: phoneDigits,
        email: form.email.trim(),
        gender: form.gender,
        aadhaar: aadhaarDigits,
        pan_card: form.pan.trim().toUpperCase(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        preferred_shift: form.preferredShift,
        fee_plan_type: form.planType,
        fee_cycle: form.billingCycle,
        limited_days:
          form.planType === "limited" ? Number(form.limitedDays) || null : null,
        registration_paid: form.registrationPaid,
        join_date: form.joinDate,
        registration_source: "qr_self",
        registered_by_role: "Self",
      });
      setStatus({
        tone: "success",
        message: "Thanks! Your enrollment has been submitted.",
      });
      setForm((prev) => ({
        ...prev,
        name: "",
        phone: "",
        email: "",
        gender: "",
        aadhaar: "",
        pan: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        attachPhoto: false,
        photoFile: null,
        preferredShift: "Morning",
        planType: "monthly",
        limitedDays: "",
        billingCycle: "calendar",
        registrationPaid: false,
        joinDate: new Date().toISOString().slice(0, 10),
      }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setStatus({
        tone: "error",
        message: err.message ?? "Unable to submit enrollment.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-slate-50 px-4 py-10 sm:px-6 lg:px-0">
      <div className="mx-auto w-full max-w-4xl rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-xl shadow-indigo-100">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">
            Abhyasika Enrollment
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">
            Create New Student
          </h1>
          <p className="text-sm text-slate-500">
            Please fill in your details. We’ll confirm your seat and plan shortly.
          </p>
        </div>

        {status.message ? (
          <div
            className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
              status.tone === "success"
                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                : "border-rose-100 bg-rose-50 text-rose-700"
            }`}
          >
            {status.message}
          </div>
        ) : null}

        <form className="mt-8 space-y-8" onSubmit={handleSubmit}>
          <section className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                <LucideIcon name="userPlus" className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  Student Details
                </p>
                <p className="text-sm text-slate-500">
                  Basic contact and identity information.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Full Name
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Phone Number
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="9876543210"
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Email
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Email address"
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Gender
                <ThemeSelect
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </ThemeSelect>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Aadhaar Number
                <input
                  name="aadhaar"
                  value={form.aadhaar}
                  onChange={handleChange}
                  placeholder="1234 5678 9012"
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700">
                PAN Card Number
                <input
                  name="pan"
                  value={form.pan}
                  onChange={handleChange}
                  placeholder="ABCDE1234F"
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 uppercase"
                />
              </label>
            </div>

            <label className="flex flex-col text-sm font-medium text-slate-700">
              Address
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Flat / Street / Landmark"
                className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col text-sm font-medium text-slate-700">
                City
                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="City"
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700">
                State
                <input
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  placeholder="State"
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Pincode
                <input
                  name="pincode"
                  value={form.pincode}
                  onChange={handleChange}
                  placeholder="6-digit pin"
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
            </div>
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Joining Date
              <input
                type="date"
                name="joinDate"
                value={form.joinDate}
                onChange={handleChange}
                className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-4">
              <label className="flex items-center justify-between text-sm font-semibold text-slate-700">
                Attach Aadhaar photo (JPEG/PNG/WEBP, under 2 MB)
                <button
                  type="button"
                  onClick={() => handleToggle("attachPhoto")}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    form.attachPhoto ? "toggle-gradient-on" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      form.attachPhoto ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
              {form.attachPhoto ? (
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFile}
                  className="mt-3 text-sm text-slate-600"
                />
              ) : null}
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <LucideIcon name="calendarCheck" className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  Schedule 
                </p>
                <p className="text-sm text-slate-500">
                  Pick your preferred shift and billing cycle.
                </p>
              </div>
            </div>

            <label className="flex flex-col text-sm font-medium text-slate-700">
              Preferred Shift
              <ThemeSelect
                name="preferredShift"
                value={form.preferredShift}
                onChange={handleChange}
                className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                {SHIFT_OPTIONS.map((shift) => (
                  <option key={shift} value={shift}>
                    {shift}
                  </option>
                ))}
              </ThemeSelect>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Plan Type
                <ThemeSelect
                  name="planType"
                  value={form.planType}
                  onChange={handleChange}
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  {PLAN_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </ThemeSelect>
              </label>

              <label className="flex flex-col text-sm font-medium text-slate-700">
                Billing Cycle
                <ThemeSelect
                  name="billingCycle"
                  value={form.billingCycle}
                  onChange={handleChange}
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  {BILLING_CYCLES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </ThemeSelect>
              </label>
            </div>

            {form.planType === "limited" ? (
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Limited Plan Duration (days)
                <input
                  name="limitedDays"
                  value={form.limitedDays}
                  onChange={handleChange}
                  placeholder="15"
                  className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
            ) : null}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Aadhaar & personal data are used only for verification and
              onboarding.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="btn-gradient-primary inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold"
            >
              {submitting ? (
                <>
                  <LucideIcon name="loader" className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <LucideIcon name="send" className="h-4 w-4" />
                  Submit Enrollment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default OnboardingPage;
