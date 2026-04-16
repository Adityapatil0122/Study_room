import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Image,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export default function StudentHomeScreen() {
    const { student, api, logout } = useAuth();
    const router = useRouter();
    const [subscription, setSubscription] = useState(null);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        try {
            setError("");
            const [sub, pays] = await Promise.all([
                api.getStudentSubscription(),
                api.listMyPayments(),
            ]);
            setSubscription(sub);
            setPayments((pays?.all ?? []).slice(0, 3));
        } catch (err) {
            setError(err?.message ?? "Failed to load data");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [api]);

    useEffect(() => {
        load();
    }, [load]);

    const onRefresh = () => {
        setRefreshing(true);
        load();
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
                        onPress={logout}
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

                        {/* Select Seat button — shown when paid but no seat */}
                        {subscription?.plan && !subscription?.seat ? (
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
                        {!subscription?.plan && !subscription?.pending_qr ? (
                            <View className="bg-rose-50 border border-rose-200 rounded-xl p-4 mt-4">
                                <Text className="text-rose-700 font-bold text-sm mb-1">No Active Plan</Text>
                                <Text className="text-rose-600 text-xs">
                                    You don't have an active plan. Make a payment to get started.
                                </Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            onPress={() => router.push("/(student)/pay")}
                            className="bg-indigo-600 rounded-xl p-5 mt-4 flex-row items-center justify-between"
                        >
                            <View>
                                <Text className="text-white font-bold text-lg">
                                    {subscription?.plan ? "Renew Plan" : "Make a Payment"}
                                </Text>
                                <Text className="text-indigo-100 text-sm mt-1">
                                    Pay online or via UPI QR
                                </Text>
                            </View>
                            <Text className="text-white text-3xl">→</Text>
                        </TouchableOpacity>

                        <View className="mt-6">
                            <Text className="text-lg font-semibold text-gray-900 mb-3">
                                Recent Payments
                            </Text>
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
                ₹{Number(payment.amount_paid).toLocaleString()}
            </Text>
        </View>
    );
}
