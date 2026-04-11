import {
  ActivityIndicator,
  Alert,
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Armchair,
  BarChart3,
  Bell,
  CalendarClock,
  CreditCard,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Plus,
  QrCode,
  RefreshCcw,
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

function Card({ children, className = "", style }) {
  return <View style={style} className={`rounded-lg border border-slate-100 bg-white p-4 shadow-sm ${className}`}>{children}</View>;
}

function Stat({ label, value, icon: Icon = BarChart3, tone = "bg-slate-100", style, compact = false }) {
  return (
    <Card style={style} className="mb-3">
      <View className={`mb-3 items-center justify-center rounded-lg ${compact ? "h-9 w-9" : "h-10 w-10"} ${tone}`}>
        <Icon size={compact ? 17 : 19} color="#334155" />
      </View>
      <Text className="text-xs font-semibold uppercase text-slate-400">{label}</Text>
      <Text className={`${compact ? "text-lg" : "text-xl"} mt-1 font-bold text-slate-950`}>{value}</Text>
    </Card>
  );
}

function Header({ title, subtitle, action, onAction }) {
  return (
    <View className="mb-4 flex-row items-start justify-between gap-3">
      <View className="flex-1">
        <Text className="text-2xl font-bold text-slate-950">{title}</Text>
        <Text className="mt-1 text-sm text-slate-500">{subtitle}</Text>
      </View>
      {action ? (
        <TouchableOpacity onPress={onAction} className="flex-row items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2">
          <Plus size={15} color="white" />
          <Text className="text-sm font-semibold text-white">{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Input({ label, value, onChangeText, placeholder, keyboardType = "default" }) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-xs font-semibold uppercase text-slate-500">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-base text-slate-900"
      />
    </View>
  );
}

function ChipPicker({ label, items, value, onChange, getLabel, getValue }) {
  return (
    <View className="mb-3">
      <Text className="mb-2 text-xs font-semibold uppercase text-slate-500">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {items.map((item) => {
            const itemValue = getValue(item);
            const active = value === itemValue;
            return (
              <TouchableOpacity
                key={String(itemValue)}
                onPress={() => onChange(itemValue)}
                className={`rounded-lg border px-3 py-2 ${active ? "border-indigo-600 bg-indigo-600" : "border-slate-200 bg-white"}`}
              >
                <Text className={`text-sm font-semibold ${active ? "text-white" : "text-slate-600"}`}>{getLabel(item)}</Text>
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
        <View className="max-h-[88%] rounded-t-lg bg-white">
          <View className="flex-row items-center justify-between border-b border-slate-100 px-5 py-4">
            <Text className="text-lg font-bold text-slate-950">{title}</Text>
            <Pressable onPress={onClose} className="rounded-lg bg-slate-100 p-2">
              <X size={18} color="#334155" />
            </Pressable>
          </View>
          <ScrollView className="px-5 py-4" keyboardShouldPersistTaps="handled">{children}<View className="h-8" /></ScrollView>
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
  const [busy, setBusy] = useState(false);
  const [studentForm, setStudentForm] = useState({ name: "", phone: "", email: "", join_date: today(), current_plan_id: "" });
  const [paymentForm, setPaymentForm] = useState({ student_id: "", plan_id: "", amount_paid: "", valid_from: today(), payment_mode: "upi" });
  const [expenseForm, setExpenseForm] = useState({ title: "", amount: "", category: "misc", expense_date: today(), paid_via: "cash" });
  const [seatForm, setSeatForm] = useState({ seat_number: "" });
  const [assignForm, setAssignForm] = useState({ seatId: "", studentId: "" });
  const [planForm, setPlanForm] = useState({ name: "", price: "", duration_days: "30" });
  const contentWidth = Math.max(width - 32, 280);
  const statGap = 10;
  const statColumns = contentWidth < 330 ? 1 : contentWidth >= 720 ? 3 : 2;
  const statWidth = (contentWidth - statGap * (statColumns - 1)) / statColumns;
  const statCardStyle = { width: statWidth, minHeight: contentWidth < 360 ? 92 : 98 };
  const compactStats = contentWidth < 370;

  const load = useCallback(async () => {
    setError("");
    const [students, seats, plans, payments, expenses, categories, history, roles] = await Promise.all([
      api.listStudents(),
      api.listSeats(),
      api.listPlans(),
      api.listPayments({ limit: 500 }),
      api.listExpenses(),
      api.listExpenseCategories(),
      api.listHistory({ limit: 80 }).catch(() => []),
      api.listRoles().catch(() => []),
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
  }, [api]);

  useEffect(() => {
    load().catch((err) => setError(err.message || "Unable to load workspace.")).finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (data.plans[0]) {
      setStudentForm((form) => ({ ...form, current_plan_id: form.current_plan_id || data.plans[0].id }));
      setPaymentForm((form) => ({ ...form, plan_id: form.plan_id || data.plans[0].id }));
    }
  }, [data.plans]);

  const refresh = async () => {
    setRefreshing(true);
    await load().catch((err) => setError(err.message || "Unable to refresh."));
    setRefreshing(false);
  };

  const audit = { actor_id: admin?.id, actor_role: admin?.name || admin?.email || "Mobile admin" };
  const activeStudents = data.students.filter((student) => student.is_active);
  const availableSeats = data.seats.filter((seat) => seat.status !== "occupied");
  const occupiedSeats = data.seats.filter((seat) => seat.status === "occupied");
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

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text className="mt-3 text-sm font-semibold text-slate-500">Loading full dashboard...</Text>
      </SafeAreaView>
    );
  }

  const dashboardView = (
    <>
      <Header title="Welcome Admin" subtitle="Full admin dashboard scaled for phone." action="Refresh" onAction={refresh} />
      <View style={{ columnGap: statGap }} className="flex-row flex-wrap">
        <Stat style={statCardStyle} compact={compactStats} label="Total Students" value={data.students.length} icon={Users2} tone="bg-blue-50" />
        <Stat style={statCardStyle} compact={compactStats} label="Active Students" value={activeStudents.length} icon={Users2} tone="bg-emerald-50" />
        <Stat style={statCardStyle} compact={compactStats} label="Seats Available" value={`${availableSeats.length} free`} icon={Armchair} tone="bg-slate-100" />
        <Stat style={statCardStyle} compact={compactStats} label="Revenue Month" value={money(monthRevenue)} icon={BarChart3} tone="bg-violet-50" />
        <Stat style={statCardStyle} compact={compactStats} label="Renewals 7 Days" value={renewals.length} icon={Bell} tone="bg-amber-50" />
        <Stat style={statCardStyle} compact={compactStats} label="Expenses Month" value={money(monthExpenses)} icon={Wallet2} tone="bg-rose-50" />
      </View>
    </>
  );

  const studentsView = (
    <>
      <Header title="Student Management" subtitle={`${data.students.length} total. KYC, plans, seats, and billing.`} action="New" onAction={() => setModal("student")} />
      <View className="mb-4 flex-row items-center rounded-lg border border-slate-200 bg-white px-3 py-2">
        <Search size={17} color="#94a3b8" />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search students" placeholderTextColor="#94a3b8" className="ml-2 flex-1 text-base text-slate-900" />
      </View>
      {filteredStudents.map((student) => (
        <Card key={student.id} className="mb-3">
          <View className="flex-row justify-between gap-3">
            <View className="flex-1">
              <Text className="text-lg font-bold text-slate-950">{student.name}</Text>
              <Text className="mt-1 text-sm text-slate-500">{student.phone || "No phone"}</Text>
              <Text className="mt-1 text-sm text-slate-500">{planName(data.plans, student.current_plan_id)} | Seat {data.seats.find((seat) => seat.id === student.current_seat_id)?.seat_number || "None"}</Text>
            </View>
            <Text className={`self-start rounded-lg px-2 py-1 text-xs font-bold ${student.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{student.is_active ? "ACTIVE" : "OFF"}</Text>
          </View>
          <View className="mt-3 flex-row gap-2">
            <TouchableOpacity onPress={() => openPayment(student)} className="rounded-lg bg-indigo-600 px-3 py-2"><Text className="text-sm font-semibold text-white">Payment</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => save(() => api.toggleStudentActive(student.id, audit), "students")} className="rounded-lg border border-slate-200 px-3 py-2"><Text className="text-sm font-semibold text-slate-700">Toggle</Text></TouchableOpacity>
          </View>
        </Card>
      ))}
    </>
  );

  const seatsView = (
    <>
      <Header title="Seat Manager" subtitle={`${occupiedSeats.length} occupied, ${availableSeats.length} available.`} action="Add" onAction={() => setModal("seat")} />
      <View className="flex-row flex-wrap justify-between">
        {data.seats.map((seat) => {
          const occupied = seat.status === "occupied";
          return (
            <Card key={seat.id} className={`mb-3 w-[48%] ${occupied ? "bg-indigo-50" : "bg-white"}`}>
              <Text className="text-xl font-bold text-slate-950">{seat.seat_number}</Text>
              <Text className={`mt-1 text-xs font-bold uppercase ${occupied ? "text-indigo-600" : "text-emerald-600"}`}>{occupied ? "Occupied" : "Available"}</Text>
              <Text className="mt-2 text-xs text-slate-500" numberOfLines={2}>{occupied ? studentName(data.students, seat.current_student_id) : "Ready"}</Text>
              <TouchableOpacity onPress={() => (occupied ? releaseSeat(seat) : openAssign(seat))} className={`mt-3 rounded-lg px-3 py-2 ${occupied ? "bg-rose-600" : "bg-indigo-600"}`}><Text className="text-center text-sm font-semibold text-white">{occupied ? "Release" : "Assign"}</Text></TouchableOpacity>
            </Card>
          );
        })}
      </View>
    </>
  );

  const paymentsView = (
    <>
      <Header title="Payments" subtitle="Fees, validity, and collection modes." action="Log" onAction={() => setModal("payment")} />
      {data.payments.map((payment) => (
        <Card key={payment.id} className="mb-3">
          <View className="flex-row justify-between gap-3">
            <View className="flex-1">
              <Text className="font-bold text-slate-950">{studentName(data.students, payment.student_id)}</Text>
              <Text className="mt-1 text-sm text-slate-500">{planName(data.plans, payment.plan_id)} | {payment.payment_mode || "upi"}</Text>
              <Text className="mt-1 text-xs text-slate-400">Valid {payment.valid_from || "-"} to {payment.valid_until || "-"}</Text>
            </View>
            <Text className="text-lg font-bold text-slate-950">{money(payment.amount_paid)}</Text>
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
          <Card key={student.id} className="mb-3">
            <View className="flex-row justify-between gap-3">
              <View className="flex-1">
                <Text className="font-bold text-slate-950">{student.name}</Text>
                <Text className="mt-1 text-sm text-slate-500">Renewal: {student.renewal_date || "-"}</Text>
              </View>
              <Text className={`font-bold ${days < 0 ? "text-rose-600" : "text-amber-600"}`}>{days < 0 ? `${Math.abs(days)}d late` : `${days}d left`}</Text>
            </View>
            <TouchableOpacity onPress={() => openPayment(student)} className="mt-3 rounded-lg bg-indigo-600 px-3 py-2"><Text className="text-center text-sm font-semibold text-white">Renew Now</Text></TouchableOpacity>
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
      <Card><QrCode size={30} color="#4f46e5" /><Text className="mt-3 text-lg font-bold text-slate-950">QR Enrollment</Text><Text className="mt-2 text-sm leading-5 text-slate-500">Use the web dashboard for printable QR forms. Mobile can create admissions instantly.</Text></Card>
      <View style={{ columnGap: statGap }} className="mt-4 flex-row flex-wrap"><Stat style={statCardStyle} compact={compactStats} label="Admissions" value={data.students.length} icon={Users2} tone="bg-blue-50" /><Stat style={statCardStyle} compact={compactStats} label="Reg Pending" value={data.students.filter((s) => !s.registration_paid).length} icon={Bell} tone="bg-rose-50" /></View>
    </>
  );

  const historyView = (
    <>
      <Header title="History" subtitle="Recent student, seat, fee, and settings activity." />
      {data.history.map((entry) => <Card key={entry.id} className="mb-3"><Text className="text-sm font-bold uppercase text-indigo-600">{entry.object_type || "activity"} | {entry.action || "update"}</Text><Text className="mt-1 text-sm text-slate-500">{entry.actor_role || "Admin"} changed {entry.object_id || "record"}</Text><Text className="mt-1 text-xs text-slate-400">{entry.created_at || ""}</Text></Card>)}
    </>
  );

  const expensesView = (
    <>
      <Header title="Expenses" subtitle="Operating expenses and payment modes." action="Add" onAction={() => setModal("expense")} />
      {data.expenses.map((expense) => <Card key={expense.id} className="mb-3"><View className="flex-row justify-between gap-3"><View className="flex-1"><Text className="font-bold text-slate-950">{expense.title}</Text><Text className="mt-1 text-sm text-slate-500">{expense.category || "misc"} | {expense.paid_via || "cash"}</Text><Text className="mt-1 text-xs text-slate-400">{expense.expense_date}</Text></View><Text className="text-lg font-bold text-rose-600">{money(expense.amount)}</Text></View></Card>)}
    </>
  );

  const settingsView = (
    <>
      <Header title="Settings" subtitle="Plans, roles, and account actions." action="Plan" onAction={() => setModal("plan")} />
      <Card className="mb-3"><Text className="text-base font-bold text-slate-950">Fee Plans</Text>{data.plans.map((plan) => <View key={plan.id} className="mt-3 flex-row justify-between border-b border-slate-100 pb-3"><View><Text className="font-semibold text-slate-900">{plan.name}</Text><Text className="text-sm text-slate-500">{plan.duration_days} days</Text></View><Text className="font-bold text-slate-950">{money(plan.price)}</Text></View>)}</Card>
      <Card className="mb-3"><Text className="text-base font-bold text-slate-950">Roles</Text>{data.roles.length ? data.roles.map((role) => <Text key={role.id} className="mt-2 text-sm font-semibold text-slate-700">{role.name}</Text>) : <Text className="mt-2 text-sm text-slate-500">No custom roles.</Text>}</Card>
      <TouchableOpacity onPress={logout} className="flex-row items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3"><LogOut size={18} color="white" /><Text className="text-base font-bold text-white">Log Out</Text></TouchableOpacity>
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
      <View className="border-b border-slate-100 bg-white px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3"><View className="h-11 w-11 items-center justify-center rounded-lg bg-indigo-600"><Home size={22} color="white" /></View><View><Text className="text-lg font-bold text-slate-950">Abhyasika</Text><Text className="text-xs text-slate-500">{admin?.email || "Mobile admin"}</Text></View></View>
          <TouchableOpacity onPress={refresh} className="rounded-lg bg-slate-100 p-3"><RefreshCcw size={18} color="#475569" /></TouchableOpacity>
        </View>
        {error ? <Text className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</Text> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
          <View className="flex-row gap-2">
            {VIEW_DEFINITIONS.map((item) => {
              const Icon = icons[item.icon] || LayoutDashboard;
              const selected = active === item.id;
              return <TouchableOpacity key={item.id} onPress={() => setActive(item.id)} className={`flex-row items-center gap-2 rounded-lg border px-3 py-2 ${selected ? "border-indigo-600 bg-indigo-600" : "border-slate-200 bg-white"}`}><Icon size={16} color={selected ? "white" : "#64748b"} /><Text className={`text-sm font-semibold ${selected ? "text-white" : "text-slate-600"}`}>{item.label}</Text></TouchableOpacity>;
            })}
          </View>
        </ScrollView>
      </View>

      <ScrollView className="flex-1 px-4 pt-5" contentContainerStyle={{ paddingBottom: 36 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>{views[active]}</ScrollView>

      <Sheet title="New Student" visible={modal === "student"} onClose={() => setModal("")}>
        <Input label="Name" value={studentForm.name} onChangeText={(name) => setStudentForm((p) => ({ ...p, name }))} placeholder="Student name" />
        <Input label="Phone" value={studentForm.phone} onChangeText={(phone) => setStudentForm((p) => ({ ...p, phone }))} placeholder="10 digit phone" keyboardType="phone-pad" />
        <Input label="Email" value={studentForm.email} onChangeText={(email) => setStudentForm((p) => ({ ...p, email }))} placeholder="Optional email" keyboardType="email-address" />
        <Input label="Join Date" value={studentForm.join_date} onChangeText={(join_date) => setStudentForm((p) => ({ ...p, join_date }))} placeholder="YYYY-MM-DD" />
        <ChipPicker label="Plan" items={data.plans} value={studentForm.current_plan_id} onChange={(current_plan_id) => setStudentForm((p) => ({ ...p, current_plan_id }))} getLabel={(plan) => plan.name} getValue={(plan) => plan.id} />
        <TouchableOpacity disabled={busy} onPress={submitStudent} className="mt-2 rounded-lg bg-indigo-600 px-4 py-3"><Text className="text-center text-base font-bold text-white">{busy ? "Saving..." : "Save Student"}</Text></TouchableOpacity>
      </Sheet>

      <Sheet title="Log Payment" visible={modal === "payment"} onClose={() => setModal("")}>
        <ChipPicker label="Student" items={data.students} value={paymentForm.student_id} onChange={(student_id) => setPaymentForm((p) => ({ ...p, student_id }))} getLabel={(student) => student.name} getValue={(student) => student.id} />
        <ChipPicker label="Plan" items={data.plans} value={paymentForm.plan_id} onChange={(plan_id) => { const plan = data.plans.find((p) => p.id === plan_id); setPaymentForm((p) => ({ ...p, plan_id, amount_paid: plan?.price?.toString() || p.amount_paid })); }} getLabel={(plan) => `${plan.name} (${money(plan.price)})`} getValue={(plan) => plan.id} />
        <Input label="Amount" value={paymentForm.amount_paid} onChangeText={(amount_paid) => setPaymentForm((p) => ({ ...p, amount_paid }))} placeholder="Amount paid" keyboardType="numeric" />
        <Input label="Valid From" value={paymentForm.valid_from} onChangeText={(valid_from) => setPaymentForm((p) => ({ ...p, valid_from }))} placeholder="YYYY-MM-DD" />
        <ChipPicker label="Mode" items={[{ label: "UPI", value: "upi" }, { label: "Cash", value: "cash" }, { label: "Card", value: "card" }, { label: "Bank", value: "bank" }]} value={paymentForm.payment_mode} onChange={(payment_mode) => setPaymentForm((p) => ({ ...p, payment_mode }))} getLabel={(item) => item.label} getValue={(item) => item.value} />
        <TouchableOpacity disabled={busy} onPress={submitPayment} className="mt-2 rounded-lg bg-indigo-600 px-4 py-3"><Text className="text-center text-base font-bold text-white">{busy ? "Saving..." : "Save Payment"}</Text></TouchableOpacity>
      </Sheet>

      <Sheet title="Add Expense" visible={modal === "expense"} onClose={() => setModal("")}>
        <Input label="Title" value={expenseForm.title} onChangeText={(title) => setExpenseForm((p) => ({ ...p, title }))} placeholder="Expense title" />
        <Input label="Amount" value={expenseForm.amount} onChangeText={(amount) => setExpenseForm((p) => ({ ...p, amount }))} placeholder="Amount" keyboardType="numeric" />
        <Input label="Date" value={expenseForm.expense_date} onChangeText={(expense_date) => setExpenseForm((p) => ({ ...p, expense_date }))} placeholder="YYYY-MM-DD" />
        <Input label="Category" value={expenseForm.category} onChangeText={(category) => setExpenseForm((p) => ({ ...p, category }))} placeholder="misc" />
        <TouchableOpacity disabled={busy} onPress={submitExpense} className="mt-2 rounded-lg bg-indigo-600 px-4 py-3"><Text className="text-center text-base font-bold text-white">{busy ? "Saving..." : "Save Expense"}</Text></TouchableOpacity>
      </Sheet>

      <Sheet title="Add Seat" visible={modal === "seat"} onClose={() => setModal("")}>
        <Input label="Seat Number" value={seatForm.seat_number} onChangeText={(seat_number) => setSeatForm({ seat_number })} placeholder="A1" />
        <TouchableOpacity disabled={busy} onPress={submitSeat} className="mt-2 rounded-lg bg-indigo-600 px-4 py-3"><Text className="text-center text-base font-bold text-white">{busy ? "Saving..." : "Save Seat"}</Text></TouchableOpacity>
      </Sheet>

      <Sheet title="Assign Seat" visible={modal === "assign"} onClose={() => setModal("")}>
        <ChipPicker label="Seat" items={availableSeats} value={assignForm.seatId} onChange={(seatId) => setAssignForm((p) => ({ ...p, seatId }))} getLabel={(seat) => seat.seat_number} getValue={(seat) => seat.id} />
        <ChipPicker label="Student" items={availableStudents} value={assignForm.studentId} onChange={(studentId) => setAssignForm((p) => ({ ...p, studentId }))} getLabel={(student) => student.name} getValue={(student) => student.id} />
        <TouchableOpacity disabled={busy} onPress={submitAssign} className="mt-2 rounded-lg bg-indigo-600 px-4 py-3"><Text className="text-center text-base font-bold text-white">{busy ? "Saving..." : "Assign Seat"}</Text></TouchableOpacity>
      </Sheet>

      <Sheet title="New Fee Plan" visible={modal === "plan"} onClose={() => setModal("")}>
        <Input label="Plan Name" value={planForm.name} onChangeText={(name) => setPlanForm((p) => ({ ...p, name }))} placeholder="Monthly" />
        <Input label="Price" value={planForm.price} onChangeText={(price) => setPlanForm((p) => ({ ...p, price }))} placeholder="0" keyboardType="numeric" />
        <Input label="Duration Days" value={planForm.duration_days} onChangeText={(duration_days) => setPlanForm((p) => ({ ...p, duration_days }))} placeholder="30" keyboardType="numeric" />
        <TouchableOpacity disabled={busy} onPress={submitPlan} className="mt-2 rounded-lg bg-indigo-600 px-4 py-3"><Text className="text-center text-base font-bold text-white">{busy ? "Saving..." : "Save Plan"}</Text></TouchableOpacity>
      </Sheet>
    </SafeAreaView>
  );
}
