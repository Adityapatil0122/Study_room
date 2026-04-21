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

const GENDERS = ["Male", "Female", "Other"];
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

// ── Verhoeff algorithm tables for Aadhaar checksum validation ─────────────
const VD = [
    [0,1,2,3,4,5,6,7,8,9],
    [1,2,3,4,0,6,7,8,9,5],
    [2,3,4,0,1,7,8,9,5,6],
    [3,4,0,1,2,8,9,5,6,7],
    [4,0,1,2,3,9,5,6,7,8],
    [5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2],
    [7,6,5,9,8,2,1,0,4,3],
    [8,7,6,5,9,3,2,1,0,4],
    [9,8,7,6,5,4,3,2,1,0],
];
const VP = [
    [0,1,2,3,4,5,6,7,8,9],
    [1,5,7,6,2,8,3,0,9,4],
    [5,8,0,3,7,9,6,1,4,2],
    [8,9,1,6,0,4,3,5,2,7],
    [9,4,5,3,1,2,6,8,7,0],
    [4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5],
    [7,0,4,6,9,1,3,2,5,8],
];

function validateAadhaar(num) {
    const clean = num.replace(/\s/g, "");
    // Must be 12 digits, not starting with 0 or 1, not all same digit
    if (!/^[2-9][0-9]{11}$/.test(clean)) return false;
    if (/^(.)\1+$/.test(clean)) return false;
    // Verhoeff checksum
    let c = 0;
    const digits = clean.split("").reverse().map(Number);
    for (let i = 0; i < digits.length; i++) {
        c = VD[c][VP[i % 8][digits[i]]];
    }
    return c === 0;
}

