import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import Toast from "react-native-toast-message";
import { View, ActivityIndicator } from "react-native";
import "../global.css";

const InitialLayout = () => {
    const { session, authInitializing } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (authInitializing) return;

        const inAppGroup = segments[0] === "(app)";

        if (session && !inAppGroup) {
            router.replace("/(app)/dashboard");
        } else if (!session && inAppGroup) {
            router.replace("/");
        }
    }, [session, authInitializing, segments]);

    if (authInitializing) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        );
    }

    return <Slot />;
};

export default function RootLayout() {
    return (
        <AuthProvider>
            <InitialLayout />
            <Toast />
        </AuthProvider>
    );
}
