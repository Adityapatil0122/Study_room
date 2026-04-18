import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";

function modeBadge(mode) {
    const m = mode?.toLowerCase() ?? "";
    if (m === "razorpay") return { label: "💳 Razorpay", bg: "#ede9fe", text: "#6d28d9" };
    if (m === "qr" || m === "upi") return { label: "📱 QR / UPI", bg: "#ecfdf5", text: "#059669" };
    if (m === "cash") return { label: "💵 Cash", bg: "#fef3c7", text: "#92400e" };
    return { label: (mode?.toUpperCase() ?? "—"), bg: "#f3f4f6", text: "#374151" };
}

export default function PaymentsScreen() {
    const { api } = useAuth();
    const router = useRouter();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        try {
            setError("");
            const data = await api.listMyPayments();
            // Merge offline (all) and online payments, sort newest first
            let list;
            if (Array.isArray(data)) {
                list = data;
            } else {
                const offline = Array.isArray(data?.all) ? data.all : [];
                const online = Array.isArray(data?.online) ? data.online : [];
                const merged = [...offline, ...online];
                merged.sort((a, b) => {
                    const dateA = new Date(a.payment_date ?? a.created_at ?? 0).getTime();
                    const dateB = new Date(b.payment_date ?? b.created_at ?? 0).getTime();
                    return dateB - dateA;
                });
                list = merged;
            }
            setPayments(list);
        } catch (err) {
            setError(err?.message ?? "Failed to load payments");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [api]);

    useEffect(() => {
        load();
    }, [load]);

    const openReceipt = (p) => {
        router.push({
            pathname: "/(student)/receipt",
            params: { payment: JSON.stringify(p) },
        });
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>
                <Text style={{ fontSize: 24, fontWeight: "800", color: "#111827" }}>Payments</Text>
                <Text style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
                    Your full payment history · tap a card to view receipt
                </Text>
            </View>

            <ScrollView
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); load(); }}
                    />
                }
                contentContainerStyle={{ padding: 16 }}
            >
                {/* Make Payment button */}
                <TouchableOpacity
                    onPress={() => router.push("/(student)/pay")}
                    style={{
                        backgroundColor: "#4f46e5", borderRadius: 14,
                        paddingVertical: 14, alignItems: "center", marginBottom: 20,
                        shadowColor: "#4f46e5", shadowOpacity: 0.25,
                        shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
                    }}
                >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>+ Make a Payment</Text>
                </TouchableOpacity>

                {loading ? (
                    <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
                ) : error ? (
                    <View style={{ backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 12, padding: 14 }}>
                        <Text style={{ color: "#dc2626", fontSize: 13 }}>{error}</Text>
                    </View>
                ) : payments.length === 0 ? (
                    <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 28, borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center" }}>
                        <Text style={{ fontSize: 36, marginBottom: 12 }}>🧾</Text>
                        <Text style={{ color: "#374151", fontWeight: "700", fontSize: 16 }}>No payments yet</Text>
                        <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 4, textAlign: "center" }}>
                            Tap "Make a Payment" above to get started.
                        </Text>
                    </View>
                ) : (
                    payments.map((p) => {
                        const paidDate = p.payment_date
                            ? new Date(p.payment_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                            : p.created_at
                            ? new Date(p.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                            : null;

                        const badge = modeBadge(p.payment_mode);
                        const amount = Number(p.amount_paid ?? p.amount ?? 0);

                        return (
                            <TouchableOpacity
                                key={p.id}
                                onPress={() => openReceipt(p)}
                                activeOpacity={0.75}
                                style={{
                                    backgroundColor: "#fff",
                                    borderRadius: 16,
                                    marginBottom: 12,
                                    borderWidth: 1,
                                    borderColor: "#e5e7eb",
                                    shadowColor: "#000",
                                    shadowOpacity: 0.04,
                                    shadowRadius: 6,
                                    shadowOffset: { width: 0, height: 2 },
                                    elevation: 2,
                                    overflow: "hidden",
                                }}
                            >
                                {/* Colored top accent bar */}
                                <View style={{ height: 4, backgroundColor: "#4f46e5" }} />

                                <View style={{ padding: 16 }}>
                                    {/* Row 1: plan name + amount */}
                                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <View style={{ flex: 1, marginRight: 12 }}>
                                            <Text style={{ color: "#111827", fontWeight: "700", fontSize: 15 }} numberOfLines={1}>
                                                {p.plan_name ?? "Payment"}
                                            </Text>
                                            {paidDate ? (
                                                <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>
                                                    {paidDate}
                                                </Text>
                                            ) : null}
                                        </View>
                                        <View style={{ alignItems: "flex-end" }}>
                                            <Text style={{ color: "#111827", fontWeight: "900", fontSize: 18 }}>
                                                ₹{amount.toLocaleString("en-IN")}
                                            </Text>
                                            <View style={{ backgroundColor: "#d1fae5", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginTop: 3 }}>
                                                <Text style={{ color: "#065f46", fontSize: 10, fontWeight: "700" }}>✅ PAID</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Row 2: badges */}
                                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                                        {/* Mode badge */}
                                        <View style={{ backgroundColor: badge.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                                            <Text style={{ color: badge.text, fontSize: 11, fontWeight: "700" }}>{badge.label}</Text>
                                        </View>
                                        {/* Validity badge */}
                                        {p.valid_from && p.valid_until ? (
                                            <View style={{ backgroundColor: "#eff6ff", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                                                <Text style={{ color: "#1d4ed8", fontSize: 11, fontWeight: "600" }}>
                                                    📅 {p.valid_from} → {p.valid_until}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>

                                    {/* Notes */}
                                    {p.notes ? (
                                        <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 8, fontStyle: "italic" }}>
                                            "{p.notes}"
                                        </Text>
                                    ) : null}

                                    {/* Receipt hint */}
                                    <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 10 }}>
                                        <Text style={{ color: "#4f46e5", fontSize: 12, fontWeight: "600" }}>View Receipt →</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
