import { clearStoredSession, getStoredSession } from "./sessionStorage.js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

function asArray(data, keys = []) {
  if (Array.isArray(data)) {
    return data;
  }

  for (const key of keys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.rows)) {
    return data.rows;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
}

async function request(path, { method = "GET", body, isForm = false, auth = true } = {}) {
  const session = getStoredSession();
  const headers = {};

  if (!isForm) {
    headers["Content-Type"] = "application/json";
  }

  if (auth && session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : isForm
        ? body
        : JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) {
      clearStoredSession();
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
      return asArray(await request("/student/plans"), ["plans"]);
    },

    async getStudentSubscription() {
      return request("/student/subscription");
    },

    async listMyPayments() {
      return request("/student/payments");
    },

    async requestQrPayment(payload) {
      return request("/student/payments/request-qr", {
        method: "POST",
        body: payload,
      });
    },

    async createScheduledOrder(payload) {
      return request("/student/payments/scheduled-order", {
        method: "POST",
        body: payload,
      });
    },

    async verifyScheduledPayment(payload) {
      return request("/student/payments/scheduled-verify", {
        method: "POST",
        body: payload,
      });
    },

    async listAvailableSeats() {
      return asArray(await request("/student/seats"), ["seats"]);
    },

    async selectSeat(seatId) {
      return request("/student/seats/select", {
        method: "POST",
        body: { seat_id: seatId },
      });
    },

    async uploadAadhaarFile(file) {
      const formData = new FormData();
      formData.append("file", file);
      return request("/student-auth/upload-id-proof", {
        method: "POST",
        body: formData,
        isForm: true,
        auth: false,
      });
    },

    async listRoles() {
      return asArray(await request("/admin/roles"), ["roles"]);
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
      return asArray(await request("/plans"), ["plans"]);
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
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (typeof filters.isActive === "boolean") {
        params.set("is_active", String(filters.isActive));
      }
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return asArray(await request(`/students${suffix}`), ["students"]);
    },

    async createStudent(payload) {
      const session = getStoredSession();
      if (!session?.access_token) {
        return request("/public/enrollments", {
          method: "POST",
          body: payload,
          auth: false,
        });
      }

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
      return asArray(await request(`/students/${id}/history`), ["history"]);
    },

    async uploadStudentProof(file) {
      const formData = new FormData();
      formData.append("file", file);
      return request("/students/upload-id-proof", {
        method: "POST",
        body: formData,
        isForm: true,
      });
    },

    async listSeats() {
      return asArray(await request("/seats"), ["seats"]);
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
      const params = new URLSearchParams();
      if (filters.limit) params.set("limit", String(filters.limit));
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return asArray(await request(`/payments${suffix}`), ["payments"]);
    },

    async createPayment(payload) {
      return request("/payments", {
        method: "POST",
        body: payload,
      });
    },

    async listExpenses() {
      return asArray(await request("/expenses"), ["expenses"]);
    },

    async createExpense(payload) {
      return request("/expenses", {
        method: "POST",
        body: payload,
      });
    },

    async listExpenseCategories() {
      return asArray(
        await request("/expenses/categories"),
        ["categories", "expenseCategories"]
      );
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

    async uploadLogo(file) {
      const formData = new FormData();
      formData.append("file", file);
      return request("/settings/logo", {
        method: "POST",
        body: formData,
        isForm: true,
      });
    },

    async listHistory({ objectType, limit } = {}) {
      const params = new URLSearchParams();
      if (objectType) params.set("object_type", objectType);
      if (limit) params.set("limit", String(limit));
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return asArray(await request(`/history${suffix}`), ["history"]);
    },

    async importStudents(rows, audit) {
      return asArray(
        await request("/students/import", {
          method: "POST",
          body: { rows, audit },
        }),
        ["students", "inserted"]
      );
    },

    async importPayments(rows, audit) {
      return asArray(
        await request("/payments/import", {
          method: "POST",
          body: { rows, audit },
        }),
        ["payments", "inserted", "results"]
      );
    },

    async listPendingPayments() {
      return asArray(await request("/payments/pending"), ["payments", "pending"]);
    },

    async approvePendingPayment(id) {
      return request(`/payments/pending/${id}/approve`, { method: "POST" });
    },

    async rejectPendingPayment(id) {
      return request(`/payments/pending/${id}/reject`, { method: "POST" });
    },

    async listScheduledPaymentRequests(status) {
      const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
      return asArray(
        await request(`/payments/scheduled${suffix}`),
        ["requests", "scheduled"]
      );
    },

    async createScheduledPaymentRequest(payload) {
      return request("/payments/scheduled", { method: "POST", body: payload });
    },

    async cancelScheduledPaymentRequest(id) {
      return request(`/payments/scheduled/${id}`, { method: "DELETE" });
    },

    async holdStudentMembership(studentId, notes) {
      return request(`/students/${studentId}/hold`, {
        method: "POST",
        body: notes ? { notes } : {},
      });
    },

    async resumeStudentMembership(studentId, notes) {
      return request(`/students/${studentId}/resume`, {
        method: "POST",
        body: notes ? { notes } : {},
      });
    },

    async getStudentHolds(studentId) {
      return asArray(await request(`/students/${studentId}/holds`), ["holds"]);
    },

    async importExpenses(rows, audit) {
      return asArray(
        await request("/expenses/import", {
          method: "POST",
          body: { rows, audit },
        }),
        ["expenses", "inserted"]
      );
    },

    async recordImportLog(entry) {
      return request("/imports/logs", {
        method: "POST",
        body: entry,
      });
    },

    // ---------- Admin notifications (bell) ----------
    async listNotifications(limit = 50) {
      const data = await request(`/notifications?limit=${limit}`);
      return {
        notifications: asArray(data?.notifications, ["notifications"]),
        unread: Number(data?.unread ?? 0),
      };
    },

    async markNotificationRead(id) {
      return request(`/notifications/${id}/read`, { method: "POST" });
    },

    async markAllNotificationsRead() {
      return request(`/notifications/read-all`, { method: "POST" });
    },
  };
}
