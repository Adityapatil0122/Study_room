import { View, Text, TouchableOpacity, Image, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";

export default function LandingScreen() {
    const router = useRouter();

    const logoScale    = useRef(new Animated.Value(0.7)).current;
    const logoOpacity  = useRef(new Animated.Value(0)).current;
    const titleY       = useRef(new Animated.Value(28)).current;
    const titleOpacity = useRef(new Animated.Value(0)).current;
    const btn1Y        = useRef(new Animated.Value(40)).current;
    const btn1Opacity  = useRef(new Animated.Value(0)).current;
    const btn2Y        = useRef(new Animated.Value(40)).current;
    const btn2Opacity  = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.parallel([
                Animated.spring(logoScale, { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
                Animated.timing(logoOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.timing(titleY, { toValue: 0, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                Animated.timing(titleOpacity, { toValue: 1, duration: 340, useNativeDriver: true }),
            ]),
            Animated.stagger(110, [
                Animated.parallel([
                    Animated.timing(btn1Y, { toValue: 0, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                    Animated.timing(btn1Opacity, { toValue: 1, duration: 340, useNativeDriver: true }),
                ]),
                Animated.parallel([
                    Animated.timing(btn2Y, { toValue: 0, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                    Animated.timing(btn2Opacity, { toValue: 1, duration: 340, useNativeDriver: true }),
                ]),
            ]),
        ]).start();
    }, []);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
            <StatusBar style="dark" />
            <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 32 }}>

                {/* Logo */}
                <Animated.View style={{ alignItems: "center", marginBottom: 18, opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
                    <Image source={require("../assets/logo.png")} style={{ width: 120, height: 120 }} resizeMode="contain" />
                </Animated.View>

                {/* Title */}
                <Animated.View style={{ alignItems: "center", marginBottom: 48, opacity: titleOpacity, transform: [{ translateY: titleY }] }}>
                    <Text style={{ fontSize: 27, fontWeight: "800", color: "#111827", textAlign: "center" }}>
                        Aardhya Abhyasika
                    </Text>
                    <Text style={{ color: "#6b7280", marginTop: 8, textAlign: "center", fontSize: 14 }}>
                        Study room membership, made simple.
                    </Text>
                </Animated.View>

                {/* Student button */}
                <Animated.View style={{ opacity: btn1Opacity, transform: [{ translateY: btn1Y }], marginBottom: 14 }}>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={{ backgroundColor: "#4f46e5", borderRadius: 14, paddingVertical: 16, alignItems: "center" }}
                        onPress={() => router.push("/(auth)/student-login")}
                    >
                        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17 }}>I'm a Student</Text>
                        <Text style={{ color: "#c7d2fe", fontSize: 12, marginTop: 3 }}>Register, pay fees, view your plan</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Admin button */}
                <Animated.View style={{ opacity: btn2Opacity, transform: [{ translateY: btn2Y }] }}>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={{ borderWidth: 2, borderColor: "#d1d5db", borderRadius: 14, paddingVertical: 16, alignItems: "center" }}
                        onPress={() => router.push("/(auth)/admin-login")}
                    >
                        <Text style={{ color: "#111827", fontWeight: "700", fontSize: 17 }}>Admin Login</Text>
                        <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 3 }}>Manage students and payments</Text>
                    </TouchableOpacity>
                </Animated.View>

            </View>
        </SafeAreaView>
    );
}
