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
} from "react-native";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

const SHIFTS = ["Morning", "Afternoon", "Evening", "Day"];
const GENDERS = ["Male", "Female", "Other"];

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
    });
    const [localError, setLocalError] = useState("");

    const set = (key) => (value) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const handleRegister = async () => {
        setLocalError("");

        if (!form.name.trim()) {
            setLocalError("Full name is required");
            return;
        }
        if (!/.+@.+\..+/.test(form.email.trim())) {
            setLocalError("Please enter a valid email");
            return;
        }
        if (form.password.length < 6) {
            setLocalError("Password must be at least 6 characters");
            return;
        }
        if (form.password !== form.confirmPassword) {
            setLocalError("Passwords do not match");
            return;
        }
        const phoneDigits = form.phone.replace(/\D/g, "");
        if (phoneDigits.length !== 10) {
            setLocalError("Phone must be 10 digits");
            return;
        }
        if (!form.gender) {
            setLocalError("Please select a gender");
            return;
        }

        try {
            await studentRegister({
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                password: form.password,
                phone: phoneDigits,
                gender: form.gender,
                preferred_shift: form.preferred_shift,
            });
        } catch (e) {
            // Error captured in authError
        }
    };

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

                        {(localError || authError) ? (
                            <Text style={{ color: "#ef4444", fontSize: 13, textAlign: "center", marginVertical: 8 }}>
                                {localError || authError}
                            </Text>
                        ) : null}

                        <TouchableOpacity
                            style={[{ backgroundColor: "#4f46e5", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 20 }, authLoading && { opacity: 0.7 }]}
                            onPress={handleRegister}
                            disabled={authLoading}
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
