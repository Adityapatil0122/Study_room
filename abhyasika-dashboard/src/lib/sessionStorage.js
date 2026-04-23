const STORAGE_KEY = "abhyasika-session";
const USER_TYPE_STORAGE_KEY = "abhyasika-user-type";

export function getStoredSession() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredSession(session) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(USER_TYPE_STORAGE_KEY);
}

export function getStoredUserType() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(USER_TYPE_STORAGE_KEY);
}

export function setStoredUserType(userType) {
  if (typeof window === "undefined") return;
  if (!userType) {
    window.localStorage.removeItem(USER_TYPE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(USER_TYPE_STORAGE_KEY, userType);
}
