export function parseJson(value, fallback = null) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  return value === 1 || value === "1";
}

export function toDateString(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}
