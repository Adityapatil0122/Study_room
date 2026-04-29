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
import LoadingState from "./components/common/LoadingState.jsx";
import ErrorBanner from "./components/common/ErrorBanner.jsx";
import LogoutConfirmModal from "./components/common/LogoutConfirmModal.jsx";
import StudentModal from "./components/modals/StudentModal.jsx";
import PaymentModal from "./components/modals/PaymentModal.jsx";
import AssignSeatModal from "./components/modals/AssignSeatModal.jsx";
import SeatDetailsModal from "./components/modals/SeatDetailsModal.jsx";
import ImportModal from "./components/modals/ImportModal.jsx";
import LucideIcon from "./components/icons/LucideIcon.jsx";
import PhosphorIcon from "./components/icons/PhosphorIcon.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import LoginView from "./views/LoginView.jsx";
import StudentPortalView from "./views/StudentPortalView.jsx";
import { createApiClient } from "./lib/apiClient.js";
import { ALL_VIEW_IDS } from "./constants/views.js";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  APP_TOAST_CONTAINER_PROPS,
  showAppToast,
  showLogoutToast,
} from "./lib/toast.js";

const DashboardView = lazy(() => import("./views/DashboardView.jsx"));
const StudentsView = lazy(() => import("./views/StudentsView.jsx"));
const SeatManagerView = lazy(() => import("./views/SeatManagerView.jsx"));
const PaymentsView = lazy(() => import("./views/PaymentsView.jsx"));
const SendPaymentRequestView = lazy(() =>
  import("./views/SendPaymentRequestView.jsx")
);
const CoordinatorHomeView = lazy(() => import("./views/CoordinatorHomeView.jsx"));
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
  const [pendingPayments, setPendingPayments] = useState([]);
  const [scheduledRequests, setScheduledRequests] = useState([]);
  const [adminNotifs, setAdminNotifs] = useState([]);
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

  const {
    session,
    userType,
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
  const isWorkspaceUser = userType === "admin" || userType === "coordinator";

  useEffect(() => {
    if (typeof document === "undefined") return;
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) return;

    viewport.setAttribute(
      "content",
      isAuthenticated && isWorkspaceUser
        ? "width=1280, initial-scale=1"
        : "width=device-width, initial-scale=1"
    );
  }, [isAuthenticated, isWorkspaceUser]);
  const ownerId = session?.user?.user_metadata?.owner_id ?? admin?.id;
  const rawRoleIds = session?.user?.user_metadata?.role_ids;
  const assignedRoleIds = useMemo(
    () => (Array.isArray(rawRoleIds) ? rawRoleIds : []),
    [Array.isArray(rawRoleIds) ? rawRoleIds.join(",") : ""]
  );
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const confirmLogout = () => {
    setLogoutConfirmOpen(true);
  };

  const handleLogoutConfirmed = () => {
    setLogoutConfirmOpen(false);
    showLogoutToast(userType === "coordinator" ? "coordinator" : "admin");
    setTimeout(() => logout(), 400);
  };

  const notificationRef = useRef(null);
  const hasSeenPendingNotificationsRef = useRef(false);
  const previousPendingNotificationIdsRef = useRef(new Set());


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
    const root = document.documentElement;
    root.classList.remove("dark");
    root.style.setProperty("color-scheme", "light");
  }, []);

  const headerHighlights = [
    {
      label: "Total Students",
      value: students.length,
      phosphorIcon: "Users",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      valueColor: "text-emerald-700",
    },
    {
      label: "Active Students",
      value: heroMetrics.activeStudents,
      phosphorIcon: "UserCheck",
      bg: "bg-indigo-50",
      border: "border-indigo-100",
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      valueColor: "text-indigo-700",
    },
    {
      label: "Seats Available",
      value: `${heroMetrics.availableSeats} / ${seats.length} free`,
      phosphorIcon: "Armchair",
      bg: "bg-amber-50",
      border: "border-amber-100",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      valueColor: "text-amber-700",
    },
    {
      label: "Revenue (this month)",
      value: CURRENCY.format(heroMetrics.revenueThisMonth || 0),
      phosphorIcon: "TrendUp",
      bg: "bg-rose-50",
      border: "border-rose-100",
      iconBg: "bg-rose-100",
      iconColor: "text-rose-600",
      valueColor: "text-rose-700",
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

  const backendStudentRegistrationIds = useMemo(() => {
    return new Set(
      adminNotifs
        .filter((notification) => notification.type === "student-registered")
        .map((notification) => notification.object_id)
        .filter(Boolean)
    );
  }, [adminNotifs]);

  const userCreatedNotifications = useMemo(() => {
    if (students.length === 0) return [];
    const now = new Date();
    const userCreatedSources = new Set(["student_app", "mobile_app"]);

    return students
      .filter((student) => {
        if (!userCreatedSources.has(student.registration_source)) return false;
        if (backendStudentRegistrationIds.has(student.id)) return false;
        const joinDate = student.join_date ? new Date(student.join_date) : now;
        const diffDays = (now - joinDate) / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      })
      .map((student) => ({
        id: `user-created-${student.id}`,
        title: "New user created",
        message: `${student.name} created a student account`,
        tone: "info",
        category: "admission",
        date: student.join_date ? new Date(student.join_date) : now,
      }));
  }, [backendStudentRegistrationIds, students]);

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

  const pendingApprovalNotifications = useMemo(() => {
    if (pendingPayments.length === 0) return [];

    return pendingPayments.map((pending) => ({
      id: `pending-${pending.id}`,
      title: "QR payment needs approval",
      message: `${pending.student_name || "Student"} requested approval for Rs ${Number(
        pending.amount || 0
      ).toLocaleString("en-IN")}`,
      tone: "alert",
      category: "approval",
      date: pending.created_at ? new Date(pending.created_at) : new Date(),
      pendingPaymentId: pending.id,
    }));
  }, [pendingPayments]);

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

  // Backend admin_notifications (new-registration alerts etc.)
  const backendNotifications = useMemo(() => {
    if (adminNotifs.length === 0) return [];
    return adminNotifs
      .filter((n) => !n.is_read)
      .map((n) => ({
        id: `backend-${n.id}`,
        _backendId: n.id,
        _objectId: n.object_id,
        title: n.type === "student-registered" ? "New user created" : n.title,
        message: n.message ?? "",
        tone: n.type === "student-registered" ? "info" : "info",
        category: n.type === "student-registered" ? "admission" : "info",
        date: n.created_at ? new Date(n.created_at) : new Date(),
      }));
  }, [adminNotifs]);

  const notifications = useMemo(() => {
    const items = [
      ...backendNotifications,
      ...pendingApprovalNotifications,
      ...renewalNotifications,
      ...registrationNotifications,
      ...qrEnrollmentNotifications,
      ...userCreatedNotifications,
      ...paymentNotifications,
      ...seatMaintenanceNotifications,
    ];

    return items.sort((a, b) => b.date - a.date).slice(0, 25);
  }, [
    backendNotifications,
    pendingApprovalNotifications,
    renewalNotifications,
    registrationNotifications,
    qrEnrollmentNotifications,
    userCreatedNotifications,
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
    { key: "admission", label: "New Sign-ups" },
    { key: "approval", label: "Approvals" },
    { key: "renewal", label: "Renewals" },
    { key: "payment", label: "Payments" },
    { key: "registration", label: "Reg. Fees" },
    { key: "seat", label: "Seats" },
  ];

  const handleMarkBackendNotifRead = useCallback(async (backendId) => {
    if (!api.markNotificationRead) return;
    try {
      await api.markNotificationRead(backendId);
      setAdminNotifs((prev) =>
        prev.map((n) => (n.id === backendId ? { ...n, is_read: true } : n))
      );
    } catch {
      // Non-fatal
    }
  }, [api]);

  const handleMarkAllNotifsRead = useCallback(async () => {
    if (!api.markAllNotificationsRead) return;
    try {
      await api.markAllNotificationsRead();
      setAdminNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // Non-fatal
    }
  }, [api]);

  useEffect(() => {
    if (!isAuthenticated || !isWorkspaceUser) {
      return;
    }
    if (!normalizedAllowedViews.includes(activeView)) {
      const fallback = normalizedAllowedViews[0] ?? "dashboard";
      setActiveView(fallback);
    }
  }, [isAuthenticated, isWorkspaceUser, normalizedAllowedViews, activeView]);

  useEffect(() => {
    let mounted = true;
    async function loadBranding() {
      if (!isAuthenticated || !isWorkspaceUser || !admin?.id) {
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
  }, [api, isAuthenticated, isWorkspaceUser, admin?.id]);

  useEffect(() => {
    if (isAuthenticated && isWorkspaceUser) return;
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
    hasSeenPendingNotificationsRef.current = false;
    previousPendingNotificationIdsRef.current = new Set();
  }, [isAuthenticated, isWorkspaceUser]);

  const loadWorkspaceData = useCallback(
    async ({ background = false } = {}) => {
      try {
        if (!background) {
          setInitialLoading(true);
        }
        setError("");
        const [
          planData,
          studentData,
          seatData,
          paymentData,
          expenseData,
          categoryData,
          pendingData,
          scheduledData,
          notifData,
        ] = await Promise.all([
          api.listPlans(),
          api.listStudents(),
          api.listSeats(),
          api.listPayments(),
          api.listExpenses(),
          api.listExpenseCategories ? api.listExpenseCategories() : [],
          api.listPendingPayments ? api.listPendingPayments() : [],
          api.listScheduledPaymentRequests
            ? api.listScheduledPaymentRequests("sent")
            : [],
          api.listNotifications ? api.listNotifications(50) : { notifications: [], unread: 0 },
        ]);

        setPlans(sortPlans(planData));
        setStudents(studentData);
        setSeats(seatData);
        setPayments(paymentData);
        setExpenses(expenseData);
        setExpenseCategories(categoryData || []);
        setPendingPayments(pendingData || []);
        setScheduledRequests(scheduledData || []);
        setAdminNotifs(notifData?.notifications ?? []);
        setError("");
      } catch (err) {
        setError(err.message ?? "Failed to load dashboard data.");
      } finally {
        if (!background) {
          setInitialLoading(false);
        }
      }
    },
    [api]
  );

  useEffect(() => {
    if (!isAuthenticated || !isWorkspaceUser) {
      setInitialLoading(false);
      return undefined;
    }

    loadWorkspaceData().catch(() => {});

    const intervalId = window.setInterval(() => {
      loadWorkspaceData({ background: true }).catch(() => {});
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, isWorkspaceUser, loadWorkspaceData]);

  useEffect(() => {
    let mounted = true;

    async function fetchRoles() {
      if (!isAuthenticated || !isWorkspaceUser) {
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
  }, [api, isAuthenticated, isWorkspaceUser, ownerId, assignedRoleIds]);

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
      showAppToast(message, tone);
    },
    []
  );

  useEffect(() => {
    const currentIds = new Set(pendingPayments.map((item) => item.id));

    if (!hasSeenPendingNotificationsRef.current) {
      hasSeenPendingNotificationsRef.current = true;
      previousPendingNotificationIdsRef.current = currentIds;
      return;
    }

    const newPendingItems = pendingPayments.filter(
      (item) => !previousPendingNotificationIdsRef.current.has(item.id)
    );

    if (newPendingItems.length > 0) {
      const message =
        newPendingItems.length === 1
          ? `${newPendingItems[0].student_name || "A student"} sent a QR approval request.`
          : `${newPendingItems.length} new QR approval requests need review.`;
      showToast(message, "info");
    }

    previousPendingNotificationIdsRef.current = currentIds;
  }, [pendingPayments, showToast]);

  const toastContainer = (
    <ToastContainer {...APP_TOAST_CONTAINER_PROPS} />
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

  const handleApprovePendingPayment = async (pendingId) => {
    try {
      setError("");
      const { payment, student } = await api.approvePendingPayment(pendingId);
      setPayments((prev) => [payment, ...prev]);
      if (student) {
        setStudents((prev) =>
          prev.map((item) => (item.id === student.id ? student : item))
        );
      }
      setPendingPayments((prev) => prev.filter((item) => item.id !== pendingId));
      showToast("Payment approved successfully.");
    } catch (err) {
      const message = err.message ?? "Failed to approve payment.";
      setError(message);
      showToast(message, "error");
    }
  };

  const handleRejectPendingPayment = async (pendingId) => {
    try {
      setError("");
      await api.rejectPendingPayment(pendingId);
      setPendingPayments((prev) => prev.filter((item) => item.id !== pendingId));
      showToast("Payment request rejected.");
    } catch (err) {
      const message = err.message ?? "Failed to reject payment.";
      setError(message);
      showToast(message, "error");
    }
  };

  const handleHoldMembership = async (studentId, notes) => {
    try {
      setError("");
      const { student } = await api.holdStudentMembership(studentId, notes);
      setStudents((prev) => prev.map((s) => (s.id === studentId ? student : s)));
      showToast("Membership put on hold.");
    } catch (err) {
      const message = err.message ?? "Failed to hold membership.";
      setError(message);
      showToast(message, "error");
    }
  };

  const handleResumeMembership = async (studentId, notes) => {
    try {
      setError("");
      const student = await api.resumeStudentMembership(studentId, notes);
      setStudents((prev) => prev.map((s) => (s.id === studentId ? student : s)));
      showToast("Membership resumed. Renewal date extended by hold duration.");
    } catch (err) {
      const message = err.message ?? "Failed to resume membership.";
      setError(message);
      showToast(message, "error");
    }
  };

  const handleCreateScheduledRequest = async (payload) => {
    try {
      setError("");
      const req = await api.createScheduledPaymentRequest(payload);
      setScheduledRequests((prev) => [req, ...prev]);
      showToast("Payment request sent to student.");
      return req;
    } catch (err) {
      const message = err.message ?? "Failed to send payment request.";
      setError(message);
      showToast(message, "error");
      throw err;
    }
  };

  const handleCancelScheduledRequest = async (requestId) => {
    try {
      setError("");
      await api.cancelScheduledPaymentRequest(requestId);
      setScheduledRequests((prev) => prev.filter((r) => r.id !== requestId));
      showToast("Payment request cancelled.");
    } catch (err) {
      const message = err.message ?? "Failed to cancel request.";
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
        {canAccessView("coordinator") && activeView === "coordinator" && (
          <CoordinatorHomeView
            students={students}
            payments={payments}
            pendingPayments={pendingPayments}
            scheduledRequests={scheduledRequests}
            onNavigate={navigateTo}
          />
        )}
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
            onHoldMembership={handleHoldMembership}
            onResumeMembership={handleResumeMembership}
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
            pendingPayments={pendingPayments}
            onApprovePending={handleApprovePendingPayment}
            onRejectPending={handleRejectPendingPayment}
          />
        )}
        {canAccessView("paymentRequests") && activeView === "paymentRequests" && (
          <SendPaymentRequestView
            students={students}
            plans={plans}
            seats={seats}
            scheduledRequests={scheduledRequests}
            onCreateScheduledRequest={
              hasPermission("paymentRequests", "add")
                ? handleCreateScheduledRequest
                : null
            }
            onCancelScheduledRequest={
              hasPermission("paymentRequests", "delete")
                ? handleCancelScheduledRequest
                : null
            }
          />
        )}
        {canAccessView("renewals") && activeView === "renewals" && (
          <RenewalsView
            students={students}
            plans={plans}
            seats={seats}
            onOpenModal={openModal}
            onCreateScheduledRequest={
              hasPermission("renewals", "add")
                ? handleCreateScheduledRequest
                : null
            }
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
          <AdmissionsView
            students={students}
            onOpenModal={openModal}
            onToggleActive={handleToggleActive}
            busyIds={busyIds}
          />
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
        <LoadingState message="Checking session..." />
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

  if (userType === "student") {
    return (
      <>
        <StudentPortalView />
        {toastContainer}
      </>
    );
  }

  return (
      <div className="flex h-screen overflow-x-auto overflow-y-hidden bg-slate-50 text-slate-900">
        {/* Sidebar — desktop only, unchanged on mobile */}
        <Sidebar
          activeView={activeView}
          onNavigate={navigateTo}
          admin={admin}
          branding={branding}
          onLogout={confirmLogout}
          allowedViews={normalizedAllowedViews}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
        />
        <div className="flex min-w-[1120px] flex-1 flex-col overflow-hidden">
          {/* Mobile nav — unchanged */}

          {/* Desktop top bar — lg only */}
          <header className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 shadow-sm flex-shrink-0 gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen((o) => !o)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                aria-label="Toggle sidebar"
              >
                <PhosphorIcon name="List" size={20} weight="bold" />
              </button>
              <h1 className="text-base font-semibold text-slate-800">
                Welcome {userType === "coordinator" ? "Coordinator" : "Admin"}!
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xs text-slate-400">{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</p>
              {/* Notification bell */}
              <div className="relative" ref={notificationRef}>
                <button
                  type="button"
                  onClick={() => setNotificationOpen((prev) => !prev)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border bg-white text-slate-500 transition-colors duration-200 ${
                    notificationOpen
                      ? "border-indigo-100 text-indigo-600"
                      : "border-slate-200 hover:border-indigo-100 hover:text-indigo-600"
                  }`}
                  aria-haspopup="true"
                  aria-expanded={notificationOpen}
                >
                  <PhosphorIcon name="Bell" size={16} weight={notifications.length ? "fill" : "regular"} />
                  {notifications.length ? (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                      {Math.min(notifications.length, 9)}
                    </span>
                  ) : null}
                </button>
                {notificationOpen ? (
                  <div className="absolute right-0 top-11 z-40 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <PhosphorIcon name="Bell" size={14} weight="fill" className="text-indigo-200" />
                        <p className="text-sm font-semibold text-white">Notifications</p>
                        {notifications.length > 0 && (
                          <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {notifications.length}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {backendNotifications.length > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllNotifsRead}
                            className="text-[11px] font-semibold text-indigo-200 hover:text-white transition-colors"
                          >
                            Mark all read
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setNotificationOpen(false)}
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                        >
                          <PhosphorIcon name="X" size={11} weight="bold" />
                        </button>
                      </div>
                    </div>

                    {/* Filter tabs */}
                    <div className="flex gap-1.5 overflow-x-auto bg-slate-50 px-3 py-2 scrollbar-none">
                      {notificationTabs.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setNotificationFilter(tab.key)}
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                            notificationFilter === tab.key
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "bg-white text-slate-500 border border-slate-200 hover:border-indigo-200 hover:text-indigo-600"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Notification list */}
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                      {filteredNotifications.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8 text-center">
                          <PhosphorIcon name="BellSlash" size={28} weight="duotone" className="text-slate-300" />
                          <p className="text-xs text-slate-400">No notifications here.</p>
                        </div>
                      ) : (
                        filteredNotifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`flex items-start gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-slate-50 ${
                              notification._backendId ? "cursor-pointer" : ""
                            }`}
                            onClick={() => {
                              if (notification._backendId) {
                                handleMarkBackendNotifRead(notification._backendId);
                                if (notification.category === "admission") {
                                  navigateTo("students");
                                  setNotificationOpen(false);
                                }
                              }
                            }}
                          >
                            {/* Icon */}
                            <span
                              className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                                notification.tone === "success"
                                  ? "bg-emerald-100 text-emerald-600"
                                  : notification.tone === "warning"
                                  ? "bg-amber-100 text-amber-600"
                                  : notification.tone === "alert"
                                  ? "bg-rose-100 text-rose-600"
                                  : "bg-indigo-100 text-indigo-600"
                              }`}
                            >
                              <PhosphorIcon
                                name={
                                  notification.category === "approval"
                                    ? "ShieldWarning"
                                    : notification.category === "renewal"
                                    ? "CalendarCheck"
                                    : notification.category === "payment"
                                    ? "CreditCard"
                                    : notification.category === "seat"
                                    ? "Armchair"
                                    : notification.category === "admission"
                                    ? "QrCode"
                                    : "Warning"
                                }
                                size={13}
                                weight="fill"
                              />
                            </span>

                            {/* Content */}
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="truncate text-xs font-semibold text-slate-800">
                                  {notification.title}
                                </p>
                                <span className="shrink-0 text-[10px] text-slate-400">
                                  {formatRelativeTime(notification.date)}
                                </span>
                              </div>
                              <p className="text-[11px] leading-snug text-slate-500 line-clamp-2">
                                {notification.message}
                              </p>
                              {notification.category === "approval" && notification.pendingPaymentId ? (
                                <div className="mt-1.5 flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleApprovePendingPayment(notification.pendingPaymentId);
                                    }}
                                    className="inline-flex items-center rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white transition hover:bg-emerald-500"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleRejectPendingPayment(notification.pendingPaymentId);
                                    }}
                                    className="inline-flex items-center rounded-md border border-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-600 transition hover:bg-rose-50"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-slate-100 bg-slate-50 px-4 py-1.5 text-center text-[10px] text-slate-400">
                      Alerts refresh automatically
                    </div>
                  </div>
                ) : null}
              </div>

              {/* User avatar */}
              <div className="flex h-8 w-8 -ml-1 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white">
                {(admin?.name || admin?.email || "A").charAt(0).toUpperCase()}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto px-6 py-5">
            {/* Stats cards — desktop only, dashboard view only */}
            {activeView === "dashboard" && (
              <div className="mb-5 overflow-x-auto pb-1">
                <div className="grid min-w-[880px] grid-cols-4 gap-3">
                {headerHighlights.map((stat) => (
                  <div
                    key={stat.label}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 ${stat.bg} ${stat.border} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        {stat.label}
                      </p>
                      <p className={`truncate text-2xl font-bold ${stat.valueColor}`}>
                        {stat.value}
                      </p>
                    </div>
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${stat.iconBg} ${stat.iconColor}`}>
                      <PhosphorIcon name={stat.phosphorIcon} size={18} weight="duotone" />
                    </div>
                  </div>
                ))}
                </div>
              </div>
            )}
            {renderContent()}
          </main>
        </div>
        {renderModal()}
        <LogoutConfirmModal
          open={logoutConfirmOpen}
          role={userType === "coordinator" ? "coordinator" : "admin"}
          onCancel={() => setLogoutConfirmOpen(false)}
          onConfirm={handleLogoutConfirmed}
        />
      {toastContainer}
    </div>
  );
}

export default App;
