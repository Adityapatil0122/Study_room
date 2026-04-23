import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import {
  Armchair,
  BarChart3,
  Bell,
  CalendarClock,
  Calculator,
  ClipboardList,
  CreditCard,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  PiggyBank,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Users2,
  Wallet2,
  X,
  XCircle,
} from "lucide-react-native";
import { createApiClient } from "../../lib/apiClient";
import { useAuth } from "../../context/AuthContext";
import { VIEW_DEFINITIONS } from "../../constants/views";

const icons = {
  ClipboardList,
  LayoutDashboard,
  Users2,
  Armchair,
  CreditCard,
  Send,
  CalendarClock,
  BarChart3,
  QrCode,
  History,
  Wallet2,
  Settings2,
};

const emptyData = {
  students: [],
  seats: [],
  plans: [],
  payments: [],
  expenses: [],
  categories: [],
  history: [],
  roles: [],
};

const today = () => new Date().toISOString().slice(0, 10);
const halfMonthDates = () => {
  const start = new Date();
  const end = new Date(start.getTime() + 14 * 86400000);
  return { valid_from: start.toISOString().slice(0, 10), valid_until: end.toISOString().slice(0, 10) };
};
const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
const planName = (plans, id) => plans.find((plan) => plan.id === id)?.name || "No plan";
const studentName = (students, id) => students.find((student) => student.id === id)?.name || "Unknown";
const diffDays = (dateValue) => {
  if (!dateValue) return null;
  return Math.ceil((new Date(`${dateValue}T00:00:00`) - new Date()) / 86400000);
};
const plusDays = (dateValue, days) => {
  const date = new Date(`${dateValue || today()}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 30));
  return date.toISOString().slice(0, 10);
};
const sortSeatsByNumber = (items = []) =>
  [...items].sort((left, right) =>
    String(left?.seat_number ?? "").localeCompare(
      String(right?.seat_number ?? ""),
      undefined,
      { numeric: true, sensitivity: "base" }
    )
  );
const isDiscountEligiblePlan = (plan) =>
  plan && Number(plan.duration_days) >= 180;

const EMPTY_REQUEST_FORM = {
  type: "custom",
  student_id: "",
  plan_id: "",
  amount: "",
  valid_from: today(),
  valid_until: today(),
  notes: "",
  deposit_amount: "",
  discount_enabled: false,
  discount_amount: "",
  late_fee_enabled: false,
  late_fee_amount: "",
  allow_seat_selection: false,
};

function Card({ children, className = "", style }) {
  return <View style={style} className={`rounded-xl border border-slate-100 bg-white p-5 shadow-sm ${className}`}>{children}</View>;
}

function Stat({ label, value, icon: Icon = BarChart3, tone = "bg-slate-100", style, compact = false, onPress }) {
  const content = (
    <Card style={onPress ? undefined : style} className="mb-4">
      <View className={`mb-4 items-center justify-center rounded-xl ${compact ? "h-11 w-11" : "h-12 w-12"} ${tone}`}>
        <Icon size={compact ? 20 : 22} color="#334155" />
      </View>
      <Text className="text-sm font-semibold uppercase tracking-wide text-slate-400">{label}</Text>
      <Text className={`${compact ? "text-xl" : "text-2xl"} mt-1 font-bold text-slate-950`}>{value}</Text>
    </Card>
  );
  if (onPress) {
    return <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={style}>{content}</TouchableOpacity>;
  }
  return content;
}

function Header({ title, subtitle, action, onAction }) {
  return (
    <View className="mb-5 flex-row items-start justify-between gap-3">
      <View className="flex-1">
        <Text className="text-3xl font-bold text-slate-950">{title}</Text>
        <Text className="mt-1.5 text-base text-slate-500">{subtitle}</Text>
      </View>
      {action ? (
        <TouchableOpacity onPress={onAction} className="flex-row items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5">
          <Plus size={17} color="white" />
          <Text className="text-base font-semibold text-white">{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Input({ label, value, onChangeText, placeholder, keyboardType = "default" }) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-sm font-semibold uppercase text-slate-500">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-lg text-slate-900"
      />
    </View>
  );
}

function ChipPicker({ label, items, value, onChange, getLabel, getValue }) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold uppercase text-slate-500">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {items.map((item) => {
            const itemValue = getValue(item);
            const active = value === itemValue;
            return (
              <TouchableOpacity
                key={String(itemValue)}
                onPress={() => onChange(itemValue)}
                className={`rounded-xl border px-4 py-2.5 ${active ? "border-indigo-600 bg-indigo-600" : "border-slate-200 bg-white"}`}
              >
                <Text className={`text-base font-semibold ${active ? "text-white" : "text-slate-600"}`}>{getLabel(item)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function Sheet({ title, visible, onClose, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[88%] rounded-t-2xl bg-white">
          <View className="flex-row items-center justify-between border-b border-slate-100 px-6 py-5">
            <Text className="text-xl font-bold text-slate-950">{title}</Text>
            <Pressable onPress={onClose} className="rounded-xl bg-slate-100 p-2.5">
              <X size={20} color="#334155" />
            </Pressable>
          </View>
          <ScrollView className="px-6 py-5" keyboardShouldPersistTaps="handled">{children}<View className="h-10" /></ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function Dashboard() {
  const { width } = useWindowDimensions();
  const api = useMemo(() => createApiClient(), []);
  const { admin, logout, allowedViews, hasPermission, userType } = useAuth();
  const [active, setActive] = useState("dashboard");
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [modal, setModal] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [scheduledRequests, setScheduledRequests] = useState([]);
  const [notificationActionId, setNotificationActionId] = useState("");
  const [studentForm, setStudentForm] = useState({ name: "", phone: "", email: "", join_date: today(), current_plan_id: "" });
  const [paymentForm, setPaymentForm] = useState({ student_id: "", plan_id: "", amount_paid: "", valid_from: today(), payment_mode: "upi" });
  const [expenseForm, setExpenseForm] = useState({ title: "", amount: "", category: "misc", expense_date: today(), paid_via: "cash" });
  const [seatForm, setSeatForm] = useState({ seat_number: "" });
  const [assignForm, setAssignForm] = useState({ seatId: "", studentId: "" });
  const [planForm, setPlanForm] = useState({ name: "", price: "", duration_days: "30" });
  const [requestForm, setRequestForm] = useState(EMPTY_REQUEST_FORM);
  const [requestBusy, setRequestBusy] = useState(false);
  const [cancelRequestId, setCancelRequestId] = useState("");
  const hasSeenPendingRequestsRef = useRef(false);
  const previousPendingRequestIdsRef = useRef(new Set());
  const contentWidth = Math.max(width - 40, 280);
  const statGap = 12;
  const statColumns = contentWidth < 330 ? 1 : contentWidth >= 720 ? 3 : 2;
  const statWidth = (contentWidth - statGap * (statColumns - 1)) / statColumns;
  const statCardStyle = { width: statWidth, minHeight: contentWidth < 360 ? 108 : 116 };
  const compactStats = contentWidth < 370;
  const seatGap = 12;
  const seatColumns = contentWidth < 360 ? 1 : contentWidth >= 960 ? 4 : contentWidth >= 640 ? 3 : 2;
  const seatCardWidth = (contentWidth - seatGap * (seatColumns - 1)) / seatColumns;
  const allowedList = useMemo(
    () =>
      allowedViews && allowedViews.length
        ? allowedViews
        : VIEW_DEFINITIONS.filter((item) => item.id !== "coordinator").map((item) => item.id),
    [allowedViews]
  );
  const visibleViews = useMemo(
    () => VIEW_DEFINITIONS.filter((item) => allowedList.includes(item.id)),
    [allowedList]
  );
  const canDo = useCallback(
    (viewId, action = "view") => hasPermission(viewId, action),
    [hasPermission]
  );

  // Drawer slide animation
  const drawerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(drawerAnim, {
      toValue: drawerOpen ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [drawerOpen, drawerAnim]);

  useEffect(() => {
    if (allowedList.includes(active)) return;
    setActive(allowedList[0] || "dashboard");
  }, [active, allowedList]);

  // Sync spin animation
  const syncAnim = useRef(new Animated.Value(0)).current;
  const spinSync = () => {
    syncAnim.setValue(0);
    Animated.timing(syncAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };
  const syncRotate = syncAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const handleSync = async () => {
    spinSync();
    setRefreshing(true);
    await load().catch((err) => setError(err.message || "Unable to refresh."));
    setRefreshing(false);
  };

  const drawerTranslateX = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-320, 0],
  });
  const overlayOpacity = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const load = useCallback(async () => {
    setError("");
    const [
      students,
      seats,
      plans,
      payments,
      expenses,
      categories,
      history,
      roles,
      pending,
      scheduled,
    ] = await Promise.all([
      api.listStudents(),
      api.listSeats(),
      api.listPlans(),
      api.listPayments({ limit: 500 }),
      api.listExpenses(),
      api.listExpenseCategories(),
      api.listHistory({ limit: 80 }).catch(() => []),
      api.listRoles().catch(() => []),
      api.listPendingPayments ? api.listPendingPayments() : [],
      api.listScheduledPaymentRequests ? api.listScheduledPaymentRequests("sent") : [],
    ]);
    setData({
      students: students ?? [],
      seats: seats ?? [],
      plans: plans ?? [],
      payments: payments ?? [],
      expenses: expenses ?? [],
      categories: categories ?? [],
      history: history ?? [],
      roles: roles ?? [],
    });
    setPendingPayments(pending ?? []);
    setScheduledRequests(scheduled ?? []);
  }, [api]);

  useEffect(() => {
    load().catch((err) => setError(err.message || "Unable to load workspace.")).finally(() => setLoading(false));

    // Auto-sync every 30 seconds
    const interval = setInterval(() => {
      // Background sync, silently handle errors
      load().catch(() => { });
    }, 30000);

    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (data.plans[0]) {
      setStudentForm((form) => ({ ...form, current_plan_id: form.current_plan_id || data.plans[0].id }));
      setPaymentForm((form) => ({ ...form, plan_id: form.plan_id || data.plans[0].id }));
    }
  }, [data.plans]);

  useEffect(() => {
    const currentIds = new Set(pendingPayments.map((item) => item.id));

    if (!hasSeenPendingRequestsRef.current) {
      hasSeenPendingRequestsRef.current = true;
      previousPendingRequestIdsRef.current = currentIds;
      return;
    }

    const newPendingItems = pendingPayments.filter(
      (item) => !previousPendingRequestIdsRef.current.has(item.id)
    );

    if (newPendingItems.length > 0) {
      Toast.show({
        type: "info",
        text1:
          newPendingItems.length === 1
            ? "New QR approval request"
            : `${newPendingItems.length} QR approvals pending`,
        text2:
          newPendingItems.length === 1
            ? `${newPendingItems[0].student_name || "A student"} sent a payment approval request.`
            : "Open notifications to review and approve them.",
      });
    }

    previousPendingRequestIdsRef.current = currentIds;
  }, [pendingPayments]);

  const refresh = async () => {
    setRefreshing(true);
    await load().catch((err) => setError(err.message || "Unable to refresh."));
    setRefreshing(false);
  };

  const audit = {
    actor_id: admin?.id,
    actor_role:
      userType === "coordinator"
        ? "Coordinator"
        : admin?.name || admin?.email || "Mobile admin",
  };
  const sortedSeats = useMemo(() => sortSeatsByNumber(data.seats), [data.seats]);
  const activeStudents = data.students.filter((student) => student.is_active);
  const availableSeats = sortedSeats.filter((seat) => seat.status !== "occupied");
  const occupiedSeats = sortedSeats.filter((seat) => seat.status === "occupied");
  const availableStudents = data.students.filter((student) => student.is_active && !student.current_seat_id);
  const renewals = activeStudents.filter((student) => {
    const days = diffDays(student.renewal_date);
    return days !== null && days >= 0 && days <= 7;
  });
  const expired = activeStudents.filter((student) => {
    const days = diffDays(student.renewal_date);
    return days !== null && days < 0;
  });
  const monthRevenue = data.payments.reduce((sum, payment) => {
    const date = new Date(payment.payment_date || payment.created_at || "");
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      ? sum + Number(payment.amount_paid || 0)
      : sum;
  }, 0);
  const monthExpenses = data.expenses.reduce((sum, expense) => {
    const date = new Date(`${expense.expense_date}T00:00:00`);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      ? sum + Number(expense.amount || 0)
      : sum;
  }, 0);
  const filteredStudents = data.students.filter((student) =>
    [student.name, student.phone, student.email, student.aadhaar]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  const selectedRequestPlan = data.plans.find((item) => item.id === requestForm.plan_id);
  const selectedRequestStudent = data.students.find((item) => item.id === requestForm.student_id);
  const canDiscountRequest = isDiscountEligiblePlan(selectedRequestPlan);
  const canOfferSeatSelection =
    selectedRequestStudent && !selectedRequestStudent.current_seat_id && availableSeats.length > 0;
  const requestPlanAmount = Number(requestForm.amount) || 0;
  const requestDeposit = Number(requestForm.deposit_amount) || 0;
  const requestDiscount =
    canDiscountRequest && requestForm.discount_enabled
      ? Number(requestForm.discount_amount) || 0
      : 0;
  const requestLateFee = requestForm.late_fee_enabled
    ? Number(requestForm.late_fee_amount) || 0
    : 0;
  const requestTotal = Math.max(
    0,
    requestPlanAmount + requestDeposit + requestLateFee - requestDiscount
  );
  const recentPayments = data.payments
    .slice()
    .sort((left, right) => new Date(right.payment_date || right.created_at || 0) - new Date(left.payment_date || left.created_at || 0))
    .slice(0, 3);

  useEffect(() => {
    const firstStudentId = activeStudents[0]?.id || "";
    const firstPlanId = data.plans[0]?.id || "";
    setRequestForm((form) => {
      if (
        (form.student_id || !firstStudentId) &&
        (form.plan_id || !firstPlanId)
      ) {
        return form;
      }
      const nextPlan = data.plans.find((item) => item.id === (form.plan_id || firstPlanId));
      return {
        ...form,
        student_id: form.student_id || firstStudentId,
        plan_id: form.plan_id || firstPlanId,
        amount: form.amount || (nextPlan ? String(Number(nextPlan.price) || 0) : ""),
      };
    });
  }, [activeStudents[0]?.id, data.plans]);

  const notifications = useMemo(() => {
    const approvalItems = pendingPayments.map((pending) => ({
      id: `pending-${pending.id}`,
      title: "QR payment needs approval",
      message: `${pending.student_name || "Student"} requested approval for ${money(pending.amount)}`,
      subtitle: `${pending.plan_name || "Plan"} | ${pending.valid_from} to ${pending.valid_until}`,
      date: pending.created_at ? new Date(pending.created_at) : new Date(),
      tone: "approval",
      pendingId: pending.id,
    }));

    const scheduledItems = scheduledRequests.map((request) => ({
      id: `scheduled-${request.id}`,
      title: "Scheduled request is still pending",
      message: `${request.student_name || "Student"} has not paid ${money(request.amount)} yet`,
      subtitle: `${request.type === "half_month" ? "15-Day" : "Custom"} request`,
      date: request.created_at ? new Date(request.created_at) : new Date(),
      tone: "scheduled",
    }));

    const renewalItems = renewals.map((student) => ({
      id: `renewal-${student.id}`,
      title: "Renewal due soon",
      message: `${student.name} expires on ${student.renewal_date || "-"}`,
      subtitle: `${diffDays(student.renewal_date)} day(s) left`,
      date: student.renewal_date ? new Date(`${student.renewal_date}T00:00:00`) : new Date(),
      tone: "renewal",
    }));

    const registrationItems = data.students
      .filter((student) => !student.registration_paid)
      .map((student) => ({
        id: `registration-${student.id}`,
        title: "Registration fee pending",
        message: `${student.name} still has pending registration`,
        subtitle: student.phone || student.email || "Student account",
        date: student.join_date ? new Date(`${student.join_date}T00:00:00`) : new Date(),
        tone: "registration",
      }));

    return [
      ...approvalItems,
      ...scheduledItems,
      ...renewalItems,
      ...registrationItems,
    ].sort((a, b) => b.date - a.date);
  }, [pendingPayments, scheduledRequests, renewals, data.students]);

  const save = async (task, successView) => {
    setBusy(true);
    try {
      await task();
      setModal("");
      await load();
      if (successView) setActive(successView);
    } catch (err) {
      Alert.alert("Action failed", err.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const setRequestField = (field, value) => {
    setRequestForm((form) => {
      const next = { ...form, [field]: value };

      if (field === "student_id") {
        const student = data.students.find((item) => item.id === value);
        if (!student || student.current_seat_id) {
          next.allow_seat_selection = false;
        }
      }

      if (field === "plan_id") {
        const plan = data.plans.find((item) => item.id === value);
        const planPrice = plan ? Number(plan.price) || 0 : 0;
        next.amount =
          form.type === "half_month"
            ? String(Math.round((planPrice * 15) / 30))
            : plan
            ? String(planPrice)
            : "";
        if (!isDiscountEligiblePlan(plan)) {
          next.discount_enabled = false;
          next.discount_amount = "";
        }
      }

      if (field === "type") {
        const plan = data.plans.find((item) => item.id === next.plan_id);
        const planPrice = plan ? Number(plan.price) || 0 : 0;
        if (value === "half_month") {
          const dates = halfMonthDates();
          return {
            ...next,
            ...dates,
            amount: plan ? String(Math.round((planPrice * 15) / 30)) : "",
          };
        }
        return {
          ...next,
          amount: plan ? String(planPrice) : "",
        };
      }

      if (field === "discount_enabled" && !value) {
        next.discount_amount = "";
      }

      if (field === "late_fee_enabled" && !value) {
        next.late_fee_amount = "";
      }

      if (field === "allow_seat_selection" && !canOfferSeatSelection) {
        next.allow_seat_selection = false;
      }

      return next;
    });
  };

  const resetRequestForm = () => {
    const plan = data.plans[0];
    setRequestForm({
      ...EMPTY_REQUEST_FORM,
      student_id: activeStudents[0]?.id || "",
      plan_id: plan?.id || "",
      amount: plan ? String(Number(plan.price) || 0) : "",
    });
  };

  const submitPaymentRequest = async () => {
    if (!canDo("paymentRequests", "add")) {
      Alert.alert("Permission required", "You do not have permission to send payment requests.");
      return;
    }
    if (!requestForm.student_id || !requestForm.plan_id) {
      Alert.alert("Missing details", "Select student and plan.");
      return;
    }
    if (!requestForm.amount || !requestForm.valid_from || !requestForm.valid_until) {
      Alert.alert("Missing details", "Amount and date range are required.");
      return;
    }

    setRequestBusy(true);
    try {
      const request = await api.createScheduledPaymentRequest({
        student_id: requestForm.student_id,
        plan_id: requestForm.plan_id,
        type: requestForm.type,
        amount: Number(requestForm.amount),
        valid_from: requestForm.valid_from,
        valid_until: requestForm.valid_until,
        notes: requestForm.notes || null,
        deposit_amount: Number(requestForm.deposit_amount) || 0,
        discount_enabled: canDiscountRequest ? requestForm.discount_enabled : false,
        discount_amount:
          canDiscountRequest && requestForm.discount_enabled
            ? Number(requestForm.discount_amount) || 0
            : 0,
        late_fee_enabled: requestForm.late_fee_enabled,
        late_fee_amount: requestForm.late_fee_enabled
          ? Number(requestForm.late_fee_amount) || 0
          : 0,
        allow_seat_selection: requestForm.allow_seat_selection && canOfferSeatSelection,
      });
      setScheduledRequests((prev) => [request, ...prev]);
      resetRequestForm();
      setActive("paymentRequests");
      Toast.show({
        type: "success",
        text1: "Payment request sent",
        text2: "The student can now pay from their app.",
      });
    } catch (err) {
      Alert.alert("Request failed", err.message || "Unable to send request.");
    } finally {
      setRequestBusy(false);
    }
  };

  const cancelScheduledRequest = async (requestId) => {
    if (!canDo("paymentRequests", "delete")) {
      Alert.alert("Permission required", "You do not have permission to cancel requests.");
      return;
    }
    setCancelRequestId(requestId);
    try {
      await api.cancelScheduledPaymentRequest(requestId);
      setScheduledRequests((prev) => prev.filter((item) => item.id !== requestId));
      Toast.show({ type: "info", text1: "Payment request cancelled" });
    } catch (err) {
      Alert.alert("Cancel failed", err.message || "Unable to cancel request.");
    } finally {
      setCancelRequestId("");
    }
  };

  const submitStudent = () => {
    if (!canDo("students", "add")) {
      Alert.alert("Permission required", "You do not have permission to add students.");
      return;
    }
    if (!studentForm.name.trim() || !studentForm.phone.trim()) {
      Alert.alert("Missing details", "Student name and phone are required.");
      return;
    }
    save(() => api.createStudent({ ...studentForm, registration_source: "mobile_app", audit }), "students");
  };

  const submitPayment = () => {
    if (!canDo("payments", "add")) {
      Alert.alert("Permission required", "You do not have permission to log payments.");
      return;
    }
    if (!paymentForm.student_id || !paymentForm.plan_id) {
      Alert.alert("Missing details", "Select student and plan.");
      return;
    }
    const plan = data.plans.find((item) => item.id === paymentForm.plan_id);
    save(
      () =>
        api.createPayment({
          ...paymentForm,
          amount_paid: paymentForm.amount_paid === "" ? Number(plan?.price || 0) : Number(paymentForm.amount_paid),
          valid_until: plusDays(paymentForm.valid_from, plan?.duration_days || 30),
          audit,
        }),
      "payments"
    );
  };

  const submitExpense = () => {
    if (!canDo("expenses", "add")) {
      Alert.alert("Permission required", "You do not have permission to add expenses.");
      return;
    }
    if (!expenseForm.title.trim() || !expenseForm.amount) {
      Alert.alert("Missing details", "Expense title and amount are required.");
      return;
    }
    save(() => api.createExpense({ ...expenseForm, amount: Number(expenseForm.amount), audit }), "expenses");
  };

  const submitSeat = () => {
    if (!canDo("seats", "add")) {
      Alert.alert("Permission required", "You do not have permission to add seats.");
      return;
    }
    if (!seatForm.seat_number.trim()) {
      Alert.alert("Missing details", "Seat number is required.");
      return;
    }
    save(() => api.createSeat({ seat_number: seatForm.seat_number.trim(), status: "available", audit }), "seats");
  };

  const submitPlan = () => {
    if (!canDo("settings", "add")) {
      Alert.alert("Permission required", "You do not have permission to add plans.");
      return;
    }
    if (!planForm.name.trim()) {
      Alert.alert("Missing details", "Plan name is required.");
      return;
    }
    save(() => api.createPlan({ ...planForm, price: Number(planForm.price || 0), duration_days: Number(planForm.duration_days || 30), is_active: true, audit }), "settings");
  };

  const submitAssign = () => {
    if (!canDo("seats", "edit")) {
      Alert.alert("Permission required", "You do not have permission to assign seats.");
      return;
    }
    if (!assignForm.seatId || !assignForm.studentId) {
      Alert.alert("Missing details", "Select seat and student.");
      return;
    }
    save(() => api.assignSeat({ ...assignForm, audit }), "seats");
  };

  const releaseSeat = (seat) => {
    if (!canDo("seats", "edit")) {
      Alert.alert("Permission required", "You do not have permission to release seats.");
      return;
    }
    Alert.alert("Release seat?", `Remove current student from ${seat.seat_number}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Release", style: "destructive", onPress: () => save(() => api.deallocateSeat({ seatId: seat.id, audit }), "seats") },
    ]);
  };

  const openPayment = (student) => {
    if (!canDo("payments", "add")) {
      Alert.alert("Permission required", "You do not have permission to log payments.");
      return;
    }
    const plan = data.plans.find((item) => item.id === student.current_plan_id) || data.plans[0];
    setPaymentForm({ student_id: student.id, plan_id: plan?.id || "", amount_paid: plan?.price?.toString() || "", valid_from: today(), payment_mode: "upi" });
    setModal("payment");
  };

  const openAssign = (seat) => {
    if (!canDo("seats", "edit")) {
      Alert.alert("Permission required", "You do not have permission to assign seats.");
      return;
    }
    setAssignForm({ seatId: seat.id, studentId: availableStudents[0]?.id || "" });
    setModal("assign");
  };

  const approvePendingRequest = async (pendingId) => {
    setNotificationActionId(`approve:${pendingId}`);
    try {
      const { payment, student } = await api.approvePendingPayment(pendingId);
      setPendingPayments((prev) => prev.filter((item) => item.id !== pendingId));
      setData((prev) => ({
        ...prev,
        payments: payment ? [payment, ...prev.payments] : prev.payments,
        students: student
          ? prev.students.map((item) => (item.id === student.id ? student : item))
          : prev.students,
      }));
      Toast.show({
        type: "success",
        text1: "QR payment approved",
        text2: `${student?.name || "Student"} has been activated successfully.`,
      });
    } catch (err) {
      Alert.alert("Approval failed", err.message || "Please try again.");
    } finally {
      setNotificationActionId("");
    }
  };

  const rejectPendingRequest = async (pendingId) => {
    setNotificationActionId(`reject:${pendingId}`);
    try {
      await api.rejectPendingPayment(pendingId);
      setPendingPayments((prev) => prev.filter((item) => item.id !== pendingId));
      Toast.show({
        type: "info",
        text1: "QR request rejected",
        text2: "The student can submit a fresh request later.",
      });
    } catch (err) {
      Alert.alert("Rejection failed", err.message || "Please try again.");
    } finally {
      setNotificationActionId("");
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text className="mt-3 text-base font-semibold text-slate-500">Loading full dashboard...</Text>
      </SafeAreaView>
    );
  }

  const dashboardView = (
    <>
      <Header title={userType === "coordinator" ? "Welcome Coordinator" : "Welcome Admin"} subtitle="Tap a card to jump to that section." />
      <View style={{ columnGap: statGap }} className="flex-row flex-wrap">
        <Stat style={statCardStyle} compact={compactStats} label="Total Students" value={data.students.length} icon={Users2} tone="bg-blue-50" onPress={() => setActive("students")} />
        <Stat style={statCardStyle} compact={compactStats} label="Active Students" value={activeStudents.length} icon={Users2} tone="bg-emerald-50" onPress={() => setActive("students")} />
        <Stat style={statCardStyle} compact={compactStats} label="Seats Available" value={`${availableSeats.length} free`} icon={Armchair} tone="bg-slate-100" onPress={() => setActive("seats")} />
        <Stat style={statCardStyle} compact={compactStats} label="Revenue Month" value={money(monthRevenue)} icon={BarChart3} tone="bg-violet-50" onPress={() => setActive("reports")} />
        <Stat style={statCardStyle} compact={compactStats} label="Renewals 7 Days" value={renewals.length} icon={Bell} tone="bg-amber-50" onPress={() => setActive("renewals")} />
        <Stat style={statCardStyle} compact={compactStats} label="QR Approvals" value={pendingPayments.length} icon={QrCode} tone="bg-orange-50" onPress={() => setNotificationsOpen(true)} />
        <Stat style={statCardStyle} compact={compactStats} label="Expenses Month" value={money(monthExpenses)} icon={Wallet2} tone="bg-rose-50" onPress={() => setActive("expenses")} />
      </View>
    </>
  );

  const studentsView = (
    <>
      <Header
        title="Student Management"
        subtitle={`${data.students.length} total. KYC, plans, seats, and billing.`}
        action={canDo("students", "add") ? "New" : undefined}
        onAction={() => setModal("student")}
      />
      <View className="mb-4 flex-row items-center rounded-xl border border-slate-200 bg-white px-4 py-3">
        <Search size={20} color="#94a3b8" />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search students" placeholderTextColor="#94a3b8" className="ml-3 flex-1 text-lg text-slate-900" />
      </View>
      {filteredStudents.map((student) => (
        <Card key={student.id} className="mb-4">
          <View className="flex-row justify-between gap-3">
            <View className="flex-1">
              <Text className="text-xl font-bold text-slate-950">{student.name}</Text>
              <Text className="mt-1.5 text-base text-slate-500">{student.phone || "No phone"}</Text>
              <Text className="mt-1 text-base text-slate-500">{planName(data.plans, student.current_plan_id)} | Seat {data.seats.find((seat) => seat.id === student.current_seat_id)?.seat_number || "None"}</Text>
            </View>
            <Text className={`self-start rounded-xl px-3 py-1.5 text-sm font-bold ${student.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{student.is_active ? "ACTIVE" : "OFF"}</Text>
          </View>
          {canDo("payments", "add") || canDo("students", "edit") ? (
            <View className="mt-4 flex-row gap-3">
              {canDo("payments", "add") ? (
                <TouchableOpacity onPress={() => openPayment(student)} className="rounded-xl bg-indigo-600 px-4 py-2.5"><Text className="text-base font-semibold text-white">Payment</Text></TouchableOpacity>
              ) : null}
              {canDo("students", "edit") ? (
                <TouchableOpacity onPress={() => save(() => api.toggleStudentActive(student.id, audit), "students")} className="rounded-xl border border-slate-200 px-4 py-2.5"><Text className="text-base font-semibold text-slate-700">Toggle</Text></TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </Card>
      ))}
    </>
  );

  const seatsView = (
    <>
      <Header
        title="Seat Manager"
        subtitle={`${occupiedSeats.length} occupied, ${availableSeats.length} available.`}
        action={canDo("seats", "add") ? "Add" : undefined}
        onAction={() => setModal("seat")}
      />
      <View style={{ columnGap: seatGap }} className="flex-row flex-wrap">
        {sortedSeats.map((seat) => {
          const occupied = seat.status === "occupied";
          return (
            <Card key={seat.id} style={{ width: seatCardWidth }} className={`mb-4 ${occupied ? "bg-indigo-50" : "bg-white"}`}>
              <Text className="text-2xl font-bold text-slate-950">{seat.seat_number}</Text>
              <Text className={`mt-1.5 text-sm font-bold uppercase ${occupied ? "text-indigo-600" : "text-emerald-600"}`}>{occupied ? "Occupied" : "Available"}</Text>
              <Text className="mt-2 text-sm text-slate-500" numberOfLines={2}>{occupied ? studentName(data.students, seat.current_student_id) : "Ready"}</Text>
              {canDo("seats", "edit") ? (
                <TouchableOpacity onPress={() => (occupied ? releaseSeat(seat) : openAssign(seat))} className={`mt-4 rounded-xl px-4 py-2.5 ${occupied ? "bg-rose-600" : "bg-indigo-600"}`}><Text className="text-center text-base font-semibold text-white">{occupied ? "Release" : "Assign"}</Text></TouchableOpacity>
              ) : null}
            </Card>
          );
        })}
      </View>
    </>
  );

  const paymentsView = (
    <>
      <Header
        title="Payments"
        subtitle="Fees, validity, and collection modes."
        action={canDo("payments", "add") ? "Log" : undefined}
        onAction={() => setModal("payment")}
      />
      {pendingPayments.length ? (
        <Card className="mb-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-lg font-bold text-slate-950">Pending QR Approvals</Text>
              <Text className="mt-1.5 text-base text-slate-500">
                {pendingPayments.length} student payment request(s) need approval.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setNotificationsOpen(true)}
              className="rounded-xl bg-amber-500 px-4 py-2.5"
            >
              <Text className="text-base font-semibold text-white">Review</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ) : null}
      {data.payments.map((payment) => (
        <Card key={payment.id} className="mb-4">
          <View className="flex-row justify-between gap-3">
            <View className="flex-1">
              <Text className="text-lg font-bold text-slate-950">{studentName(data.students, payment.student_id)}</Text>
              <Text className="mt-1.5 text-base text-slate-500">{planName(data.plans, payment.plan_id)} | {payment.payment_mode || "upi"}</Text>
              <Text className="mt-1 text-sm text-slate-400">Valid {payment.valid_from || "-"} to {payment.valid_until || "-"}</Text>
            </View>
            <Text className="text-xl font-bold text-slate-950">{money(payment.amount_paid)}</Text>
          </View>
        </Card>
      ))}
    </>
  );

  const renewalsView = (
    <>
      <Header title="Renewals" subtitle={`${expired.length} expired, ${renewals.length} due in 7 days.`} />
      {[...expired, ...renewals].map((student) => {
        const days = diffDays(student.renewal_date);
        return (
          <Card key={student.id} className="mb-4">
            <View className="flex-row justify-between gap-3">
              <View className="flex-1">
                <Text className="text-lg font-bold text-slate-950">{student.name}</Text>
                <Text className="mt-1.5 text-base text-slate-500">Renewal: {student.renewal_date || "-"}</Text>
              </View>
              <Text className={`text-lg font-bold ${days < 0 ? "text-rose-600" : "text-amber-600"}`}>{days < 0 ? `${Math.abs(days)}d late` : `${days}d left`}</Text>
            </View>
            {canDo("payments", "add") || canDo("paymentRequests", "add") ? (
              <TouchableOpacity
                onPress={() => {
                  if (canDo("payments", "add")) {
                    openPayment(student);
                    return;
                  }
                  setRequestField("student_id", student.id);
                  setActive("paymentRequests");
                }}
                className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5"
              >
                <Text className="text-center text-base font-semibold text-white">
                  {canDo("payments", "add") ? "Renew Now" : "Send Request"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </Card>
        );
      })}
    </>
  );

  const reportsView = (
    <>
      <Header title="Reports" subtitle="Revenue, expenses, and occupancy summary." />
      <View style={{ columnGap: statGap }} className="flex-row flex-wrap">
        <Stat style={statCardStyle} compact={compactStats} label="Revenue" value={money(monthRevenue)} icon={BarChart3} tone="bg-violet-50" />
        <Stat style={statCardStyle} compact={compactStats} label="Expenses" value={money(monthExpenses)} icon={Wallet2} tone="bg-rose-50" />
        <Stat style={statCardStyle} compact={compactStats} label="Net" value={money(monthRevenue - monthExpenses)} icon={BarChart3} tone="bg-emerald-50" />
        <Stat style={statCardStyle} compact={compactStats} label="Occupancy" value={`${occupiedSeats.length}/${data.seats.length}`} icon={Armchair} tone="bg-blue-50" />
      </View>
    </>
  );

  const admissionsView = (
    <>
      <Header
        title="Admissions"
        subtitle="Student intake and QR enrollment support."
        action={canDo("students", "add") ? "Add" : undefined}
        onAction={() => setModal("student")}
      />
      <Card><QrCode size={34} color="#4f46e5" /><Text className="mt-3 text-xl font-bold text-slate-950">QR Enrollment</Text><Text className="mt-2 text-base leading-6 text-slate-500">Use the web dashboard for printable QR forms. Mobile can create admissions instantly.</Text></Card>
      <View style={{ columnGap: statGap }} className="mt-5 flex-row flex-wrap"><Stat style={statCardStyle} compact={compactStats} label="Admissions" value={data.students.length} icon={Users2} tone="bg-blue-50" /><Stat style={statCardStyle} compact={compactStats} label="Reg Pending" value={data.students.filter((s) => !s.registration_paid).length} icon={Bell} tone="bg-rose-50" /></View>
    </>
  );

  const historyView = (
    <>
      <Header title="History" subtitle="Recent student, seat, fee, and settings activity." />
      {data.history.map((entry) => <Card key={entry.id} className="mb-4"><Text className="text-base font-bold uppercase text-indigo-600">{entry.object_type || "activity"} | {entry.action || "update"}</Text><Text className="mt-1.5 text-base text-slate-500">{entry.actor_role || "Admin"} changed {entry.object_id || "record"}</Text><Text className="mt-1 text-sm text-slate-400">{entry.created_at || ""}</Text></Card>)}
    </>
  );

  const expensesView = (
    <>
      <Header title="Expenses" subtitle="Operating expenses and payment modes." action={canDo("expenses", "add") ? "Add" : undefined} onAction={() => setModal("expense")} />
      {data.expenses.map((expense) => <Card key={expense.id} className="mb-4"><View className="flex-row justify-between gap-3"><View className="flex-1"><Text className="text-lg font-bold text-slate-950">{expense.title}</Text><Text className="mt-1.5 text-base text-slate-500">{expense.category || "misc"} | {expense.paid_via || "cash"}</Text><Text className="mt-1 text-sm text-slate-400">{expense.expense_date}</Text></View><Text className="text-xl font-bold text-rose-600">{money(expense.amount)}</Text></View></Card>)}
    </>
  );

  const settingsView = (
    <>
      <Header title="Settings" subtitle="Plans, roles, and account actions." action={canDo("settings", "add") ? "Plan" : undefined} onAction={() => setModal("plan")} />
      <Card className="mb-4"><Text className="text-lg font-bold text-slate-950">Fee Plans</Text>{data.plans.map((plan) => <View key={plan.id} className="mt-4 flex-row justify-between border-b border-slate-100 pb-4"><View><Text className="text-base font-semibold text-slate-900">{plan.name}</Text><Text className="text-base text-slate-500">{plan.duration_days} days</Text></View><Text className="text-lg font-bold text-slate-950">{money(plan.price)}</Text></View>)}</Card>
      <Card className="mb-4"><Text className="text-lg font-bold text-slate-950">Roles</Text>{data.roles.length ? data.roles.map((role) => <Text key={role.id} className="mt-2.5 text-base font-semibold text-slate-700">{role.name}</Text>) : <Text className="mt-2.5 text-base text-slate-500">No custom roles.</Text>}</Card>
      <TouchableOpacity onPress={logout} className="flex-row items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5"><LogOut size={20} color="white" /><Text className="text-lg font-bold text-white">Log Out</Text></TouchableOpacity>
    </>
  );

  const coordinatorView = (
    <>
      <Header
        title="Daily Coordination"
        subtitle="Send payment requests, monitor renewals, and verify student payments."
        action={canDo("paymentRequests", "add") ? "Request" : undefined}
        onAction={() => setActive("paymentRequests")}
      />
      <View style={{ columnGap: statGap }} className="flex-row flex-wrap">
        <Stat style={statCardStyle} compact={compactStats} label="Active Students" value={activeStudents.length} icon={Users2} tone="bg-emerald-50" onPress={() => setActive("students")} />
        <Stat style={statCardStyle} compact={compactStats} label="Renewals This Week" value={renewals.length} icon={CalendarClock} tone="bg-indigo-50" onPress={() => setActive("renewals")} />
        <Stat style={statCardStyle} compact={compactStats} label="Pending QR" value={pendingPayments.length} icon={QrCode} tone="bg-amber-50" onPress={() => setActive("payments")} />
        <Stat style={statCardStyle} compact={compactStats} label="Payment Requests" value={scheduledRequests.length} icon={Send} tone="bg-rose-50" onPress={() => setActive("paymentRequests")} />
      </View>

      <Card className="mb-4">
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-lg font-bold text-slate-950">Coordinator Access</Text>
            <Text className="mt-1 text-base text-slate-500">Limited workspace tools, no settings or expense access.</Text>
          </View>
          <Text className="rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-700">Limited</Text>
        </View>
        {[
          ["Send payment requests", "Create plan/payment requests for students."],
          ["Track renewals", "View due students and send renewal reminders."],
          ["Verify payments", "Review collections and pending QR payments."],
          ["View admissions", "See registrations without admin settings access."],
        ].map(([title, description]) => (
          <View key={title} className="mb-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <Text className="text-base font-bold text-slate-800">{title}</Text>
            <Text className="mt-1 text-sm text-slate-500">{description}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-slate-950">Recent Payments</Text>
          <TouchableOpacity onPress={() => setActive("payments")}><Text className="text-base font-bold text-indigo-600">View all</Text></TouchableOpacity>
        </View>
        {recentPayments.length ? (
          recentPayments.map((payment) => (
            <View key={payment.id} className="mb-3 flex-row items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
              <View className="flex-1 pr-3">
                <Text className="text-base font-bold text-slate-800">{payment.student_name || studentName(data.students, payment.student_id)}</Text>
                <Text className="mt-1 text-sm text-slate-400">{(payment.payment_mode || "-").toUpperCase()}</Text>
              </View>
              <Text className="text-base font-bold text-emerald-600">{money(payment.amount_paid)}</Text>
            </View>
          ))
        ) : (
          <Text className="rounded-xl bg-slate-50 px-4 py-8 text-center text-base text-slate-500">No payments recorded yet.</Text>
        )}
      </Card>
    </>
  );

  const paymentRequestsView = (
    <>
      <Header
        title="Send Payment Request"
        subtitle="Create a request for a student and track pending requests."
      />

      {canDo("paymentRequests", "add") ? (
        <Card className="mb-5">
          <View className="mb-5 flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-indigo-600">
              <Send size={22} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-slate-950">Request Details</Text>
              <Text className="mt-1 text-sm text-slate-500">The student receives this instantly in their app.</Text>
            </View>
          </View>

          {activeStudents.length ? (
            <ChipPicker
              label="Student"
              items={activeStudents}
              value={requestForm.student_id}
              onChange={(value) => setRequestField("student_id", value)}
              getLabel={(student) => `${student.name}${student.phone ? ` - ${student.phone}` : ""}`}
              getValue={(student) => student.id}
            />
          ) : (
            <Text className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-base text-rose-600">No active students available.</Text>
          )}

          {data.plans.length ? (
            <ChipPicker
              label="Plan"
              items={data.plans}
              value={requestForm.plan_id}
              onChange={(value) => setRequestField("plan_id", value)}
              getLabel={(plan) => `${plan.name} - ${money(plan.price)}`}
              getValue={(plan) => plan.id}
            />
          ) : (
            <Text className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-base text-rose-600">Create a plan before sending requests.</Text>
          )}

          <Text className="mb-2 text-sm font-semibold uppercase text-slate-500">Request Type</Text>
          <View className="mb-4 flex-row gap-3">
            {[
              ["custom", "Custom", Settings2],
              ["half_month", "15-Day", CalendarClock],
            ].map(([value, label, Icon]) => {
              const selected = requestForm.type === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => setRequestField("type", value)}
                  className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-3 py-3 ${selected ? "border-indigo-600 bg-indigo-600" : "border-slate-200 bg-white"}`}
                >
                  <Icon size={18} color={selected ? "white" : "#64748b"} />
                  <Text className={`text-base font-bold ${selected ? "text-white" : "text-slate-600"}`}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View className="mb-4 flex-row gap-3">
            <View className="flex-1">
              <Input
                label="Amount (Rs)"
                value={requestForm.amount}
                onChangeText={(value) => setRequestField("amount", value)}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Deposit"
                value={requestForm.deposit_amount}
                onChangeText={(value) => setRequestField("deposit_amount", value)}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
          </View>

          <View className="mb-4 flex-row gap-3">
            <View className="flex-1">
              <Input
                label="Valid From"
                value={requestForm.valid_from}
                onChangeText={(value) => setRequestField("valid_from", value)}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Valid Until"
                value={requestForm.valid_until}
                onChangeText={(value) => setRequestField("valid_until", value)}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setRequestField("late_fee_enabled", !requestForm.late_fee_enabled)}
            className={`mb-3 flex-row items-center gap-3 rounded-xl border px-4 py-3 ${requestForm.late_fee_enabled ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}
          >
            <Calculator size={19} color={requestForm.late_fee_enabled ? "#d97706" : "#64748b"} />
            <View className="flex-1">
              <Text className="text-base font-bold text-slate-800">Late Fee</Text>
              <Text className="text-sm text-slate-500">Add an end-of-month fee.</Text>
            </View>
            <Text className="text-base font-bold text-slate-700">{requestForm.late_fee_enabled ? "On" : "Off"}</Text>
          </TouchableOpacity>
          {requestForm.late_fee_enabled ? (
            <Input label="Late Fee Amount" value={requestForm.late_fee_amount} onChangeText={(value) => setRequestField("late_fee_amount", value)} placeholder="0" keyboardType="numeric" />
          ) : null}

          <TouchableOpacity
            disabled={!canDiscountRequest}
            onPress={() => setRequestField("discount_enabled", !requestForm.discount_enabled)}
            className={`mb-3 flex-row items-center gap-3 rounded-xl border px-4 py-3 ${requestForm.discount_enabled ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"} ${canDiscountRequest ? "" : "opacity-60"}`}
          >
            <PiggyBank size={19} color={requestForm.discount_enabled ? "#e11d48" : "#64748b"} />
            <View className="flex-1">
              <Text className="text-base font-bold text-slate-800">Discount</Text>
              <Text className="text-sm text-slate-500">Available for plans of 180 days or more.</Text>
            </View>
            <Text className="text-base font-bold text-slate-700">{requestForm.discount_enabled ? "On" : "Off"}</Text>
          </TouchableOpacity>
          {requestForm.discount_enabled && canDiscountRequest ? (
            <Input label="Discount Amount" value={requestForm.discount_amount} onChangeText={(value) => setRequestField("discount_amount", value)} placeholder="0" keyboardType="numeric" />
          ) : null}

          <TouchableOpacity
            disabled={!canOfferSeatSelection}
            onPress={() => setRequestField("allow_seat_selection", !requestForm.allow_seat_selection)}
            className={`mb-4 flex-row items-center gap-3 rounded-xl border px-4 py-3 ${requestForm.allow_seat_selection ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"} ${canOfferSeatSelection ? "" : "opacity-60"}`}
          >
            <Armchair size={19} color={requestForm.allow_seat_selection ? "#059669" : "#64748b"} />
            <View className="flex-1">
              <Text className="text-base font-bold text-slate-800">Allow Seat Selection</Text>
              <Text className="text-sm text-slate-500">
                {selectedRequestStudent?.current_seat_id
                  ? "Student already has a seat."
                  : availableSeats.length
                  ? `${availableSeats.length} seats available after payment.`
                  : "No available seats right now."}
              </Text>
            </View>
            <Text className="text-base font-bold text-slate-700">{requestForm.allow_seat_selection ? "On" : "Off"}</Text>
          </TouchableOpacity>

          <Input
            label="Note to Student"
            value={requestForm.notes}
            onChangeText={(value) => setRequestField("notes", value)}
            placeholder="e.g. Remaining days for April"
          />

          <View className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
            <View className="flex-row items-center gap-2">
              <Calculator size={18} color="#4f46e5" />
              <Text className="text-sm font-bold uppercase text-indigo-700">Total to Collect</Text>
            </View>
            <Text className="mt-2 text-2xl font-bold text-indigo-700">{money(requestTotal)}</Text>
            <Text className="mt-1 text-sm text-slate-500">
              Plan {money(requestPlanAmount)}
              {requestDeposit ? ` + Deposit ${money(requestDeposit)}` : ""}
              {requestLateFee ? ` + Late fee ${money(requestLateFee)}` : ""}
              {requestDiscount ? ` - Discount ${money(requestDiscount)}` : ""}
            </Text>
          </View>

          <TouchableOpacity
            disabled={requestBusy || !activeStudents.length || !data.plans.length}
            onPress={submitPaymentRequest}
            className="flex-row items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 disabled:opacity-60"
          >
            <Send size={20} color="white" />
            <Text className="text-lg font-bold text-white">{requestBusy ? "Sending..." : "Send Request to Student"}</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      <Card>
        <View className="mb-4 flex-row items-center gap-3">
          <ClipboardList size={22} color="#4f46e5" />
          <View className="flex-1">
            <Text className="text-lg font-bold text-slate-950">Sent & Pending Requests</Text>
            <Text className="text-sm text-slate-500">{scheduledRequests.length} pending request(s)</Text>
          </View>
        </View>
        {scheduledRequests.length ? (
          scheduledRequests.map((request) => (
            <View key={request.id} className="mb-4 rounded-xl border border-slate-100 px-4 py-3">
              <View className="flex-row justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-base font-bold text-slate-950">{request.student_name || studentName(data.students, request.student_id)}</Text>
                  <Text className="mt-1 text-sm text-slate-500">{request.type === "half_month" ? "15-Day" : "Custom"} | {request.plan_name || planName(data.plans, request.plan_id)}</Text>
                  <Text className="mt-1 text-sm text-slate-400">{request.valid_from} to {request.valid_until}</Text>
                </View>
                <Text className="text-lg font-bold text-indigo-700">{money(request.total_amount ?? request.amount)}</Text>
              </View>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {Number(request.deposit_amount) > 0 ? <Text className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Deposit {money(request.deposit_amount)}</Text> : null}
                {request.late_fee_enabled && Number(request.late_fee_amount) > 0 ? <Text className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Late {money(request.late_fee_amount)}</Text> : null}
                {request.discount_enabled && Number(request.discount_amount) > 0 ? <Text className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">Discount {money(request.discount_amount)}</Text> : null}
                {request.allow_seat_selection ? <Text className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">Seat choice</Text> : null}
              </View>
              {request.notes ? <Text className="mt-3 text-sm text-slate-500">{request.notes}</Text> : null}
              {canDo("paymentRequests", "delete") ? (
                <TouchableOpacity
                  disabled={cancelRequestId === request.id}
                  onPress={() => cancelScheduledRequest(request.id)}
                  className="mt-4 flex-row items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5"
                >
                  <XCircle size={18} color="#e11d48" />
                  <Text className="text-base font-bold text-rose-600">{cancelRequestId === request.id ? "Cancelling..." : "Cancel Request"}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        ) : (
          <View className="items-center rounded-xl bg-slate-50 px-4 py-10">
            <Inbox size={34} color="#94a3b8" />
            <Text className="mt-3 text-base text-slate-500">No pending scheduled requests.</Text>
          </View>
        )}
      </Card>
    </>
  );

  const views = {
    coordinator: coordinatorView,
    dashboard: dashboardView,
    students: studentsView,
    seats: seatsView,
    payments: paymentsView,
    paymentRequests: paymentRequestsView,
    renewals: renewalsView,
    reports: reportsView,
    admissions: admissionsView,
    history: historyView,
    expenses: expensesView,
    settings: settingsView,
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Animated Sidebar Drawer */}
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}
        pointerEvents={drawerOpen ? "auto" : "none"}
      >
        <Animated.View
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", opacity: overlayOpacity }}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setDrawerOpen(false)} />
        </Animated.View>
        <Animated.View
          style={{
            height: "100%",
            width: 320,
            backgroundColor: "white",
            paddingTop: 56,
            transform: [{ translateX: drawerTranslateX }],
            elevation: 10,
            shadowColor: "#000",
            shadowOffset: { width: 2, height: 0 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
          }}
        >
          <View className="px-6 pb-6 border-b border-slate-100">
            <View className="flex-row items-center gap-3">
              <View className="h-14 w-14 items-center justify-center rounded-2xl overflow-hidden bg-white border border-slate-100">
                <Image
                  source={require("../../assets/logo.png")}
                  style={{ width: 56, height: 56 }}
                  resizeMode="contain"
                />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-slate-950">Aardhya Abhyasika</Text>
                <Text className="text-xs text-slate-500" numberOfLines={1}>{admin?.email || "Admin"}</Text>
              </View>
            </View>
          </View>
          <ScrollView className="flex-1 px-3 pt-4" showsVerticalScrollIndicator={false}>
            {visibleViews.map((item) => {
              const Icon = icons[item.icon] || LayoutDashboard;
              const selected = active === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => { setActive(item.id); setDrawerOpen(false); }}
                  className={`mb-1.5 flex-row items-center gap-3.5 rounded-xl px-5 py-3.5 ${selected ? "bg-indigo-600" : "bg-transparent"}`}
                >
                  <Icon size={22} color={selected ? "white" : "#64748b"} />
                  <Text className={`text-base font-semibold ${selected ? "text-white" : "text-slate-700"}`}>{item.label}</Text>
                  {selected ? <View className="ml-auto h-2.5 w-2.5 rounded-full bg-white" /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View className="border-t border-slate-100 px-4 pb-10 pt-4">
            <TouchableOpacity
              onPress={() => { setDrawerOpen(false); logout(); }}
              className="flex-row items-center gap-3 rounded-xl bg-slate-950 px-5 py-3.5"
            >
              <LogOut size={20} color="white" />
              <Text className="text-base font-bold text-white">Log Out</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      {/* Header */}
      <View className="border-b border-slate-100 bg-white px-5 py-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => setDrawerOpen(true)} className="rounded-xl bg-slate-100 p-3">
              <Menu size={24} color="#334155" />
            </TouchableOpacity>
            <View>
              <Text className="text-xl font-bold text-slate-950">{visibleViews.find(v => v.id === active)?.label || "Dashboard"}</Text>
              <Text className="text-sm text-slate-500">{admin?.email || "Mobile admin"}</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => setNotificationsOpen(true)}
              className="rounded-xl bg-amber-50 p-3"
            >
              <View>
                <Bell size={22} color="#d97706" />
                {notifications.length ? (
                  <View className="absolute -right-2 -top-2 min-w-[18px] rounded-full bg-rose-500 px-1 py-0.5">
                    <Text className="text-center text-[10px] font-bold text-white">
                      {Math.min(notifications.length, 9)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSync}
              disabled={refreshing}
              className="rounded-xl bg-indigo-50 p-3"
            >
              <Animated.View style={{ transform: [{ rotate: syncRotate }] }}>
                <RefreshCw size={22} color="#4f46e5" />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>
        {error ? <Text className="mt-3 rounded-xl bg-rose-50 px-4 py-2.5 text-base text-rose-600">{error}</Text> : null}
      </View>

      <ScrollView className="flex-1 px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>{views[active] || views[visibleViews[0]?.id] || dashboardView}</ScrollView>

      <Sheet title="Notifications" visible={notificationsOpen} onClose={() => setNotificationsOpen(false)}>
        {notifications.length === 0 ? (
          <Card>
            <Text className="text-base text-slate-500">No notifications right now.</Text>
          </Card>
        ) : (
          notifications.map((notification) => (
            <Card key={notification.id} className="mb-4">
              <Text
                className={`text-sm font-bold uppercase ${
                  notification.tone === "approval"
                    ? "text-amber-600"
                    : notification.tone === "scheduled"
                    ? "text-indigo-600"
                    : notification.tone === "renewal"
                    ? "text-rose-600"
                    : "text-slate-500"
                }`}
              >
                {notification.title}
              </Text>
              <Text className="mt-2 text-base font-semibold text-slate-950">
                {notification.message}
              </Text>
              <Text className="mt-1 text-sm text-slate-500">{notification.subtitle}</Text>
              <Text className="mt-2 text-xs text-slate-400">
                {notification.date.toLocaleString("en-IN")}
              </Text>

              {notification.pendingId ? (
                <View className="mt-4 flex-row gap-3">
                  <TouchableOpacity
                    disabled={notificationActionId === `approve:${notification.pendingId}` || notificationActionId === `reject:${notification.pendingId}`}
                    onPress={() => approvePendingRequest(notification.pendingId)}
                    className="flex-1 rounded-xl bg-emerald-600 px-4 py-3"
                  >
                    <Text className="text-center text-base font-semibold text-white">
                      {notificationActionId === `approve:${notification.pendingId}` ? "Approving..." : "Approve"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={notificationActionId === `approve:${notification.pendingId}` || notificationActionId === `reject:${notification.pendingId}`}
                    onPress={() => rejectPendingRequest(notification.pendingId)}
                    className="flex-1 rounded-xl border border-rose-200 px-4 py-3"
                  >
                    <Text className="text-center text-base font-semibold text-rose-600">
                      {notificationActionId === `reject:${notification.pendingId}` ? "Rejecting..." : "Reject"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </Card>
          ))
        )}
      </Sheet>

      <Sheet title="New Student" visible={modal === "student"} onClose={() => setModal("")}>
        <Input label="Name" value={studentForm.name} onChangeText={(name) => setStudentForm((p) => ({ ...p, name }))} placeholder="Student name" />
        <Input label="Phone" value={studentForm.phone} onChangeText={(phone) => setStudentForm((p) => ({ ...p, phone }))} placeholder="10 digit phone" keyboardType="phone-pad" />
        <Input label="Email" value={studentForm.email} onChangeText={(email) => setStudentForm((p) => ({ ...p, email }))} placeholder="Optional email" keyboardType="email-address" />
        <Input label="Join Date" value={studentForm.join_date} onChangeText={(join_date) => setStudentForm((p) => ({ ...p, join_date }))} placeholder="YYYY-MM-DD" />
        <ChipPicker label="Plan" items={data.plans} value={studentForm.current_plan_id} onChange={(current_plan_id) => setStudentForm((p) => ({ ...p, current_plan_id }))} getLabel={(plan) => plan.name} getValue={(plan) => plan.id} />
        <TouchableOpacity disabled={busy} onPress={submitStudent} className="mt-3 rounded-xl bg-indigo-600 px-5 py-3.5"><Text className="text-center text-lg font-bold text-white">{busy ? "Saving..." : "Save Student"}</Text></TouchableOpacity>
      </Sheet>

      <Sheet title="Log Payment" visible={modal === "payment"} onClose={() => setModal("")}>
        <ChipPicker label="Student" items={data.students} value={paymentForm.student_id} onChange={(student_id) => setPaymentForm((p) => ({ ...p, student_id }))} getLabel={(student) => student.name} getValue={(student) => student.id} />
        <ChipPicker label="Plan" items={data.plans} value={paymentForm.plan_id} onChange={(plan_id) => { const plan = data.plans.find((p) => p.id === plan_id); setPaymentForm((p) => ({ ...p, plan_id, amount_paid: plan?.price?.toString() || p.amount_paid })); }} getLabel={(plan) => `${plan.name} (${money(plan.price)})`} getValue={(plan) => plan.id} />
        <Input label="Amount" value={paymentForm.amount_paid} onChangeText={(amount_paid) => setPaymentForm((p) => ({ ...p, amount_paid }))} placeholder="Amount paid" keyboardType="numeric" />
        <Input label="Valid From" value={paymentForm.valid_from} onChangeText={(valid_from) => setPaymentForm((p) => ({ ...p, valid_from }))} placeholder="YYYY-MM-DD" />
        <ChipPicker label="Mode" items={[{ label: "UPI", value: "upi" }, { label: "Cash", value: "cash" }, { label: "Card", value: "card" }, { label: "Bank", value: "bank" }]} value={paymentForm.payment_mode} onChange={(payment_mode) => setPaymentForm((p) => ({ ...p, payment_mode }))} getLabel={(item) => item.label} getValue={(item) => item.value} />
        <TouchableOpacity disabled={busy} onPress={submitPayment} className="mt-3 rounded-xl bg-indigo-600 px-5 py-3.5"><Text className="text-center text-lg font-bold text-white">{busy ? "Saving..." : "Save Payment"}</Text></TouchableOpacity>
      </Sheet>

      <Sheet title="Add Expense" visible={modal === "expense"} onClose={() => setModal("")}>
        <Input label="Title" value={expenseForm.title} onChangeText={(title) => setExpenseForm((p) => ({ ...p, title }))} placeholder="Expense title" />
        <Input label="Amount" value={expenseForm.amount} onChangeText={(amount) => setExpenseForm((p) => ({ ...p, amount }))} placeholder="Amount" keyboardType="numeric" />
        <Input label="Date" value={expenseForm.expense_date} onChangeText={(expense_date) => setExpenseForm((p) => ({ ...p, expense_date }))} placeholder="YYYY-MM-DD" />
        <Input label="Category" value={expenseForm.category} onChangeText={(category) => setExpenseForm((p) => ({ ...p, category }))} placeholder="misc" />
        <TouchableOpacity disabled={busy} onPress={submitExpense} className="mt-3 rounded-xl bg-indigo-600 px-5 py-3.5"><Text className="text-center text-lg font-bold text-white">{busy ? "Saving..." : "Save Expense"}</Text></TouchableOpacity>
      </Sheet>

      <Sheet title="Add Seat" visible={modal === "seat"} onClose={() => setModal("")}>
        <Input label="Seat Number" value={seatForm.seat_number} onChangeText={(seat_number) => setSeatForm({ seat_number })} placeholder="A1" />
        <TouchableOpacity disabled={busy} onPress={submitSeat} className="mt-3 rounded-xl bg-indigo-600 px-5 py-3.5"><Text className="text-center text-lg font-bold text-white">{busy ? "Saving..." : "Save Seat"}</Text></TouchableOpacity>
      </Sheet>

      <Sheet title="Assign Seat" visible={modal === "assign"} onClose={() => setModal("")}>
        <ChipPicker label="Seat" items={availableSeats} value={assignForm.seatId} onChange={(seatId) => setAssignForm((p) => ({ ...p, seatId }))} getLabel={(seat) => seat.seat_number} getValue={(seat) => seat.id} />
        <ChipPicker label="Student" items={availableStudents} value={assignForm.studentId} onChange={(studentId) => setAssignForm((p) => ({ ...p, studentId }))} getLabel={(student) => student.name} getValue={(student) => student.id} />
        <TouchableOpacity disabled={busy} onPress={submitAssign} className="mt-3 rounded-xl bg-indigo-600 px-5 py-3.5"><Text className="text-center text-lg font-bold text-white">{busy ? "Saving..." : "Assign Seat"}</Text></TouchableOpacity>
      </Sheet>

      <Sheet title="New Fee Plan" visible={modal === "plan"} onClose={() => setModal("")}>
        <Input label="Plan Name" value={planForm.name} onChangeText={(name) => setPlanForm((p) => ({ ...p, name }))} placeholder="Monthly" />
        <Input label="Price" value={planForm.price} onChangeText={(price) => setPlanForm((p) => ({ ...p, price }))} placeholder="0" keyboardType="numeric" />
        <Input label="Duration Days" value={planForm.duration_days} onChangeText={(duration_days) => setPlanForm((p) => ({ ...p, duration_days }))} placeholder="30" keyboardType="numeric" />
        <TouchableOpacity disabled={busy} onPress={submitPlan} className="mt-3 rounded-xl bg-indigo-600 px-5 py-3.5"><Text className="text-center text-lg font-bold text-white">{busy ? "Saving..." : "Save Plan"}</Text></TouchableOpacity>
      </Sheet>
    </SafeAreaView>
  );
}
