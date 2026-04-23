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

const INDIGO = "#4f46e5";

function modeBadge(mode) {
    const m = mode?.toLowerCase() ?? "";
    if (m === "razorpay") return { label: "💳 Razorpay", bg: "#ede9fe", text: "#6d28d9" };
    if (m === "qr" || m === "upi") return { label: "📱 UPI / QR", bg: "#ecfdf5", text: "#059669" };
    if (m === "cash") return { label: "💵 Cash", bg: "#fef3c7", text: "#92400e" };
    return { label: mode?.toUpperCase() ?? "—", bg: "#f3f4f6", text: "#374151" };
}

export default function PaymentsScreen() {
    const { api } = useAuth();
    const router  = useRouter();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError]       = useState("");

    const load = useCallback(async () => {
        try {
            setError("");
            const data = await api.listMyPayments();
            let list;
            if (Array.isArray(data)) {
                list = data;
            } else {
                const offline = Array.isArray(data?.all) ? data.all : [];
                const online  = Array.isArray(data?.online) ? data.online : [];
                const merged  = [...offline, ...online];
                merged.sort((a, b) =>
                    new Date(b.payment_date ?? b.created_at ?? 0) -
                    new Date(a.payment_date ?? a.created_at ?? 0)
                );
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

    useEffect(() => { load(); }, [load]);

    const openReceipt = (p) =>
        router.push({ pathname: "/(student)/receipt", params: { payment: JSON.stringify(p) } });

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f4f5fb" }}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={{
                backgroundColor: "#fff",
                paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16,
                borderBottomWidth: 1, borderBottomColor: "#f0f0f8",
                shadowColor: INDIGO, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
            }}>
                <Text style={{ fontSize: 22, fontWeight: "800", color: "#111827" }}>Payments</Text>
                <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>
                    Full history · tap any card for receipt
                </Text>
            </View>

            <ScrollView
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); load(); }}
                        tintColor={INDIGO}
                    />
                }
                contentContainerStyle={{ padding: 20 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Make payment CTA */}
                <TouchableOpacity
                    onPress={() => router.push("/(student)/pay")}
                    style={{
                        backgroundColor: INDIGO, borderRadius: 14,
                        paddingVertical: 15, alignItems: "center", marginBottom: 22,
                        shadowColor: INDIGO, shadowOpacity: 0.28,
                        shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
                    }}
                >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>+ Make a Payment</Text>
                </TouchableOpacity>

                {loading ? (
                    <ActivityIndicator size="large" color={INDIGO} style={{ marginTop: 40 }} />
                ) : error ? (
                    <View style={{
                        backgroundColor: "#fff5f5", borderRadius: 12,
                        borderLeftWidth: 4, borderLeftColor: "#ef4444", padding: 14,
                    }}>
                        <Text style={{ color: "#ef4444", fontSize: 13 }}>{error}</Text>
                    </View>
                ) : payments.length === 0 ? (
                    <View style={{
                        backgroundColor: "#fff", borderRadius: 20,
                        padding: 32, alignItems: "center",
                        shadowColor: INDIGO, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
                    }}>
                        <Text style={{ fontSize: 40, marginBottom: 12 }}>🧾</Text>
                        <Text style={{ color: "#111827", fontWeight: "700", fontSize: 16 }}>No payments yet</Text>
                        <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 4, textAlign: "center" }}>
                            Tap "Make a Payment" above to get started.
                        </Text>
                    </View>
                ) : (
                    payments.map((p) => {
                        const paidDate = p.payment_date ?? p.created_at
                            ? new Date(p.payment_date ?? p.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                            : null;
                        const badge  = modeBadge(p.payment_mode);
                        const amount = Number(p.amount_paid ?? p.amount ?? 0);

                        return (
                            <TouchableOpacity
                                key={p.id}
                                onPress={() => openReceipt(p)}
                                activeOpacity={0.75}
                                style={{
                                    backgroundColor: "#fff",
                                    borderRadius: 16, marginBottom: 12,
                                    overflow: "hidden",
                                    shadowColor: INDIGO,
                                    shadowOpacity: 0.07,
                                    shadowRadius: 10,
                                    shadowOffset: { width: 0, height: 3 },
                                    elevation: 2,
                                }}
                            >
                                {/* Indigo accent line */}
                                <View style={{ height: 3, backgroundColor: INDIGO }} />

                                <View style={{ padding: 16 }}>
                                    {/* Row 1: name + amount */}
                                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <View style={{ flex: 1, marginRight: 12 }}>
                                            <Text style={{ color: "#111827", fontWeight: "700", fontSize: 15 }} numberOfLines={1}>
                                                {p.plan_name ?? "Payment"}
                                            </Text>
                                            {paidDate ? (
                                                <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>{paidDate}</Text>
                                            ) : null}
                                        </View>
                                        <View style={{ alignItems: "flex-end" }}>
                                            <Text style={{ color: "#111827", fontWeight: "900", fontSize: 18 }}>
                                                ₹{amount.toLocaleString("en-IN")}
                                            </Text>
                                            <View style={{
                                                backgroundColor: "#dcfce7", borderRadius: 8,
                                                paddingHorizontal: 7, paddingVertical: 2, marginTop: 3,
                                            }}>
                                                <Text style={{ color: "#065f46", fontSize: 10, fontWeight: "700" }}>✅ PAID</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Row 2: badges */}
                                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                                        <View style={{ backgroundColor: badge.bg, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 }}>
                                            <Text style={{ color: badge.text, fontSize: 11, fontWeight: "700" }}>{badge.label}</Text>
                                        </View>
                                        {p.valid_from && p.valid_until ? (
                                            <View style={{ backgroundColor: "#eff6ff", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 }}>
                                                <Text style={{ color: "#1d4ed8", fontSize: 11, fontWeight: "600" }}>
                                                    📅 {p.valid_from} → {p.valid_until}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>

                                    {p.notes ? (
                                        <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 8, fontStyle: "italic" }}>
                                            "{p.notes}"
                                        </Text>
                                    ) : null}

                                    <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 10 }}>
                                        <Text style={{ color: INDIGO, fontSize: 12, fontWeight: "600" }}>View Receipt →</Text>
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
