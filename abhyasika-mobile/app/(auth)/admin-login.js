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

export default function AdminLoginScreen() {
    const { login, authLoading, authError } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // Animations
    const fadeY   = useRef(new Animated.Value(30)).current;
    const fadeOp  = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeY, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(fadeOp, { toValue: 1, duration: 420, useNativeDriver: true }),
        ]).start();
    }, []);

    const handleLogin = async () => {
        try {
            await login(email, password);
        } catch (e) {
            // Error handled in context
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
                    contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 32 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Back */}
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{ position: "absolute", top: 16, left: 0, padding: 8 }}
                    >
                        <Text style={{ color: "#2563eb", fontSize: 15 }}>← Back</Text>
                    </TouchableOpacity>

                    <Animated.View style={{ opacity: fadeOp, transform: [{ translateY: fadeY }] }}>
                        {/* Logo + heading */}
                        <View style={{ alignItems: "center", marginBottom: 36, marginTop: 60 }}>
                            <Image
                                source={require("../../assets/logo.png")}
                                style={{ width: 100, height: 100, marginBottom: 16 }}
                                resizeMode="contain"
                            />
                            <Text style={{ fontSize: 26, fontWeight: "800", color: "#111827" }}>Admin Sign In</Text>
                            <Text style={{ color: "#6b7280", marginTop: 6, fontSize: 14 }}>Manage your workspace</Text>
                        </View>

                        {/* Fields */}
                        <View style={{ marginBottom: 14 }}>
                            <Text style={{ color: "#374151", marginBottom: 6, fontWeight: "600", fontSize: 14 }}>Email</Text>
                            <TextInput
                                style={inputStyle}
                                placeholder="admin@example.com"
                                placeholderTextColor="#9ca3af"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                returnKeyType="next"
                            />
                        </View>

                        <View style={{ marginBottom: 6 }}>
                            <Text style={{ color: "#374151", marginBottom: 6, fontWeight: "600", fontSize: 14 }}>Password</Text>
                            <TextInput
                                style={inputStyle}
                                placeholder="••••••••"
                                placeholderTextColor="#9ca3af"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                returnKeyType="done"
                                onSubmitEditing={handleLogin}
                            />
                        </View>

                        {authError ? (
                            <Text style={{ color: "#ef4444", fontSize: 13, textAlign: "center", marginVertical: 8 }}>
                                {authError}
                            </Text>
                        ) : null}

                        <TouchableOpacity
                            style={[btnStyle("#2563eb"), authLoading && { opacity: 0.7 }, { marginTop: 18, marginBottom: 32 }]}
                            onPress={handleLogin}
                            disabled={authLoading}
                            activeOpacity={0.85}
                        >
                            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17 }}>
                                {authLoading ? "Signing in…" : "Sign In"}
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

const btnStyle = (bg) => ({
    backgroundColor: bg,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
});
