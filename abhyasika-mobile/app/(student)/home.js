import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Image,
    Alert,
} from "react-native";
import { useCallback, useState, useRef } from "react";
import Toast from "react-native-toast-message";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../context/AuthContext";

const INDIGO = "#4f46e5";
const BG     = "#f4f5fb";

export default function StudentHomeScreen() {
    const { student, api, logout } = useAuth();
    const router = useRouter();
    const [subscription, setSubscription] = useState(null);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const prevPendingQrRef = useRef(undefined);

    const load = useCallback(async () => {
        try {
            setError("");
            const [sub, pays] = await Promise.all([
                api.getStudentSubscription(),
                api.listMyPayments(),
            ]);

            const wasPending = prevPendingQrRef.current !== undefined
                ? Boolean(prevPendingQrRef.current) : false;
            const isNowApproved = wasPending && !sub?.pending_qr && sub?.plan;
            if (isNowApproved) {
                Toast.show({
                    type: "success",
                    text1: "Payment approved! 🎉",
                    text2: "Your QR payment has been approved by admin.",
                    visibilityTime: 4000,
                });
            }
            prevPendingQrRef.current = sub?.pending_qr ?? null;
            setSubscription(sub);

            let allPays;
            if (Array.isArray(pays)) {
                allPays = pays;
            } else {
                const offline = Array.isArray(pays?.all) ? pays.all : [];
                const online  = Array.isArray(pays?.online) ? pays.online : [];
                const merged  = [...offline, ...online];
                merged.sort((a, b) =>
                    new Date(b.payment_date ?? b.created_at ?? 0) -
                    new Date(a.payment_date ?? a.created_at ?? 0)
                );
                allPays = merged;
            }
            setPayments(allPays.slice(0, 5));
        } catch (err) {
            setError(err?.message ?? "Failed to load data");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [api]);

    const isFirstLoad = useRef(true);
    useFocusEffect(
        useCallback(() => {
            if (isFirstLoad.current) {
                isFirstLoad.current = false;
                setLoading(true);
            }
            load();
        }, [load])
    );

    const onRefresh = () => { setRefreshing(true); load(); };

    const handleLogout = () =>
        Alert.alert("Logout", "Are you sure you want to log out?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Logout", style: "destructive", onPress: () => {
                    Toast.show({ type: "info", text1: "Logged out", text2: "See you soon! 👋", visibilityTime: 2000 });
                    logout();
                },
            },
        ]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
            <StatusBar style="dark" />
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={INDIGO} />}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Header ── */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 22 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{
                            width: 50, height: 50, borderRadius: 25,
                            backgroundColor: "#fff", borderWidth: 2, borderColor: "#e0e2f7",
                            alignItems: "center", justifyContent: "center",
                            overflow: "hidden", marginRight: 12,
                            shadowColor: INDIGO, shadowOpacity: 0.1, shadowRadius: 6, elevation: 2,
                        }}>
                            <Image source={require("../../assets/logo.png")} style={{ width: 38, height: 38 }} resizeMode="contain" />
                        </View>
                        <View>
                            <Text style={{ fontSize: 12, color: "#9ca3af", fontWeight: "500", letterSpacing: 0.3 }}>Welcome back,</Text>
                            <Text style={{ fontSize: 22, fontWeight: "800", color: "#111827", letterSpacing: -0.3 }}>
                                {student?.name ?? "Student"}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={handleLogout}
                        style={{
                            paddingHorizontal: 14, paddingVertical: 8,
                            borderRadius: 10, borderWidth: 1.5, borderColor: "#e5e7eb",
                            backgroundColor: "#fff",
                        }}
                    >
                        <Text style={{ color: "#6b7280", fontSize: 13, fontWeight: "600" }}>Logout</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={INDIGO} style={{ marginTop: 60 }} />
                ) : (
                    <>
                        {error ? (
                            <View style={[banner, { borderLeftColor: "#ef4444", backgroundColor: "#fff5f5" }]}>
                                <Text style={{ color: "#ef4444", fontSize: 13, fontWeight: "600" }}>{error}</Text>
                            </View>
                        ) : null}

                        <SubscriptionCard subscription={subscription} />

                        {/* On-hold */}
                        {subscription?.membership_status === "on_hold" ? (
                            <View style={[banner, { borderLeftColor: "#f59e0b", backgroundColor: "#fffbeb" }]}>
                                <Text style={[bannerTitle, { color: "#b45309" }]}>⏸  Membership On Hold</Text>
                                <Text style={[bannerBody, { color: "#92400e" }]}>
                                    Your membership is paused since{" "}
                                    {subscription.hold_start
                                        ? new Date(subscription.hold_start).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                                        : "recently"}.
                                    Days away will be added back when you return.
                                </Text>
                            </View>
                        ) : null}

                        {/* Scheduled payment request */}
                        {subscription?.scheduled_request && subscription?.membership_status !== "on_hold" ? (
                            <View style={[banner, { borderLeftColor: INDIGO, backgroundColor: "#eef2ff" }]}>
                                <Text style={[bannerTitle, { color: "#4338ca" }]}>📋  Payment Request from Admin</Text>
                                <Text style={{ color: "#4338ca", fontSize: 15, fontWeight: "700", marginTop: 2 }}>
                                    ₹{Number(subscription.scheduled_request.amount).toLocaleString("en-IN")}
                                    {"  ·  "}
                                    {subscription.scheduled_request.type === "half_month" ? "15-Day Lumpsum" : "Custom Amount"}
                                </Text>
                                <Text style={[bannerBody, { color: "#6366f1" }]}>
                                    {subscription.scheduled_request.valid_from} → {subscription.scheduled_request.valid_until}
                                </Text>
                                {subscription.scheduled_request.notes ? (
                                    <Text style={{ color: "#818cf8", fontSize: 12, fontStyle: "italic", marginTop: 3 }}>
                                        "{subscription.scheduled_request.notes}"
                                    </Text>
                                ) : null}
                                <TouchableOpacity
                                    onPress={() => router.push("/(student)/pay")}
                                    style={{
                                        marginTop: 12, backgroundColor: INDIGO,
                                        borderRadius: 10, paddingVertical: 11, alignItems: "center",
                                        shadowColor: INDIGO, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
                                    }}
                                >
                                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Pay Now →</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        {/* Pending QR */}
                        {subscription?.pending_qr ? (
                            <View style={[banner, { borderLeftColor: "#f59e0b", backgroundColor: "#fffbeb" }]}>
                                <Text style={[bannerTitle, { color: "#b45309" }]}>⏳  Payment Pending Approval</Text>
                                <Text style={[bannerBody, { color: "#92400e" }]}>
                                    ₹{Number(subscription.pending_qr.amount).toLocaleString("en-IN")} for{" "}
                                    {subscription.pending_qr.valid_from} – {subscription.pending_qr.valid_until}
                                </Text>
                                <Text style={{ color: "#b45309", fontSize: 11, marginTop: 4 }}>
                                    Submitted {subscription.pending_qr.submitted_at
                                        ? new Date(subscription.pending_qr.submitted_at).toLocaleDateString("en-IN")
                                        : "recently"}  · Admin will approve shortly.
                                </Text>
                            </View>
                        ) : null}

<<<<<<< HEAD
                        {/* Select Seat button - shown when admin enabled self-selection */}
                        {subscription?.seat_selection_allowed ? (
=======
                        {/* Select seat CTA — only after admin offers seats */}
                        {subscription?.plan && !subscription?.seat ? (
>>>>>>> 4cc9e3a413a93b323c69f37ddb699a4d5d92e446
                            <TouchableOpacity
                                onPress={() => router.push("/(student)/seat-select")}
                                activeOpacity={0.87}
                                style={{
                                    backgroundColor: "#059669", borderRadius: 16,
                                    paddingHorizontal: 20, paddingVertical: 18,
                                    marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                                    shadowColor: "#059669", shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
                                }}
                            >
                                <View>
                                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17, letterSpacing: -0.2 }}>
                                        Choose Your Seat
                                    </Text>
                                    <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 3 }}>
                                        Admin has shared seat options for you
                                    </Text>
                                </View>
                                <View style={{
                                    width: 40, height: 40, borderRadius: 12,
                                    backgroundColor: "rgba(255,255,255,0.2)",
                                    alignItems: "center", justifyContent: "center",
                                }}>
                                    <Text style={{ color: "#fff", fontSize: 22 }}>⊞</Text>
                                </View>
                            </TouchableOpacity>
                        ) : null}

                        {/* No active plan */}
                        {!subscription?.plan && !subscription?.pending_qr && !subscription?.scheduled_request ? (
                            <View style={[banner, { borderLeftColor: "#f43f5e", backgroundColor: "#fff1f2" }]}>
                                <Text style={[bannerTitle, { color: "#be123c" }]}>No Active Plan</Text>
                                <Text style={[bannerBody, { color: "#9f1239" }]}>
                                    You don't have an active plan. Make a payment to get started.
                                </Text>
                            </View>
                        ) : null}

                        {/* Plan active */}
                        {subscription?.plan && subscription?.days_remaining > 0 ? (
                            <View style={[banner, { borderLeftColor: "#059669", backgroundColor: "#f0fdf4" }]}>
                                <Text style={[bannerTitle, { color: "#065f46" }]}>✅  Plan Active</Text>
                                <Text style={[bannerBody, { color: "#047857" }]}>
                                    Your <Text style={{ fontWeight: "700" }}>{subscription.plan.name}</Text> plan is active.{" "}
                                    {subscription.days_remaining} day{subscription.days_remaining !== 1 ? "s" : ""} remaining.
                                </Text>
                            </View>
                        ) : null}

                        {/* Make / Renew payment CTA */}
                        {subscription?.membership_status !== "on_hold" &&
                        !subscription?.pending_qr &&
                        !subscription?.scheduled_request &&
                        (!subscription?.plan || (subscription?.days_remaining !== null && subscription?.days_remaining <= 7)) ? (
                            <TouchableOpacity
                                onPress={() => router.push("/(student)/pay")}
                                activeOpacity={0.87}
                                style={{
                                    backgroundColor: INDIGO, borderRadius: 16,
                                    paddingHorizontal: 20, paddingVertical: 18,
                                    marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                                    shadowColor: INDIGO, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
                                }}
                            >
                                <View>
                                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17, letterSpacing: -0.2 }}>
                                        {subscription?.plan ? "Renew Plan" : "Make a Payment"}
                                    </Text>
                                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 3 }}>
                                        {subscription?.days_remaining !== null && subscription?.days_remaining <= 7 && subscription?.days_remaining > 0
                                            ? `Expires in ${subscription.days_remaining} days — renew now`
                                            : "Pay online or via UPI QR"}
                                    </Text>
                                </View>
                                <View style={{
                                    width: 40, height: 40, borderRadius: 12,
                                    backgroundColor: "rgba(255,255,255,0.15)",
                                    alignItems: "center", justifyContent: "center",
                                }}>
                                    <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>→</Text>
                                </View>
                            </TouchableOpacity>
                        ) : null}

                        {/* ── Recent Payments ── */}
                        <View style={{ marginTop: 28 }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                                <Text style={{ fontSize: 17, fontWeight: "700", color: "#111827", letterSpacing: -0.2 }}>
                                    Recent Payments
                                </Text>
                                <TouchableOpacity onPress={() => router.push("/(student)/payments")}>
                                    <Text style={{ color: INDIGO, fontSize: 13, fontWeight: "600" }}>View All →</Text>
                                </TouchableOpacity>
                            </View>
                            {payments.length === 0 ? (
                                <View style={card}>
                                    <Text style={{ color: "#9ca3af", fontSize: 14, textAlign: "center" }}>No payments yet</Text>
                                </View>
                            ) : (
                                payments.map((p) => <PaymentRow key={p.id} payment={p} />)
                            )}
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Subscription card ─────────────────────────────────────────────────────────
function SubscriptionCard({ subscription }) {
    if (!subscription) {
        return (
            <View style={card}>
                <Text style={{ color: "#9ca3af" }}>No subscription data</Text>
            </View>
        );
    }

    const { plan, seat, renewal_date, days_remaining } = subscription;
    const isExpiring = days_remaining !== null && days_remaining <= 7 && days_remaining >= 0;
    const isExpired  = days_remaining !== null && days_remaining < 0;

    const daysColor = isExpired ? "#ef4444" : isExpiring ? "#f59e0b" : "#111827";

    return (
        <View style={[card, { padding: 0, overflow: "hidden" }]}>
            {/* Indigo accent bar */}
            <View style={{ height: 4, backgroundColor: INDIGO }} />
            <View style={{ padding: 20 }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#9ca3af", letterSpacing: 1.5, textTransform: "uppercase" }}>
                    Current Plan
                </Text>
                <Text style={{ fontSize: 24, fontWeight: "800", color: "#111827", marginTop: 4, letterSpacing: -0.5 }}>
                    {plan?.name ?? "No plan active"}
                </Text>
                {plan ? (
                    <Text style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
                        ₹{Number(plan.price).toLocaleString()} / {plan.duration_days} days
                    </Text>
                ) : null}

                <View style={{ height: 1, backgroundColor: "#f3f4f6", marginVertical: 16 }} />

                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <View>
                        <Text style={metaLabel}>Renewal Date</Text>
                        <Text style={metaValue}>{renewal_date ?? "—"}</Text>
                    </View>
                    <View style={{ alignItems: "center" }}>
                        <Text style={metaLabel}>Days Left</Text>
                        <Text style={[metaValue, { color: daysColor }]}>{days_remaining ?? "—"}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                        <Text style={metaLabel}>My Seat</Text>
                        <Text style={[metaValue, { fontSize: 22, color: seat ? "#059669" : "#d1d5db" }]}>
                            {seat?.seat_number ?? "—"}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

// ── Payment row ───────────────────────────────────────────────────────────────
function PaymentRow({ payment }) {
    const mode = payment.payment_mode?.toLowerCase() ?? "";
    const modeIcon  = mode === "razorpay" ? "💳" : mode === "qr" || mode === "upi" ? "📱" : "💵";
    const modeColor = mode === "razorpay" ? "#7c3aed" : mode === "qr" || mode === "upi" ? "#059669" : "#92400e";

    return (
        <View style={[card, { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }]}>
            <View style={{ flex: 1 }}>
                <Text style={{ color: "#111827", fontWeight: "700", fontSize: 14 }} numberOfLines={1}>
                    {payment.plan_name ?? "Payment"}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 }}>
                    <Text style={{ fontSize: 11, color: modeColor, fontWeight: "700" }}>{modeIcon} {payment.payment_mode?.toUpperCase()}</Text>
                    <Text style={{ fontSize: 11, color: "#d1d5db" }}>·</Text>
                    <Text style={{ fontSize: 11, color: "#9ca3af" }}>
                        {payment.valid_from} → {payment.valid_until}
                    </Text>
                </View>
            </View>
            <Text style={{ color: "#111827", fontWeight: "800", fontSize: 16, marginLeft: 8 }}>
                ₹{Number(payment.amount_paid ?? payment.amount ?? 0).toLocaleString()}
            </Text>
        </View>
    );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const card = {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginTop: 14,
    shadowColor: "#4f46e5",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
};

const banner = {
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
};

const bannerTitle = { fontSize: 13, fontWeight: "700", marginBottom: 4 };
const bannerBody  = { fontSize: 12, lineHeight: 18 };
const metaLabel   = { fontSize: 11, color: "#9ca3af", fontWeight: "500", marginBottom: 3 };
const metaValue   = { fontSize: 15, fontWeight: "700", color: "#111827" };
