import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

export default function AdminLoginScreen() {
    const { login, authLoading, authError } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async () => {
        try {
            await login(email, password);
        } catch (e) {
            // Error handled in context
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar style="dark" />
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1 justify-center px-8"
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="absolute top-12 left-4 p-2"
                >
                    <Text className="text-blue-600 text-base">← Back</Text>
                </TouchableOpacity>

                <View className="items-center mb-10">
                    <View className="w-20 h-20 bg-blue-600 rounded-full items-center justify-center mb-4">
                        <Text className="text-white text-3xl font-bold">A</Text>
                    </View>
                    <Text className="text-3xl font-bold text-gray-900">Admin Sign In</Text>
                    <Text className="text-gray-500 mt-2">Manage your workspace</Text>
                </View>

                <View className="space-y-4">
                    <View>
                        <Text className="text-gray-700 mb-2 font-medium">Email</Text>
                        <TextInput
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 bg-gray-50"
                            placeholder="admin@example.com"
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
                        className={`w-full bg-blue-600 rounded-lg py-4 items-center ${
                            authLoading ? "opacity-70" : ""
                        }`}
                        onPress={handleLogin}
                        disabled={authLoading}
                    >
                        <Text className="text-white font-bold text-lg">
                            {authLoading ? "Signing in..." : "Sign In"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
