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
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function WelcomeLoginScreen() {
    const router = useRouter();
    const { unifiedLogin, authLoading, authError } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const logoScale   = useRef(new Animated.Value(0.7)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const cardY       = useRef(new Animated.Value(30)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.parallel([
                Animated.spring(logoScale, { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
                Animated.timing(logoOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.timing(cardY, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                Animated.timing(cardOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
            ]),
        ]).start();
    }, []);

    const handleLogin = async () => {
        if (!email.trim() || !password) return;
        try {
            await unifiedLogin(email.trim(), password);
        } catch (e) {
            // error surfaces via authError
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
                    contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 24 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View style={{ alignItems: "center", marginBottom: 20, opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
                        <Image source={require("../assets/logo.png")} style={{ width: 110, height: 110 }} resizeMode="contain" />
                    </Animated.View>

                    <Animated.View style={{ opacity: cardOpacity, transform: [{ translateY: cardY }] }}>
                        <View style={{ alignItems: "center", marginBottom: 28 }}>
                            <Text style={{ fontSize: 26, fontWeight: "800", color: "#111827", textAlign: "center" }}>
                                Welcome to Aardhya Abhyasika
                            </Text>
                            <Text style={{ color: "#6b7280", marginTop: 8, textAlign: "center", fontSize: 14 }}>
                                Sign in to continue
                            </Text>
                        </View>

                        <View style={{ marginBottom: 14 }}>
                            <Text style={labelStyle}>Email</Text>
                            <TextInput
                                style={inputStyle}
                                placeholder="you@example.com"
                                placeholderTextColor="#9ca3af"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="email-address"
                                returnKeyType="next"
                            />
                        </View>

                        <View style={{ marginBottom: 6 }}>
                            <Text style={labelStyle}>Password</Text>
                            <View style={{ position: "relative" }}>
                                <TextInput
                                    style={[inputStyle, { paddingRight: 64 }]}
                                    placeholder="••••••••"
                                    placeholderTextColor="#9ca3af"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    returnKeyType="done"
                                    onSubmitEditing={handleLogin}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword((v) => !v)}
                                    style={{ position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center", paddingHorizontal: 4 }}
                                >
                                    <Text style={{ color: "#4f46e5", fontWeight: "600", fontSize: 13 }}>
                                        {showPassword ? "Hide" : "Show"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {authError ? (
                            <Text style={{ color: "#ef4444", fontSize: 13, textAlign: "center", marginTop: 10 }}>
                                {authError}
                            </Text>
                        ) : null}

                        <TouchableOpacity
                            style={[btnStyle, authLoading && { opacity: 0.7 }, { marginTop: 18 }]}
                            onPress={handleLogin}
                            disabled={authLoading}
                            activeOpacity={0.85}
                        >
                            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17 }}>
                                {authLoading ? "Signing in…" : "Sign In"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => router.push("/(auth)/student-register")}
                            style={{ marginTop: 20, alignItems: "center" }}
                        >
                            <Text style={{ color: "#6b7280", fontSize: 14 }}>
                                New student?{" "}
                                <Text style={{ color: "#4f46e5", fontWeight: "600" }}>Create an account</Text>
                            </Text>
                        </TouchableOpacity>

                        <Text style={{ color: "#9ca3af", fontSize: 12, textAlign: "center", marginTop: 24 }}>
                            Study room membership, made simple.
                        </Text>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const labelStyle = { color: "#374151", marginBottom: 6, fontWeight: "600", fontSize: 14 };

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

const btnStyle = {
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
};
