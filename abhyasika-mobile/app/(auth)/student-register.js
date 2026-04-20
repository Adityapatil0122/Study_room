import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image,
    Animated,
    Easing,
    Alert,
    ActivityIndicator,
} from "react-native";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { createApiClient } from "../../lib/apiClient";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import Toast from "react-native-toast-message";

const SHIFTS = ["Morning", "Afternoon", "Evening", "Day"];
const GENDERS = ["Male", "Female", "Other"];

const api = createApiClient();

export default function StudentRegisterScreen() {
    const { studentRegister, authLoading, authError } = useAuth();
    const router = useRouter();

    const fadeY  = useRef(new Animated.Value(24)).current;
    const fadeOp = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeY, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(fadeOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]).start();
    }, []);

    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        phone: "",
        gender: "",
        preferred_shift: "Morning",
        deposit_amount: "",
    });
    // Aadhaar file state: { uri, name, mimeType } | null
    const [aadhaarFile, setAadhaarFile] = useState(null);
    const [uploadingAadhaar, setUploadingAadhaar] = useState(false);
    const [uploadedAadhaar, setUploadedAadhaar] = useState(null); // { url, mimeType }
    const [localError, setLocalError] = useState("");

    const set = (key) => (value) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    // ── Aadhaar pickers ──────────────────────────────────────────────────────

    const pickAadhaarImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission needed", "Allow access to your photos to upload Aadhaar.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: false,
        });
        if (!result.canceled && result.assets?.length > 0) {
            const asset = result.assets[0];
            setAadhaarFile({
                uri: asset.uri,
                name: asset.fileName ?? "aadhaar.jpg",
                mimeType: asset.mimeType ?? "image/jpeg",
            });
            setUploadedAadhaar(null);
        }
    };

    const pickAadhaarPdf = async () => {
        const result = await DocumentPicker.getDocumentAsync({
            type: "application/pdf",
            copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets?.length > 0) {
            const asset = result.assets[0];
            setAadhaarFile({
                uri: asset.uri,
                name: asset.name ?? "aadhaar.pdf",
                mimeType: "application/pdf",
            });
            setUploadedAadhaar(null);
        }
    };

    const uploadAadhaar = async () => {
        if (!aadhaarFile) return null;
        setUploadingAadhaar(true);
        try {
            const data = await api.uploadAadhaarFile(
                aadhaarFile.uri,
                aadhaarFile.mimeType,
                aadhaarFile.name
            );
            setUploadedAadhaar(data);
            return data;
        } catch (err) {
            Alert.alert("Upload failed", err.message ?? "Could not upload Aadhaar file.");
            return null;
        } finally {
            setUploadingAadhaar(false);
        }
    };

    // ── Submit ───────────────────────────────────────────────────────────────

    const handleRegister = async () => {
        setLocalError("");

        if (!form.name.trim()) { setLocalError("Full name is required"); return; }
        if (!/.+@.+\..+/.test(form.email.trim())) { setLocalError("Please enter a valid email"); return; }
        if (form.password.length < 6) { setLocalError("Password must be at least 6 characters"); return; }
        if (form.password !== form.confirmPassword) { setLocalError("Passwords do not match"); return; }
        const phoneDigits = form.phone.replace(/\D/g, "");
        if (phoneDigits.length !== 10) { setLocalError("Phone must be 10 digits"); return; }
        if (!form.gender) { setLocalError("Please select a gender"); return; }

        // Upload Aadhaar if selected but not yet uploaded
        let aadhaarData = uploadedAadhaar;
        if (aadhaarFile && !uploadedAadhaar) {
            aadhaarData = await uploadAadhaar();
            if (!aadhaarData) return; // Upload failed; error already shown
        }

        try {
            await studentRegister({
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                password: form.password,
                phone: phoneDigits,
                gender: form.gender,
                preferred_shift: form.preferred_shift,
                deposit_amount: Number(form.deposit_amount) || 0,
                aadhaar_file_url: aadhaarData?.url ?? null,
                aadhaar_file_type: aadhaarData?.mimeType ?? null,
                registration_source: "student_app",
            });
            Toast.show({
                type: "success",
                text1: "Account created! 🎉",
                text2: "Welcome to Aradhya Abhyasika.",
                visibilityTime: 3000,
            });
        } catch (e) {
            Toast.show({
                type: "error",
                text1: "Registration failed",
                text2: e?.message ?? "Please check your details and try again.",
                visibilityTime: 3500,
            });
        }
    };

    const aadhaarLabel = aadhaarFile
        ? aadhaarFile.name
        : uploadedAadhaar
        ? "Uploaded ✓"
        : null;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
            <StatusBar style="dark" />
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
                <ScrollView
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View style={{ opacity: fadeOp, transform: [{ translateY: fadeY }] }}>
                        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16, marginBottom: 8, padding: 4 }}>
                            <Text style={{ color: "#4f46e5", fontSize: 15 }}>← Back</Text>
                        </TouchableOpacity>

                        <View style={{ marginBottom: 24 }}>
                            <Image source={require("../../assets/logo.png")} style={{ width: 80, height: 80, marginBottom: 14 }} resizeMode="contain" />
                            <Text style={{ fontSize: 26, fontWeight: "800", color: "#111827" }}>Create account</Text>
                            <Text style={{ color: "#6b7280", marginTop: 4, fontSize: 14 }}>Register yourself to get started</Text>
                        </View>

                        <Field label="Full Name">
                            <TextInput style={inputStyle} placeholder="John Doe" placeholderTextColor="#9ca3af" value={form.name} onChangeText={set("name")} returnKeyType="next" />
                        </Field>

                        <Field label="Email">
                            <TextInput style={inputStyle} placeholder="you@example.com" placeholderTextColor="#9ca3af" value={form.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" returnKeyType="next" />
                        </Field>

                        <Field label="Phone Number">
                            <TextInput style={inputStyle} placeholder="9876543210" placeholderTextColor="#9ca3af" value={form.phone} onChangeText={set("phone")} keyboardType="number-pad" maxLength={10} />
                        </Field>

                        <Field label="Password">
                            <TextInput style={inputStyle} placeholder="At least 6 characters" placeholderTextColor="#9ca3af" value={form.password} onChangeText={set("password")} secureTextEntry returnKeyType="next" />
                        </Field>

                        <Field label="Confirm Password">
                            <TextInput style={inputStyle} placeholder="Re-enter password" placeholderTextColor="#9ca3af" value={form.confirmPassword} onChangeText={set("confirmPassword")} secureTextEntry returnKeyType="done" />
                        </Field>

                        <Field label="Gender">
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                {GENDERS.map((g) => (
                                    <TouchableOpacity
                                        key={g}
                                        onPress={() => set("gender")(g)}
                                        activeOpacity={0.8}
                                        style={{
                                            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
                                            backgroundColor: form.gender === g ? "#4f46e5" : "#fff",
                                            borderColor: form.gender === g ? "#4f46e5" : "#d1d5db",
                                        }}
                                    >
                                        <Text style={{ color: form.gender === g ? "#fff" : "#374151", fontWeight: "500" }}>{g}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Field>

                        <Field label="Preferred Shift">
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                {SHIFTS.map((s) => (
                                    <TouchableOpacity
                                        key={s}
                                        onPress={() => set("preferred_shift")(s)}
                                        activeOpacity={0.8}
                                        style={{
                                            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
                                            backgroundColor: form.preferred_shift === s ? "#4f46e5" : "#fff",
                                            borderColor: form.preferred_shift === s ? "#4f46e5" : "#d1d5db",
                                        }}
                                    >
                                        <Text style={{ color: form.preferred_shift === s ? "#fff" : "#374151", fontWeight: "500" }}>{s}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Field>

                        {/* ── Deposit Amount ─────────────────────────────────── */}
                        <Field label="Deposit Amount (₹)  —  optional">
                            <TextInput
                                style={inputStyle}
                                placeholder="0"
                                placeholderTextColor="#9ca3af"
                                value={form.deposit_amount}
                                onChangeText={set("deposit_amount")}
                                keyboardType="number-pad"
                            />
                            <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                                Security deposit you're paying at the time of registration
                            </Text>
                        </Field>

                        {/* ── Aadhaar Upload ─────────────────────────────────── */}
                        <Field label="Aadhaar Card  —  optional">
                            <View style={{ gap: 8 }}>
                                <View style={{ flexDirection: "row", gap: 8 }}>
                                    <TouchableOpacity
                                        onPress={pickAadhaarImage}
                                        activeOpacity={0.8}
                                        style={{
                                            flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5,
                                            borderColor: "#d1d5db", alignItems: "center",
                                            backgroundColor: "#f9fafb",
                                        }}
                                    >
                                        <Text style={{ color: "#4f46e5", fontWeight: "600", fontSize: 14 }}>📷 Photo / Image</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={pickAadhaarPdf}
                                        activeOpacity={0.8}
                                        style={{
                                            flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5,
                                            borderColor: "#d1d5db", alignItems: "center",
                                            backgroundColor: "#f9fafb",
                                        }}
                                    >
                                        <Text style={{ color: "#4f46e5", fontWeight: "600", fontSize: 14 }}>📄 PDF</Text>
                                    </TouchableOpacity>
                                </View>

                                {aadhaarFile && !uploadedAadhaar && (
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                        <Text style={{ flex: 1, fontSize: 12, color: "#374151" }} numberOfLines={1}>
                                            {aadhaarLabel}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={uploadAadhaar}
                                            disabled={uploadingAadhaar}
                                            style={{
                                                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
                                                backgroundColor: "#4f46e5",
                                            }}
                                        >
                                            {uploadingAadhaar
                                                ? <ActivityIndicator color="#fff" size="small" />
                                                : <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Upload</Text>
                                            }
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setAadhaarFile(null)}>
                                            <Text style={{ color: "#ef4444", fontSize: 13 }}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {uploadedAadhaar && (
                                    <View style={{
                                        flexDirection: "row", alignItems: "center", gap: 8,
                                        backgroundColor: "#ecfdf5", borderRadius: 8, padding: 10,
                                    }}>
                                        <Text style={{ color: "#065f46", fontWeight: "600", fontSize: 13, flex: 1 }}>
                                            ✓ Aadhaar uploaded
                                        </Text>
                                        <TouchableOpacity onPress={() => { setAadhaarFile(null); setUploadedAadhaar(null); }}>
                                            <Text style={{ color: "#6b7280", fontSize: 12 }}>Change</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {!aadhaarFile && !uploadedAadhaar && (
                                    <Text style={{ fontSize: 12, color: "#9ca3af" }}>
                                        Upload a photo or PDF of your Aadhaar card
                                    </Text>
                                )}
                            </View>
                        </Field>

                        {(localError || authError) ? (
                            <Text style={{ color: "#ef4444", fontSize: 13, textAlign: "center", marginVertical: 8 }}>
                                {localError || authError}
                            </Text>
                        ) : null}

                        <TouchableOpacity
                            style={[{ backgroundColor: "#4f46e5", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 20 }, (authLoading || uploadingAadhaar) && { opacity: 0.7 }]}
                            onPress={handleRegister}
                            disabled={authLoading || uploadingAadhaar}
                            activeOpacity={0.85}
                        >
                            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17 }}>
                                {authLoading ? "Creating account…" : "Create Account"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => router.replace("/(auth)/student-login")} style={{ marginTop: 16, alignItems: "center" }}>
                            <Text style={{ color: "#6b7280", fontSize: 14 }}>
                                Already registered?{" "}
                                <Text style={{ color: "#4f46e5", fontWeight: "600" }}>Sign in</Text>
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const inputStyle = {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#f9fafb",
};

function Field({ label, children }) {
    return (
        <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "#374151", marginBottom: 6, fontWeight: "600", fontSize: 14 }}>{label}</Text>
            {children}
        </View>
    );
}
