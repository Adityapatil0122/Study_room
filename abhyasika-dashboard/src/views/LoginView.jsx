import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import LucideIcon from "../components/icons/LucideIcon.jsx";
import LoadingState from "../components/common/LoadingState.jsx";

const SHIFTS = ["Morning", "Afternoon", "Evening", "Day"];
const GENDERS = ["Male", "Female", "Other"];

const initialRegisterForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  phone: "",
  gender: "",
  preferred_shift: "Morning",
  deposit_amount: "",
};

function LoginView() {
  const {
    api,
    unifiedLogin,
    studentRegister,
    authLoading,
    authError,
    authInitializing,
    clearAuthError,
  } = useAuth();
  const [mode, setMode] = useState("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");
  const [aadhaarFile, setAadhaarFile] = useState(null);
  const [uploadedAadhaar, setUploadedAadhaar] = useState(null);
  const [uploadingAadhaar, setUploadingAadhaar] = useState(false);

  const resetErrors = () => {
    setLocalError("");
    clearAuthError?.();
  };

  const switchMode = (nextMode) => {
    resetErrors();
    setMode(nextMode);
  };

  const handleLoginChange = (event) => {
    const { name, value } = event.target;
    setLoginForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegisterChange = (event) => {
    const { name, value } = event.target;
    setRegisterForm((prev) => ({ ...prev, [name]: value }));
  };

  const setRegisterValue = (key, value) => {
    setRegisterForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    resetErrors();

    if (!loginForm.email.trim() || !loginForm.password) {
      setLocalError("Email and password are required.");
      return;
    }

    try {
      await unifiedLogin(loginForm.email.trim(), loginForm.password);
    } catch (loginError) {
      setLocalError(loginError.message);
    }
  };

  const uploadAadhaar = async () => {
    if (!aadhaarFile) return null;
    setUploadingAadhaar(true);
    try {
      const data = await api.uploadAadhaarFile(aadhaarFile);
      setUploadedAadhaar(data);
      return data;
    } catch (err) {
      setLocalError(err?.message ?? "Could not upload Aadhaar file.");
      return null;
    } finally {
      setUploadingAadhaar(false);
    }
  };

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    resetErrors();

    if (!registerForm.name.trim()) {
      setLocalError("Full name is required.");
      return;
    }
    if (!/.+@.+\..+/.test(registerForm.email.trim())) {
      setLocalError("Please enter a valid email.");
      return;
    }
    if (registerForm.password.length < 6) {
      setLocalError("Password must be at least 6 characters.");
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    const phoneDigits = registerForm.phone.replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      setLocalError("Phone must be 10 digits.");
      return;
    }
    if (!registerForm.gender) {
      setLocalError("Please select a gender.");
      return;
    }

    let aadhaarData = uploadedAadhaar;
    if (aadhaarFile && !uploadedAadhaar) {
      aadhaarData = await uploadAadhaar();
      if (!aadhaarData) return;
    }

    try {
      await studentRegister({
        name: registerForm.name.trim(),
        email: registerForm.email.trim().toLowerCase(),
        password: registerForm.password,
        phone: phoneDigits,
        gender: registerForm.gender,
        preferred_shift: registerForm.preferred_shift,
        deposit_amount: Number(registerForm.deposit_amount) || 0,
        aadhaar_file_url: aadhaarData?.url ?? null,
        aadhaar_file_type: aadhaarData?.mimeType ?? null,
        registration_source: "student_app",
      });
    } catch (registerError) {
      setLocalError(registerError.message);
    }
  };

  if (authInitializing) {
    return <LoadingState message="Checking session..." />;
  }

  const visibleError = localError || authError;

  return (
    <div className="min-h-screen overflow-y-auto bg-white px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div
        className={`mx-auto flex min-h-[calc(100vh-4rem)] w-full items-center justify-center ${
          mode === "login" ? "max-w-md" : "max-w-2xl"
        }`}
      >
        <section className="w-full">
          {mode === "login" ? (
            <div className="mb-8 flex flex-col items-center text-center">
              <img
                src="/images/logo.png"
                alt="Aardhya Abhyasika"
                className="h-24 w-24 object-contain"
              />
              <h1 className="mt-5 text-2xl font-semibold leading-tight text-slate-900">
                Welcome to Aardhya Abhyasika
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Admin, coordinator, and student sign in
              </p>
            </div>
          ) : null}

            {mode === "login" ? (
              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <Field label="Email">
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={loginForm.email}
                    onChange={handleLoginChange}
                    required
                    className="auth-input"
                    placeholder="you@example.com"
                  />
                </Field>

                <Field label="Password">
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={loginForm.password}
                      onChange={handleLoginChange}
                      required
                      className="auth-input pr-20"
                      placeholder="........"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute inset-y-0 right-4 text-sm font-semibold text-indigo-600"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </Field>

                <ErrorMessage message={visibleError} />

                <button
                  type="submit"
                  disabled={authLoading}
                  className="btn-gradient-primary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:bg-none disabled:bg-indigo-300"
                >
                  {authLoading ? (
                    <>
                      <LucideIcon name="loader2" className="h-5 w-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className="w-full text-center text-sm text-slate-500"
                >
                  New student?{" "}
                  <span className="font-semibold text-indigo-600">
                    Create an account
                  </span>
                </button>
                <p className="text-center text-xs text-slate-400">
                  Coordinators get limited payment and renewal tools.
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-5">
                <div>
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600"
                  >
                    <LucideIcon name="arrowLeft" className="h-4 w-4" />
                    Back to sign in
                  </button>
                  <img
                    src="/images/logo.png"
                    alt="Aardhya Abhyasika"
                    className="h-20 w-20 object-contain"
                  />
                  <h2 className="mt-4 text-2xl font-semibold text-slate-900">
                    Create account
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Register yourself to get started.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full Name">
                    <input
                      name="name"
                      value={registerForm.name}
                      onChange={handleRegisterChange}
                      className="auth-input"
                      placeholder="John Doe"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      name="email"
                      type="email"
                      value={registerForm.email}
                      onChange={handleRegisterChange}
                      className="auth-input"
                      placeholder="you@example.com"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Phone Number">
                    <input
                      name="phone"
                      inputMode="numeric"
                      maxLength={10}
                      value={registerForm.phone}
                      onChange={handleRegisterChange}
                      className="auth-input"
                      placeholder="9876543210"
                    />
                  </Field>
                  <Field label="Deposit Amount (Rs) - optional">
                    <input
                      name="deposit_amount"
                      inputMode="numeric"
                      value={registerForm.deposit_amount}
                      onChange={handleRegisterChange}
                      className="auth-input"
                      placeholder="0"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Password">
                    <input
                      name="password"
                      type="password"
                      value={registerForm.password}
                      onChange={handleRegisterChange}
                      className="auth-input"
                      placeholder="At least 6 characters"
                    />
                  </Field>
                  <Field label="Confirm Password">
                    <input
                      name="confirmPassword"
                      type="password"
                      value={registerForm.confirmPassword}
                      onChange={handleRegisterChange}
                      className="auth-input"
                      placeholder="Re-enter password"
                    />
                  </Field>
                </div>

                <Field label="Gender">
                  <div className="flex flex-wrap gap-2">
                    {GENDERS.map((gender) => (
                      <Chip
                        key={gender}
                        selected={registerForm.gender === gender}
                        onClick={() => setRegisterValue("gender", gender)}
                      >
                        {gender}
                      </Chip>
                    ))}
                  </div>
                </Field>

                <Field label="Preferred Shift">
                  <div className="flex flex-wrap gap-2">
                    {SHIFTS.map((shift) => (
                      <Chip
                        key={shift}
                        selected={registerForm.preferred_shift === shift}
                        onClick={() => setRegisterValue("preferred_shift", shift)}
                      >
                        {shift}
                      </Chip>
                    ))}
                  </div>
                </Field>

                <Field label="Aadhaar Card - optional">
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(event) => {
                        setAadhaarFile(event.target.files?.[0] ?? null);
                        setUploadedAadhaar(null);
                        resetErrors();
                      }}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-600"
                    />
                    {aadhaarFile ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                        <span className="min-w-0 flex-1 truncate text-slate-600">
                          {aadhaarFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={uploadAadhaar}
                          disabled={uploadingAadhaar}
                          className="btn-gradient-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:bg-none disabled:bg-indigo-300"
                        >
                          {uploadingAadhaar ? "Uploading..." : "Upload"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAadhaarFile(null);
                            setUploadedAadhaar(null);
                          }}
                          className="text-sm font-semibold text-red-500"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">
                        Upload a photo or PDF of your Aadhaar card.
                      </p>
                    )}
                    {uploadedAadhaar ? (
                      <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                        Aadhaar uploaded
                      </p>
                    ) : null}
                  </div>
                </Field>

                <ErrorMessage message={visibleError} />

                <button
                  type="submit"
                  disabled={authLoading || uploadingAadhaar}
                  className="btn-gradient-primary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:bg-none disabled:bg-indigo-300"
                >
                  {authLoading ? (
                    <>
                      <LucideIcon name="loader2" className="h-5 w-5 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="w-full text-center text-sm text-slate-500"
                >
                  Already registered?{" "}
                  <span className="font-semibold text-indigo-600">Sign in</span>
                </button>
              </form>
            )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Chip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
        selected
          ? "btn-gradient-primary border-indigo-600"
          : "border-slate-300 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
      }`}
    >
      {children}
    </button>
  );
}

function ErrorMessage({ message }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
      <LucideIcon name="alertCircle" className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export default LoginView;
