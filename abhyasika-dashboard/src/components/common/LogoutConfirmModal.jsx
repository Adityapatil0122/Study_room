import React, { useEffect } from "react";
import PhosphorIcon from "../icons/PhosphorIcon.jsx";

const ROLE_COPY = {
  admin: {
    title: "Log out as admin?",
    message: "Your dashboard session will end and you will return to sign in.",
    badge: "Admin session",
  },
  coordinator: {
    title: "Log out as coordinator?",
    message: "Your workspace session will end and you will return to sign in.",
    badge: "Coordinator session",
  },
  user: {
    title: "Log out of your account?",
    message: "Your portal session will end and you will return to sign in.",
    badge: "User session",
  },
};

function LogoutConfirmModal({ open, role = "user", onCancel, onConfirm }) {
  const copy = ROLE_COPY[role] ?? ROLE_COPY.user;

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onCancel?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-confirm-title"
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10"
      >
        <div className="h-1.5 bg-gradient-to-r from-indigo-600 via-violet-600 to-rose-500" />
        <div className="px-6 pb-5 pt-6">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
              <PhosphorIcon name="SignOut" size={24} weight="duotone" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                {copy.badge}
              </span>
              <h2
                id="logout-confirm-title"
                className="mt-3 text-xl font-semibold leading-snug text-slate-950"
              >
                {copy.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {copy.message}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500"
            >
              <PhosphorIcon name="SignOut" size={17} weight="bold" />
              Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LogoutConfirmModal;
