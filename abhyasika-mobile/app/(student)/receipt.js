import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Image,
    Platform,
} from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(str) {
    if (!str) return "—";
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function fmtDateShort(str) {
    if (!str) return "—";
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtAmount(val) {
    const n = Number(val ?? 0);
    return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function modeLabel(mode) {
    if (!mode) return "—";
    const m = mode.toLowerCase();
    if (m === "razorpay")           return "Razorpay (Online)";
    if (m === "qr" || m === "upi") return "UPI / QR Code";
    if (m === "cash")               return "Cash";
    return mode.toUpperCase();
}

function modeIcon(mode) {
    if (!mode) return "💳";
    const m = mode.toLowerCase();
    if (m === "razorpay")           return "💳";
    if (m === "qr" || m === "upi") return "📱";
    if (m === "cash")               return "💵";
    return "💳";
}

// ─── PDF HTML ────────────────────────────────────────────────────────────────

function buildReceiptHTML(payment, logoBase64) {
    const amount    = Number(payment.amount_paid ?? payment.amount ?? 0);
    const date      = fmtDate(payment.payment_date ?? payment.created_at);
    const mode      = modeLabel(payment.payment_mode);
    const planName  = payment.plan_name ?? "Membership";
    const validFrom = payment.valid_from  ? fmtDateShort(payment.valid_from)  : null;
    const validUntil= payment.valid_until ? fmtDateShort(payment.valid_until) : null;
    const receiptNo = payment.id ? payment.id.slice(0, 8).toUpperCase() : "—";
    const issuedOn  = new Date().toLocaleDateString("en-IN", {
        day: "2-digit", month: "long", year: "numeric",
    });

    const logoTag = logoBase64
        ? `<img src="data:image/png;base64,${logoBase64}" class="logo" alt="Logo"/>`
        : `<div class="logo-ph">A</div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    background: #f0f2ff;
    padding: 32px 20px;
  }

  .page {
    max-width: 520px;
    margin: 0 auto;
    background: #fff;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(79, 70, 229, 0.13);
    border: 1px solid #e0e2f7;
  }

  /* ── purple header ── */
  .header {
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    padding: 30px 28px 24px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .logo-box {
    width: 68px; height: 68px;
    border-radius: 50%;
    background: #fff;
    border: 3px solid rgba(255,255,255,0.5);
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }
  .logo { width: 56px; height: 56px; object-fit: contain; }
  .logo-ph {
    width: 56px; height: 56px;
    display: flex; align-items: center; justify-content: center;
    font-size: 28px; font-weight: 800; color: #4f46e5;
  }
  .header-info { flex: 1; }
  .lib-name {
    font-size: 20px; font-weight: 800;
    color: #fff;
    letter-spacing: 0.2px;
    line-height: 1.2;
  }
  .lib-sub {
    font-size: 11px;
    color: rgba(255,255,255,0.7);
    margin-top: 3px;
    letter-spacing: 0.3px;
  }
  .receipt-tag {
    margin-top: 10px;
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    color: rgba(255,255,255,0.85);
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }

  /* ── green amount strip ── */
  .amount-strip {
    background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
    padding: 26px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #a7f3d0;
  }
  .amt-label {
    font-size: 10px; font-weight: 700;
    color: #059669;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .amt-value {
    font-size: 42px; font-weight: 900;
    color: #065f46;
    line-height: 1;
    letter-spacing: -0.5px;
  }
  .amt-plan {
    font-size: 12px; color: #6b7280;
    margin-top: 6px;
  }
  .paid-text {
    font-size: 13px; font-weight: 800;
    color: #059669;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  /* ── details ── */
  .details { padding: 24px 28px 20px; background: #fff; }
  .details-heading {
    font-size: 13px; font-weight: 800;
    color: #4f46e5;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 1.5px solid #e0e2f7;
  }
  table { width: 100%; border-collapse: collapse; }
  tr + tr td { border-top: 1px solid #f3f4f6; }
  td { padding: 10px 0; font-size: 13px; vertical-align: middle; }
  td.lbl { color: #6b7280; font-weight: 500; width: 44%; }
  td.val { color: #111827; font-weight: 600; text-align: right; }
  td.val.italic { font-style: italic; color: #9ca3af; font-weight: 400; }
  .chip-indigo {
    display: inline-block;
    background: #ede9fe; color: #5b21b6;
    font-size: 11px; font-weight: 700;
    border-radius: 8px; padding: 3px 10px;
  }
  .chip-green {
    display: inline-block;
    background: #d1fae5; color: #065f46;
    font-size: 11px; font-weight: 700;
    border-radius: 8px; padding: 3px 10px;
  }
  .autogen {
    text-align: center;
    font-size: 9px; color: #c4b5fd;
    font-style: italic;
    padding: 10px 28px 14px;
    background: #fff;
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="logo-box">${logoTag}</div>
    <div class="header-info">
      <div class="lib-name">Aradhya Abhyasika</div>
      <div class="lib-sub">Library &amp; Study Centre</div>
      <div class="receipt-tag">Payment Receipt</div>
    </div>
  </div>

  <!-- Amount strip -->
  <div class="amount-strip">
    <div>
      <div class="amt-label">Amount Paid</div>
      <div class="amt-value">${fmtAmount(amount)}</div>
      <div class="amt-plan">${planName} &nbsp;·&nbsp; ${date}</div>
    </div>
    <div class="paid-text">Paid</div>
  </div>

  <!-- Details -->
  <div class="details">
    <div class="details-heading">Transaction Details</div>
    <table>
      <tr><td class="lbl">Receipt No.</td><td class="val">#${receiptNo}</td></tr>
      <tr><td class="lbl">Plan</td><td class="val">${planName}</td></tr>
      <tr><td class="lbl">Payment Date</td><td class="val">${date}</td></tr>
      <tr>
        <td class="lbl">Payment Mode</td>
        <td class="val"><span class="chip-indigo">${mode}</span></td>
      </tr>
      ${validFrom && validUntil ? `
      <tr>
        <td class="lbl">Valid Period</td>
        <td class="val"><span class="chip-green">${validFrom} – ${validUntil}</span></td>
      </tr>` : ""}
      ${payment.notes ? `<tr><td class="lbl">Notes</td><td class="val italic">${payment.notes}</td></tr>` : ""}
    </table>
  </div>

  <div class="autogen">Computer-generated receipt · No signature required</div>

</div>
</body>
</html>`;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ReceiptScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [downloading, setDownloading] = useState(false);

    let payment = {};
    try { payment = JSON.parse(params.payment ?? "{}"); } catch (_) {}
    const redirectAfter = params.redirectAfter ?? null;

    const amount    = Number(payment.amount_paid ?? payment.amount ?? 0);
    const date      = fmtDate(payment.payment_date ?? payment.created_at);
    const mode      = modeLabel(payment.payment_mode);
    const icon      = modeIcon(payment.payment_mode);
    const planName  = payment.plan_name ?? "Membership";
    const receiptNo = payment.id ? payment.id.slice(0, 8).toUpperCase() : "—";

    // ── Download PDF ─────────────────────────────────────────────────────────
    const handleDownload = async () => {
        setDownloading(true);
        try {
            let logoBase64 = null;
            try {
                const { Asset } = await import("expo-asset");
                const [asset] = await Asset.loadAsync(require("../../assets/logo.png"));
                const localUri = asset.localUri ?? asset.uri;
                if (localUri) {
                    logoBase64 = await FileSystem.readAsStringAsync(localUri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });
                }
            } catch (_) {}

            const html    = buildReceiptHTML(payment, logoBase64);
            const { uri: tmpUri } = await Print.printToFileAsync({ html, base64: false });
            const safeDate = new Date().toISOString().slice(0, 10).replace(/-/g, "");
            const safePlan = (payment.plan_name ?? "receipt").replace(/[^a-zA-Z0-9]/g, "_");
            const fileName = `Abhyasika_Receipt_${safePlan}_${safeDate}.pdf`;
            const destUri  = FileSystem.documentDirectory + fileName;

            await FileSystem.copyAsync({ from: tmpUri, to: destUri });

            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(destUri, {
                    mimeType: "application/pdf",
                    dialogTitle: "Save or share your receipt",
                    UTI: "com.adobe.pdf",
                });
            } else {
                Alert.alert("Saved ✅", `Receipt saved as:\n${fileName}`);
            }
        } catch (err) {
            Alert.alert("Error", err?.message ?? "Could not generate PDF.");
        } finally {
            setDownloading(false);
        }
    };

    // ── UI ───────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f2ff" }}>
            <StatusBar style="dark" />

            {/* Top nav bar */}
            <View style={{
                flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                paddingHorizontal: 16, paddingVertical: 12,
                backgroundColor: "#fff",
                borderBottomWidth: 1, borderBottomColor: "#e0e2f7",
            }}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
                    <Text style={{ color: "#4f46e5", fontSize: 14, fontWeight: "600" }}>← Back</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>Receipt</Text>
                <TouchableOpacity
                    onPress={handleDownload}
                    disabled={downloading}
                    style={{
                        backgroundColor: "#4f46e5", borderRadius: 9,
                        paddingHorizontal: 14, paddingVertical: 8,
                        opacity: downloading ? 0.7 : 1,
                    }}
                >
                    {downloading
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>⬇ PDF</Text>
                    }
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={{ padding: 20, paddingBottom: 52 }}
                showsVerticalScrollIndicator={false}
            >

                {/* ── Receipt card ── */}
                <View style={{
                    backgroundColor: "#fff",
                    borderRadius: 20,
                    overflow: "hidden",
                    borderWidth: 1, borderColor: "#e0e2f7",
                    shadowColor: "#4f46e5",
                    shadowOpacity: 0.10,
                    shadowRadius: 20,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 6,
                }}>

                    {/* Purple header */}
                    <View style={{
                        backgroundColor: "#4f46e5",
                        paddingHorizontal: 22, paddingTop: 26, paddingBottom: 22,
                    }}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                            {/* Logo circle */}
                            <View style={{
                                width: 68, height: 68, borderRadius: 34,
                                backgroundColor: "#fff",
                                borderWidth: 3, borderColor: "rgba(255,255,255,0.5)",
                                alignItems: "center", justifyContent: "center",
                                overflow: "hidden",
                            }}>
                                <Image
                                    source={require("../../assets/logo.png")}
                                    style={{ width: 56, height: 56 }}
                                    resizeMode="contain"
                                />
                            </View>

                            {/* Name */}
                            <View style={{ marginLeft: 14, flex: 1 }}>
                                <Text style={{ color: "#fff", fontSize: 19, fontWeight: "800", letterSpacing: 0.2 }}>
                                    Aradhya Abhyasika
                                </Text>
                                <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 2 }}>
                                    Library & Study Centre
                                </Text>
                                <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginTop: 8, textTransform: "uppercase" }}>
                                    Payment Receipt
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Green amount strip */}
                    <View style={{
                        backgroundColor: "#ecfdf5",
                        paddingHorizontal: 22, paddingVertical: 24,
                        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                        borderBottomWidth: 1, borderBottomColor: "#a7f3d0",
                    }}>
                        <View>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: "#059669", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
                                Amount Paid
                            </Text>
                            <Text style={{ fontSize: 40, fontWeight: "900", color: "#065f46", lineHeight: 42, letterSpacing: -0.5 }}>
                                {fmtAmount(amount)}
                            </Text>
                            <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                                {planName}  ·  {date}
                            </Text>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "800", color: "#059669", letterSpacing: 1, textTransform: "uppercase" }}>
                            Paid
                        </Text>
                    </View>

                    {/* Details */}
                    <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 18 }}>
                        {/* Section label */}
                        <Text style={{ fontSize: 13, fontWeight: "800", color: "#4f46e5", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1.5, borderBottomColor: "#e0e2f7" }}>
                            Transaction Details
                        </Text>

                        <DetailRow label="Receipt No." value={`#${receiptNo}`} />
                        <DetailRow label="Plan" value={planName} />
                        <DetailRow label="Payment Date" value={date} />
                        <DetailRow
                            label="Payment Mode"
                            chipValue={`${icon}  ${mode}`}
                            chipBg="#ede9fe" chipText="#5b21b6"
                        />
                        {payment.valid_from && payment.valid_until ? (
                            <DetailRow
                                label="Valid Period"
                                chipValue={`${fmtDateShort(payment.valid_from)}  →  ${fmtDateShort(payment.valid_until)}`}
                                chipBg="#d1fae5" chipText="#065f46"
                            />
                        ) : null}
                        {payment.notes ? (
                            <DetailRow label="Notes" value={payment.notes} italic />
                        ) : null}
                    </View>

                    {/* Auto-gen */}
                    <View style={{ paddingBottom: 14, alignItems: "center" }}>
                        <Text style={{ fontSize: 9, color: "#c4b5fd", fontStyle: "italic" }}>
                            Computer-generated receipt · No signature required
                        </Text>
                    </View>
                </View>

                {/* Download button */}
                <TouchableOpacity
                    onPress={handleDownload}
                    disabled={downloading}
                    style={{
                        marginTop: 22,
                        backgroundColor: "#4f46e5",
                        borderRadius: 14, paddingVertical: 16,
                        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                        opacity: downloading ? 0.7 : 1,
                        shadowColor: "#4f46e5", shadowOpacity: 0.28,
                        shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
                        elevation: 4,
                    }}
                >
                    {downloading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>⬇  Save / Share Receipt PDF</Text>
                    }
                </TouchableOpacity>

                <Text style={{ textAlign: "center", color: "#6b7280", fontSize: 11, marginTop: 9, lineHeight: 17 }}>
                    {Platform.OS === "android"
                        ? `Tap "Save to Files" or "Downloads" in the share sheet`
                        : `Tap "Save to Files" in the share sheet to keep on device`
                    }
                </Text>

                {/* Continue button after fresh payment */}
                {redirectAfter ? (
                    <TouchableOpacity
                        onPress={() => router.replace(redirectAfter)}
                        style={{
                            marginTop: 12,
                            backgroundColor: "#059669",
                            borderRadius: 14, paddingVertical: 16, alignItems: "center",
                            shadowColor: "#059669", shadowOpacity: 0.25,
                            shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
                            elevation: 3,
                        }}
                    >
                        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
                            {redirectAfter.includes("seat-select") ? "Select Your Seat →" : "Continue to Home →"}
                        </Text>
                    </TouchableOpacity>
                ) : null}

            </ScrollView>
        </SafeAreaView>
    );
}

// ─── Detail Row ──────────────────────────────────────────────────────────────

function DetailRow({ label, value, italic, chipValue, chipBg, chipText }) {
    return (
        <View style={{
            flexDirection: "row", justifyContent: "space-between", alignItems: "center",
            paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
        }}>
            <Text style={{ color: "#6b7280", fontSize: 13, fontWeight: "500", flex: 1, paddingRight: 8 }}>
                {label}
            </Text>
            {chipValue ? (
                <View style={{ backgroundColor: chipBg ?? "#f3f4f6", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, maxWidth: 200 }}>
                    <Text style={{ color: chipText ?? "#374151", fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
                        {chipValue}
                    </Text>
                </View>
            ) : (
                <Text style={{
                    color: italic ? "#9ca3af" : "#111827",
                    fontSize: 13,
                    fontWeight: italic ? "400" : "600",
                    fontStyle: italic ? "italic" : "normal",
                    textAlign: "right", flex: 1.2,
                }} numberOfLines={2}>
                    {value}
                </Text>
            )}
        </View>
    );
}
