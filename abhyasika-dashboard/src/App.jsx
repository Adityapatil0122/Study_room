import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  lazy,
  Suspense,
} from "react";
import Sidebar from "./components/layout/Sidebar.jsx";
import MobileNav from "./components/layout/MobileNav.jsx";
import LoadingState from "./components/common/LoadingState.jsx";
import ErrorBanner from "./components/common/ErrorBanner.jsx";
import StudentModal from "./components/modals/StudentModal.jsx";
import PaymentModal from "./components/modals/PaymentModal.jsx";
import AssignSeatModal from "./components/modals/AssignSeatModal.jsx";
import SeatDetailsModal from "./components/modals/SeatDetailsModal.jsx";
import ImportModal from "./components/modals/ImportModal.jsx";
import LucideIcon from "./components/icons/LucideIcon.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import LoginView from "./views/LoginView.jsx";
import { createApiClient } from "./lib/apiClient.js";
import { ALL_VIEW_IDS } from "./constants/views.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const DashboardView = lazy(() => import("./views/DashboardView.jsx"));
const StudentsView = lazy(() => import("./views/StudentsView.jsx"));
const SeatManagerView = lazy(() => import("./views/SeatManagerView.jsx"));
const PaymentsView = lazy(() => import("./views/PaymentsView.jsx"));
const SettingsView = lazy(() => import("./views/SettingsView.jsx"));
const ExpensesView = lazy(() => import("./views/ExpensesView.jsx"));
const AdmissionsView = lazy(() => import("./views/AdmissionsView.jsx"));
const ReportsView = lazy(() => import("./views/ReportsView.jsx"));
const RenewalsView = lazy(() => import("./views/RenewalsView.jsx"));
const HistoryView = lazy(() => import("./views/HistoryView.jsx"));
const OnboardingPage = lazy(() => import("./views/OnboardingPage.jsx"));

const CURRENCY = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const INITIAL_PAYMENT_FILTERS = {
  search: "",
  startDate: "",
  endDate: "",
  mode: "all",
};

const MODAL_PERMISSIONS = {
  createStudent: { view: "students", action: "add" },
  editStudent: { view: "students", action: "edit" },
  logPayment: { view: "payments", action: "add" },
  assignSeat: { view: "seats", action: "edit" },
};

const sortPlans = (collection = []) =>
  [...collection].sort((a, b) => {
    const priceA = Number(a?.price) || 0;
    const priceB = Number(b?.price) || 0;
    if (priceA === priceB) {
      return (a?.name || "").localeCompare(b?.name || "");
    }
    return priceA - priceB;
  });

function App() {
  const initialOnboarding =
    typeof window !== "undefined" && window.location.pathname === "/onboarding";
  const [activeView, setActiveView] = useState("dashboard");
  const [isOnboardingPage, setIsOnboardingPage] = useState(initialOnboarding);
  const [students, setStudents] = useState([]);
  const [seats, setSeats] = useState([]);
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [branding, setBranding] = useState({
    logoUrl: "/images/abhyasika-logo.png",
    logoPath: "",
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyIds, setBusyIds] = useState([]);
  const [paymentFilters, setPaymentFilters] = useState(
    INITIAL_PAYMENT_FILTERS
  );
  const [modalState, setModalState] = useState({
    type: null,
    payload: null,
  });

  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem("abhyasika-theme") || "light";
  });
  const {
    session,
    isAuthenticated,
    admin,
    logout,
    authInitializing,
    allowedViews,
    hasPermission,
  } = useAuth();
  const normalizedAllowedViews = useMemo(
    () => (allowedViews && allowedViews.length ? allowedViews : ALL_VIEW_IDS),
    [allowedViews]
  );
  const ownerId = session?.user?.user_metadata?.owner_id ?? admin?.id;
  const rawRoleIds = session?.user?.user_metadata?.role_ids;
  const assignedRoleIds = useMemo(
    () => (Array.isArray(rawRoleIds) ? rawRoleIds : []),
    [Array.isArray(rawRoleIds) ? rawRoleIds.join(",") : ""]
  );
  const [notificationOpen, setNotificationOpen] = useState(false);
