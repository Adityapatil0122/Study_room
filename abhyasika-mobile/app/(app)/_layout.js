import { Tabs } from "expo-router";
import { Home, Users, Armchair, CreditCard } from "lucide-react-native";

export default function AppLayout() {
    return (
        <Tabs screenOptions={{ tabBarActiveTintColor: "#2563eb", headerShown: false }}>
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: "Dashboard",
                    tabBarIcon: ({ color }) => <Home size={24} color={color} />,
                }}
            />
        </Tabs>
    );
}
