import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useEffect, useState, useMemo } from "react";
import { createApiClient } from "../../lib/apiClient";
import { useAuth } from "../../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Users, Armchair, TrendingUp, BellRing } from "lucide-react-native";

const MetricCard = ({ label, value, icon: Icon, color }) => (
    <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 w-[48%] mb-4">
        <View className={`p-2 rounded-lg self-start mb-2 ${color}`}>
            <Icon size={20} className="text-white" color="white" />
        </View>
        <Text className="text-gray-500 text-xs font-medium">{label}</Text>
        <Text className="text-xl font-bold text-gray-900 mt-1">{value}</Text>
    </View>
);

export default function Dashboard() {
    const { isAuthenticated } = useAuth();
    const [refreshing, setRefreshing] = useState(false);
    const [metrics, setMetrics] = useState({
        activeStudents: 0,
        availableSeats: 0,
        revenueThisMonth: 0,
        upcomingRenewals: 0,
    });

    const api = useMemo(() => createApiClient(), []);

    const loadData = async () => {
        try {
            const [students, seats, payments] = await Promise.all([
                api.listStudents(),
                api.listSeats(),
                api.listPayments(),
            ]);

            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            const activeStudents = students.filter((s) => s.is_active).length;

            const occupiedSeats = seats.filter((s) => s.status === "occupied").length;
            const availableSeats = Math.max(seats.length - occupiedSeats, 0);

            let revenueThisMonth = 0;
            for (const payment of payments) {
                if (!payment.payment_date) continue;
                const paidAt = new Date(payment.payment_date);
                if (paidAt.getMonth() === currentMonth && paidAt.getFullYear() === currentYear) {
                    revenueThisMonth += Number(payment.amount_paid || 0);
                }
            }

            let upcomingRenewals = 0;
            for (const student of students) {
                if (student.is_active && student.renewal_date) {
                    const due = new Date(student.renewal_date);
                    const diffDays = (due - now) / (1000 * 60 * 60 * 24);
                    if (diffDays >= 0 && diffDays <= 7) upcomingRenewals++;
                }
            }

            setMetrics({
                activeStudents,
                availableSeats,
                revenueThisMonth,
                upcomingRenewals,
            });
        } catch (err) {
            console.error(err);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    useEffect(() => {
        if (isAuthenticated) {
            loadData();
        }
    }, [isAuthenticated]);

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <ScrollView
                contentContainerStyle={{ padding: 16 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View className="mb-6">
                    <Text className="text-2xl font-bold text-gray-900">Dashboard</Text>
                    <Text className="text-gray-500">Overview of your study room</Text>
                </View>

                <View className="flex-row flex-wrap justify-between">
                    <MetricCard
                        label="Active Students"
                        value={metrics.activeStudents}
                        icon={Users}
                        color="bg-blue-500"
                    />
                    <MetricCard
                        label="Available Seats"
                        value={metrics.availableSeats}
                        icon={Armchair}
                        color="bg-green-500"
                    />
                    <MetricCard
                        label="Revenue (Month)"
                        value={`₹${metrics.revenueThisMonth.toLocaleString("en-IN")}`}
                        icon={TrendingUp}
                        color="bg-purple-500"
                    />
                    <MetricCard
                        label="Renewals (7d)"
                        value={metrics.upcomingRenewals}
                        icon={BellRing}
                        color="bg-orange-500"
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
