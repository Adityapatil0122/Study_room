import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import Toast from "react-native-toast-message";
import { View, Animated, Easing } from "react-native";
import "../global.css";

function LoadingScreen() {
    const pulse = useRef(new Animated.Value(0.4)).current;
    const spin = useRef(new Animated.Value(0)).current;
    const fade = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fade, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        }).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 900,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 0.4,
                    duration: 900,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();

        Animated.loop(
            Animated.timing(spin, {
                toValue: 1,
                duration: 1200,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const spinDeg = spin.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
    });

    return (
        <Animated.View
            style={{ opacity: fade, flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}
        >
            <View style={{ alignItems: "center" }}>
                <View style={{ width: 80, height: 80, alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
                    <Animated.View
                        style={{
                            transform: [{ rotate: spinDeg }],
                            position: "absolute",
                            width: 72,
                            height: 72,
                            borderRadius: 36,
                            borderWidth: 3,
                            borderColor: "transparent",
                            borderTopColor: "#4f46e5",
                            borderRightColor: "#a5b4fc",
                        }}
                    />
                    <Animated.View
                        style={{
                            opacity: pulse,
                            width: 28,
                            height: 28,
                            backgroundColor: "#4f46e5",
                            borderRadius: 14,
                        }}
                    />
                </View>
                <Animated.Text
                    style={{
                        opacity: pulse,
                        color: "#4f46e5",
                        fontWeight: "600",
                        fontSize: 15,
                        letterSpacing: 0.5,
                    }}
                >
                    Loading…
                </Animated.Text>
            </View>
        </Animated.View>
    );
}

const InitialLayout = () => {
    const { session, userType, authInitializing } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (authInitializing) return;

        const firstSegment = segments[0];
        const inAdminGroup = firstSegment === "(app)";
        const inStudentGroup = firstSegment === "(student)";

        if (!session) {
            if (inAdminGroup || inStudentGroup) router.replace("/");
            return;
        }

        if (userType === "admin") {
            if (!inAdminGroup) router.replace("/(app)/dashboard");
        } else if (userType === "student") {
            if (!inStudentGroup) router.replace("/(student)/home");
        }
    }, [session, userType, authInitializing, segments]);

    if (authInitializing) return <LoadingScreen />;

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
