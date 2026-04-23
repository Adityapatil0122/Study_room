import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import RazorpayCheckout from "react-native-razorpay";
import { useAuth } from "../../context/AuthContext";
import Toast from "react-native-toast-message";

// Bundled QR code image
const LOCAL_QR = require("../../assets/qr_code.png");

function fmtDate(str) {
  if (!str) return "—";
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PayScreen() {
  const { api, student } = useAuth();
  const router = useRouter();

  const [loading, setLoading]                     = useState(true);
  const [error, setError]                         = useState("");
  const [subscription, setSubscription]           = useState(null);
  const [processingRazorpay, setProcessingRazorpay] = useState(false);
  const [sendingQrRequest, setSendingQrRequest]   = useState(false);
  const [qrScreen, setQrScreen]                   = useState(null); // null | { amount, valid_from, valid_until, existing_pending }

  const load = useCallback(async () => {
    try {
      setError("");
      const subData = await api.getStudentSubscription();
      setSubscription(subData);
    } catch (err) {
      setError(err?.message ?? "Failed to load payment details");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const req   = subscription?.scheduled_request ?? null;
  const total = req
    ? req.total_amount != null
      ? Number(req.total_amount)
      : Math.max(0,
          Number(req.amount ?? 0) +
          Number(req.deposit_amount ?? 0) -
          (req.discount_enabled ? Number(req.discount_amount ?? 0) : 0) +
          (req.late_fee_enabled ? Number(req.late_fee_amount ?? 0) : 0)
        )
    : 0;

  // ── Razorpay (scheduled request) ────────────────────────────────────────────
  const handleRazorpay = async () => {
    if (!req) return;
    setProcessingRazorpay(true);
    try {
      const order = await api.createScheduledOrder({ request_id: req.id });
      const options = {
        description: req.plan_name ?? "Library Membership",
        currency: order.currency ?? "INR",
        key: order.razorpay_key_id,
        amount: order.amount,
        name: "Aradhya Abhyasika",
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
        razorpay_order_id:   result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature:  result.razorpay_signature,
        scheduled_request_id: req.id,
      });
      Toast.show({
        type: "success",
        text1: "Payment successful! 🎉",
        text2: `₹${total.toLocaleString("en-IN")} paid via Razorpay.`,
        visibilityTime: 3000,
      });
      const receiptPayment = {
        id:           result.razorpay_payment_id ?? req.id,
        plan_name:    req.plan_name ?? "Membership",
        amount_paid:  total,
        payment_date: new Date().toISOString(),
        payment_mode: "razorpay",
        valid_from:   req.valid_from,
        valid_until:  req.valid_until,
        notes:        req.notes ?? null,
      };
      router.replace({
        pathname: "/(student)/receipt",
        params: {
          payment:       JSON.stringify(receiptPayment),
          redirectAfter:
            req.allow_seat_selection && !student?.current_seat_id
              ? "/(student)/seat-select"
              : "/(student)/home",
        },
      });
    } catch (err) {
      Alert.alert("Payment failed", err?.description ?? err?.message ?? "Please try again.");
    } finally {
      setProcessingRazorpay(false);
    }
  };

  // ── Open QR screen ───────────────────────────────────────────────────────────
  const handleOpenQr = () => {
    if (!req) return;
    // We already have amount + dates from the scheduled request — no API call needed
    setQrScreen({
      amount:           total,
      valid_from:       req.valid_from,
      valid_until:      req.valid_until,
      existing_pending: null,
    });
  };

  // ── Send QR approval request ─────────────────────────────────────────────────
  const handleSendApproval = async () => {
    if (!req) return;
    setSendingQrRequest(true);
    try {
      const result = await api.requestQrPayment({
        plan_id:              req.plan_id,
        is_renewal:           Boolean(student?.renewal_date),
        scheduled_request_id: req.id,
      });
      setQrScreen((prev) => ({
        ...(prev ?? {}),
        existing_pending: {
          id:           result.id,
          amount:       result.amount,
          valid_from:   result.valid_from,
          valid_until:  result.valid_until,
          submitted_at: result.submitted_at,
        },
      }));
      Toast.show({
        type: result.already_pending ? "info" : "success",
        text1: result.already_pending ? "Already submitted" : "Admin notified! ✓",
        text2: result.already_pending
          ? "Your request is pending. Admin will review shortly."
          : "Your payment request has been sent for approval.",
        visibilityTime: 3000,
      });
      Alert.alert(
        result.already_pending ? "Already submitted" : "Request sent!",
        result.already_pending
          ? "Your request is still pending. Admin will review it shortly."
          : "Admin has been notified and will approve your payment shortly.",
        [{ text: "Go to Home", onPress: () => router.replace("/(student)/home") }]
      );
    } catch (err) {
      Alert.alert("Error", err?.message ?? "Could not send request.");
    } finally {
      setSendingQrRequest(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // QR SCREEN
  // ════════════════════════════════════════════════════════════════════════════
  if (qrScreen) {
    const ep = qrScreen.existing_pending;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f2ff" }}>
        <StatusBar style="dark" />

        {/* Nav */}
        <View style={{
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: 16, paddingVertical: 12,
          backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e0e2f7",
        }}>
          <TouchableOpacity onPress={() => setQrScreen(null)} style={{ padding: 4, marginRight: 10 }}>
            <Text style={{ color: "#4f46e5", fontSize: 14, fontWeight: "600" }}>← Back</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: "#111827" }}>Pay via UPI QR</Text>
            <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>Scan · Pay · Notify admin</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

          {/* Amount card */}
          <View style={{
            backgroundColor: "#4f46e5", borderRadius: 20,
            paddingHorizontal: 22, paddingVertical: 20, marginBottom: 16,
            shadowColor: "#4f46e5", shadowOpacity: 0.25, shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 }, elevation: 5,
          }}>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" }}>
              Amount to Pay
            </Text>
            <Text style={{ color: "#fff", fontSize: 40, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 }}>
              ₹{Number(qrScreen.amount).toLocaleString("en-IN")}
            </Text>
            <View style={{ flexDirection: "row", marginTop: 10, gap: 8 }}>
              <View style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>
                  📅 {fmtDate(qrScreen.valid_from)} → {fmtDate(qrScreen.valid_until)}
                </Text>
              </View>
            </View>
          </View>

          {/* QR card */}
          <View style={{
            backgroundColor: "#fff", borderRadius: 20,
            borderWidth: 1, borderColor: "#e0e2f7",
            padding: 20, marginBottom: 16, alignItems: "center",
            shadowColor: "#4f46e5", shadowOpacity: 0.07, shadowRadius: 10,
            shadowOffset: { width: 0, height: 3 }, elevation: 3,
          }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827", marginBottom: 4 }}>
              Scan QR to Pay
            </Text>
            <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 18, textAlign: "center" }}>
              Open GPay, PhonePe, Paytm or any UPI app and scan the code below
            </Text>
            <View style={{
              padding: 14, backgroundColor: "#fff", borderRadius: 16,
              borderWidth: 1.5, borderColor: "#e0e2f7",
              shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 }, elevation: 2, marginBottom: 14,
            }}>
              <Image source={LOCAL_QR} style={{ width: 230, height: 230 }} resizeMode="contain" />
            </View>
            <Text style={{ fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
              Google Pay · PhonePe · Paytm · BHIM · Any UPI app
            </Text>
          </View>

          {/* Status / info */}
          {ep ? (
            <View style={{
              backgroundColor: "#ecfdf5", borderWidth: 1.5, borderColor: "#6ee7b7",
              borderRadius: 16, padding: 16, marginBottom: 16,
            }}>
              <Text style={{ color: "#065f46", fontWeight: "800", fontSize: 14, marginBottom: 4 }}>
                ✅ Approval Request Already Sent
              </Text>
              <Text style={{ color: "#059669", fontSize: 13 }}>
                Submitted on {ep.submitted_at
                  ? new Date(ep.submitted_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                  : "—"}.
              </Text>
              <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
                Admin will review and approve shortly.
              </Text>
            </View>
          ) : (
            <View style={{
              backgroundColor: "#eff6ff", borderWidth: 1, borderColor: "#bfdbfe",
              borderRadius: 16, padding: 14, marginBottom: 16,
            }}>
              <Text style={{ color: "#1d4ed8", fontWeight: "700", fontSize: 13, marginBottom: 6 }}>
                ℹ️ How it works
              </Text>
              <Text style={{ color: "#3b82f6", fontSize: 12, lineHeight: 20 }}>
                1. Scan the QR and complete UPI payment{"\n"}
                2. Tap <Text style={{ fontWeight: "700" }}>"I've Paid — Notify Admin"</Text> below{"\n"}
                3. Admin reviews and approves your payment
              </Text>
            </View>
          )}

          {/* Notify button */}
          {!ep ? (
            <TouchableOpacity
              onPress={handleSendApproval}
              disabled={sendingQrRequest}
              style={{
                backgroundColor: "#059669", borderRadius: 16,
                paddingVertical: 16, alignItems: "center", marginBottom: 12,
                shadowColor: "#059669", shadowOpacity: 0.28, shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 }, elevation: 4,
                opacity: sendingQrRequest ? 0.7 : 1,
              }}
            >
              {sendingQrRequest
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>✅  I've Paid — Notify Admin</Text>
              }
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

  // ════════════════════════════════════════════════════════════════════════════
  // MAIN PAY SCREEN
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <StatusBar style="dark" />

      {/* Nav */}
      <View style={{
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: 16, paddingVertical: 14,
        backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb",
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 10 }}>
          <Text style={{ color: "#4f46e5", fontSize: 14, fontWeight: "600" }}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#111827" }}>Make Payment</Text>
          <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>
            Pay securely via Razorpay or UPI QR
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {loading ? (
          <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 60 }} />
        ) : error ? (
          <View style={{ backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 14, padding: 16 }}>
            <Text style={{ color: "#dc2626", fontSize: 13 }}>{error}</Text>
          </View>
        ) : !req ? (
          /* No scheduled request from admin yet */
          <View style={{
            backgroundColor: "#fff", borderRadius: 20, padding: 28,
            borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center", marginTop: 20,
          }}>
            <Text style={{ fontSize: 36, marginBottom: 14 }}>⏳</Text>
            <Text style={{ color: "#111827", fontWeight: "700", fontSize: 17, marginBottom: 8 }}>
              Waiting for Admin
            </Text>
            <Text style={{ color: "#6b7280", fontSize: 13, textAlign: "center", lineHeight: 20 }}>
              Your payment details haven't been set up yet.{"\n"}
              The admin will send your plan and amount shortly.
            </Text>
          </View>
        ) : (
          <>
            {/* ── Payment details card ── */}
            <View style={{
              backgroundColor: "#fff", borderRadius: 20,
              borderWidth: 1.5, borderColor: "#e0e2f7",
              padding: 20, marginBottom: 20,
              shadowColor: "#4f46e5", shadowOpacity: 0.08,
              shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 3,
            }}>
              {/* Plan header */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                <View style={{
                  backgroundColor: "#eef2ff", borderRadius: 12,
                  paddingHorizontal: 12, paddingVertical: 6, marginRight: 10,
                }}>
                  <Text style={{ fontSize: 20 }}>🏛️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: "#111827" }}>
                    {req.plan_name ?? "Membership Plan"}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    {fmtDate(req.valid_from)} → {fmtDate(req.valid_until)}
                  </Text>
                </View>
              </View>

              {/* Breakdown */}
              <View style={{ backgroundColor: "#f9fafb", borderRadius: 12, padding: 14, marginBottom: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ color: "#6b7280", fontSize: 13 }}>
                    {req.type === "half_month" ? "15-Day Lumpsum" : "Plan fee"}
                  </Text>
                  <Text style={{ color: "#111827", fontWeight: "600", fontSize: 13 }}>
                    ₹{Number(req.amount ?? 0).toLocaleString("en-IN")}
                  </Text>
                </View>
                {Number(req.deposit_amount) > 0 && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ color: "#059669", fontSize: 13 }}>+ Deposit</Text>
                    <Text style={{ color: "#059669", fontWeight: "600", fontSize: 13 }}>
                      ₹{Number(req.deposit_amount).toLocaleString("en-IN")}
                    </Text>
                  </View>
                )}
                {req.discount_enabled && Number(req.discount_amount) > 0 && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ color: "#ef4444", fontSize: 13 }}>− Discount</Text>
                    <Text style={{ color: "#ef4444", fontWeight: "600", fontSize: 13 }}>
                      ₹{Number(req.discount_amount).toLocaleString("en-IN")}
                    </Text>
                  </View>
                )}
                {req.late_fee_enabled && Number(req.late_fee_amount) > 0 && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ color: "#d97706", fontSize: 13 }}>+ Late Fee</Text>
                    <Text style={{ color: "#d97706", fontWeight: "600", fontSize: 13 }}>
                      ₹{Number(req.late_fee_amount).toLocaleString("en-IN")}
                    </Text>
                  </View>
                )}
                <View style={{ borderTopWidth: 1, borderColor: "#e5e7eb", paddingTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: "#111827", fontWeight: "700", fontSize: 15 }}>Total Payable</Text>
                  <Text style={{ color: "#4f46e5", fontWeight: "900", fontSize: 22 }}>
                    ₹{total.toLocaleString("en-IN")}
                  </Text>
                </View>
              </View>

              {req.notes ? (
                <Text style={{ color: "#818cf8", fontSize: 12, fontStyle: "italic", marginTop: 8 }}>
                  "{req.notes}"
                </Text>
              ) : null}
              {req.allow_seat_selection && !student?.current_seat_id ? (
                <Text style={{ color: "#059669", fontSize: 12, fontWeight: "700", marginTop: 8 }}>
                  After payment, you can choose any currently available seat.
                </Text>
              ) : null}
            </View>

            {/* ── Choose payment method label ── */}
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
              Choose Payment Method
            </Text>

            {/* ── Razorpay button ── */}
            <TouchableOpacity
              onPress={handleRazorpay}
              disabled={processingRazorpay}
              style={{
                backgroundColor: "#4f46e5", borderRadius: 16,
                padding: 18, marginBottom: 12,
                flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                opacity: processingRazorpay ? 0.7 : 1,
                shadowColor: "#4f46e5", shadowOpacity: 0.3,
                shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
              }}
            >
              <View>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>💳  Pay ₹{total.toLocaleString("en-IN")} via Razorpay</Text>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 3 }}>
                  Instant · UPI, Card, Netbanking
                </Text>
              </View>
              {processingRazorpay
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>›</Text>
              }
            </TouchableOpacity>

            {/* ── UPI QR button ── */}
            <TouchableOpacity
              onPress={handleOpenQr}
              disabled={processingRazorpay}
              style={{
                backgroundColor: "#fff", borderRadius: 16,
                borderWidth: 2, borderColor: "#059669",
                padding: 18, marginBottom: 20,
                flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                opacity: processingRazorpay ? 0.7 : 1,
                shadowColor: "#059669", shadowOpacity: 0.12,
                shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Image
                  source={LOCAL_QR}
                  style={{ width: 48, height: 48, borderRadius: 8, marginRight: 14, borderWidth: 1, borderColor: "#d1fae5" }}
                  resizeMode="contain"
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#065f46", fontWeight: "800", fontSize: 16 }}>
                    Pay ₹{total.toLocaleString("en-IN")} via UPI QR
                  </Text>
                  <Text style={{ color: "#059669", fontSize: 12, marginTop: 3 }}>
                    Scan QR · Pay · Admin approves
                  </Text>
                </View>
              </View>
              <Text style={{ color: "#059669", fontSize: 22, fontWeight: "800" }}>›</Text>
            </TouchableOpacity>

            <Text style={{ textAlign: "center", color: "#9ca3af", fontSize: 11 }}>
              🔒 Payments are processed securely
            </Text>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
