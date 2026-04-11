import React, { useEffect, useMemo, useState } from "react";
import LucideIcon from "../components/icons/LucideIcon.jsx";
import { createApiClient } from "../lib/apiClient.js";

const OBJECT_LABELS = {
  students: "Students",
  payments: "Payments",
  seats: "Seats",
  expenses: "Expenses",
  expense_categories: "Expense categories",
  admin_roles: "Roles",
};

function HistoryView() {
  const api = useMemo(() => createApiClient(), []);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    object_type: "all",
    search: "",
  });

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await api.listHistory({
          objectType: filters.object_type !== "all" ? filters.object_type : undefined,
          limit: 200,
        });
        if (!active) return;
        setEntries(data ?? []);
      } catch (error) {
        if (!active) return;
        setError(error.message ?? "Failed to fetch history.");
        setEntries([]);
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [api, filters.object_type]);

  const filtered = useMemo(() => {
    if (!filters.search.trim()) return entries;
    const q = filters.search.toLowerCase();
    return entries.filter((item) => {
      const meta = JSON.stringify(item.metadata || {}).toLowerCase();
      return (
        (item.action && item.action.toLowerCase().includes(q)) ||
        (item.object_type && item.object_type.toLowerCase().includes(q)) ||
        meta.includes(q)
      );
    });
  }, [entries, filters.search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">History</h1>
          <p className="text-sm text-slate-500">Recent changes across students, payments, seats, expenses, and roles.</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filters.object_type}
            onChange={(e) => setFilters((prev) => ({ ...prev, object_type: e.target.value }))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">All types</option>
            {Object.entries(OBJECT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <div className="relative">
            <LucideIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Search action, type, metadata"
              className="w-60 rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto rounded-3xl pb-2">
          <table className="min-w-[900px] w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Actor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Details</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    Loading history…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    No history found for the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const when = item.created_at ? new Date(item.created_at).toLocaleString() : "";
                  const meta = item.metadata || {};
                  const metaPreview = Object.entries(meta)
                    .slice(0, 3)
                    .map(([k, v]) => `${k}: ${String(v)}`)
                    .join(" • ");
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-semibold text-slate-900 capitalize">{item.action}</td>
                      <td className="px-4 py-3 text-slate-600">{OBJECT_LABELS[item.object_type] ?? item.object_type}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.actor_role ? `${item.actor_role}` : "—"}
                        {item.actor_id ? <span className="text-xs text-slate-400"> • {item.actor_id}</span> : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm">{metaPreview || "—"}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{when}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default HistoryView;
