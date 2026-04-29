import React from "react";
import { toast } from "react-toastify";

const TOAST_METHODS = {
  success: toast.success,
  error: toast.error,
  warning: toast.warn,
  info: toast.info,
};

const ROLE_LABELS = {
  admin: "Admin",
  coordinator: "Coordinator",
  student: "User",
  user: "User",
};

const buildToastIcon = (tone) =>
  React.createElement("span", {
    "aria-hidden": "true",
    className: `app-toast__icon app-toast__icon--${tone}`,
  });

const buildToastOptions = (tone, overrides = {}) => ({
  position: "top-right",
  autoClose: tone === "error" ? 4200 : tone === "warning" ? 3600 : 2600,
  icon: buildToastIcon(tone),
  className: `app-toast app-toast--${tone}`,
  bodyClassName: "app-toast__body",
  progressClassName: `app-toast__progress app-toast__progress--${tone}`,
  ...overrides,
});

export const APP_TOAST_CONTAINER_PROPS = {
  position: "top-right",
  autoClose: 3200,
  newestOnTop: true,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  hideProgressBar: false,
  closeButton: false,
  limit: 4,
};

export function showAppToast(message, tone = "success", overrides = {}) {
  const method = TOAST_METHODS[tone] ?? toast.success;
  return method(message, buildToastOptions(tone, overrides));
}

export function showLoginToast(role = "user") {
  const label = ROLE_LABELS[role] ?? ROLE_LABELS.user;
  return showAppToast(`Signed in as ${label}.`, "success");
}

export function showLogoutToast(role = "user") {
  const label = ROLE_LABELS[role] ?? ROLE_LABELS.user;
  return showAppToast(`${label} logged out successfully.`, "info", {
    autoClose: 1800,
  });
}
