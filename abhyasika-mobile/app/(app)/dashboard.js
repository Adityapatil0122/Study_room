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
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Settings2,
  Users2,
  Wallet2,
  X,
} from "lucide-react-native";
import { createApiClient } from "../../lib/apiClient";
import { useAuth } from "../../context/AuthContext";
import { VIEW_DEFINITIONS } from "../../constants/views";

const icons = {
  LayoutDashboard,
  Users2,
  Armchair,
  CreditCard,
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
  const { admin, logout } = useAuth();
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
  const [offerSeatsForm, setOfferSeatsForm] = useState({ studentId: "", studentName: "", seatIds: [] });
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

  // Drawer slide animation
  const drawerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(drawerAnim, {
      toValue: drawerOpen ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [drawerOpen, drawerAnim]);

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

  const audit = { actor_id: admin?.id, actor_role: admin?.name || admin?.email || "Mobile admin" };
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

  const submitStudent = () => {
    if (!studentForm.name.trim() || !studentForm.phone.trim()) {
      Alert.alert("Missing details", "Student name and phone are required.");
      return;
    }
    save(() => api.createStudent({ ...studentForm, registration_source: "mobile_app", audit }), "students");
  };

  const submitPayment = () => {
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
    if (!expenseForm.title.trim() || !expenseForm.amount) {
      Alert.alert("Missing details", "Expense title and amount are required.");
      return;
    }
    save(() => api.createExpense({ ...expenseForm, amount: Number(expenseForm.amount), audit }), "expenses");
  };

  const submitSeat = () => {
    if (!seatForm.seat_number.trim()) {
      Alert.alert("Missing details", "Seat number is required.");
      return;
    }
    save(() => api.createSeat({ seat_number: seatForm.seat_number.trim(), status: "available", audit }), "seats");
  };

  const submitPlan = () => {
    if (!planForm.name.trim()) {
      Alert.alert("Missing details", "Plan name is required.");
      return;
    }
    save(() => api.createPlan({ ...planForm, price: Number(planForm.price || 0), duration_days: Number(planForm.duration_days || 30), is_active: true, audit }), "settings");
  };

  const submitAssign = () => {
    if (!assignForm.seatId || !assignForm.studentId) {
      Alert.alert("Missing details", "Select seat and student.");
      return;
    }
    save(() => api.assignSeat({ ...assignForm, audit }), "seats");
  };

  const openOfferSeats = (student) => {
    setOfferSeatsForm({ studentId: student.id, studentName: student.name, seatIds: [] });
    setModal("offerSeats");
  };

  const toggleOfferedSeat = (seatId) => {
    setOfferSeatsForm((prev) => ({
      ...prev,
      seatIds: prev.seatIds.includes(seatId)
        ? prev.seatIds.filter((id) => id !== seatId)
        : [...prev.seatIds, seatId],
    }));
  };

  const submitOfferSeats = () => {
    if (!offerSeatsForm.studentId) {
      Alert.alert("Error", "No student selected.");
      return;
    }
    if (offerSeatsForm.seatIds.length === 0) {
      Alert.alert("Missing details", "Select at least one seat to send.");
      return;
    }
    save(() => api.sendSeatsToStudent(offerSeatsForm.studentId, offerSeatsForm.seatIds));
  };

  const releaseSeat = (seat) => {
    Alert.alert("Release seat?", `Remove current student from ${seat.seat_number}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Release", style: "destructive", onPress: () => save(() => api.deallocateSeat({ seatId: seat.id, audit }), "seats") },
    ]);
  };

  const openPayment = (student) => {
    const plan = data.plans.find((item) => item.id === student.current_plan_id) || data.plans[0];
    setPaymentForm({ student_id: student.id, plan_id: plan?.id || "", amount_paid: plan?.price?.toString() || "", valid_from: today(), payment_mode: "upi" });
    setModal("payment");
  };

  const openAssign = (seat) => {
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
      <Header title="Welcome Admin" subtitle="Tap a card to jump to that section." />
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
      <Header title="Student Management" subtitle={`${data.students.length} total. KYC, plans, seats, and billing.`} action="New" onAction={() => setModal("student")} />
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
          <View className="mt-4 flex-row gap-3 flex-wrap">
            <TouchableOpacity onPress={() => openPayment(student)} className="rounded-xl bg-indigo-600 px-4 py-2.5"><Text className="text-base font-semibold text-white">Payment</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => openOfferSeats(student)} className="rounded-xl bg-emerald-600 px-4 py-2.5"><Text className="text-base font-semibold text-white">Send Seats</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => save(() => api.toggleStudentActive(student.id, audit), "students")} className="rounded-xl border border-slate-200 px-4 py-2.5"><Text className="text-base font-semibold text-slate-700">Toggle</Text></TouchableOpacity>
          </View>
        </Card>
      ))}
    </>
  );

  const seatsView = (
    <>
      <Header title="Seat Manager" subtitle={`${occupiedSeats.length} occupied, ${availableSeats.length} available.`} action="Add" onAction={() => setModal("seat")} />
      <View style={{ columnGap: seatGap }} className="flex-row flex-wrap">
        {sortedSeats.map((seat) => {
          const occupied = seat.status === "occupied";
          return (
            <Card key={seat.id} style={{ width: seatCardWidth }} className={`mb-4 ${occupied ? "bg-indigo-50" : "bg-white"}`}>
              <Text className="text-2xl font-bold text-slate-950">{seat.seat_number}</Text>
              <Text className={`mt-1.5 text-sm font-bold uppercase ${occupied ? "text-indigo-600" : "text-emerald-600"}`}>{occupied ? "Occupied" : "Available"}</Text>
              <Text className="mt-2 text-sm text-slate-500" numberOfLines={2}>{occupied ? studentName(data.students, seat.current_student_id) : "Ready"}</Text>
              <TouchableOpacity onPress={() => (occupied ? releaseSeat(seat) : openAssign(seat))} className={`mt-4 rounded-xl px-4 py-2.5 ${occupied ? "bg-rose-600" : "bg-indigo-600"}`}><Text className="text-center text-base font-semibold text-white">{occupied ? "Release" : "Assign"}</Text></TouchableOpacity>
            </Card>
          );
        })}
      </View>
    </>
  );

  const paymentsView = (
    <>
      <Header title="Payments" subtitle="Fees, validity, and collection modes." action="Log" onAction={() => setModal("payment")} />
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
            <TouchableOpacity onPress={() => openPayment(student)} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5"><Text className="text-center text-base font-semibold text-white">Renew Now</Text></TouchableOpacity>
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
      <Header title="Admissions" subtitle="Student intake and QR enrollment support." action="Add" onAction={() => setModal("student")} />
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
      <Header title="Expenses" subtitle="Operating expenses and payment modes." action="Add" onAction={() => setModal("expense")} />
      {data.expenses.map((expense) => <Card key={expense.id} className="mb-4"><View className="flex-row justify-between gap-3"><View className="flex-1"><Text className="text-lg font-bold text-slate-950">{expense.title}</Text><Text className="mt-1.5 text-base text-slate-500">{expense.category || "misc"} | {expense.paid_via || "cash"}</Text><Text className="mt-1 text-sm text-slate-400">{expense.expense_date}</Text></View><Text className="text-xl font-bold text-rose-600">{money(expense.amount)}</Text></View></Card>)}
    </>
  );

  const settingsView = (
    <>
      <Header title="Settings" subtitle="Plans, roles, and account actions." action="Plan" onAction={() => setModal("plan")} />
      <Card className="mb-4"><Text className="text-lg font-bold text-slate-950">Fee Plans</Text>{data.plans.map((plan) => <View key={plan.id} className="mt-4 flex-row justify-between border-b border-slate-100 pb-4"><View><Text className="text-base font-semibold text-slate-900">{plan.name}</Text><Text className="text-base text-slate-500">{plan.duration_days} days</Text></View><Text className="text-lg font-bold text-slate-950">{money(plan.price)}</Text></View>)}</Card>
      <Card className="mb-4"><Text className="text-lg font-bold text-slate-950">Roles</Text>{data.roles.length ? data.roles.map((role) => <Text key={role.id} className="mt-2.5 text-base font-semibold text-slate-700">{role.name}</Text>) : <Text className="mt-2.5 text-base text-slate-500">No custom roles.</Text>}</Card>
      <TouchableOpacity onPress={logout} className="flex-row items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5"><LogOut size={20} color="white" /><Text className="text-lg font-bold text-white">Log Out</Text></TouchableOpacity>
    </>
  );

  const views = {
    dashboard: dashboardView,
    students: studentsView,
    seats: seatsView,
    payments: paymentsView,
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
            {VIEW_DEFINITIONS.map((item) => {
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
              <Text className="text-xl font-bold text-slate-950">{VIEW_DEFINITIONS.find(v => v.id === active)?.label || "Dashboard"}</Text>
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

      <ScrollView className="flex-1 px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>{views[active]}</ScrollView>

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

      <Sheet title={`Send Seats to ${offerSeatsForm.studentName || "Student"}`} visible={modal === "offerSeats"} onClose={() => setModal("")}>
        <Text className="mb-3 text-sm text-slate-500">
          Select one or more available seats to send to this student. They will only see these options.
        </Text>
        {availableSeats.length === 0 ? (
          <Text className="text-base text-slate-500 py-4 text-center">No available seats right now.</Text>
        ) : (
          <View className="flex-row flex-wrap gap-3 mb-4">
            {availableSeats.map((seat) => {
              const selected = offerSeatsForm.seatIds.includes(seat.id);
              return (
                <TouchableOpacity
                  key={seat.id}
                  onPress={() => toggleOfferedSeat(seat.id)}
                  className={`rounded-xl border-2 px-5 py-3 ${selected ? "border-emerald-600 bg-emerald-600" : "border-slate-200 bg-white"}`}
                >
                  <Text className={`text-base font-bold ${selected ? "text-white" : "text-slate-700"}`}>{seat.seat_number}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {offerSeatsForm.seatIds.length > 0 ? (
          <Text className="mb-3 text-sm text-emerald-700 font-semibold">
            {offerSeatsForm.seatIds.length} seat(s) selected
          </Text>
        ) : null}
        <TouchableOpacity disabled={busy || offerSeatsForm.seatIds.length === 0} onPress={submitOfferSeats} className={`mt-1 rounded-xl bg-emerald-600 px-5 py-3.5 ${(busy || offerSeatsForm.seatIds.length === 0) ? "opacity-50" : ""}`}>
          <Text className="text-center text-lg font-bold text-white">{busy ? "Sending..." : "Send to Student"}</Text>
        </TouchableOpacity>
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
