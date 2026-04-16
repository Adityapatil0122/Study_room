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
            setPayments(data?.all ?? []);
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

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <StatusBar style="dark" />
            <View className="px-4 pt-4 pb-2 bg-white border-b border-gray-200">
                <Text className="text-2xl font-bold text-gray-900">Payments</Text>
                <Text className="text-gray-500 text-sm mt-1">
                    Your full payment history
                </Text>
            </View>

            <ScrollView
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            load();
                        }}
                    />
                }
                contentContainerStyle={{ padding: 16 }}
            >
                <TouchableOpacity
                    onPress={() => router.push("/(student)/pay")}
                    className="bg-indigo-600 rounded-xl p-4 mb-4 items-center"
                >
                    <Text className="text-white font-bold">+ Make a Payment</Text>
                </TouchableOpacity>

                {loading ? (
                    <ActivityIndicator size="large" color="#4f46e5" className="mt-10" />
                ) : error ? (
                    <View className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <Text className="text-red-600 text-sm">{error}</Text>
                    </View>
                ) : payments.length === 0 ? (
                    <View className="bg-white rounded-xl p-6 border border-gray-200">
                        <Text className="text-gray-500 text-center">
                            No payments yet. Tap "Make a Payment" above to get started.
                        </Text>
                    </View>
                ) : (
                    payments.map((p) => (
                        <View
                            key={p.id}
                            className="bg-white rounded-xl p-4 border border-gray-200 mb-2"
                        >
                            <View className="flex-row justify-between items-start">
                                <View className="flex-1">
                                    <Text className="text-gray-900 font-semibold">
                                        {p.plan_name ?? "Payment"}
                                    </Text>
                                    <Text className="text-gray-500 text-xs mt-1">
                                        {p.payment_mode?.toUpperCase()}
                                    </Text>
                                    <Text className="text-gray-500 text-xs">
                                        Valid: {p.valid_from} → {p.valid_until}
                                    </Text>
                                </View>
                                <Text className="text-gray-900 font-bold text-base">
                                    ₹{Number(p.amount_paid).toLocaleString()}
                                </Text>
                            </View>
                            {p.notes ? (
                                <Text className="text-gray-400 text-xs mt-2">{p.notes}</Text>
                            ) : null}
                        </View>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