function validatePAN(pan) {
    const clean = pan.trim().toUpperCase();
    // Format: 5 letters + 4 digits + 1 letter; 4th char must be valid entity type
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clean)) return false;
    return "PCHABFTLJG".includes(clean[3]);
}

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
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // ID proof
    const [idDocType, setIdDocType] = useState("aadhaar"); // "aadhaar" | "pan"
    const [idNumber, setIdNumber] = useState("");
    const [idNumberError, setIdNumberError] = useState("");

    // File upload
    const [idFile, setIdFile] = useState(null); // { uri, name, mimeType, size }
    const [uploadingId, setUploadingId] = useState(false);
    const [uploadedId, setUploadedId] = useState(null); // { url, mimeType }
    const [localError, setLocalError] = useState("");

    const set = (key) => (value) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    // ── Real-time ID number validation ───────────────────────────────────────
    const onIdNumberChange = (raw) => {
        const val = idDocType === "aadhaar"
            ? raw.replace(/\D/g, "").slice(0, 12)
            : raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
        setIdNumber(val);
        if (!val) { setIdNumberError(""); return; }
        if (idDocType === "aadhaar") {
            setIdNumberError(val.length === 12 ? (validateAadhaar(val) ? "" : "Invalid Aadhaar number") : "");
        } else {
            setIdNumberError(val.length === 10 ? (validatePAN(val) ? "" : "Invalid PAN (format: ABCDE1234F)") : "");
        }
    };

    const switchDocType = (type) => {
        setIdDocType(type);
        setIdNumber("");
        setIdNumberError("");
    };

    // ── File pickers with 5 MB guard ─────────────────────────────────────────
    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission needed", "Allow access to your photos to upload ID proof.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: false,
        });
        if (!result.canceled && result.assets?.length > 0) {
            const asset = result.assets[0];
            if (asset.fileSize && asset.fileSize > MAX_FILE_BYTES) {
                Alert.alert("File too large", "Please select an image under 5 MB.");
                return;
            }
            setIdFile({ uri: asset.uri, name: asset.fileName ?? "id_proof.jpg", mimeType: asset.mimeType ?? "image/jpeg", size: asset.fileSize });
            setUploadedId(null);
        }
    };

    const pickPdf = async () => {
        const result = await DocumentPicker.getDocumentAsync({
            type: "application/pdf",
            copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets?.length > 0) {
            const asset = result.assets[0];
            if (asset.size && asset.size > MAX_FILE_BYTES) {
                Alert.alert("File too large", "Please select a PDF under 5 MB.");
                return;
            }
            setIdFile({ uri: asset.uri, name: asset.name ?? "id_proof.pdf", mimeType: "application/pdf", size: asset.size });
            setUploadedId(null);
        }
    };

    const uploadId = async () => {
        if (!idFile) return null;
        setUploadingId(true);
        try {
            const data = await api.uploadAadhaarFile(idFile.uri, idFile.mimeType, idFile.name);
            setUploadedId(data);
            return data;
        } catch (err) {
            Alert.alert("Upload failed", err.message ?? "Could not upload ID proof.");
            return null;
        } finally {
            setUploadingId(false);
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

        if (idNumber.trim()) {
            const valid = idDocType === "aadhaar" ? validateAadhaar(idNumber) : validatePAN(idNumber);
            if (!valid) {
                setLocalError(idDocType === "aadhaar" ? "Invalid Aadhaar number" : "Invalid PAN number");
                return;
            }
        }

        let idData = uploadedId;
        if (idFile && !uploadedId) {
            idData = await uploadId();
            if (!idData) return;
        }

        try {
            await studentRegister({
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                password: form.password,
                phone: phoneDigits,
                gender: form.gender,
                id_proof_type: idNumber.trim() ? idDocType : null,
                id_proof_number: idNumber.trim() || null,
                aadhaar_file_url: idData?.url ?? null,
                aadhaar_file_type: idData?.mimeType ?? null,
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

    const idDocLabel = idDocType === "aadhaar" ? "Aadhaar" : "PAN Card";
    const idFileLabel = idFile ? idFile.name : uploadedId ? "Uploaded ✓" : null;

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
                            <View style={{ position: "relative" }}>
                                <TextInput
                                    style={[inputStyle, { paddingRight: 50 }]}
                                    placeholder="At least 6 characters"
                                    placeholderTextColor="#9ca3af"
                                    value={form.password}
                                    onChangeText={set("password")}
                                    secureTextEntry={!showPassword}
                                    returnKeyType="next"
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(v => !v)}
                                    style={{ position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Text style={{ fontSize: 17 }}>{showPassword ? "🙈" : "👁️"}</Text>
                                </TouchableOpacity>
                            </View>
                        </Field>

                        <Field label="Confirm Password">
                            <View style={{ position: "relative" }}>
                                <TextInput
                                    style={[inputStyle, { paddingRight: 50 }]}
                                    placeholder="Re-enter password"
                                    placeholderTextColor="#9ca3af"
                                    value={form.confirmPassword}
                                    onChangeText={set("confirmPassword")}
                                    secureTextEntry={!showConfirmPassword}
                                    returnKeyType="done"
                                />
                                <TouchableOpacity
                                    onPress={() => setShowConfirmPassword(v => !v)}
                                    style={{ position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Text style={{ fontSize: 17 }}>{showConfirmPassword ? "🙈" : "👁️"}</Text>
                                </TouchableOpacity>
                            </View>
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

                        {/* ── ID Proof ─────────────────────────────────────────── */}
                        <Field label="ID Proof  —  optional">
                            <View style={{ gap: 10 }}>
                                {/* Aadhaar / PAN toggle */}
                                <View style={{ flexDirection: "row", gap: 8 }}>
                                    {[
                                        { key: "aadhaar", label: "Aadhaar Card" },
                                        { key: "pan",     label: "PAN Card"     },
                                    ].map(({ key, label }) => (
                                        <TouchableOpacity
                                            key={key}
                                            onPress={() => switchDocType(key)}
                                            activeOpacity={0.8}
                                            style={{
                                                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
                                                backgroundColor: idDocType === key ? "#4f46e5" : "#fff",
                                                borderColor:     idDocType === key ? "#4f46e5" : "#d1d5db",
                                            }}
                                        >
                                            <Text style={{ color: idDocType === key ? "#fff" : "#374151", fontWeight: "600", fontSize: 13 }}>
                                                {label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Card number input with live validation */}
                                <View>
                                    <TextInput
                                        style={[inputStyle, idNumberError ? { borderColor: "#ef4444", borderWidth: 1.5 } : null]}
                                        placeholder={idDocType === "aadhaar" ? "12-digit Aadhaar number" : "e.g. ABCDE1234F"}
                                        placeholderTextColor="#9ca3af"
                                        value={idNumber}
                                        onChangeText={onIdNumberChange}
                                        keyboardType={idDocType === "aadhaar" ? "number-pad" : "default"}
                                        autoCapitalize={idDocType === "pan" ? "characters" : "none"}
                                        maxLength={idDocType === "aadhaar" ? 12 : 10}
                                    />
                                    {idNumberError ? (
                                        <Text style={{ color: "#ef4444", fontSize: 12, marginTop: 3 }}>✗ {idNumberError}</Text>
                                    ) : idNumber.length > 0 && !idNumberError && (
                                        (idDocType === "aadhaar" && idNumber.length === 12) ||
                                        (idDocType === "pan"     && idNumber.length === 10)
                                    ) ? (
                                        <Text style={{ color: "#16a34a", fontSize: 12, marginTop: 3 }}>✓ Valid {idDocLabel} number</Text>
                                    ) : null}
                                </View>

                                {/* Photo / PDF buttons */}
                                <View style={{ flexDirection: "row", gap: 8 }}>
                                    <TouchableOpacity
                                        onPress={pickImage}
                                        activeOpacity={0.8}
                                        style={{
                                            flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5,
                                            borderColor: "#d1d5db", alignItems: "center", backgroundColor: "#f9fafb",
                                        }}
                                    >
                                        <Text style={{ color: "#4f46e5", fontWeight: "600", fontSize: 14 }}>📷 Photo / Image</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={pickPdf}
                                        activeOpacity={0.8}
                                        style={{
                                            flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5,
                                            borderColor: "#d1d5db", alignItems: "center", backgroundColor: "#f9fafb",
                                        }}
                                    >
                                        <Text style={{ color: "#4f46e5", fontWeight: "600", fontSize: 14 }}>📄 PDF</Text>
                                    </TouchableOpacity>
                                </View>

                                {idFile && !uploadedId && (
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                        <Text style={{ flex: 1, fontSize: 12, color: "#374151" }} numberOfLines={1}>
                                            {idFileLabel}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={uploadId}
                                            disabled={uploadingId}
                                            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: "#4f46e5" }}
                                        >
                                            {uploadingId
                                                ? <ActivityIndicator color="#fff" size="small" />
                                                : <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Upload</Text>
                                            }
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setIdFile(null)}>
                                            <Text style={{ color: "#ef4444", fontSize: 13 }}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {uploadedId && (
                                    <View style={{
                                        flexDirection: "row", alignItems: "center", gap: 8,
                                        backgroundColor: "#ecfdf5", borderRadius: 8, padding: 10,
                                    }}>
                                        <Text style={{ color: "#065f46", fontWeight: "600", fontSize: 13, flex: 1 }}>
                                            ✓ {idDocLabel} uploaded
                                        </Text>
                                        <TouchableOpacity onPress={() => { setIdFile(null); setUploadedId(null); }}>
                                            <Text style={{ color: "#6b7280", fontSize: 12 }}>Change</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {!idFile && !uploadedId && (
                                    <Text style={{ fontSize: 12, color: "#9ca3af" }}>
                                        Upload a photo or PDF of your {idDocLabel} (max 5 MB)
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
                            style={[
                                { backgroundColor: "#4f46e5", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 20 },
                                (authLoading || uploadingId) && { opacity: 0.7 },
                            ]}
                            onPress={handleRegister}
                            disabled={authLoading || uploadingId}
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
