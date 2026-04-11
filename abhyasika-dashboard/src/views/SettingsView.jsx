import React, { useEffect, useMemo, useState, memo, useRef } from "react";
import LucideIcon from "../components/icons/LucideIcon.jsx";
import PlanModal from "../components/modals/PlanModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { createApiClient } from "../lib/apiClient.js";
import LoadingState from "../components/common/LoadingState.jsx";
import {
  VIEW_DEFINITIONS,
  VIEW_ACTIONS,
  buildPermissionTemplate,
  normalizePermissions,
} from "../constants/views.js";

const defaultProfile = {
  name: "Admin",
  email: "admin@example.com",
  phone: "",
  timezone: "Asia/Kolkata",
  logoUrl: "",
  logoPath: "",
  notifications: {
    renewals: true,
    payments: true,
    waitlist: false,
  },
  autoReminders: true,
  dataExportFrequency: "weekly",
};

const timezones = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
  "Australia/Sydney",
];

const slugify = (value = "") =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 24);

const isSystemPlan = (plan) => {
  const name = plan?.name?.trim().toLowerCase() || "";
  return name === "monthly" || name.startsWith("rolling");
};

function SettingsView({
  seats = [],
  onAddSeat,
  onBulkAddSeats = async () => [],
  branding = { logoUrl: "/images/abhyasika-logo.png" },
  onLogoUploaded = () => {},
  expenseCategories = [],
  onAddCategory = async () => {},
  onDeleteCategory = async () => {},
  plans = [],
  onAddPlan = async () => {
    throw new Error("Plan actions are unavailable.");
  },
  onUpdatePlan = async () => {
    throw new Error("Plan actions are unavailable.");
  },
  onDeletePlan = async () => {
    throw new Error("Plan actions are unavailable.");
  },
}) {
  const api = useMemo(() => createApiClient(), []);
  const { admin } = useAuth();
  const baseProfile = useMemo(
    () => ({
      ...defaultProfile,
      name: admin?.name || defaultProfile.name,
      email: admin?.email || defaultProfile.email,
      logoUrl: branding?.logoUrl || defaultProfile.logoUrl,
      logoPath: branding?.logoPath || defaultProfile.logoPath,
    }),
    [admin, branding?.logoUrl, branding?.logoPath]
  );

  const [profile, setProfile] = useState(baseProfile);
  const [savedBanner, setSavedBanner] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [seatForm, setSeatForm] = useState({
    seat_number: "",
    status: "available",
  });
  const [seatError, setSeatError] = useState("");
  const [bulkSeatForm, setBulkSeatForm] = useState({
    prefix: "",
    start: 1,
    count: 10,
    status: "available",
    usePrefix: true,
  });
  const [bulkSeatError, setBulkSeatError] = useState("");
  const [bulkSeatSaving, setBulkSeatSaving] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [roles, setRoles] = useState([]);
  const createRoleForm = () => ({
    name: "",
    description: "",
    permissions: buildPermissionTemplate(),
  });
  const [roleForm, setRoleForm] = useState(() => createRoleForm());
  const [roleError, setRoleError] = useState("");
  const [roleSaving, setRoleSaving] = useState(false);
  const [teamForm, setTeamForm] = useState({
    mode: "manual",
    fullName: "",
    email: "",
    roleName: "",
    password: "",
  });
  const [teamMessage, setTeamMessage] = useState("");
  const [teamError, setTeamError] = useState("");
  const [teamSaving, setTeamSaving] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "", value: "" });
  const [categoryError, setCategoryError] = useState("");
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planEditing, setPlanEditing] = useState(null);
  const [planListError, setPlanListError] = useState("");
  const [planBusyId, setPlanBusyId] = useState("");
  const seededDefaults = useRef(false);
  const sectionKeys = ["seat", "plans", "roles", "team", "categories", "profile", "notifications", "automation"];
  const [openSections, setOpenSections] = useState(
    () =>
      sectionKeys.reduce(
        (acc, key) => ({
          ...acc,
          [key]: false,
        }),
        {}
      )
  );

  const toggleSection = (key) =>
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));

  const seatStats = useMemo(() => {
    const total = seats.length;
    const available = seats.filter((seat) => seat.status === "available").length;
    const maintenance = seats.filter(
      (seat) => seat.status === "maintenance"
    ).length;
    return {
      total,
      available,
      maintenance,
    };
  }, [seats]);

  useEffect(() => {
    setProfile((prev) => ({
      ...prev,
      name: baseProfile.name,
      email: baseProfile.email,
      logoUrl: baseProfile.logoUrl || prev.logoUrl,
      logoPath: baseProfile.logoPath || prev.logoPath,
    }));
  }, [baseProfile]);

  useEffect(() => {
    if (profile.logoUrl) {
      onLogoUploaded({ url: profile.logoUrl, path: profile.logoPath });
    }
  }, [profile.logoUrl, profile.logoPath, onLogoUploaded]);

  useEffect(() => {
    if (seededDefaults.current) return;
    if (!Array.isArray(plans)) return;
    const names = plans.map((p) => p?.name?.trim().toLowerCase()).filter(Boolean);
    const hasMonthly = names.includes("monthly");
    const hasRolling = names.some((n) => n.startsWith("rolling"));
    const tasks = [];
    if (!hasMonthly) {
      tasks.push(
        onAddPlan({
          name: "Monthly",
          price: 0,
          duration_days: 30,
          is_active: true,
        }).catch(() => {})
      );
    }
    if (!hasRolling) {
      tasks.push(
        onAddPlan({
          name: "Rolling 30 Days",
          price: 0,
          duration_days: 30,
          is_active: true,
        }).catch(() => {})
      );
    }
    if (tasks.length) {
      Promise.allSettled(tasks).finally(() => {
        seededDefaults.current = true;
      });
    } else {
      seededDefaults.current = true;
    }
  }, [plans, onAddPlan]);

  useEffect(() => {
    let active = true;
    async function loadSettings() {
      try {
        setLoading(true);
        setError("");
        if (!admin?.id) {
          setProfile(baseProfile);
          return;
        }
        const data = await api.getSettings();
        if (!active) return;
        if (data) {
          const prefs = { ...baseProfile, ...data };
          setProfile(prefs);
          if (prefs.logoUrl) {
            onLogoUploaded({ url: prefs.logoUrl, path: prefs.logoPath });
          }
        } else {
          setProfile(baseProfile);
        }
      } catch (err) {
        if (!active) return;
        setError(err.message || "Failed to load settings.");
        setProfile(baseProfile);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    loadSettings();
    return () => {
      active = false;
    };
  }, [admin?.id, api, baseProfile, onLogoUploaded]);

  useEffect(() => {
    let active = true;
    async function loadRoles() {
      if (!admin?.id) {
        setRoles([]);
        return;
      }
      try {
        const data = await api.listRoles();
        if (!active) return;
        const normalized =
          data?.map((role) => ({
            ...role,
            permissions: normalizePermissions(role.permissions),
          })) ?? [];
        setRoles(normalized);
      } catch {
        if (!active) return;
        setRoles([]);
      }
    }

    loadRoles();
    return () => {
      active = false;
    };
  }, [admin?.id, api]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setProfile((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleNotificationChange = (event) => {
    const { name, checked } = event.target;
    setProfile((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [name]: checked,
      },
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!admin?.id) {
        throw new Error("No active session found.");
      }
      await api.updateSettings(profile);
      setSavedBanner("Settings saved! Changes will sync to your account.");
      setTimeout(() => setSavedBanner(""), 3200);
    } catch (err) {
      setError(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoUploadError("");
    if (!admin?.id) {
      setLogoUploadError("You need an active session to upload a logo.");
      return;
    }
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setLogoUploadError("Upload a PNG, JPG, or WEBP image.");
      return;
    }
    const maxBytes = 500 * 1024; // ~500KB
    if (file.size > maxBytes) {
      setLogoUploadError("Logo should be under 500KB for fast loading.");
      return;
    }

    try {
      setLogoUploading(true);
      const upload = await api.uploadLogo(file);
      const selectedUrl = upload?.url || "";
      const path = upload?.path || "";
      const updatedProfile = { ...profile, logoUrl: selectedUrl, logoPath: path };
      setProfile(updatedProfile);
      onLogoUploaded({ url: selectedUrl, path });
      await api.updateSettings(updatedProfile);
      setSavedBanner("Logo updated for your workspace.");
      setTimeout(() => setSavedBanner(""), 3200);
    } catch (err) {
      setLogoUploadError(err.message || "Unable to upload logo.");
    } finally {
      setLogoUploading(false);
      event.target.value = "";
    }
  };

  const handleSeatSubmit = async (event) => {
    event.preventDefault();
    setSeatError("");
    if (!seatForm.seat_number.trim()) {
      setSeatError("Seat number is required.");
      return;
    }
    try {
      await onAddSeat({
        seat_number: seatForm.seat_number.toUpperCase(),
        status: seatForm.status,
      });
      setSeatForm({ seat_number: "", status: "available" });
    } catch (err) {
      setSeatError(err.message || "Unable to add seat.");
    }
  };

  const handleBulkSeatSubmit = async (event) => {
    event.preventDefault();
    setBulkSeatError("");
    const prefix = bulkSeatForm.prefix.trim();
    const total = Number(bulkSeatForm.count);
    const start = Number(bulkSeatForm.start);
    if (bulkSeatForm.usePrefix && !prefix) {
      setBulkSeatError("Prefix is required.");
      return;
    }
    if (!Number.isInteger(total) || total <= 0) {
      setBulkSeatError("Seat count must be a positive whole number.");
      return;
    }
    if (total > 200) {
      setBulkSeatError("Please generate at most 200 seats in one go.");
      return;
    }
    if (!Number.isInteger(start) || start <= 0) {
      setBulkSeatError("Starting number must be at least 1.");
      return;
    }
    try {
      setBulkSeatSaving(true);
      await onBulkAddSeats({
        prefix,
        count: total,
        start,
        status: bulkSeatForm.status,
        usePrefix: bulkSeatForm.usePrefix,
      });
      setBulkSeatForm((prev) => ({
        ...prev,
        prefix: "",
        start: 1,
        count: 10,
        usePrefix: true,
      }));
    } catch (err) {
      setBulkSeatError(err.message || "Unable to add seats.");
    } finally {
      setBulkSeatSaving(false);
    }
  };

  const handleRoleFieldChange = (event) => {
    const { name, value } = event.target;
    setRoleForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const toggleRolePermission = (viewId, action) => {
    setRoleForm((prev) => {
      const currentPermissions =
        prev.permissions?.[viewId] ?? buildPermissionTemplate()[viewId];
      const nextValue = !currentPermissions[action];
      const updatedViewPermissions = {
        ...currentPermissions,
        [action]: nextValue,
      };

      if (action === "view" && !nextValue) {
        VIEW_ACTIONS.forEach((key) => {
          if (key !== "view") {
            updatedViewPermissions[key] = false;
          }
        });
      } else if (action !== "view" && nextValue) {
        updatedViewPermissions.view = true;
      }

      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [viewId]: updatedViewPermissions,
        },
      };
    });
  };

  const handleRoleSubmit = async (event) => {
    event.preventDefault();
    setRoleError("");

    const trimmed = roleForm.name.trim();
    if (!trimmed) {
      setRoleError("Role name is required.");
      return;
    }
    const alreadyExists = roles.some(
      (role) => role.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadyExists) {
      setRoleError("Role with this name already exists. Choose another name.");
      return;
    }
    const hasAnyView = Object.values(roleForm.permissions || {}).some(
      (perms) => perms.view
    );
    if (!hasAnyView) {
      setRoleError("Enable at least one page access.");
      return;
    }
    if (!admin?.id) {
      setRoleError("No active admin session.");
      return;
    }

    try {
      setRoleSaving(true);
      const data = await api.createRole({
        name: trimmed,
        description: roleForm.description.trim() || null,
        permissions: roleForm.permissions,
      });
      const normalizedRole = {
        ...data,
        permissions: normalizePermissions(data.permissions),
      };
      setRoles((prev) =>
        [...prev, normalizedRole].sort((a, b) => a.name.localeCompare(b.name))
      );
      setRoleForm(createRoleForm());
      setSavedBanner("Role created with custom permissions.");
      setTimeout(() => setSavedBanner(""), 3200);
    } catch (err) {
      setRoleError(err.message || "Unable to add role.");
    } finally {
      setRoleSaving(false);
    }
  };

  const handleRoleRemove = async (roleId) => {
    setRoleError("");
    try {
      await api.deleteRole(roleId);
      setRoles((prev) => prev.filter((role) => role.id !== roleId));
    } catch (err) {
      setRoleError(err.message || "Unable to delete role.");
    }
  };

  const handleTeamChange = (event) => {
    const { name, value } = event.target;
    setTeamForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTeamSubmit = async (event) => {
    event.preventDefault();
    setTeamError("");
    setTeamMessage("");

    if (roles.length === 0) {
      setTeamError("Create a role before adding teammates.");
      return;
    }
    if (!teamForm.email.trim()) {
      setTeamError("Email is required.");
      return;
    }
    if (!teamForm.roleName.trim()) {
      setTeamError("Please specify a role name.");
      return;
    }
    if (teamForm.mode === "manual" && !teamForm.password.trim()) {
      setTeamError("Password is required for manual account creation.");
      return;
    }

    const selectedRole = roles.find(
      (role) =>
        role.name.trim().toLowerCase() === teamForm.roleName.trim().toLowerCase()
    );
    if (!selectedRole) {
      setTeamError("Role not found. Create it above first.");
      return;
    }

    try {
      setTeamSaving(true);
      const payload = {
        email: teamForm.email.trim(),
        fullName: teamForm.fullName.trim(),
        role_id: selectedRole.id,
      };
      if (teamForm.mode === "manual") {
        payload.password = teamForm.password;
      }
      const result =
        teamForm.mode === "manual"
          ? await api.createTeamMember(payload)
          : await api.inviteTeamMember(payload);

      setTeamMessage(
        teamForm.mode === "manual"
          ? "Account created. Share credentials securely."
          : result?.temporaryPassword
          ? `Invite prepared. Share this temporary password manually: ${result.temporaryPassword}`
          : "Teammate account created."
      );
      setTeamForm((prev) => ({
        ...prev,
        fullName: "",
        email: "",
        password: "",
        roleName: "",
      }));
      setTimeout(() => setTeamMessage(""), 4000);
    } catch (err) {
      setTeamError(err.message || "Unable to add teammate.");
    } finally {
      setTeamSaving(false);
    }
  };

  const handleCategoryChange = (event) => {
    const { name, value } = event.target;
    setCategoryForm((prev) => {
      if (name === "name") {
        return {
          ...prev,
          name: value,
          value: prev.value ? prev.value : slugify(value),
        };
      }
      return {
        ...prev,
        [name]: value,
      };
    });
  };

  const handleCategorySubmit = async (event) => {
    event.preventDefault();
    setCategoryError("");
    const trimmedName = categoryForm.name.trim();
    const trimmedValue =
      categoryForm.value.trim() || slugify(categoryForm.name);
    if (!trimmedName) {
      setCategoryError("Category name is required.");
      return;
    }
    if (!trimmedValue) {
      setCategoryError("Category identifier is required.");
      return;
    }
    try {
      await onAddCategory({
        name: trimmedName,
        value: trimmedValue,
      });
      setCategoryError("");
      setCategoryForm({ name: "", value: "" });
    } catch (err) {
      setCategoryError(err.message || "Unable to add category.");
    }
  };

  const handleCategoryDelete = async (categoryId) => {
    setCategoryError("");
    try {
      await onDeleteCategory(categoryId);
    } catch (err) {
      setCategoryError(err.message || "Unable to delete category.");
    }
  };

  const closePlanModal = () => {
    setPlanModalOpen(false);
    setPlanEditing(null);
  };

  const handlePlanModalSubmit = async (values) => {
    if (planEditing) {
      return onUpdatePlan(planEditing.id, values);
    }
    return onAddPlan(values);
  };

  const handlePlanDelete = async (plan) => {
    if (isSystemPlan(plan)) {
      setPlanListError("Core plans (Monthly/Rolling) cannot be deleted.");
      return;
    }
    if (!plan?.id) return;
    setPlanListError("");
    const confirmed = typeof window !== "undefined" ? window.confirm(`Delete plan "${plan.name}"?`) : true;
    if (!confirmed) return;
    setPlanBusyId(plan.id);
    try {
      await onDeletePlan(plan.id);
    } catch (err) {
      setPlanListError(err.message || "Unable to delete plan.");
    } finally {
      setPlanBusyId("");
    }
  };

  if (loading) {
    return <LoadingState message="Loading your settings…" />;
  }

  return (
    <div className="space-y-6">
      

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total seats",
            value: seatStats.total,
            icon: "layoutGrid",
            tone: "from-slate-100 to-slate-50 text-slate-900 dark:from-gray-800 dark:to-gray-800/50 dark:text-slate-100",
            sub: `${seatStats.available} available`,
          },
          {
            label: "Maintenance",
            value: seatStats.maintenance,
            icon: "wrench",
            tone: "from-amber-100 to-orange-50 text-amber-800 dark:from-amber-900/40 dark:to-amber-900/20 dark:text-amber-100",
            sub: "Temporarily offline",
          },
          {
            label: "Active roles",
            value: roles.length,
            icon: "shieldCheck",
            tone: "from-emerald-100 to-emerald-50 text-emerald-800 dark:from-emerald-900/40 dark:to-emerald-900/20 dark:text-emerald-100",
            sub: "Team permission sets",
          },
          {
            label: "Expense tags",
            value: expenseCategories.length,
            icon: "tag",
            tone: "from-sky-100 to-sky-50 text-sky-800 dark:from-sky-900/40 dark:to-sky-900/20 dark:text-sky-100",
            sub: "Classified categories",
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border border-white/70 dark:border-gray-800 bg-gradient-to-br ${card.tone} p-4 shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                {card.label}
              </p>
              <LucideIcon name={card.icon} className="h-4 w-4" />
            </div>
            <p className="mt-3 text-3xl font-semibold">{card.value}</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 opacity-90">{card.sub}</p>
          </div>
        ))}
      </div>

      <section className="rounded-3xl border border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection("seat")}
          className="flex w-full items-center justify-between rounded-2xl border border-transparent p-2 text-left transition hover:border-indigo-100"
          aria-expanded={openSections.seat}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
              <LucideIcon name="armchair" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Seat Configuration
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                Add or label new seats. Maintenance seats are hidden for booking.
              </p>
            </div>
          </div>
          <LucideIcon
            name={openSections.seat ? "ChevronUp" : "ChevronDown"}
            className="h-4 w-4 text-slate-500 dark:text-slate-400 dark:text-slate-500"
          />
        </button>
        {openSections.seat ? (
        <div className="mt-4 space-y-6">
          <form
            onSubmit={handleSeatSubmit}
            className="grid gap-3 md:grid-cols-3"
          >
            <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
              Seat Number
              <input
                name="seat_number"
                value={seatForm.seat_number}
                onChange={(event) =>
                  setSeatForm((prev) => ({
                    ...prev,
                    seat_number: event.target.value,
                  }))
                }
                placeholder="e.g. B-12"
                className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
              Status
              <select
                name="status"
                value={seatForm.status}
                onChange={(event) =>
                  setSeatForm((prev) => ({
                    ...prev,
                    status: event.target.value,
                  }))
                }
                className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="available">Available</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                Add Seat
              </button>
            </div>
          </form>
          {seatError ? (
            <p className="text-xs font-semibold text-rose-600">{seatError}</p>
          ) : null}
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/60/60 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Bulk generate seats
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  Creates seats like PREFIX-1, PREFIX-2 in a single click.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                new
              </span>
            </div>
            <form
              onSubmit={handleBulkSeatSubmit}
              className="mt-3 grid gap-3 md:grid-cols-[1fr,1fr,1fr,1fr,auto]"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Prefix</p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bulkSeatForm.usePrefix}
                    onClick={() =>
                      setBulkSeatForm((prev) => ({
                        ...prev,
                        usePrefix: !prev.usePrefix,
                        prefix: !prev.usePrefix ? prev.prefix : "",
                      }))
                    }
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                      bulkSeatForm.usePrefix ? "bg-indigo-600" : "bg-slate-300"
                    }`}
                  >
                    <span className="sr-only">Toggle prefix usage</span>
                    <span
                      className={`absolute h-4 w-4 rounded-full bg-white dark:bg-gray-900 shadow transition ${
                        bulkSeatForm.usePrefix ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                <input
                  name="prefix"
                  value={bulkSeatForm.prefix}
                  onChange={(event) =>
                    setBulkSeatForm((prev) => ({
                      ...prev,
                      prefix: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="A"
                  disabled={!bulkSeatForm.usePrefix}
                  className="rounded-xl border border-slate-200 dark:border-gray-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:text-slate-500"
                />
              </div>
              <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
                Start from
                <input
                  name="start"
                  type="number"
                  min="1"
                  value={bulkSeatForm.start}
                  onChange={(event) =>
                    setBulkSeatForm((prev) => ({
                      ...prev,
                      start: Number(event.target.value),
                    }))
                  }
                  className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
                Total seats
                <input
                  name="count"
                  type="number"
                  min="1"
                  value={bulkSeatForm.count}
                  onChange={(event) =>
                    setBulkSeatForm((prev) => ({
                      ...prev,
                      count: Number(event.target.value),
                    }))
                  }
                  className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
                Status
                <select
                  name="status"
                  value={bulkSeatForm.status}
                  onChange={(event) =>
                    setBulkSeatForm((prev) => ({
                      ...prev,
                      status: event.target.value,
                    }))
                  }
                  className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="available">Available</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={bulkSeatSaving}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {bulkSeatSaving ? "Generating..." : "Generate seats"}
                </button>
              </div>
            </form>
            {bulkSeatError ? (
              <p className="mt-2 text-xs font-semibold text-rose-600">
                {bulkSeatError}
              </p>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {seats
              .slice()
              .sort((a, b) => a.seat_number.localeCompare(b.seat_number))
              .map((seat) => (
                <div
                  key={seat.id}
                  className="rounded-2xl border border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/60 px-4 py-3 text-sm text-slate-600 dark:text-slate-300"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {seat.seat_number}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {seat.status}
                  </p>
                </div>
              ))}
          </div>
        </div>
        ) : null}
      </section>
      <section className="rounded-3xl border border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection("plans")}
          className="flex w-full items-center justify-between rounded-2xl border border-transparent p-2 text-left transition hover:border-indigo-100"
          aria-expanded={openSections.plans}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100 text-purple-600">
              <LucideIcon name="creditCard" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Fees Management
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Create plans that appear in student, payment, and renewal flows.
              </p>
            </div>
          </div>
          <LucideIcon
            name={openSections.plans ? "ChevronUp" : "ChevronDown"}
            className="h-4 w-4 text-slate-500 dark:text-slate-400"
          />
        </button>
        {openSections.plans ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Plans control fee suggestions, default validity, and duplicate detection. Keep inactive plans for history instead of deleting.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPlanEditing(null);
                  setPlanModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                <LucideIcon name="Plus" className="h-4 w-4" />
                New Plan
              </button>
            </div>
            {planListError ? (
              <p className="text-xs font-semibold text-rose-600">{planListError}</p>
            ) : null}
            <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-gray-800">
              <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-gray-800">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-gray-900/60 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3 text-left">Plan</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Duration</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800 dark:text-slate-200">
                  {plans.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400"
                      >
                        No plans yet. Create one to start assigning it to students.
                      </td>
                    </tr>
                  ) : (
                    plans.map((plan) => (
                      <tr key={plan.id} className="hover:bg-slate-50/70 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {plan.name}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          ₹{Number(plan.price ?? 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {plan.duration_days || 0} days
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                              plan.is_active
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-100"
                                : "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-slate-300"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                plan.is_active ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                            {plan.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPlanEditing({ ...plan, isSystem: isSystemPlan(plan) });
                                setPlanModalOpen(true);
                              }}
                              className="rounded-full border border-slate-200 dark:border-gray-700 p-1.5 text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-200"
                              aria-label={`Edit ${plan.name}`}
                            >
                              <LucideIcon name="Pencil" className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePlanDelete(plan)}
                              disabled={planBusyId === plan.id}
                              className={`rounded-full border border-slate-200 dark:border-gray-700 p-1.5 text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed dark:text-slate-300 dark:hover:border-rose-500 dark:hover:text-rose-200 ${
                                isSystemPlan(plan) ? "opacity-60 cursor-not-allowed" : ""
                              }`}
                              aria-label={`Delete ${plan.name}`}
                            >
                              {planBusyId === plan.id ? (
                                <LucideIcon name="Loader2" className="h-4 w-4 animate-spin" />
                              ) : (
                                <LucideIcon name="Trash2" className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
      <section className="rounded-3xl border border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection("categories")}
          className="flex w-full items-center justify-between rounded-2xl border border-transparent p-2 text-left transition hover:border-indigo-100"
          aria-expanded={openSections.categories}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-100 text-teal-600">
              <LucideIcon name="Tags" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Expense Categories
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                Organize expense entries with custom categories.
              </p>
            </div>
          </div>
          <LucideIcon
            name={openSections.categories ? "ChevronUp" : "ChevronDown"}
            className="h-4 w-4 text-slate-500 dark:text-slate-400 dark:text-slate-500"
          />
        </button>
        {openSections.categories ? (
          <div className="mt-4 space-y-4">
            <form
              onSubmit={handleCategorySubmit}
              className="grid gap-3 md:grid-cols-[2fr,1fr,auto]"
            >
              <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
                Category Name
                <input
                  name="name"
                  value={categoryForm.name}
                  onChange={handleCategoryChange}
                  placeholder="e.g. Rent"
                  className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
                Identifier
                <input
                  name="value"
                  value={categoryForm.value}
                  onChange={handleCategoryChange}
                  placeholder="rent"
                  className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  Add Category
                </button>
              </div>
            </form>
            {categoryError ? (
              <p className="text-xs font-semibold text-rose-600">
                {categoryError}
              </p>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              {expenseCategories.length === 0 ? (
                <div className="rounded-2xl border border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/60 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                  No categories yet. Create one to tag expenses.
                </div>
              ) : (
                expenseCategories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2 text-sm text-slate-700 dark:text-slate-200"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {category.name}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {category.value}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCategoryDelete(category.id)}
                      className="rounded-full border border-transparent p-1 text-slate-400 dark:text-slate-500 transition hover:border-rose-100 hover:text-rose-600"
                      aria-label={`Delete ${category.name}`}
                    >
                      <LucideIcon name="Trash2" className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </section>
      <section className="rounded-3xl border border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection("roles")}
          className="flex w-full items-center justify-between rounded-2xl border border-transparent p-2 text-left transition hover:border-indigo-100"
          aria-expanded={openSections.roles}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
              <LucideIcon name="shieldCheck" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Role Permissions
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                Design who can access each workspace module.
              </p>
            </div>
          </div>
          <LucideIcon
            name={openSections.roles ? "ChevronUp" : "ChevronDown"}
            className="h-4 w-4 text-slate-500 dark:text-slate-400 dark:text-slate-500"
          />
        </button>
        {openSections.roles ? (
        <form
          onSubmit={handleRoleSubmit}
          className="mt-6 space-y-4 rounded-2xl border border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/60/60 p-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
              Role name
              <input
                name="name"
                value={roleForm.name}
                onChange={handleRoleFieldChange}
                placeholder="e.g. Front Desk Manager"
                className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
              Description
              <input
                name="description"
                value={roleForm.description}
                onChange={handleRoleFieldChange}
                placeholder="Optional summary"
                className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Permissions matrix
            </p>
            <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 dark:bg-gray-900/60">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      Section
                    </th>
                    {VIEW_ACTIONS.map((action) => (
                      <th
                        key={action}
                        className="px-4 py-3 text-center font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500"
                      >
                        {action}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {VIEW_DEFINITIONS.map((view) => (
                    <tr key={view.id}>
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{view.label}</td>
                      {VIEW_ACTIONS.map((action) => (
                        <td key={action} className="px-4 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={
                              roleForm.permissions?.[view.id]?.[action] ?? false
                            }
                            onChange={() => toggleRolePermission(view.id, action)}
                            disabled={
                              action !== "view" &&
                              !roleForm.permissions?.[view.id]?.view
                            }
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
              View must be enabled before add/edit/delete can be granted.
            </p>
          </div>
          {roleError ? (
            <p className="text-xs font-semibold text-rose-600">{roleError}</p>
          ) : null}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={roleSaving}
              className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
            >
              {roleSaving ? "Saving…" : "Save role"}
            </button>
          </div>
        </form>
        ) : null}
        {openSections.roles ? (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {roles.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/60 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
              No roles yet. Create one to assign permissions.
            </div>
          ) : (
            roles
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((role) => (
                <div
                  key={role.id}
                  className="flex items-start justify-between rounded-2xl border border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 shadow-sm"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {role.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      {role.description || "No description"}
                    </p>
                    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100 dark:border-gray-800">
                      <table className="w-full min-w-[280px] divide-y divide-slate-100 text-xs">
                        <thead className="bg-slate-50 dark:bg-gray-900/60">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                              Section
                            </th>
                            {VIEW_ACTIONS.map((action) => (
                              <th
                                key={action}
                                className="px-3 py-2 text-center font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500"
                              >
                                {action}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {VIEW_DEFINITIONS.map((view) => (
                            <tr key={view.id}>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                {view.label}
                              </td>
                              {VIEW_ACTIONS.map((action) => {
                                const enabled =
                                  role.permissions?.[view.id]?.[action] ?? false;
                                return (
                                  <td
                                    key={action}
                                    className="px-3 py-2 text-center"
                                  >
                                    <span
                                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                                        enabled
                                          ? "bg-emerald-50 text-emerald-600"
                                          : "bg-slate-100 text-slate-400 dark:text-slate-500"
                                      }`}
                                    >
                                      {enabled ? "✓" : "—"}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRoleRemove(role.id)}
                    className="inline-flex items-center rounded-full border border-transparent p-1 text-slate-400 dark:text-slate-500 transition hover:border-rose-100 hover:text-rose-600"
                    aria-label={`Remove ${role.name}`}
                  >
                    <LucideIcon name="trash2" className="h-4 w-4" />
                  </button>
                </div>
              ))
          )}
        </div>
        ) : null}
      </section>
      <section className="rounded-3xl border border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection("team")}
          className="flex w-full items-center justify-between rounded-2xl border border-transparent p-2 text-left transition hover:border-indigo-100"
          aria-expanded={openSections.team}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
              <LucideIcon name="users2" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Team Access
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                Create teammate logins and assign role-based access for this workspace.
              </p>
            </div>
          </div>
          <LucideIcon
            name={openSections.team ? "ChevronUp" : "ChevronDown"}
            className="h-4 w-4 text-slate-500 dark:text-slate-400 dark:text-slate-500"
          />
        </button>
        {openSections.team ? (
        <form onSubmit={handleTeamSubmit} className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-3">
            {[
              { key: "manual", label: "Manual account" },
              { key: "invite", label: "Temp password" },
            ].map((option) => (
              <label
                key={option.key}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition ${
                  teamForm.mode === option.key
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-600 dark:text-slate-300 hover:border-indigo-200"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={option.key}
                  checked={teamForm.mode === option.key}
                  onChange={handleTeamChange}
                  className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500"
                />
                {option.label}
              </label>
            ))}
          </div>
          {roles.length === 0 ? (
            <p className="text-xs font-semibold text-amber-600">
              Create at least one role above before inviting teammates.
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
              Team member name
              <input
                name="fullName"
                value={teamForm.fullName}
                onChange={handleTeamChange}
                placeholder="Optional"
                className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
              Email
              <input
                name="email"
                type="email"
                value={teamForm.email}
                onChange={handleTeamChange}
                required
                className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
              Role
              <select
                name="roleName"
                value={teamForm.roleName}
                onChange={handleTeamChange}
                className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
                disabled={roles.length === 0}
              >
                {roles.length === 0 ? (
                  <option value="">Create a role first</option>
                ) : (
                  <>
                    <option value="">Select role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.name}>
                        {role.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </label>
            {teamForm.mode === "manual" ? (
              <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
                Temporary Password
                <input
                  name="password"
                  type="text"
                  value={teamForm.password}
                  onChange={handleTeamChange}
                  placeholder="Share securely"
                  className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
            ) : (
              <div className="rounded-2xl border border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/60 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
                XAMPP mode creates a temporary password for you to share manually.
              </div>
            )}
          </div>
          {teamError ? (
            <p className="text-xs font-semibold text-rose-600">{teamError}</p>
          ) : null}
          {teamMessage ? (
            <p className="text-xs font-semibold text-emerald-600">
              {teamMessage}
            </p>
          ) : null}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={teamSaving || roles.length === 0}
              className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
            >
              {teamSaving ? "Saving…" : teamForm.mode === "manual" ? "Create login" : "Create temp access"}
            </button>
          </div>
        </form>
        ) : null}
      </section>
      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <LucideIcon name="alertCircle" className="h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : null}
      {savedBanner ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <LucideIcon name="badgeCheck" className="h-4 w-4" />
          <span>{savedBanner}</span>
        </div>
      ) : null}

      <form onSubmit={handleSave} className="space-y-6">
        <section className="rounded-3xl border border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <button
            type="button"
            onClick={() => toggleSection("profile")}
            className="flex w-full items-center justify-between rounded-2xl border border-transparent p-2 text-left transition hover:border-indigo-100"
            aria-expanded={openSections.profile}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                <LucideIcon name="users" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Profile & Workspace
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  Update the basics that power your admin experience.
                </p>
              </div>
            </div>
            <LucideIcon
              name={openSections.profile ? "ChevronUp" : "ChevronDown"}
              className="h-4 w-4 text-slate-500 dark:text-slate-400 dark:text-slate-500"
            />
          </button>
          {openSections.profile ? (
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
                Full Name
                <input
                  name="name"
                  value={profile.name}
                  onChange={handleChange}
                  className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
                Email
                <input
                  name="email"
                  type="email"
                  value={profile.email}
                  onChange={handleChange}
                  className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
                Phone
                <input
                  name="phone"
                  value={profile.phone}
                  onChange={handleChange}
                  placeholder="Optional"
                  className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
                Timezone
                <select
                  name="timezone"
                  value={profile.timezone}
                  onChange={handleChange}
                  className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/60/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
                  <img
                    src={profile.logoUrl || branding?.logoUrl || "/images/abhyasika-logo.png"}
                    alt="Workspace logo preview"
                    className="h-12 w-12 rounded-lg object-contain"
                  />
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">Workspace logo</p>
                  <p>Recommended: square PNG/JPG, under 500KB.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="logo-upload-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <label
                  htmlFor="logo-upload-input"
                  className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600"
                >
                  {logoUploading ? "Uploading..." : "Upload logo"}
                </label>
              </div>
            </div>
            {logoUploadError ? (
              <p className="text-xs font-semibold text-rose-600">{logoUploadError}</p>
            ) : null}
          </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <button
            type="button"
            onClick={() => toggleSection("notifications")}
            className="flex w-full items-center justify-between rounded-2xl border border-transparent p-2 text-left transition hover:border-indigo-100"
            aria-expanded={openSections.notifications}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                <LucideIcon name="bell" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Notifications
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  Choose what alerts you want to receive.
                </p>
              </div>
            </div>
            <LucideIcon
              name={openSections.notifications ? "ChevronUp" : "ChevronDown"}
              className="h-4 w-4 text-slate-500 dark:text-slate-400 dark:text-slate-500"
            />
          </button>
          {openSections.notifications ? (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                key: "renewals",
                title: "Renewal Alerts",
                desc: "Remind me when renewals are due.",
              },
              {
                key: "payments",
                title: "Payment Receipts",
                desc: "Send a summary after logging payments.",
              },
              {
                key: "waitlist",
                title: "Waitlist Updates",
                desc: "Notify me when seats free up.",
              },
            ].map(({ key, title, desc }) => (
              <label
                key={key}
                className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/60 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 transition hover:border-indigo-200 hover:bg-white dark:bg-gray-900"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{title}</p>
                  <input
                    type="checkbox"
                    name={key}
                    checked={profile.notifications[key]}
                    onChange={handleNotificationChange}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">{desc}</p>
              </label>
            ))}
          </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <button
            type="button"
            onClick={() => toggleSection("automation")}
            className="flex w-full items-center justify-between rounded-2xl border border-transparent p-2 text-left transition hover:border-indigo-100"
            aria-expanded={openSections.automation}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                <LucideIcon name="settings" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Automation Preferences
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  Tune auto reminders and export automations.
                </p>
              </div>
            </div>
            <LucideIcon
              name={openSections.automation ? "ChevronUp" : "ChevronDown"}
              className="h-4 w-4 text-slate-500 dark:text-slate-400 dark:text-slate-500"
            />
          </button>
          {openSections.automation ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-2xl border border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/60 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
              Auto reminder emails
              <input
                type="checkbox"
                name="autoReminders"
                checked={profile.autoReminders}
                onChange={handleChange}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
              Auto data export
              <select
                name="dataExportFrequency"
                value={profile.dataExportFrequency}
                onChange={handleChange}
                className="mt-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="daily">Daily summary</option>
                <option value="weekly">Weekly digest</option>
                <option value="monthly">Monthly report</option>
              </select>
            </label>
            <div className="rounded-2xl border border-slate-100 dark:border-gray-800 bg-gradient-to-r from-indigo-500 to-purple-500 p-4 text-white">
              <p className="text-sm font-medium uppercase tracking-wide text-white/80">
                Automation status
              </p>
              <p className="mt-1 text-lg font-semibold">
                {profile.autoReminders ? "Reminders Active" : "Manual Follow-ups"}
              </p>
              <p className="text-sm text-white/80">
                Data export cadence:{" "}
                {profile.dataExportFrequency === "daily"
                  ? "Daily"
                  : profile.dataExportFrequency === "weekly"
                  ? "Weekly"
                  : "Monthly"}
              </p>
            </div>
          </div>
          ) : null}
        </section>

   

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 transition hover:border-slate-300 hover:bg-white dark:bg-gray-900"
            onClick={() => setProfile(baseProfile)}
          >
            <LucideIcon name="rotateCcw" className="h-4 w-4" />
            Reset Defaults
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <LucideIcon name="shield" className="h-4 w-4" />
              Manage Security
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-500 disabled:bg-indigo-300"
            >
              {saving ? (
                <>
                  <LucideIcon
                    name="loader2"
                    className="h-4 w-4 animate-spin"
                  />
                  Saving…
                </>
              ) : (
                <>
                  <LucideIcon name="badgeCheck" className="h-4 w-4" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </form>
      <PlanModal
        open={planModalOpen}
        onClose={closePlanModal}
        plan={planEditing}
        onSubmit={handlePlanModalSubmit}
        isSystem={planEditing?.isSystem}
      />
    </div>
  );
}

export default memo(SettingsView);
