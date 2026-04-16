import { clearStoredSession, getStoredSession } from "./sessionStorage.js";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:4000/api";

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
    throw new Error(
      payload?.error?.message ?? payload?.message ?? "Request failed"
    );
  }

  return payload?.data;
}

const withParams = (path, params) => {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
};

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

    async createRole(payload) {
      return request("/admin/roles", {
        method: "POST",
        body: payload,
      });
    },

    async deleteRole(id, audit) {
      return request(`/admin/roles/${id}`, {
        method: "DELETE",
        body: audit ? { audit } : undefined,
      });
    },

    async createTeamMember(payload) {
      return request("/admin/team-members/manual", {
        method: "POST",
        body: payload,
      });
    },

    async inviteTeamMember(payload) {
      return request("/admin/team-members/invite", {
        method: "POST",
        body: payload,
      });
    },

    async listPlans() {
      return request("/plans");
    },

    async createPlan(payload) {
      return request("/plans", {
        method: "POST",
        body: payload,
      });
    },

    async updatePlan(id, updates) {
      return request(`/plans/${id}`, {
        method: "PUT",
        body: updates,
      });
    },

    async deletePlan(id, audit) {
      return request(`/plans/${id}`, {
        method: "DELETE",
        body: audit ? { audit } : undefined,
      });
    },

    async listStudents(filters = {}) {
      return request(
        withParams("/students", {
          search: filters.search,
          is_active:
            typeof filters.isActive === "boolean" ? filters.isActive : undefined,
        })
      );
    },

    async createStudent(payload) {
      return request("/students", {
        method: "POST",
        body: payload,
      });
    },

    async updateStudent(id, updates) {
      return request(`/students/${id}`, {
        method: "PUT",
        body: updates,
      });
    },

    async toggleStudentActive(id, audit) {
      return request(`/students/${id}/toggle-active`, {
        method: "PATCH",
        body: audit ? { audit } : undefined,
      });
    },

    async getStudentHistory(id) {
      return request(`/students/${id}/history`);
    },

    async listSeats() {
      return request("/seats");
    },

    async createSeat(payload) {
      return request("/seats", {
        method: "POST",
        body: payload,
      });
    },

    async assignSeat(payload) {
      return request(`/seats/${payload.seatId}/assign`, {
        method: "POST",
        body: {
          studentId: payload.studentId,
          audit: payload.audit,
        },
      });
    },

    async deallocateSeat(payload) {
      const seatId = payload?.seatId ?? payload;
      return request(`/seats/${seatId}/deallocate`, {
        method: "POST",
        body: payload?.audit ? { audit: payload.audit } : undefined,
      });
    },

    async listPayments(filters = {}) {
      return request(
        withParams("/payments", {
          limit: filters.limit,
          startDate: filters.startDate,
          endDate: filters.endDate,
        })
      );
    },

    async createPayment(payload) {
      return request("/payments", {
        method: "POST",
        body: payload,
      });
    },

    async listExpenses() {
      return request("/expenses");
    },

    async createExpense(payload) {
      return request("/expenses", {
        method: "POST",
        body: payload,
      });
    },

    async listExpenseCategories() {
      return request("/expenses/categories");
    },

    async createExpenseCategory(payload) {
      return request("/expenses/categories", {
        method: "POST",
        body: payload,
      });
    },

    async deleteExpenseCategory(id, audit) {
      return request(`/expenses/categories/${id}`, {
        method: "DELETE",
        body: audit ? { audit } : undefined,
      });
    },

    async getSettings() {
      return request("/settings");
    },

    async updateSettings(preferences) {
      return request("/settings", {
        method: "PUT",
        body: { preferences },
      });
    },

    async listHistory({ objectType, limit } = {}) {
      return request(
        withParams("/history", {
          object_type: objectType,
          limit,
        })
      );
    },

    async importStudents(rows, audit) {
      return request("/students/import", {
        method: "POST",
        body: { rows, audit },
      });
    },

    async importPayments(rows, audit) {
      return request("/payments/import", {
        method: "POST",
        body: { rows, audit },
      });
    },

    async importExpenses(rows, audit) {
      return request("/expenses/import", {
        method: "POST",
        body: { rows, audit },
      });
    },

    async recordImportLog(entry) {
      return request("/imports/logs", {
        method: "POST",
        body: entry,
      });
    },

    // ---------- Student-facing endpoints ----------
    async studentRegister(payload) {
      const data = await request("/student-auth/register", {
        method: "POST",
        body: payload,
        auth: false,
      });
      return data?.session ?? null;
    },

    async studentLogin(email, password) {
      const data = await request("/student-auth/login", {
        method: "POST",
        body: { email, password },
        auth: false,
      });
      return data?.session ?? null;
    },

    async getStudentSession() {
      const data = await request("/student-auth/me");
      return data?.session ?? null;
    },

    async getStudentProfile() {
      return request("/student/profile");
    },

    async updateStudentProfile(updates) {
      return request("/student/profile", {
        method: "PUT",
        body: updates,
      });
    },

    async listStudentPlans() {
      return request("/student/plans");
    },

    async getStudentSubscription() {
      return request("/student/subscription");
    },

    async listMyPayments() {
      return request("/student/payments");
    },

    async createPaymentOrder(payload) {
      return request("/student/payments/create-order", {
        method: "POST",
        body: payload,
      });
    },

    async verifyPayment(payload) {
      return request("/student/payments/verify", {
        method: "POST",
        body: payload,
      });
    },

    async requestQrPayment(payload) {
      return request("/student/payments/request-qr", {
        method: "POST",
        body: payload,
      });
    },

    async listAvailableSeats() {
      return request("/student/seats");
    },

    async selectSeat(seatId) {
      return request("/student/seats/select", {
        method: "POST",
        body: { seat_id: seatId },
      });
    },
  };
}
