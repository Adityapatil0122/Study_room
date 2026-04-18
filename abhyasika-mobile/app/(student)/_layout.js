import { Tabs } from "expo-router";
import { Home, CreditCard, User } from "lucide-react-native";

export default function StudentLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: "#4f46e5",
                tabBarInactiveTintColor: "#6b7280",
                tabBarStyle: {
                    borderTopWidth: 1,
                    borderTopColor: "#e5e7eb",
                    paddingTop: 6,
                    paddingBottom: 6,
                    height: 60,
                },
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: "Home",
                    tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="payments"
                options={{
                    title: "Payments",
                    tabBarIcon: ({ color, size }) => (
                        <CreditCard color={color} size={size} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
                }}
            />
            <Tabs.Screen name="pay" options={{ href: null }} />
            <Tabs.Screen name="seat-select" options={{ href: null }} />
            <Tabs.Screen name="receipt" options={{ href: null }} />
        </Tabs>
    );
}
