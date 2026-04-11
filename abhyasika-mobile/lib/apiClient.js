import { clearStoredSession, getStoredSession } from "./sessionStorage.js";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:4000/api";

async function request(path, { method = "GET", body, auth = true } = {}) {
  const session = await getStoredSession();
  const headers = {
    "Content-Type": "application/json",
  };

  if (auth && session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) {
      await clearStoredSession();
    }
    throw new Error(payload?.error?.message ?? payload?.message ?? "Request failed");
  }

  return payload?.data;
}

export function createApiClient() {
  return {
    async login(email, password) {
      const data = await request("/auth/login", {
        method: "POST",
        body: { email, password },
        auth: false,
      });
      return data?.session ?? null;
    },

    async getCurrentSession() {
      const data = await request("/auth/me");
      return data?.session ?? null;
    },

    async listRoles() {
      return request("/admin/roles");
    },

    async listStudents(filters = {}) {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (typeof filters.isActive === "boolean") {
        params.set("is_active", String(filters.isActive));
      }
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return request(`/students${suffix}`);
    },

    async listSeats() {
      return request("/seats");
    },

    async listPayments(filters = {}) {
      const params = new URLSearchParams();
      if (filters.limit) params.set("limit", String(filters.limit));
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return request(`/payments${suffix}`);
    },
  };
}
