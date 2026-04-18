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

      // Navigate to the receipt screen with payment data
      const receiptPayment = {
        id: result.razorpay_payment_id ?? order.id,
        plan_name: order.plan?.name ?? selectedPlan?.name ?? "Plan",
        amount_paid: Math.round(order.amount / 100), // amount is in paise
        payment_date: new Date().toISOString(),
        payment_mode: "razorpay",
        valid_from: order.valid_from,
        valid_until: order.valid_until,
        notes: `Order: ${result.razorpay_order_id}`,
      };
      router.replace({
        pathname: "/(student)/receipt",
        params: {
          payment: JSON.stringify(receiptPayment),
          redirectAfter: !student?.current_seat_id ? "/(student)/seat-select" : "/(student)/home",
        },
      });
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
      const paidTotal = req.total_amount != null
        ? Number(req.total_amount)
        : Math.max(0, Number(req.amount ?? 0) + Number(req.deposit_amount ?? 0) - (req.discount_enabled ? Number(req.discount_amount ?? 0) : 0));

      const receiptPayment = {
        id: result.razorpay_payment_id ?? req.id,
        plan_name: req.plan_name ?? "Plan Payment",
        amount_paid: paidTotal,
        payment_date: new Date().toISOString(),
        payment_mode: "razorpay",
        valid_from: req.valid_from,
        valid_until: req.valid_until,
        notes: req.notes ?? null,
      };
      router.replace({
        pathname: "/(student)/receipt",
        params: {
          payment: JSON.stringify(receiptPayment),
          redirectAfter: "/(student)/home",
        },
      });
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
    const amount = Number(qrPreview.amount);

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f2ff" }}>
        <StatusBar style="dark" />

        {/* Nav bar */}
        <View style={{
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: 16, paddingVertical: 12,
          backgroundColor: "#fff",
          borderBottomWidth: 1, borderBottomColor: "#e0e2f7",
        }}>
          <TouchableOpacity onPress={() => setQrPreview(null)} style={{ padding: 4, marginRight: 10 }}>
            <Text style={{ color: "#4f46e5", fontSize: 14, fontWeight: "600" }}>← Back</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: "#111827" }}>Pay via UPI QR</Text>
            <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>
              Scan · Pay · Send request to admin
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

          {/* ── Amount card ── */}
          <View style={{
            backgroundColor: "#4f46e5", borderRadius: 20,
            paddingHorizontal: 22, paddingVertical: 20,
            marginBottom: 16,
            shadowColor: "#4f46e5", shadowOpacity: 0.25,
            shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5,
          }}>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" }}>
              Amount to Pay
            </Text>
            <Text style={{ color: "#fff", fontSize: 38, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 }}>
              ₹{amount.toLocaleString("en-IN")}
            </Text>
            <View style={{ flexDirection: "row", marginTop: 10, gap: 10 }}>
              <View style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>
                  📅 {fmtDate(qrPreview.valid_from)} → {fmtDate(qrPreview.valid_until)}
                </Text>
              </View>
              {qrPreview.prorated ? (
                <View style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>Prorated</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ── QR Code card ── */}
          <View style={{
            backgroundColor: "#fff", borderRadius: 20,
            borderWidth: 1, borderColor: "#e0e2f7",
            padding: 20, marginBottom: 16, alignItems: "center",
            shadowColor: "#4f46e5", shadowOpacity: 0.07,
            shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
          }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827", marginBottom: 4 }}>
              Scan QR to Pay
            </Text>
            <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 18, textAlign: "center" }}>
              Open any UPI app (GPay, PhonePe, Paytm) and scan the code below
            </Text>

            {/* QR Image — bundled local asset takes priority, server URL as fallback */}
            <View style={{
              padding: 14,
              backgroundColor: "#fff",
              borderRadius: 16,
              borderWidth: 1.5, borderColor: "#e0e2f7",
              shadowColor: "#000", shadowOpacity: 0.06,
              shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
              marginBottom: 16,
            }}>
              {(() => {
                // Try bundled local QR first
                try {
                  const localQr = require("../../assets/qr_code.png");
                  return (
                    <Image
                      source={localQr}
                      style={{ width: 230, height: 230 }}
                      resizeMode="contain"
                    />
                  );
                } catch (_) {
                  // Fall back to server-configured URL
                  if (qrPreview.upi_qr_url && qrPreview.upi_qr_url.startsWith("http")) {
                    return (
                      <Image
                        source={{ uri: qrPreview.upi_qr_url }}
                        style={{ width: 230, height: 230 }}
                        resizeMode="contain"
                      />
                    );
                  }
                  // No QR available
                  return (
                    <View style={{ width: 230, height: 230, alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb", borderRadius: 12 }}>
                      <Text style={{ fontSize: 40, marginBottom: 10 }}>📱</Text>
                      <Text style={{ color: "#6b7280", fontSize: 13, textAlign: "center", paddingHorizontal: 16 }}>
                        No QR configured yet.{"\n"}Contact admin for UPI details.
                      </Text>
                    </View>
                  );
                }
              })()}
            </View>

            {/* UPI deep-link button if available */}
            {qrPreview.upi_qr_url && qrPreview.upi_qr_url.startsWith("upi://") ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(qrPreview.upi_qr_url)}
                style={{
                  backgroundColor: "#ecfdf5", borderWidth: 1.5, borderColor: "#6ee7b7",
                  borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24,
                  flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 18 }}>📲</Text>
                <Text style={{ color: "#065f46", fontWeight: "700", fontSize: 14 }}>Open UPI App Directly</Text>
              </TouchableOpacity>
            ) : null}

            <Text style={{ fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
              Supported: Google Pay · PhonePe · Paytm · BHIM · Any UPI app
            </Text>
          </View>

          {/* ── Status banner ── */}
          {existingPending ? (
            <View style={{
              backgroundColor: "#ecfdf5", borderWidth: 1.5, borderColor: "#6ee7b7",
              borderRadius: 16, padding: 16, marginBottom: 16,
            }}>
              <Text style={{ color: "#065f46", fontWeight: "800", fontSize: 14, marginBottom: 4 }}>
                ✅ Approval Request Already Sent
              </Text>
              <Text style={{ color: "#059669", fontSize: 13 }}>
                Submitted on {existingPending.submitted_at
                  ? new Date(existingPending.submitted_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                  : "—"}.
              </Text>
              <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
                The admin will review and approve it from the dashboard shortly.
              </Text>
            </View>
          ) : (
            <View style={{
              backgroundColor: "#eff6ff", borderWidth: 1, borderColor: "#bfdbfe",
              borderRadius: 16, padding: 14, marginBottom: 16,
            }}>
              <Text style={{ color: "#1d4ed8", fontWeight: "700", fontSize: 13, marginBottom: 4 }}>
                ℹ️ How it works
              </Text>
              <Text style={{ color: "#3b82f6", fontSize: 12, lineHeight: 18 }}>
                1. Scan the QR code and complete the UPI payment{"\n"}
                2. Tap <Text style={{ fontWeight: "700" }}>"I've Paid — Notify Admin"</Text> below{"\n"}
                3. Admin reviews and approves your payment
              </Text>
            </View>
          )}

          {/* ── Action buttons ── */}
          {!existingPending ? (
            <TouchableOpacity
              onPress={handleSendApprovalRequest}
              disabled={sendingQrRequest}
              style={{
                backgroundColor: "#059669", borderRadius: 16,
                paddingVertical: 16, alignItems: "center", marginBottom: 12,
                shadowColor: "#059669", shadowOpacity: 0.28,
                shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
                opacity: sendingQrRequest ? 0.7 : 1,
              }}
            >
              {sendingQrRequest ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
                  ✅  I've Paid — Notify Admin
                </Text>
              )}
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={() => router.replace("/(student)/home")}
            style={{
              backgroundColor: "#f0f2ff", borderWidth: 1.5, borderColor: "#c7d2fe",
              borderRadius: 16, paddingVertical: 14, alignItems: "center",
            }}
          >
            <Text style={{ color: "#4f46e5", fontWeight: "700", fontSize: 14 }}>Go to Home</Text>
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
            {subscription?.scheduled_request ? (() => {
              const req = subscription.scheduled_request;
              const planAmt = Number(req.amount ?? 0);
              const deposit = Number(req.deposit_amount ?? 0);
              const discount = req.discount_enabled ? Number(req.discount_amount ?? 0) : 0;
              const total = req.total_amount != null
                ? Number(req.total_amount)
                : Math.max(0, planAmt + deposit - discount);
              return (
                <View style={{ backgroundColor: "#eef2ff", borderWidth: 2, borderColor: "#6366f1", borderRadius: 16, padding: 16, marginBottom: 20 }}>
                  <Text style={{ color: "#4338ca", fontWeight: "800", fontSize: 15, marginBottom: 4 }}>
                    Admin Payment Request
                  </Text>

                  <View style={{ backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 8 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                      <Text style={{ color: "#6b7280", fontSize: 13 }}>
                        {req.type === "half_month" ? "15-Day Lumpsum" : "Plan fee"}
                      </Text>
                      <Text style={{ color: "#111827", fontWeight: "600", fontSize: 13 }}>
                        ₹{planAmt.toLocaleString("en-IN")}
                      </Text>
                    </View>
                    {deposit > 0 && (
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                        <Text style={{ color: "#059669", fontSize: 13 }}>+ Deposit</Text>
                        <Text style={{ color: "#059669", fontWeight: "600", fontSize: 13 }}>
                          ₹{deposit.toLocaleString("en-IN")}
                        </Text>
                      </View>
                    )}
                    {discount > 0 && (
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                        <Text style={{ color: "#ef4444", fontSize: 13 }}>− Discount</Text>
                        <Text style={{ color: "#ef4444", fontWeight: "600", fontSize: 13 }}>
                          ₹{discount.toLocaleString("en-IN")}
                        </Text>
                      </View>
                    )}
                    <View style={{ borderTopWidth: 1, borderColor: "#e5e7eb", marginTop: 6, paddingTop: 6, flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: "#111827", fontWeight: "700", fontSize: 15 }}>Total</Text>
                      <Text style={{ color: "#4f46e5", fontWeight: "800", fontSize: 16 }}>
                        ₹{total.toLocaleString("en-IN")}
                      </Text>
                    </View>
                  </View>

                  <Text style={{ color: "#6366f1", fontSize: 12 }}>
                    {fmtDate(req.valid_from)} → {fmtDate(req.valid_until)}
                  </Text>
                  {req.notes ? (
                    <Text style={{ color: "#818cf8", fontSize: 12, marginTop: 2, fontStyle: "italic" }}>
                      "{req.notes}"
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    onPress={handleScheduledPay}
                    disabled={processingScheduled}
                    style={[
                      { marginTop: 12, backgroundColor: "#4f46e5", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
                      processingScheduled && { opacity: 0.7 }
                    ]}
                  >
                    {processingScheduled ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                        Pay ₹{total.toLocaleString("en-IN")} via Razorpay
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })() : null}

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
