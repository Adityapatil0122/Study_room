import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import Toast from "react-native-toast-message";
import { View, ActivityIndicator } from "react-native";
import "../global.css";

const InitialLayout = () => {
    const { session, userType, authInitializing } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (authInitializing) return;

        const firstSegment = segments[0];
        const inAdminGroup = firstSegment === "(app)";
        const inStudentGroup = firstSegment === "(student)";
        const inAuthGroup = firstSegment === "(auth)";

        if (!session) {
            if (inAdminGroup || inStudentGroup) {
                router.replace("/");
            }
            return;
        }

        if (userType === "admin") {
            if (!inAdminGroup) {
                router.replace("/(app)/dashboard");
            }
        } else if (userType === "student") {
            if (!inStudentGroup) {
                router.replace("/(student)/home");
            }
        }
    }, [session, userType, authInitializing, segments]);

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
