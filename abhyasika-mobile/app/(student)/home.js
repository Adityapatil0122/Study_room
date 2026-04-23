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

export default function StudentHomeScreen() {
    const { student, api, logout } = useAuth();
    const router = useRouter();
    const [subscription, setSubscription] = useState(null);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    // Track previous pending_qr so we can detect when admin approves it
    const prevPendingQrRef = useRef(undefined);

    const load = useCallback(async () => {
        try {
            setError("");
            const [sub, pays] = await Promise.all([
                api.getStudentSubscription(),
                api.listMyPayments(),
            ]);

            // Detect QR payment approval: was pending before, now it's gone and plan is active
            const wasPending = prevPendingQrRef.current !== undefined
                ? Boolean(prevPendingQrRef.current)
                : false;
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
            // listMyPayments returns { all: [...], online: [...] } or a flat array
            // Merge offline (all) and online payments, sort newest first
            let allPays;
            if (Array.isArray(pays)) {
                allPays = pays;
            } else {
                const offline = Array.isArray(pays?.all) ? pays.all : [];
                const online = Array.isArray(pays?.online) ? pays.online : [];
                const merged = [...offline, ...online];
                merged.sort((a, b) => {
                    const dateA = new Date(a.payment_date ?? a.created_at ?? 0).getTime();
                    const dateB = new Date(b.payment_date ?? b.created_at ?? 0).getTime();
                    return dateB - dateA;
                });
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

    // Reload fresh data every time this screen comes into focus
    // (e.g. returning from pay / receipt screens after a successful payment)
    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            load();
        }, [load])
    );

    const onRefresh = () => {
        setRefreshing(true);
        load();
    };

    const handleLogout = () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to log out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout", style: "destructive", onPress: () => {
                        Toast.show({
                            type: "info",
                            text1: "Logged out",
                            text2: "See you soon! 👋",
                            visibilityTime: 2000,
                        });
                        logout();
                    }
                },
            ]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <StatusBar style="dark" />
            <ScrollView
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                contentContainerStyle={{ padding: 16 }}
            >
                <View className="flex-row justify-between items-center mb-6 mt-2">
                    <View className="flex-row items-center">
                        <Image 
                            source={require('../../assets/logo.png')} 
                            className="w-12 h-12 rounded-full mr-3 border border-gray-200" 
                            resizeMode="contain" 
                        />
                        <View>
                            <Text className="text-gray-500">Welcome back,</Text>
                            <Text className="text-2xl font-bold text-gray-900">
                                {student?.name ?? "Student"}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={handleLogout}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                    >
                        <Text className="text-gray-700 text-sm">Logout</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#4f46e5" className="mt-10" />
                ) : (
                    <>
                        {error ? (
                            <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                                <Text className="text-red-600 text-sm">{error}</Text>
                            </View>
                        ) : null}

                        <SubscriptionCard subscription={subscription} />

                        {/* Membership On-Hold banner */}
                        {subscription?.membership_status === "on_hold" ? (
                            <View className="bg-amber-50 border border-amber-300 rounded-xl p-4 mt-4">
                                <Text className="text-amber-700 font-bold text-sm mb-1">
                                    ⏸ Membership On Hold
                                </Text>
                                <Text className="text-amber-600 text-xs">
                                    Your membership is paused since{" "}
                                    {subscription.hold_start
                                        ? new Date(subscription.hold_start).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                                        : "recently"}.
                                </Text>
                                <Text className="text-amber-500 text-xs mt-1">
                                    Your renewal date is frozen. When you return, the days you were away will be added back.
                                </Text>
                            </View>
                        ) : null}

                        {/* Scheduled payment request from admin */}
                        {subscription?.scheduled_request && subscription?.membership_status !== "on_hold" ? (
                            <View className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mt-4">
                                <Text className="text-indigo-700 font-bold text-sm mb-1">
                                    📋 Payment Request from Admin
                                </Text>
                                <Text className="text-indigo-800 text-sm">
                                    ₹{Number(subscription.scheduled_request.amount).toLocaleString("en-IN")}
                                    {" "}— {subscription.scheduled_request.type === "half_month" ? "15-Day Lumpsum" : "Custom Amount"}
                                </Text>
                                <Text className="text-indigo-600 text-xs mt-0.5">
                                    {subscription.scheduled_request.valid_from} → {subscription.scheduled_request.valid_until}
                                </Text>
                                {subscription.scheduled_request.notes ? (
                                    <Text className="text-indigo-500 text-xs mt-1 italic">
                                        "{subscription.scheduled_request.notes}"
                                    </Text>
                                ) : null}
                                <TouchableOpacity
                                    onPress={() => router.push("/(student)/pay")}
                                    className="mt-3 bg-indigo-600 rounded-lg py-2 items-center"
                                >
                                    <Text className="text-white font-bold text-sm">Pay Now →</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        {/* Pending QR payment badge */}
                        {subscription?.pending_qr ? (
                            <View className="bg-amber-50 border border-amber-300 rounded-xl p-4 mt-4">
                                <View className="flex-row items-center mb-1">
                                    <Text className="text-amber-700 font-bold text-sm">
                                        ⏳ Payment Pending Approval
                                    </Text>
                                </View>
                                <Text className="text-amber-600 text-xs">
                                    ₹{Number(subscription.pending_qr.amount).toLocaleString("en-IN")} for{" "}
                                    {subscription.pending_qr.valid_from} – {subscription.pending_qr.valid_until}
                                </Text>
                                <Text className="text-amber-500 text-xs mt-1">
                                    Submitted on {subscription.pending_qr.submitted_at
                                        ? new Date(subscription.pending_qr.submitted_at).toLocaleDateString("en-IN")
                                        : "—"}. The admin will approve shortly.
                                </Text>
                            </View>
                        ) : null}

                        {/* Select Seat button - shown when admin enabled self-selection */}
                        {subscription?.seat_selection_allowed ? (
                            <TouchableOpacity
                                onPress={() => router.push("/(student)/seat-select")}
                                className="bg-emerald-600 rounded-xl p-5 mt-4 flex-row items-center justify-between"
                            >
                                <View>
                                    <Text className="text-white font-bold text-lg">
                                        Select Your Seat →
                                    </Text>
                                    <Text className="text-emerald-100 text-sm mt-1">
                                        Pick your spot in the library
                                    </Text>
                                </View>
                                <Text className="text-white text-3xl">⊞</Text>
                            </TouchableOpacity>
                        ) : null}

                        {/* No active plan warning */}
                        {!subscription?.plan && !subscription?.pending_qr && !subscription?.scheduled_request ? (
                            <View className="bg-rose-50 border border-rose-200 rounded-xl p-4 mt-4">
                                <Text className="text-rose-700 font-bold text-sm mb-1">No Active Plan</Text>
                                <Text className="text-rose-600 text-xs">
                                    You don't have an active plan. Make a payment to get started.
                                </Text>
                            </View>
                        ) : null}

                        {/* Payment successful banner — plan is active */}
                        {subscription?.plan && subscription?.days_remaining > 0 ? (
                            <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-4">
                                <Text className="text-emerald-700 font-bold text-sm mb-1">
                                    ✅ Plan Active
                                </Text>
                                <Text className="text-emerald-600 text-xs">
                                    Your <Text className="font-semibold">{subscription.plan.name}</Text> plan is active.{" "}
                                    {subscription.days_remaining} day{subscription.days_remaining !== 1 ? "s" : ""} remaining.
                                </Text>
                            </View>
                        ) : null}

                        {/* Show payment button only when:
                            - not on hold
                            - no pending QR awaiting approval
                            - no active scheduled request from admin
                            - no plan, or plan expired/expiring in 7 days */}
                        {subscription?.membership_status !== "on_hold" &&
                        !subscription?.pending_qr &&
                        !subscription?.scheduled_request &&
                        (!subscription?.plan || (subscription?.days_remaining !== null && subscription?.days_remaining <= 7)) ? (
                            <TouchableOpacity
                                onPress={() => router.push("/(student)/pay")}
                                className="bg-indigo-600 rounded-xl p-5 mt-4 flex-row items-center justify-between"
                            >
                                <View>
                                    <Text className="text-white font-bold text-lg">
                                        {subscription?.plan ? "Renew Plan" : "Make a Payment"}
                                    </Text>
                                    <Text className="text-indigo-100 text-sm mt-1">
                                        {subscription?.days_remaining !== null && subscription?.days_remaining <= 7 && subscription?.days_remaining > 0
                                            ? `Expires in ${subscription.days_remaining} days — renew now`
                                            : "Pay online or via UPI QR"}
                                    </Text>
                                </View>
                                <Text className="text-white text-3xl">→</Text>
                            </TouchableOpacity>
                        ) : null}

                        <View className="mt-6">
                            <View className="flex-row justify-between items-center mb-3">
                                <Text className="text-lg font-semibold text-gray-900">
                                    Recent Payments
                                </Text>
                                <TouchableOpacity onPress={() => router.push("/(student)/payments")}>
                                    <Text className="text-indigo-600 text-sm font-semibold">View All →</Text>
                                </TouchableOpacity>
                            </View>
                            {payments.length === 0 ? (
                                <View className="bg-white rounded-xl p-4 border border-gray-200">
                                    <Text className="text-gray-500 text-sm text-center">
                                        No payments yet
                                    </Text>
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

function SubscriptionCard({ subscription }) {
    if (!subscription) {
        return (
            <View className="bg-white rounded-xl p-5 border border-gray-200">
                <Text className="text-gray-500">No subscription data</Text>
            </View>
        );
    }

    const { plan, seat, renewal_date, days_remaining } = subscription;
    const isExpiring = days_remaining !== null && days_remaining <= 7;
    const isExpired = days_remaining !== null && days_remaining < 0;

    return (
        <View className="bg-white rounded-xl p-5 border border-gray-200">
            <Text className="text-xs uppercase tracking-wider text-gray-500">
                Current Plan
            </Text>
            <Text className="text-2xl font-bold text-gray-900 mt-1">
                {plan?.name ?? "No plan active"}
            </Text>
            {plan ? (
                <Text className="text-gray-600 text-sm mt-1">
                    ₹{Number(plan.price).toLocaleString()} / {plan.duration_days} days
                </Text>
            ) : null}

            <View className="h-px bg-gray-200 my-4" />

            <View className="flex-row justify-between">
                <View>
                    <Text className="text-xs text-gray-500">Renewal Date</Text>
                    <Text className="text-gray-900 font-semibold">
                        {renewal_date ?? "—"}
                    </Text>
                </View>
                <View>
                    <Text className="text-xs text-gray-500">Days Left</Text>
                    <Text
                        className={`font-semibold ${
                            isExpired
                                ? "text-red-600"
                                : isExpiring
                                ? "text-amber-600"
                                : "text-gray-900"
                        }`}
                    >
                        {days_remaining ?? "—"}
                    </Text>
                </View>
                <View>
                    <Text className="text-xs text-gray-500">Seat</Text>
                    <Text className={`font-bold text-lg ${seat ? "text-emerald-600" : "text-gray-400"}`}>
                        {seat?.seat_number ?? "—"}
                    </Text>
                </View>
            </View>
        </View>
    );
}

function PaymentRow({ payment }) {
    return (
        <View className="bg-white rounded-xl p-4 border border-gray-200 mb-2 flex-row justify-between items-center">
            <View>
                <Text className="text-gray-900 font-semibold">
                    {payment.plan_name ?? "Payment"}
                </Text>
                <Text className="text-gray-500 text-xs mt-1">
                    {payment.payment_mode?.toUpperCase()} •{" "}
                    {payment.valid_from} → {payment.valid_until}
                </Text>
            </View>
            <Text className="text-gray-900 font-bold">
                ₹{Number(payment.amount_paid ?? payment.amount ?? 0).toLocaleString()}
            </Text>
        </View>
    );
}
