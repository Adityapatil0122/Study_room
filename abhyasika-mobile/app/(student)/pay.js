import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import RazorpayCheckout from "react-native-razorpay";
import { useAuth } from "../../context/AuthContext";

export default function PayScreen() {
    const { api, student } = useAuth();
    const router = useRouter();
    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        try {
            setError("");
            const data = await api.listStudentPlans();
            setPlans(data ?? []);
            if (data?.[0]) setSelectedPlanId(data[0].id);
        } catch (err) {
            setError(err?.message ?? "Failed to load plans");
        } finally {
            setLoading(false);
        }
    }, [api]);

    useEffect(() => {
        load();
    }, [load]);

    const handlePay = async () => {
        if (!selectedPlanId) {
            Alert.alert("Select a plan", "Please select a plan before paying.");
            return;
        }
        setProcessing(true);
        try {
            const order = await api.createPaymentOrder({ plan_id: selectedPlanId });

            const options = {
                description: `${order.plan.name} Plan`,
                currency: order.currency,
                key: order.razorpay_key_id,
                amount: order.amount,
                name: "Abhyasika Study Room",
                order_id: order.razorpay_order_id,
                prefill: {
                    name: student?.name ?? "",
                    email: student?.email ?? "",
                    contact: student?.phone ?? "",
                },
                theme: { color: "#4f46e5" },
            };

            const result = await RazorpayCheckout.open(options);

            // Verify on the server
            await api.verifyPayment({
                razorpay_order_id: result.razorpay_order_id,
                razorpay_payment_id: result.razorpay_payment_id,
                razorpay_signature: result.razorpay_signature,
            });

            Alert.alert(
                "Payment successful",
                "Your plan has been activated.",
                [{ text: "OK", onPress: () => router.replace("/(student)/home") }]
            );
        } catch (err) {
            const msg =
                err?.description ??
                err?.message ??
                "Payment did not complete. Please try again.";
            Alert.alert("Payment failed", msg);
        } finally {
            setProcessing(false);
        }
    };

    const selected = plans.find((p) => p.id === selectedPlanId);

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <StatusBar style="dark" />
            <View className="px-4 pt-4 pb-2 bg-white border-b border-gray-200 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-3 p-2">
                    <Text className="text-indigo-600 text-base">←</Text>
                </TouchableOpacity>
                <View>
                    <Text className="text-2xl font-bold text-gray-900">Make Payment</Text>
                    <Text className="text-gray-500 text-sm">
                        Choose a plan and pay securely
                    </Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {loading ? (
                    <ActivityIndicator size="large" color="#4f46e5" className="mt-10" />
                ) : error ? (
                    <View className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <Text className="text-red-600 text-sm">{error}</Text>
                    </View>
                ) : plans.length === 0 ? (
                    <View className="bg-white rounded-xl p-6 border border-gray-200">
                        <Text className="text-gray-500 text-center">
                            No plans are currently available. Please contact the admin.
                        </Text>
                    </View>
                ) : (
                    <>
                        <Text className="text-sm text-gray-700 mb-3 font-medium">
                            Available Plans
                        </Text>
                        {plans.map((plan) => (
                            <TouchableOpacity
                                key={plan.id}
                                onPress={() => setSelectedPlanId(plan.id)}
                                className={`rounded-xl border-2 p-4 mb-3 ${
                                    selectedPlanId === plan.id
                                        ? "bg-indigo-50 border-indigo-600"
                                        : "bg-white border-gray-200"
                                }`}
                            >
                                <View className="flex-row justify-between items-center">
                                    <View className="flex-1">
                                        <Text className="text-gray-900 font-bold text-lg">
                                            {plan.name}
                                        </Text>
                                        <Text className="text-gray-500 text-sm">
                                            {plan.duration_days} days
                                        </Text>
                                    </View>
                                    <Text className="text-gray-900 font-bold text-xl">
                                        ₹{Number(plan.price).toLocaleString()}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}

                        {selected ? (
                            <View className="bg-white rounded-xl p-4 border border-gray-200 mt-2 mb-4">
                                <Text className="text-xs uppercase tracking-wider text-gray-500">
                                    You pay
                                </Text>
                                <Text className="text-3xl font-bold text-gray-900 mt-1">
                                    ₹{Number(selected.price).toLocaleString()}
                                </Text>
                                <Text className="text-gray-500 text-sm mt-1">
                                    {selected.name} • {selected.duration_days} days
                                </Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            onPress={handlePay}
                            disabled={processing || !selectedPlanId}
                            className={`bg-indigo-600 rounded-xl py-4 items-center ${
                                processing || !selectedPlanId ? "opacity-70" : ""
                            }`}
                        >
                            <Text className="text-white font-bold text-lg">
                                {processing ? "Processing..." : "Pay Now"}
                            </Text>
                        </TouchableOpacity>

                        <Text className="text-xs text-gray-400 text-center mt-3">
                            Payments are processed securely via Razorpay
                        </Text>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
