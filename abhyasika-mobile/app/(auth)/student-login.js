import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

export default function StudentLoginScreen() {
    const { studentLogin, authLoading, authError } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async () => {
        try {
            await studentLogin(email, password);
        } catch (e) {
            // Error handled in context
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
                    contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 32 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="absolute top-4 left-4 p-2"
                    >
                        <Text className="text-indigo-600 text-base">← Back</Text>
                    </TouchableOpacity>

                    <View className="items-center mb-10 mt-10">
                        <View className="w-20 h-20 bg-indigo-600 rounded-full items-center justify-center mb-4">
                            <Text className="text-white text-3xl font-bold">S</Text>
                        </View>
                        <Text className="text-3xl font-bold text-gray-900">Student Login</Text>
                        <Text className="text-gray-500 mt-2">Access your membership</Text>
                    </View>

                    <View className="space-y-4">
                        <View>
                            <Text className="text-gray-700 mb-2 font-medium">Email</Text>
                            <TextInput
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 bg-gray-50"
                                placeholder="you@example.com"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <View>
                            <Text className="text-gray-700 mb-2 font-medium">Password</Text>
                            <TextInput
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 bg-gray-50"
                                placeholder="••••••••"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        {authError ? (
                            <Text className="text-red-500 text-sm text-center">{authError}</Text>
                        ) : null}

                        <TouchableOpacity
                            className={`w-full bg-indigo-600 rounded-lg py-4 items-center ${
                                authLoading ? "opacity-70" : ""
                            }`}
                            onPress={handleLogin}
                            disabled={authLoading}
                        >
                            <Text className="text-white font-bold text-lg">
                                {authLoading ? "Signing in..." : "Sign In"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => router.push("/(auth)/student-register")}
                            className="mt-3 items-center"
                        >
                            <Text className="text-gray-600 text-sm">
                                New student?{" "}
                                <Text className="text-indigo-600 font-semibold">
                                    Create an account
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
