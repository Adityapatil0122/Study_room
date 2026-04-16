import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image,
} from "react-native";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

const SHIFTS = ["Morning", "Afternoon", "Evening", "Day"];
const GENDERS = ["Male", "Female", "Other"];

export default function StudentRegisterScreen() {
    const { studentRegister, authLoading, authError } = useAuth();
    const router = useRouter();
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
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar style="dark" />
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
            >
                <ScrollView
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="mt-4 mb-4 p-2"
                    >
                        <Text className="text-indigo-600 text-base">← Back</Text>
                    </TouchableOpacity>

                    <View className="mb-6">
                        <Image 
                            source={require('../../assets/logo.png')} 
                            className="w-24 h-24 mb-4" 
                            resizeMode="contain" 
                        />
                        <Text className="text-3xl font-bold text-gray-900">Create account</Text>
                        <Text className="text-gray-500 mt-1">
                            Register yourself to get started
                        </Text>
                    </View>

                    <View className="space-y-4">
                        <Field label="Full Name">
                            <TextInput
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 bg-gray-50"
                                placeholder="John Doe"
                                value={form.name}
                                onChangeText={set("name")}
                            />
                        </Field>

                        <Field label="Email">
                            <TextInput
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 bg-gray-50"
                                placeholder="you@example.com"
                                value={form.email}
                                onChangeText={set("email")}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </Field>

                        <Field label="Phone Number">
                            <TextInput
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 bg-gray-50"
                                placeholder="9876543210"
                                value={form.phone}
                                onChangeText={set("phone")}
                                keyboardType="number-pad"
                                maxLength={10}
                            />
                        </Field>

                        <Field label="Password">
                            <TextInput
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 bg-gray-50"
                                placeholder="At least 6 characters"
                                value={form.password}
                                onChangeText={set("password")}
                                secureTextEntry
                            />
                        </Field>

                        <Field label="Confirm Password">
                            <TextInput
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 bg-gray-50"
                                placeholder="Re-enter password"
                                value={form.confirmPassword}
                                onChangeText={set("confirmPassword")}
                                secureTextEntry
                            />
                        </Field>

                        <Field label="Gender">
                            <View className="flex-row flex-wrap gap-2">
                                {GENDERS.map((g) => (
                                    <TouchableOpacity
                                        key={g}
                                        onPress={() => set("gender")(g)}
                                        className={`px-4 py-2 rounded-full border ${
                                            form.gender === g
                                                ? "bg-indigo-600 border-indigo-600"
                                                : "bg-white border-gray-300"
                                        }`}
                                    >
                                        <Text
                                            className={
                                                form.gender === g ? "text-white" : "text-gray-700"
                                            }
                                        >
                                            {g}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Field>

                        <Field label="Preferred Shift">
                            <View className="flex-row flex-wrap gap-2">
                                {SHIFTS.map((s) => (
                                    <TouchableOpacity
                                        key={s}
                                        onPress={() => set("preferred_shift")(s)}
                                        className={`px-4 py-2 rounded-full border ${
                                            form.preferred_shift === s
                                                ? "bg-indigo-600 border-indigo-600"
                                                : "bg-white border-gray-300"
                                        }`}
                                    >
                                        <Text
                                            className={
                                                form.preferred_shift === s
                                                    ? "text-white"
                                                    : "text-gray-700"
                                            }
                                        >
                                            {s}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Field>

                        {(localError || authError) ? (
                            <Text className="text-red-500 text-sm text-center">
                                {localError || authError}
                            </Text>
                        ) : null}

                        <TouchableOpacity
                            className={`w-full bg-indigo-600 rounded-lg py-4 items-center mt-4 ${
                                authLoading ? "opacity-70" : ""
                            }`}
                            onPress={handleRegister}
                            disabled={authLoading}
                        >
                            <Text className="text-white font-bold text-lg">
                                {authLoading ? "Creating account..." : "Create Account"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => router.replace("/(auth)/student-login")}
                            className="mt-2 items-center"
                        >
                            <Text className="text-gray-600 text-sm">
                                Already registered?{" "}
                                <Text className="text-indigo-600 font-semibold">
                                    Sign in
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function Field({ label, children }) {
    return (
        <View>
            <Text className="text-gray-700 mb-2 font-medium">{label}</Text>
            {children}
        </View>
    );
}
