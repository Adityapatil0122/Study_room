import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Image,
    Linking,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import RazorpayCheckout from "react-native-razorpay";
import { useAuth } from "../../context/AuthContext";

/**
 * Formats a YYYY-MM-DD date string into "DD MMM YYYY".
 */
function fmtDate(str) {
    if (!str) return "—";
    const d = new Date(str);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PayScreen() {
    const { api, student } = useAuth();
    const router = useRouter();

    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // "razorpay" | "qr" | null
    const [paymentMethod, setPaymentMethod] = useState(null);
    const [processingRazorpay, setProcessingRazorpay] = useState(false);
    const [processingQr, setProcessingQr] = useState(false);
    const [processingScheduled, setProcessingScheduled] = useState(false);

    // After QR request is created
    const [qrResult, setQrResult] = useState(null);

    // Subscription data (includes scheduled_request if admin sent one)
    const [subscription, setSubscription] = useState(null);

    const isRenewal = Boolean(student?.renewal_date);

    const load = useCallback(async () => {
        try {
            setError("");
            const [plansData, subData] = await Promise.all([
                api.listStudentPlans(),
                api.getStudentSubscription(),
            ]);
            setPlans(plansData ?? []);
            setSubscription(subData);
            // Pre-select plan from scheduled request if exists, else first plan
            if (subData?.scheduled_request?.plan_id) {
                const matchPlan = (plansData ?? []).find((p) => p.id === subData.scheduled_request.plan_id);
                setSelectedPlanId(matchPlan?.id ?? plansData?.[0]?.id ?? null);
            } else if (plansData?.[0]) {
                setSelectedPlanId(plansData[0].id);
            }
        } catch (err) {
            setError(err?.message ?? "Failed to load plans");
        } finally {
            setLoading(false);
        }
    }, [api]);

    useEffect(() => {
        load();
    }, [load]);

    const selectedPlan = plans.find((p) => p.id === selectedPlanId);

    // ------------------------------------------------------------------
    // Razorpay flow
    // ------------------------------------------------------------------
    const handleRazorpay = async () => {
        if (!selectedPlanId) {
            Alert.alert("Select a plan", "Please select a plan first.");
            return;
        }
        setProcessingRazorpay(true);
        try {
            const order = await api.createPaymentOrder({
                plan_id: selectedPlanId,
                is_renewal: isRenewal,
            });

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

            await api.verifyPayment({
                razorpay_order_id: result.razorpay_order_id,
                razorpay_payment_id: result.razorpay_payment_id,
                razorpay_signature: result.razorpay_signature,
            });

            Alert.alert(
                "Payment successful",
                `Your plan has been activated.\nValid: ${fmtDate(order.valid_from)} – ${fmtDate(order.valid_until)}`,
                [{
                    text: "OK",
                    onPress: () => {
                        // If student has no seat yet, go to seat selection
                        if (!student?.current_seat_id) {
                            router.replace("/(student)/seat-select");
                        } else {
                            router.replace("/(student)/home");
                        }
                    },
                }]
            );
        } catch (err) {
            const msg =
                err?.description ??
                err?.message ??
                "Payment did not complete. Please try again.";
            Alert.alert("Payment failed", msg);
        } finally {
            setProcessingRazorpay(false);
        }
    };

    // ------------------------------------------------------------------
    // Scheduled request payment via Razorpay
    // ------------------------------------------------------------------
    const handleScheduledPay = async () => {
        const req = subscription?.scheduled_request;
        if (!req) return;
        setProcessingScheduled(true);
        try {
            const order = await api.createScheduledOrder({ request_id: req.id });
            const options = {
                description: `${req.type === "half_month" ? "15-Day" : "Custom"} Payment`,
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
            await api.verifyScheduledPayment({
                razorpay_order_id: result.razorpay_order_id,
                razorpay_payment_id: result.razorpay_payment_id,
                razorpay_signature: result.razorpay_signature,
                scheduled_request_id: req.id,
            });
            Alert.alert(
                "Payment successful",
                `Your payment of ₹${Number(req.amount).toLocaleString("en-IN")} has been recorded.\nValid: ${fmtDate(req.valid_from)} – ${fmtDate(req.valid_until)}`,
                [{ text: "OK", onPress: () => router.replace("/(student)/home") }]
            );
        } catch (err) {
            const msg = err?.description ?? err?.message ?? "Payment failed. Please try again.";
            Alert.alert("Payment failed", msg);
        } finally {
            setProcessingScheduled(false);
        }
    };

    // ------------------------------------------------------------------
    // QR flow
    // ------------------------------------------------------------------
    const handleQrRequest = async () => {
        if (!selectedPlanId) {
            Alert.alert("Select a plan", "Please select a plan first.");
            return;
        }
        setProcessingQr(true);
        try {
            const result = await api.requestQrPayment({
                plan_id: selectedPlanId,
                is_renewal: isRenewal,
            });
            setQrResult(result);
        } catch (err) {
            Alert.alert("Error", err?.message ?? "Could not create payment request.");
        } finally {
            setProcessingQr(false);
        }
    };

    // ------------------------------------------------------------------
    // Render: QR confirmation screen
    // ------------------------------------------------------------------
    if (qrResult) {
        return (
            <SafeAreaView className="flex-1 bg-gray-50">
                <StatusBar style="dark" />
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                    <View className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
                        <Text className="text-lg font-bold text-gray-900 mb-1">
                            Scan & Pay via UPI
                        </Text>
                        <Text className="text-sm text-gray-500 mb-4">
                            Pay ₹{Number(qrResult.amount).toLocaleString("en-IN")} using any UPI app.
                            Your admission will be confirmed once the admin verifies the payment.
                        </Text>

                        <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                            <Text className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                                Payment Details
                            </Text>
                            <Text className="text-sm text-amber-800">
                                Amount: <Text className="font-bold">₹{Number(qrResult.amount).toLocaleString("en-IN")}</Text>
                            </Text>
                            <Text className="text-sm text-amber-800">
                                Valid: {fmtDate(qrResult.valid_from)} – {fmtDate(qrResult.valid_until)}
                            </Text>
                            {qrResult.prorated && (
                                <Text className="text-xs text-amber-600 mt-1">
                                    Prorated for days remaining this month
                                </Text>
                            )}
                        </View>

                        {qrResult.upi_qr_url && qrResult.upi_qr_url.startsWith("http") ? (
                            <View className="items-center mb-4">
                                <Image
                                    source={{ uri: qrResult.upi_qr_url }}
                                    style={{ width: 200, height: 200, borderRadius: 12 }}
                                    resizeMode="contain"
                                />
                            </View>
                        ) : qrResult.upi_qr_url && qrResult.upi_qr_url.startsWith("upi://") ? (
                            <TouchableOpacity
                                onPress={() => Linking.openURL(qrResult.upi_qr_url)}
                                className="bg-indigo-600 rounded-xl py-3 items-center mb-4"
                            >
                                <Text className="text-white font-bold">Open UPI App</Text>
                            </TouchableOpacity>
                        ) : (
                            <View className="bg-gray-100 rounded-xl p-4 items-center mb-4">
                                <Text className="text-gray-500 text-sm text-center">
                                    No QR code configured. Please contact the admin for payment details.
                                </Text>
                            </View>
                        )}

                        <View className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                            <Text className="text-xs text-indigo-700">
                                After paying, your request has been submitted. The admin will approve it and
                                activate your plan. You can check the status on the Home screen.
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={() => router.replace("/(student)/home")}
                        className="bg-indigo-600 rounded-xl py-4 items-center"
                    >
                        <Text className="text-white font-bold text-base">Go to Home</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // ------------------------------------------------------------------
    // Render: Plan + method selection
    // ------------------------------------------------------------------
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
                        {isRenewal ? "Renew your plan" : "Choose a plan and pay securely"}
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
                        {/* Scheduled request from admin */}
                        {subscription?.scheduled_request ? (
                            <View className="bg-indigo-50 border-2 border-indigo-400 rounded-xl p-4 mb-5">
                                <Text className="text-indigo-700 font-bold text-base mb-1">
                                    📋 Admin Payment Request
                                </Text>
                                <Text className="text-indigo-900 text-sm">
                                    ₹{Number(subscription.scheduled_request.amount).toLocaleString("en-IN")}
                                    {" "}· {subscription.scheduled_request.type === "half_month" ? "15-Day Lumpsum" : "Custom Amount"}
                                </Text>
                                <Text className="text-indigo-600 text-xs mt-0.5">
                                    {fmtDate(subscription.scheduled_request.valid_from)} – {fmtDate(subscription.scheduled_request.valid_until)}
                                </Text>
                                {subscription.scheduled_request.notes ? (
                                    <Text className="text-indigo-500 text-xs mt-1 italic">
                                        "{subscription.scheduled_request.notes}"
                                    </Text>
                                ) : null}
                                <TouchableOpacity
                                    onPress={handleScheduledPay}
                                    disabled={processingScheduled}
                                    className={`mt-3 bg-indigo-600 rounded-xl py-3 items-center ${processingScheduled ? "opacity-70" : ""}`}
                                >
                                    {processingScheduled ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text className="text-white font-bold text-sm">
                                            Pay ₹{Number(subscription.scheduled_request.amount).toLocaleString("en-IN")} via Razorpay
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        {/* Plan list */}
                        <Text className="text-sm text-gray-700 mb-3 font-semibold uppercase tracking-wide">
                            {subscription?.scheduled_request ? "Or Choose a Different Plan" : "Select Plan"}
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
                                        <Text className="text-gray-900 font-bold text-lg">{plan.name}</Text>
                                        <Text className="text-gray-500 text-sm">{plan.duration_days} days</Text>
                                    </View>
                                    <Text className="text-gray-900 font-bold text-xl">
                                        ₹{Number(plan.price).toLocaleString("en-IN")}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}

                        {/* Proration note for first-time payment */}
                        {selectedPlan && !isRenewal && (
                            <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                                <Text className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                                    First Payment — Calendar Cycle
                                </Text>
                                <Text className="text-sm text-amber-800">
                                    You will pay a <Text className="font-semibold">prorated amount</Text> from
                                    your join date to the end of this month, then ₹{Number(selectedPlan.price).toLocaleString("en-IN")} every 1st.
                                </Text>
                                <Text className="text-xs text-amber-600 mt-1">
                                    Exact amount shown at checkout.
                                </Text>
                            </View>
                        )}
                        {selectedPlan && isRenewal && (
                            <View className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4">
                                <Text className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">
                                    Renewal
                                </Text>
                                <Text className="text-sm text-indigo-800">
                                    Full monthly fee — valid 1st to last day of next month.
                                </Text>
                            </View>
                        )}

                        {/* Payment method selection */}
                        {selectedPlan && (
                            <>
                                <Text className="text-sm text-gray-700 mb-3 font-semibold uppercase tracking-wide">
                                    Payment Method
                                </Text>

                                {/* Razorpay card */}
                                <TouchableOpacity
                                    onPress={handleRazorpay}
                                    disabled={processingRazorpay || processingQr}
                                    className={`bg-indigo-600 rounded-xl p-4 mb-3 flex-row items-center justify-between ${
                                        processingRazorpay || processingQr ? "opacity-70" : ""
                                    }`}
                                >
                                    <View>
                                        <Text className="text-white font-bold text-base">Pay Online</Text>
                                        <Text className="text-indigo-200 text-xs mt-0.5">
                                            Instant via Razorpay — UPI, card, netbanking
                                        </Text>
                                    </View>
                                    {processingRazorpay ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text className="text-white text-2xl font-bold">→</Text>
                                    )}
                                </TouchableOpacity>

                                {/* QR / Offline card */}
                                <TouchableOpacity
                                    onPress={handleQrRequest}
                                    disabled={processingRazorpay || processingQr}
                                    className={`bg-white border-2 border-emerald-500 rounded-xl p-4 mb-3 flex-row items-center justify-between ${
                                        processingRazorpay || processingQr ? "opacity-70" : ""
                                    }`}
                                >
                                    <View>
                                        <Text className="text-emerald-700 font-bold text-base">Pay via UPI QR</Text>
                                        <Text className="text-emerald-600 text-xs mt-0.5">
                                            Scan QR &amp; pay offline — admin approves
                                        </Text>
                                    </View>
                                    {processingQr ? (
                                        <ActivityIndicator color="#059669" />
                                    ) : (
                                        <Text className="text-emerald-600 text-2xl font-bold">⊞</Text>
                                    )}
                                </TouchableOpacity>

                                <Text className="text-xs text-gray-400 text-center mt-1">
                                    Payments are processed securely
                                </Text>
                            </>
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