const [notificationFilter, setNotificationFilter] = useState("all");
const notificationRef = useRef(null);


  // OPTIMIZED: Fixed route listener - "pushstate" and "replacestate" don't exist as events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleRoute = () => {
      setIsOnboardingPage(window.location.pathname === "/onboarding");
    };

    // Only "popstate" exists as a standard event
    window.addEventListener("popstate", handleRoute);

    return () => {
      window.removeEventListener("popstate", handleRoute);
    };
  }, []);

  // OPTIMIZED: Compute heroMetrics more efficiently with early returns
  const heroMetrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Count active students in single pass
    let activeStudents = 0;
    let upcomingRenewals = 0;

    for (const student of students) {
      if (student.is_active) activeStudents++;

      if (student.renewal_date) {
        const due = new Date(student.renewal_date);
        const diffDays = (due - now) / (1000 * 60 * 60 * 24);
        if (diffDays >= 0 && diffDays <= 7) upcomingRenewals++;
      }
    }

    // Count occupied seats in single pass
    let occupiedSeats = 0;
    for (const seat of seats) {
      if (seat.status === "occupied") occupiedSeats++;
    }

    const availableSeats = Math.max(seats.length - occupiedSeats, 0);
    const seatUtilization = seats.length
      ? Math.round((occupiedSeats / seats.length) * 100)
      : 0;

    // Calculate revenue for current month in single pass
    let revenueThisMonth = 0;
    for (const payment of payments) {
      if (!payment.payment_date) continue;
      const paidAt = new Date(payment.payment_date);
      if (paidAt.getMonth() === currentMonth && paidAt.getFullYear() === currentYear) {
        revenueThisMonth += Number(payment.amount_paid || 0);
      }
    }

    return {
      activeStudents,
      availableSeats,
      seatUtilization,
      revenueThisMonth,
      upcomingRenewals,
    };
  }, [students, seats, payments]);

  const getAuditContext = useCallback(() => {
    const actor_id = session?.user?.id ?? admin?.id ?? null;
    const actor_role =
      roles.find((role) => assignedRoleIds.includes(role.id))?.name ?? null;
    return { actor_id, actor_role };
  }, [session?.user?.id, admin?.id, roles, assignedRoleIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("abhyasika-theme", theme);
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.style.setProperty("color-scheme", theme === "dark" ? "dark" : "light");
  }, [theme]);

  const headerHighlights = [
    {
      label: "Total students",
      value: students.length,
      icon: "Users",
    },
    {
      label: "Active students",
      value: heroMetrics.activeStudents,
      icon: "Users2",
    },
    {
      label: "Seats available",
      value: `${heroMetrics.availableSeats} free`,
      icon: "Armchair",
    },
    {
      label: "Revenue (this month)",
      value: CURRENCY.format(heroMetrics.revenueThisMonth || 0),
      icon: "TrendingUp",
    },
    {
      label: "Renewals (7 days)",
      value: heroMetrics.upcomingRenewals,
      icon: "BellRing",
    },
  ];

  const api = useMemo(() => createApiClient(), []);

  // OPTIMIZED: Separate notification calculations for better memoization
  const planMap = useMemo(
    () => new Map(plans.map(p => [p.id, p])),
    [plans]
  );

  const studentMap = useMemo(
    () => new Map(students.map(s => [s.id, s])),
    [students]
  );

  const renewalNotifications = useMemo(() => {
    if (students.length === 0) return [];
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return students
      .filter(student => {
        if (!student.renewal_date) return false;
        const due = new Date(student.renewal_date);
        return due >= now && due <= weekAhead;
      })
      .map(student => ({
        id: `renewal-${student.id}`,
        title: "Renewal reminder",
        message: `${student.name} - ${planMap.get(student.current_plan_id)?.name ?? 'Plan'}`,
        tone: "warning",
        category: "renewal",
        date: new Date(student.renewal_date),
      }));
  }, [students, planMap]);

  const registrationNotifications = useMemo(() => {
    if (students.length === 0) return [];
    const now = new Date();

    return students
      .filter(student => !student.registration_paid)
      .map(student => ({
        id: `reg-${student.id}`,
        title: "Registration pending",
        message: `${student.name} still owes registration fee`,
        tone: "alert",
        category: "registration",
        date: student.join_date ? new Date(student.join_date) : now,
      }));
  }, [students]);

  const qrEnrollmentNotifications = useMemo(() => {
    if (students.length === 0) return [];
    const now = new Date();

    return students
      .filter(student => {
        if (student.registration_source !== "qr_self") return false;
        const joinDate = student.join_date ? new Date(student.join_date) : now;
        const diffDays = (now - joinDate) / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      })
      .map(student => ({
        id: `qr-${student.id}`,
        title: "New QR enrollment",
        message: `${student.name} submitted via onboarding form`,
        tone: "info",
        category: "admission",
        date: student.join_date ? new Date(student.join_date) : now,
      }));
  }, [students]);

  const paymentNotifications = useMemo(() => {
    if (payments.length === 0) return [];
    const now = new Date();

    // OPTIMIZED: Sort once and take top 8
    const recentPayments = [...payments]
      .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
      .slice(0, 8);

    return recentPayments.map(payment => {
      const student = studentMap.get(payment.student_id);
      return {
        id: `payment-${payment.id}`,
        title: "Payment recorded",
        message: `${
          student ? student.name : "Student"
        } paid ₹${Number(payment.amount_paid || 0).toLocaleString(
          "en-IN"
        )} via ${payment.payment_mode === "upi" ? "UPI" : "Cash"}`,
        tone: "success",
        category: "payment",
        date: payment.payment_date ? new Date(payment.payment_date) : now,
      };
    });
  }, [payments, studentMap]);

  const seatMaintenanceNotifications = useMemo(() => {
    if (seats.length === 0) return [];
    const now = new Date();

    return seats
      .filter(seat => seat.status === "maintenance")
      .map(seat => ({
        id: `seat-${seat.id}`,
        title: "Seat unavailable",
        message: `${seat.seat_number} is under maintenance`,
        tone: "info",
        category: "seat",
        date: seat.updated_at ? new Date(seat.updated_at) : now,
      }));
  }, [seats]);

  const notifications = useMemo(() => {
    const items = [
      ...renewalNotifications,
      ...registrationNotifications,
      ...qrEnrollmentNotifications,
      ...paymentNotifications,
      ...seatMaintenanceNotifications,
    ];

    return items.sort((a, b) => b.date - a.date).slice(0, 25);
  }, [
    renewalNotifications,
    registrationNotifications,
    qrEnrollmentNotifications,
    paymentNotifications,
    seatMaintenanceNotifications,
  ]);

  // OPTIMIZED: Use useCallback to stabilize event handler and prevent memory leaks
  const handleNotificationClickOutside = useCallback((event) => {
    if (notificationRef.current && !notificationRef.current.contains(event.target)) {
      setNotificationOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!notificationOpen) return;

    // Small delay to avoid immediate close on button click
    const timeoutId = setTimeout(() => {
      window.addEventListener("mousedown", handleNotificationClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("mousedown", handleNotificationClickOutside);
    };
  }, [notificationOpen, handleNotificationClickOutside]);

  const formatRelativeTime = (date) => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const filteredNotifications = notifications.filter((notification) =>
    notificationFilter === "all"
      ? true
      : notification.category === notificationFilter
  );

  const notificationTabs = [
    { key: "all", label: "All" },
    { key: "renewal", label: "Renewals" },
    { key: "payment", label: "Payments" },
    { key: "registration", label: "Reg. Fees" },
    { key: "seat", label: "Seats" },
    { key: "admission", label: "Admissions" },
  ];

  const toggleTheme = () =>
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    if (!normalizedAllowedViews.includes(activeView)) {
      const fallback = normalizedAllowedViews[0] ?? "dashboard";
      setActiveView(fallback);
    }
  }, [isAuthenticated, normalizedAllowedViews, activeView]);

  useEffect(() => {
    let mounted = true;
    async function loadBranding() {
      if (!isAuthenticated || !admin?.id) {
        if (mounted) {
          setBranding({ logoUrl: "/images/abhyasika-logo.png", logoPath: "" });
        }
        return;
      }
      try {
        const data = await api.getSettings();
        if (!mounted) return;
        const prefs = data || {};
        const logoPath = prefs.logoPath || "";
        const logoUrl = prefs.logoUrl || "/images/abhyasika-logo.png";
        setBranding({ logoUrl, logoPath });
      } catch (err) {
        if (!mounted) return;
        console.error("Branding fetch error", err);
      }
    }
    loadBranding();
    return () => {
      mounted = false;
    };
  }, [api, isAuthenticated, admin?.id]);

  useEffect(() => {
    if (isAuthenticated) return;
    setActiveView("dashboard");
    setStudents([]);
    setSeats([]);
    setPlans([]);
    setPayments([]);
    setExpenses([]);
    setExpenseCategories([]);
    setBranding({ logoUrl: "/images/abhyasika-logo.png", logoPath: "" });
    setRoles([]);
    setModalState({ type: null, payload: null });
    setBusyIds([]);
    setPaymentFilters(INITIAL_PAYMENT_FILTERS);
    setError("");
  }, [isAuthenticated]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        setInitialLoading(true);
        setError("");
        const [
          planData,
          studentData,
          seatData,
          paymentData,
          expenseData,
          categoryData,
        ] =
          await Promise.all([
            api.listPlans(),
            api.listStudents(),
            api.listSeats(),
            api.listPayments(),
            api.listExpenses(),
            api.listExpenseCategories ? api.listExpenseCategories() : [],
          ]);
        if (!mounted) return;
        setPlans(sortPlans(planData));
        setStudents(studentData);
        setSeats(seatData);
        setPayments(paymentData);
        setExpenses(expenseData);
        setExpenseCategories(categoryData || []);
        setError("");
      } catch (err) {
        if (!mounted) return;
        setError(err.message ?? "Failed to load dashboard data.");
      } finally {
        if (mounted) {
          setInitialLoading(false);
        }
      }
    }

    if (!isAuthenticated) {
      setInitialLoading(false);
      return () => {
        mounted = false;
      };
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [api, isAuthenticated]);

  useEffect(() => {
    let mounted = true;

    async function fetchRoles() {
      if (!isAuthenticated) {
        if (mounted) setRoles([]);
        return;
      }
      if (!ownerId && assignedRoleIds.length === 0) {
        if (mounted) setRoles([]);
        return;
      }
      try {
        const roleData = await api.listRoles({
          ownerId,
          includeRoleIds: assignedRoleIds,
        });
        if (!mounted) return;
        setRoles(roleData);
      } catch (err) {
        console.error("Failed to load roles", err);
      }
    }

    fetchRoles();
    return () => {
      mounted = false;
    };
  }, [api, isAuthenticated, ownerId, assignedRoleIds]);

  const canAccessView = useCallback(
    (viewId) => normalizedAllowedViews.includes(viewId),
    [normalizedAllowedViews]
  );

  const openModal = (type, payload = null) => {
    const requirement = MODAL_PERMISSIONS[type];
    if (
      requirement &&
      !hasPermission(requirement.view, requirement.action)
    ) {
      showToast("You do not have permission for this action.", "warning");
      return;
    }
    setModalState({ type, payload });
  };

  const closeModal = () => {
    setModalState({ type: null, payload: null });
  };

  const showToast = useCallback(
    (message, tone = "success") => {
      const options = {
        position: "top-right",
        theme: theme === "dark" ? "dark" : "light",
      };
      switch (tone) {
        case "error":
          toast.error(message, options);
          break;
        case "warning":
          toast.warn(message, options);
          break;
        case "info":
          toast.info(message, options);
          break;
        default:
          toast.success(message, options);
      }
    },
    [theme]
  );

  const toastContainer = (
    <ToastContainer
      position="top-right"
      autoClose={3200}
      newestOnTop
      closeOnClick
      pauseOnHover
      draggable
      theme={theme === "dark" ? "dark" : "light"}
    />
  );

  const navigateTo = useCallback(
    (viewId) => {
      if (!normalizedAllowedViews.includes(viewId)) {
        showToast("You do not have access to that section.", "warning");
        return;
      }
      setActiveView(viewId);
    },
    [normalizedAllowedViews, showToast]
  );

  const handleCreatePlan = async (payload) => {
    try {
      setError("");
      const plan = await api.createPlan({ ...payload, audit: getAuditContext() });
      setPlans((prev) => sortPlans([...prev, plan]));
      showToast("Plan created.");
      return plan;
    } catch (err) {
      const message = err.message ?? "Failed to create plan.";
      setError(message);
      showToast(message, "error");
      throw err;
    }
  };

  const handleUpdatePlan = async (planId, updates) => {
    try {
      setError("");
      const plan = await api.updatePlan(planId, { ...updates, audit: getAuditContext() });
      setPlans((prev) => sortPlans(prev.map((item) => (item.id === planId ? plan : item))));
      showToast("Plan updated.");
      return plan;
    } catch (err) {
      const message = err.message ?? "Failed to update plan.";
      setError(message);
      showToast(message, "error");
      throw err;
    }
  };

  const handleDeletePlan = async (planId) => {
    try {
      setError("");
      await api.deletePlan(planId, getAuditContext());
      setPlans((prev) => prev.filter((plan) => plan.id !== planId));
      showToast("Plan removed.");
    } catch (err) {
      const message = err.message ?? "Failed to delete plan.";
      setError(message);
      showToast(message, "error");
      throw err;
    }
  };

  const handleCreateStudent = async (formData) => {
    try {
      setError("");
      const audit = getAuditContext();
      const registeringRole =
        roles.find((role) => assignedRoleIds.includes(role.id))?.name ||
        audit.actor_role ||
        "Admin";
      const { initialPayment, ...studentPayload } = formData;
      const created = await api.createStudent({
        ...studentPayload,
        registration_source:
          studentPayload.registration_source || "admin_panel",
        registered_by_role:
          studentPayload.registered_by_role || registeringRole,
        audit,
      });
      setStudents((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      if (initialPayment?.enabled && initialPayment.plan_id) {
        const { payment, student } = await api.createPayment({
          student_id: created.id,
          plan_id: initialPayment.plan_id,
          amount_paid: Number(initialPayment.amount_paid) || undefined,
          valid_from: initialPayment.valid_from,
          valid_until: initialPayment.valid_until,
          payment_mode: initialPayment.payment_mode,
          includes_registration: initialPayment.includes_registration,
          notes: initialPayment.notes,
          audit,
        });
        setPayments((prev) => [payment, ...prev]);
        setStudents((prev) =>
          prev.map((item) => (item.id === student.id ? student : item))
        );
      }
      showToast("Student added successfully.");
      closeModal();
    } catch (err) {
      const message = err.message ?? "Failed to create student.";
      setError(message);
      showToast(message, "error");
    }
  };

  const handleUpdateStudent = async (studentId, updates) => {
    try {
      setError("");
      const updated = await api.updateStudent(studentId, { ...updates, audit: getAuditContext() });
      setStudents((prev) =>
        prev
          .map((student) => (student.id === studentId ? updated : student))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      showToast("Student details updated.");
      closeModal();
    } catch (err) {
      const message = err.message ?? "Failed to update student.";
      setError(message);
      showToast(message, "error");
    }
  };

  const handleToggleActive = async (studentId) => {
    try {
      setBusyIds((prev) => [...prev, studentId]);
      setError("");
      const updated = await api.toggleStudentActive(studentId, getAuditContext());
      setStudents((prev) =>
        prev.map((student) => (student.id === studentId ? updated : student))
      );
      showToast(
        updated.is_active ? "Student reactivated." : "Student deactivated."
      );
    } catch (err) {
      const message = err.message ?? "Failed to update student status.";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusyIds((prev) => prev.filter((id) => id !== studentId));
    }
  };

  const handleAssignSeat = async ({ seatId, studentId }) => {
    try {
      setError("");
      const { seat, student } = await api.assignSeat({
        seatId,
        studentId,
        audit: getAuditContext(),
      });
      setSeats((prev) =>
        prev.map((item) => (item.id === seat.id ? seat : item))
      );
      setStudents((prev) =>
        prev.map((item) => (item.id === student.id ? student : item))
      );
      showToast("Seat assigned successfully.");
      closeModal();
    } catch (err) {
      const message = err.message ?? "Failed to assign seat.";
      setError(message);
      showToast(message, "error");
    }
  };

  const handleDeallocateSeat = async (seatId) => {
    try {
      setError("");
      const { seat, student } = await api.deallocateSeat({ seatId, audit: getAuditContext() });
      setSeats((prev) =>
        prev.map((item) => (item.id === seat.id ? seat : item))
      );
      if (student) {
        setStudents((prev) =>
          prev.map((item) => (item.id === student.id ? student : item))
        );
      }
      showToast("Seat deallocated.");
      closeModal();
    } catch (err) {
      const message = err.message ?? "Unable to deallocate seat.";
      setError(message);
      showToast(message, "error");
    }
  };

  const handleCreatePayment = async (payload) => {
    try {
      setError("");
      const { payment, student } = await api.createPayment({
        ...payload,
        audit: getAuditContext(),
      });
      setPayments((prev) => [payment, ...prev]);
      setStudents((prev) =>
        prev.map((item) => (item.id === student.id ? student : item))
      );
      showToast("Payment recorded successfully.");
      closeModal();
    } catch (err) {
      const message = err.message ?? "Failed to record payment.";
      setError(message);
      showToast(message, "error");
    }
  };

  const handleCreateExpense = async (payload) => {
    try {
      setError("");
      const expense = await api.createExpense({ ...payload, audit: getAuditContext() });
      setExpenses((prev) => [expense, ...prev]);
      showToast("Expense logged.");
    } catch (err) {
      const message = err.message ?? "Failed to log expense.";
      setError(message);
      showToast(message, "error");
    }
  };

  const handleCreateCategory = async (payload) => {
    try {
      setError("");
      const category = await api.createExpenseCategory({ ...payload, audit: getAuditContext() });
      setExpenseCategories((prev) =>
        [...prev, category].sort((a, b) => a.name.localeCompare(b.name))
      );
      showToast("Category added.");
      return category;
    } catch (err) {
      const message = err.message ?? "Failed to add category.";
      setError(message);
      showToast(message, "error");
      throw err;
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    try {
      setError("");
      await api.deleteExpenseCategory(categoryId, getAuditContext());
      setExpenseCategories((prev) => prev.filter((item) => item.id !== categoryId));
      showToast("Category removed.");
    } catch (err) {
      const message = err.message ?? "Failed to remove category.";
      setError(message);
      showToast(message, "error");
      throw err;
    }
  };

  const handleImportData = async ({ entity, rows, fileName, stats }) => {
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error("No valid rows to import.");
      }
      const audit = getAuditContext();
      let insertedCount = 0;
      try {
        if (entity === "students") {
          const inserted = await api.importStudents(rows, audit);
          insertedCount = inserted.length;
          if (insertedCount) {
            setStudents((prev) =>
              [...prev, ...inserted].sort((a, b) => a.name.localeCompare(b.name))
            );
          }
        } else if (entity === "payments") {
          const created = await api.importPayments(rows, audit);
          insertedCount = created.length;
          if (insertedCount) {
            const newPayments = created.map((item) => item.payment);
            setPayments((prev) => [...newPayments, ...prev]);
            const updatedStudents = created
              .map((item) => item.student)
              .filter(Boolean);
            if (updatedStudents.length) {
              setStudents((prev) =>
                prev.map((student) => {
                  const updated = updatedStudents.find((item) => item.id === student.id);
                  return updated || student;
                })
              );
            }
          }
        } else if (entity === "expenses") {
          const inserted = await api.importExpenses(rows, audit);
          insertedCount = inserted.length;
          if (insertedCount) {
            setExpenses((prev) => [...inserted, ...prev]);
          }
        } else {
          throw new Error("Unsupported import type.");
        }

        await api.recordImportLog({
          table: entity,
          fileName,
          totalRows: stats.total,
          successRows: insertedCount,
          duplicateRows: stats.duplicates,
          invalidRows: stats.invalid,
          actorId: audit.actor_id,
          actorRole: audit.actor_role,
        });
        showToast(`Imported ${insertedCount} ${entity}.`);
    } catch (err) {
      const message = err.message ?? "Import failed.";
      setError(message);
      showToast(message, "error");
      throw err;
    }
    return insertedCount;
  };

  const handleCreateSeatRecord = async (payload) => {
    try {
      setError("");
      const seat = await api.createSeat({ ...payload, audit: getAuditContext() });
      setSeats((prev) => [...prev, seat]);
      showToast("Seat added to layout.");
      return seat;
    } catch (err) {
      const message = err.message ?? "Failed to add seat.";
      setError(message);
      showToast(message, "error");
      throw err;
    }
  };

  const handleCreateSeatBatch = async ({
    prefix,
    count,
    start = 1,
    status = "available",
    usePrefix = true,
  }) => {
    const normalizedPrefix = usePrefix ? (prefix || "").trim().toUpperCase() : "";
    const total = Number(count);
    const startAt = Number(start);
    if (usePrefix && !normalizedPrefix) {
      throw new Error("Prefix is required for bulk seat creation.");
    }
    if (!Number.isInteger(total) || total <= 0) {
      throw new Error("Seat count must be a positive whole number.");
    }
    if (!Number.isInteger(startAt) || startAt <= 0) {
      throw new Error("Starting number must be at least 1.");
    }

    const plannedNumbers = Array.from(
      { length: total },
      (_, idx) => `${normalizedPrefix ? `${normalizedPrefix}-` : ""}${startAt + idx}`
    );
    const existingNumbers = new Set(
      seats.map((seat) => seat.seat_number?.toUpperCase()).filter(Boolean)
    );
    const conflict = plannedNumbers.find((seatNumber) =>
      existingNumbers.has(seatNumber.toUpperCase())
    );
    if (conflict) {
      throw new Error(`Seat ${conflict} already exists. Adjust the range or prefix.`);
    }

    const created = [];
    try {
      setError("");
      for (const seatNumber of plannedNumbers) {
        const seat = await api.createSeat({ seat_number: seatNumber, status });
        created.push(seat);
      }
      if (created.length) {
        setSeats((prev) => [...prev, ...created]);
        const rangeSummary =
          created.length > 1
            ? `${created[0].seat_number} \u2192 ${created[created.length - 1].seat_number}`
            : created[0].seat_number;
        showToast(`Added ${created.length} seats (${rangeSummary}).`);
      }
      return created;
    } catch (err) {
      if (created.length) {
        setSeats((prev) => [...prev, ...created]);
      }
      const baseMessage = err?.message ?? "Failed to add seats.";
      const message =
        created.length > 0
          ? `Added ${created.length} seats but stopped early: ${baseMessage}`
          : baseMessage;
      setError(baseMessage);
      showToast(message, "error");
      throw new Error(message);
    }
  };

  const handleLogoUploaded = useCallback((payload) => {
    if (!payload) return;
    if (typeof payload === "string") {
      setBranding((prev) => {
        const next = {
          logoUrl: payload || "/images/abhyasika-logo.png",
          logoPath: "",
        };
        return prev.logoUrl === next.logoUrl && prev.logoPath === next.logoPath
          ? prev
          : next;
      });
      return;
    }
    setBranding((prev) => {
      const next = {
        logoUrl: payload.url || "/images/abhyasika-logo.png",
        logoPath: payload.path || prev.logoPath || "",
      };
      return prev.logoUrl === next.logoUrl && prev.logoPath === next.logoPath ? prev : next;
    });
  }, []);

  const activeStudentsWithoutSeat = useMemo(
    () =>
      students
        .filter((student) => !student.current_seat_id && student.is_active)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [students]
  );

  const renderModal = () => {
    if (!isAuthenticated || !modalState.type) return null;
    const { type, payload } = modalState;

    if (type === "createStudent" || type === "editStudent") {
      return (
        <StudentModal
          open
          onClose={closeModal}
          onSubmit={(data) =>
            type === "editStudent"
              ? handleUpdateStudent(payload.student.id, data)
              : handleCreateStudent(data)
          }
          student={type === "editStudent" ? payload.student : null}
          plans={plans}
          seats={seats}
        />
      );
    }

    if (type === "logPayment") {
      return (
        <PaymentModal
          open
          onClose={closeModal}
          onSubmit={handleCreatePayment}
          plans={plans}
          students={students}
          roles={roles}
          defaultStudent={payload?.student ?? null}
        />
      );
    }

    if (type === "assignSeat") {
      return (
        <AssignSeatModal
          open
          onClose={closeModal}
          seat={payload.seat}
          students={activeStudentsWithoutSeat}
          onSubmit={(studentId) =>
            handleAssignSeat({ seatId: payload.seat.id, studentId })
          }
        />
      );
    }

    if (type === "seatDetails") {
      return (
        <SeatDetailsModal
          open
          onClose={closeModal}
          seat={payload.seat}
          student={payload.student}
          onDeallocate={() => handleDeallocateSeat(payload.seat.id)}
        />
      );
    }

    if (type === "importData") {
      return (
        <ImportModal
          open
          onClose={closeModal}
          entity={payload?.entity ?? "students"}
          students={students}
          plans={plans}
          payments={payments}
          expenses={expenses}
          seats={seats}
          categories={expenseCategories}
          onImport={handleImportData}
        />
      );
    }

    return null;
  };

  const renderContent = () => {
    if (initialLoading) {
      return <LoadingState />;
    }

    if (error && students.length === 0) {
      return (
        <div className="flex h-full flex-1 items-center justify-center">
          <div className="max-w-sm rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
            <LucideIcon
              name="badgeAlert"
              className="mx-auto h-10 w-10 text-red-500"
            />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <button
              onClick={async () => {
                try {
                  setInitialLoading(true);
                  setError("");
                  const [
                    planData,
                    studentData,
                    seatData,
                    paymentData,
                    expenseData,
                  ] = await Promise.all([
                    api.listPlans(),
                    api.listStudents(),
                    api.listSeats(),
                    api.listPayments(),
                    api.listExpenses(),
                  ]);
                  setPlans(sortPlans(planData));
                  setStudents(studentData);
                  setSeats(seatData);
                  setPayments(paymentData);
                  setExpenses(expenseData);
                } catch (retryError) {
                  setError(
                    retryError.message ??
                      "Unable to refresh dashboard data."
                  );
                } finally {
                  setInitialLoading(false);
                }
              }}
              className="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return (
      <Suspense fallback={<LoadingState message="Loading section…" />}>
        <div className="space-y-6">
        <ErrorBanner message={error} />
        {canAccessView("dashboard") && activeView === "dashboard" && (
          <DashboardView
            students={students}
            seats={seats}
            payments={payments}
            notifications={notifications}
          />
        )}
        {canAccessView("students") && activeView === "students" && (
          <StudentsView
            students={students}
            seats={seats}
            plans={plans}
            onOpenModal={openModal}
            onToggleActive={handleToggleActive}
            busyIds={busyIds}
            onNavigate={navigateTo}
            payments={payments}
            roles={roles}
          />
        )}
        {canAccessView("seats") && activeView === "seats" && (
          <SeatManagerView
            seats={seats}
            students={students}
            onOpenModal={openModal}
          />
        )}
        {canAccessView("payments") && activeView === "payments" && (
          <PaymentsView
            payments={payments}
            students={students}
            plans={plans}
            filters={paymentFilters}
            onFiltersChange={setPaymentFilters}
            onOpenModal={(type, payload = null) => openModal(type, payload)}
            roles={roles}
          />
        )}
        {canAccessView("renewals") && activeView === "renewals" && (
          <RenewalsView
            students={students}
            plans={plans}
            onOpenModal={openModal}
          />
        )}
        {canAccessView("reports") && activeView === "reports" && (
          <ReportsView
            seats={seats}
            students={students}
            payments={payments}
            expenses={expenses}
            plans={plans}
          />
        )}
        {canAccessView("admissions") && activeView === "admissions" && (
          <AdmissionsView />
        )}
        {canAccessView("history") && activeView === "history" && (
          <HistoryView />
        )}
        {canAccessView("expenses") && activeView === "expenses" && (
          <ExpensesView
            expenses={expenses}
            categories={expenseCategories}
            onCreateExpense={handleCreateExpense}
            onOpenModal={openModal}
          />
        )}
        {canAccessView("settings") && activeView === "settings" && (
          <SettingsView
            seats={seats}
            onAddSeat={handleCreateSeatRecord}
            onBulkAddSeats={handleCreateSeatBatch}
            branding={branding}
            onLogoUploaded={handleLogoUploaded}
            expenseCategories={expenseCategories}
            onAddCategory={handleCreateCategory}
            onDeleteCategory={handleDeleteCategory}
            plans={plans}
            onAddPlan={handleCreatePlan}
            onUpdatePlan={handleUpdatePlan}
            onDeletePlan={handleDeletePlan}
          />
        )}
        </div>
      </Suspense>
    );
  };

  if (isOnboardingPage) {
    return (
      <>
        <Suspense fallback={<LoadingState message="Loading enrollment form…" />}>
          <OnboardingPage />
        </Suspense>
        {toastContainer}
      </>
    );
  }


  if (authInitializing) {
    return (
      <>
        <LoadingState message="Checking admin session…" />
        {toastContainer}
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginView />
        {toastContainer}
      </>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 transition-colors duration-300 ease-in-out dark:bg-gray-950 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0 transition-opacity duration-300">
        <div className="absolute left-24 top-10 h-72 w-72 rounded-full bg-indigo-100/70 blur-3xl dark:bg-indigo-900/40" />
        <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-pink-100/70 blur-3xl dark:bg-pink-900/40" />
      </div>
      <div className="relative flex min-h-screen">
        <Sidebar
          activeView={activeView}
          onNavigate={navigateTo}
          admin={admin}
          branding={branding}
          onLogout={logout}
          allowedViews={normalizedAllowedViews}
        />
        <div className="flex flex-1 flex-col">
          <MobileNav
            activeView={activeView}
            onNavigate={navigateTo}
            branding={branding}
            allowedViews={normalizedAllowedViews}
          />
          <main className="flex-1 px-4 py-6 transition-colors duration-300 sm:px-6 lg:px-8">
            <div className="mb-6 rounded-3xl border border-white/70 bg-white/95 px-5 py-5 shadow-2xl shadow-indigo-100/60 backdrop-blur transition-colors duration-300 dark:border-gray-800/80 dark:bg-gray-900/80 dark:shadow-black/40">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 transition-colors duration-300 dark:border-gray-800 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow dark:bg-indigo-500">
                    <LucideIcon name="GraduationCap" className="h-5 w-5" />
                  </div>
                  <div>
                    {/* <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                     Welcome 
                    </p> */}
                    <h1 className="text-lg font-semibold text-slate-900 uppercase">Welcome Admin </h1>
                    
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  {/* <div className="relative w-full max-w-sm">
                    <LucideIcon
                      name="Search"
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="search"
                      placeholder="Search students, seats, payments..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                    />
                  </div> */}
                    <div className="flex items-center gap-2">
                      <div className="relative" ref={notificationRef}>
                        <button
                          type="button"
                          onClick={() => setNotificationOpen((prev) => !prev)}
                          className={`rounded-2xl border border-slate-200 bg-white/80 p-2 text-slate-500 transition-colors duration-200 dark:border-gray-700 dark:bg-gray-900/60 dark:text-slate-300 ${
                            notificationOpen
                              ? "border-indigo-200 text-indigo-600 dark:border-indigo-500 dark:text-indigo-200"
                              : "hover:border-indigo-200 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-200"
                          }`}
                          aria-haspopup="true"
                          aria-expanded={notificationOpen}
                        >
                        <LucideIcon name="Bell" className="h-4.5 w-4.5" />
                        {notifications.length ? (
                          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                            {Math.min(notifications.length, 9)}
                          </span>
                        ) : null}
                      </button>
                      {notificationOpen ? (
                        <div className="absolute right-0 top-12 z-40 w-80 rounded-3xl border border-slate-100 bg-white/95 shadow-2xl shadow-indigo-200/50 backdrop-blur dark:border-gray-800 dark:bg-gray-900">
                          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-gray-800">
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                Notifications
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {notifications.length} total alerts
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setNotificationOpen(false)}
                              className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-white"
                            >
                              Close
                            </button>
                          </div>
                          <div className="flex gap-2 overflow-x-auto px-4 py-2">
                            {notificationTabs.map((tab) => (
                              <button
                                key={tab.key}
                                type="button"
                                onClick={() => setNotificationFilter(tab.key)}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                  notificationFilter === tab.key
                                    ? "bg-indigo-600 text-white dark:bg-indigo-500/80"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-800 dark:text-slate-300 dark:hover:bg-gray-700"
                                }`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>
                          <div className="max-h-80 overflow-y-auto px-2 py-2">
                            {filteredNotifications.length === 0 ? (
                              <p className="px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                                No notifications in this category.
                              </p>
                            ) : (
                              filteredNotifications.map((notification) => (
                                <div
                                  key={notification.id}
                                  className="flex items-start gap-3 rounded-2xl px-4 py-3 text-sm transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-gray-800"
                                >
                                  <span
                                    className={`mt-1 inline-flex h-8 w-8 items-center justify-center rounded-2xl text-white ${
                                      notification.tone === "success"
                                        ? "bg-emerald-500"
                                        : notification.tone === "warning"
                                        ? "bg-amber-500"
                                        : notification.tone === "alert"
                                        ? "bg-rose-500"
                                        : "bg-slate-500"
                                    }`}
                                  >
                                    <LucideIcon
                                      name={
                                        notification.category === "renewal"
                                          ? "CalendarClock"
                                          : notification.category === "payment"
                                          ? "CreditCard"
                                          : notification.category === "seat"
                                          ? "Armchair"
                                          : notification.category === "admission"
                                          ? "QrCode"
                                          : "AlertCircle"
                                      }
                                      className="h-4 w-4"
                                    />
                                  </span>
                                  <div className="flex flex-1 flex-col">
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                      {notification.title}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      {notification.message}
                                    </p>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                      {formatRelativeTime(notification.date)}
                                    </p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="border-t border-slate-100 px-4 py-2 text-center text-xs text-slate-500 dark:border-gray-800 dark:text-slate-400">
                            Alerts refresh automatically
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                      aria-label="Toggle theme"
                    >
                      <LucideIcon
                        name={theme === "dark" ? "Sun" : "Moon"}
                        className="h-4.5 w-4.5"
                      />
                    </button>
                    {/* <button className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600">
                      <LucideIcon name="Settings2" className="h-4.5 w-4.5" />
                    </button> */}
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-1.5 transition-colors duration-200 dark:border-gray-700 dark:bg-gray-900/40">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white dark:bg-gray-700">
                        {(admin?.name || admin?.email || "AA").charAt(0).toUpperCase()}
                      </div>
                      {/* <div className="hidden text-left text-xs font-medium text-slate-500 sm:block">
                        <p className="text-slate-900">{admin?.name || "Admin"}</p>
                        <p className="text-[10px] uppercase tracking-wide">
                          {admin?.email || "admin@abhyasika.co"}
                        </p>
                      </div> */}
                    </div>
                    <button
                      onClick={logout}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-gray-700 dark:text-slate-300 dark:hover:border-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-200"
                    >
                      <LucideIcon name="Power" className="h-4.5 w-4.5" />
                     
                    </button>
                  </div>
                </div>
              </div>
              {/* <div className="flex flex-col gap-4 py-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    Welcome to Abhyasika
                  </p>
                  <p className="text-base font-semibold text-slate-900">{activeViewLabel}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => openModal("createStudent")}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/30 transition hover:-translate-y-0.5"
                  >
                    <LucideIcon name="UserPlus2" className="h-4 w-4" />
                    Add student
                  </button>
                  <button
                    onClick={() => openModal("logPayment")}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
                  >
                    <LucideIcon name="CreditCard" className="h-4 w-4" />
                    Quick payment
                  </button>
                  <button
                    onClick={() => setActiveView("expenses")}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-emerald-200 hover:text-emerald-600"
                  >
                    <LucideIcon name="Wallet2" className="h-4 w-4" />
                    Expenses desk
                  </button>
                  <button
                    onClick={() => setActiveView("reports")}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-600"
                  >
                    <LucideIcon name="BarChart3" className="h-4 w-4" />
                    Reports hub
                  </button>
                  <button
                    onClick={() => setActiveView("admissions")}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
                  >
                    <LucideIcon name="QrCode" className="h-4 w-4" />
                    Admissions QR
                  </button>
                  <button
                    onClick={logout}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    <LucideIcon name="Power" className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              </div> */}
              <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {headerHighlights.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800/80"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900/5 text-slate-700 dark:bg-gray-900 dark:text-indigo-200">
                        <LucideIcon name={stat.icon} className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-400">
                          {stat.label}
                        </p>
                        <p className="text-lg font-semibold text-slate-900 dark:text-white">
                          {stat.value}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {renderContent()}
          </main>
        </div>
        {renderModal()}
        {toastContainer}
      </div>
    </div>
  );
}

export default App;
