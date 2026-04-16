import { Stack } from "expo-router";

export default function AuthLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="admin-login" />
            <Stack.Screen name="student-login" />
            <Stack.Screen name="student-register" />
        </Stack>
    );
}
