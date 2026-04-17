import { clearStoredSession, getStoredSession } from "./sessionStorage.js";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:4000/api";

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
      return asArray(
        await request(
          withParams("/students", {
            search: filters.search,
            is_active:
              typeof filters.isActive === "boolean" ? filters.isActive : undefined,
          })
        ),
        ["students"]
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
      return asArray(await request(`/students/${id}/history`), ["history"]);
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
      return asArray(
        await request(
          withParams("/payments", {
            limit: filters.limit,
            startDate: filters.startDate,
            endDate: filters.endDate,
          })
        ),
        ["payments"]
      );
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

    async listHistory({ objectType, limit } = {}) {
      return asArray(
        await request(
          withParams("/history", {
            object_type: objectType,
            limit,
          })
        ),
        ["history"]
      );
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
      return asArray(await request("/student/plans"), ["plans"]);
    },

    async getStudentSubscription() {
      return request("/student/subscription");
    },

    async listMyPayments() {
      return asArray(await request("/student/payments"), ["payments"]);
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

    async previewQrPayment(payload) {
      return request("/student/payments/qr-preview", {
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

    // Pay an admin-scheduled request via Razorpay (create order)
    async createScheduledOrder(payload) {
      return request("/student/payments/scheduled-order", {
        method: "POST",
        body: payload,
      });
    },

    // Verify payment for an admin-scheduled request
    async verifyScheduledPayment(payload) {
      return request("/student/payments/scheduled-verify", {
        method: "POST",
        body: payload,
      });
    },

    async listPendingPayments() {
      return asArray(await request("/payments/pending"), ["payments", "pending"]);
    },

    async approvePendingPayment(id) {
      return request(`/payments/pending/${id}/approve`, {
        method: "POST",
      });
    },

    async rejectPendingPayment(id) {
      return request(`/payments/pending/${id}/reject`, {
        method: "POST",
      });
    },

    async listScheduledPaymentRequests(status) {
      const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
      return asArray(
        await request(`/payments/scheduled${suffix}`),
        ["requests", "scheduled"]
      );
    },
  };
}
