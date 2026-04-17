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

function fmtDate(str) {
  if (!str) return "-";
  const d = new Date(str);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PayScreen() {
  const { api, student } = useAuth();
  const router = useRouter();

  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingRazorpay, setProcessingRazorpay] = useState(false);
  const [loadingQrPreview, setLoadingQrPreview] = useState(false);
  const [sendingQrRequest, setSendingQrRequest] = useState(false);
  const [processingScheduled, setProcessingScheduled] = useState(false);
  const [qrPreview, setQrPreview] = useState(null);
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

      if (subData?.scheduled_request?.plan_id) {
        const matchingPlan = (plansData ?? []).find(
          (plan) => plan.id === subData.scheduled_request.plan_id
        );
        setSelectedPlanId(matchingPlan?.id ?? plansData?.[0]?.id ?? null);
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

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);

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
        `Your plan has been activated.\nValid: ${fmtDate(order.valid_from)} - ${fmtDate(order.valid_until)}`,
        [
          {
            text: "OK",
            onPress: () => {
              if (!student?.current_seat_id) {
                router.replace("/(student)/seat-select");
              } else {
                router.replace("/(student)/home");
              }
            },
          },
        ]
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
        `Your payment of Rs ${Number(req.amount).toLocaleString("en-IN")} has been recorded.\nValid: ${fmtDate(req.valid_from)} - ${fmtDate(req.valid_until)}`,
        [{ text: "OK", onPress: () => router.replace("/(student)/home") }]
      );
    } catch (err) {
      const msg = err?.description ?? err?.message ?? "Payment failed. Please try again.";
      Alert.alert("Payment failed", msg);
    } finally {
      setProcessingScheduled(false);
    }
  };

  const handleOpenQrFlow = async () => {
    if (!selectedPlanId) {
      Alert.alert("Select a plan", "Please select a plan first.");
      return;
    }

    setLoadingQrPreview(true);
    try {
      const preview = await api.previewQrPayment({
        plan_id: selectedPlanId,
        is_renewal: isRenewal,
      });
      setQrPreview(preview);
    } catch (err) {
      Alert.alert("Error", err?.message ?? "Could not load the QR payment screen.");
    } finally {
      setLoadingQrPreview(false);
    }
  };

  const handleSendApprovalRequest = async () => {
    if (!selectedPlanId) {
      Alert.alert("Select a plan", "Please select a plan first.");
      return;
    }

    setSendingQrRequest(true);
    try {
      const result = await api.requestQrPayment({
        plan_id: selectedPlanId,
        is_renewal: isRenewal,
      });

      const pendingRequest = {
        id: result.id,
        plan_id: result.plan_id ?? selectedPlanId,
        amount: result.amount,
        valid_from: result.valid_from,
        valid_until: result.valid_until,
        submitted_at: result.submitted_at,
      };

      setQrPreview((prev) => ({
        ...(prev ?? {}),
        existing_pending: pendingRequest,
      }));

      Alert.alert(
        result.already_pending
          ? "Approval request already sent"
          : "Approval request sent to admin",
        result.already_pending
          ? "Your earlier request is still pending. The admin will review it shortly."
          : "The admin has been notified. They can now review and approve your QR payment.",
        [{ text: "Go to Home", onPress: () => router.replace("/(student)/home") }]
      );
    } catch (err) {
      Alert.alert("Error", err?.message ?? "Could not send approval request.");
    } finally {
      setSendingQrRequest(false);
    }
  };

  if (qrPreview) {
    const existingPending = qrPreview.existing_pending;

    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <StatusBar style="dark" />
        <View className="px-4 pt-4 pb-2 bg-white border-b border-gray-200 flex-row items-center">
          <TouchableOpacity onPress={() => setQrPreview(null)} className="mr-3 p-2">
            <Text className="text-indigo-600 text-base">{`<-`}</Text>
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-gray-900">UPI QR Payment</Text>
            <Text className="text-gray-500 text-sm">
              Pay first, then send the approval request to admin
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <Text className="text-lg font-bold text-gray-900 mb-1">
              Scan and Pay via UPI
            </Text>
            <Text className="text-sm text-gray-500 mb-4">
              Pay Rs {Number(qrPreview.amount).toLocaleString("en-IN")} using any UPI app, then tap the button below to send your approval request to the admin.
            </Text>

            <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <Text className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                Payment Details
              </Text>
              <Text className="text-sm text-amber-800">
                Amount: <Text className="font-bold">Rs {Number(qrPreview.amount).toLocaleString("en-IN")}</Text>
              </Text>
              <Text className="text-sm text-amber-800">
                Valid: {fmtDate(qrPreview.valid_from)} - {fmtDate(qrPreview.valid_until)}
              </Text>
              {qrPreview.prorated ? (
                <Text className="text-xs text-amber-600 mt-1">
                  Prorated for the remaining days in this month
                </Text>
              ) : null}
            </View>

            {qrPreview.upi_qr_url && qrPreview.upi_qr_url.startsWith("http") ? (
              <View className="items-center mb-4">
                <Image
                  source={{ uri: qrPreview.upi_qr_url }}
                  style={{ width: 220, height: 220, borderRadius: 12 }}
                  resizeMode="contain"
                />
              </View>
            ) : qrPreview.upi_qr_url && qrPreview.upi_qr_url.startsWith("upi://") ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(qrPreview.upi_qr_url)}
                className="bg-indigo-600 rounded-xl py-3 items-center mb-4"
              >
                <Text className="text-white font-bold">Open UPI App</Text>
              </TouchableOpacity>
            ) : (
              <View className="bg-gray-100 rounded-xl p-4 items-center mb-4">
                <Text className="text-gray-500 text-sm text-center">
                  No QR code is configured yet. Please contact the admin for payment details.
                </Text>
              </View>
            )}

            {existingPending ? (
              <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
                <Text className="text-emerald-700 font-bold text-sm mb-1">
                  Approval request already sent
                </Text>
                <Text className="text-emerald-600 text-xs">
                  Submitted on {existingPending.submitted_at
                    ? new Date(existingPending.submitted_at).toLocaleDateString("en-IN")
                    : "-"}.
                  The admin can review and approve it from the dashboard.
                </Text>
              </View>
            ) : (
              <View className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4">
                <Text className="text-xs text-indigo-700">
                  After completing the UPI payment, tap the button below so the admin gets a notification to review and approve your payment.
                </Text>
              </View>
            )}
          </View>

          {!existingPending ? (
            <TouchableOpacity
              onPress={handleSendApprovalRequest}
              disabled={sendingQrRequest}
              className={`bg-emerald-600 rounded-xl py-4 items-center mb-3 ${sendingQrRequest ? "opacity-70" : ""}`}
            >
              {sendingQrRequest ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">
                  Send Approval Request To Admin
                </Text>
              )}
            </TouchableOpacity>
          ) : null}

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

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar style="dark" />
      <View className="px-4 pt-4 pb-2 bg-white border-b border-gray-200 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-2">
          <Text className="text-indigo-600 text-base">{`<-`}</Text>
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
            {subscription?.scheduled_request ? (
              <View className="bg-indigo-50 border-2 border-indigo-400 rounded-xl p-4 mb-5">
                <Text className="text-indigo-700 font-bold text-base mb-1">
                  Admin Payment Request
                </Text>
                <Text className="text-indigo-900 text-sm">
                  Rs {Number(subscription.scheduled_request.amount).toLocaleString("en-IN")}
                  {" · "}
                  {subscription.scheduled_request.type === "half_month"
                    ? "15-Day Lumpsum"
                    : "Custom Amount"}
                </Text>
                <Text className="text-indigo-600 text-xs mt-0.5">
                  {fmtDate(subscription.scheduled_request.valid_from)} - {fmtDate(subscription.scheduled_request.valid_until)}
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
                      Pay Rs {Number(subscription.scheduled_request.amount).toLocaleString("en-IN")} via Razorpay
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

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
                    Rs {Number(plan.price).toLocaleString("en-IN")}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {selectedPlan && !isRenewal ? (
              <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <Text className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                  First Payment - Calendar Cycle
                </Text>
                <Text className="text-sm text-amber-800">
                  You will pay a <Text className="font-semibold">prorated amount</Text> from
                  your join date to the end of this month, then Rs {Number(selectedPlan.price).toLocaleString("en-IN")} every 1st.
                </Text>
                <Text className="text-xs text-amber-600 mt-1">
                  The exact amount is shown at checkout.
                </Text>
              </View>
            ) : null}

            {selectedPlan && isRenewal ? (
              <View className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4">
                <Text className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">
                  Renewal
                </Text>
                <Text className="text-sm text-indigo-800">
                  Full monthly fee valid from the 1st to the last day of next month.
                </Text>
              </View>
            ) : null}

            {selectedPlan ? (
              <>
                <Text className="text-sm text-gray-700 mb-3 font-semibold uppercase tracking-wide">
                  Payment Method
                </Text>

                <TouchableOpacity
                  onPress={handleRazorpay}
                  disabled={processingRazorpay || loadingQrPreview}
                  className={`bg-indigo-600 rounded-xl p-4 mb-3 flex-row items-center justify-between ${
                    processingRazorpay || loadingQrPreview ? "opacity-70" : ""
                  }`}
                >
                  <View>
                    <Text className="text-white font-bold text-base">Pay Online</Text>
                    <Text className="text-indigo-200 text-xs mt-0.5">
                      Instant via Razorpay - UPI, card, netbanking
                    </Text>
                  </View>
                  {processingRazorpay ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white text-2xl font-bold">&gt;</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleOpenQrFlow}
                  disabled={processingRazorpay || loadingQrPreview}
                  className={`bg-white border-2 border-emerald-500 rounded-xl p-4 mb-3 flex-row items-center justify-between ${
                    processingRazorpay || loadingQrPreview ? "opacity-70" : ""
                  }`}
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-emerald-700 font-bold text-base">Pay via UPI QR</Text>
                    <Text className="text-emerald-600 text-xs mt-0.5">
                      Open QR, pay, then send approval request to admin
                    </Text>
                  </View>
                  {loadingQrPreview ? (
                    <ActivityIndicator color="#059669" />
                  ) : (
                    <Text className="text-emerald-600 text-2xl font-bold">QR</Text>
                  )}
                </TouchableOpacity>

                <Text className="text-xs text-gray-400 text-center mt-1">
                  Payments are processed securely
                </Text>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
