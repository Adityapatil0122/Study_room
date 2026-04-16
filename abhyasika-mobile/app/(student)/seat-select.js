import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    RefreshControl,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export default function SeatSelectScreen() {
    const { api, student } = useAuth();
    const router = useRouter();

    const [seats, setSeats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [selectingId, setSelectingId] = useState(null);

    const load = useCallback(async () => {
        try {
            setError("");
            const data = await api.listAvailableSeats();
            setSeats(data ?? []);
        } catch (err) {
            setError(err?.message ?? "Failed to load seats");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [api]);

    useEffect(() => {
        load();
    }, [load]);

    const onRefresh = () => {
        setRefreshing(true);
        load();
    };

    const handleSelectSeat = (seat) => {
        Alert.alert(
            "Confirm Seat Selection",
            `Select Seat #${seat.seat_number}? This cannot be changed without admin help.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm",
                    onPress: async () => {
                        setSelectingId(seat.id);
                        try {
                            await api.selectSeat(seat.id);
                            Alert.alert(
                                "Seat Assigned!",
                                `Seat #${seat.seat_number} is now yours.`,
                                [{ text: "OK", onPress: () => router.replace("/(student)/home") }]
                            );
                        } catch (err) {
                            Alert.alert("Error", err?.message ?? "Could not assign seat.");
                        } finally {
                            setSelectingId(null);
                        }
                    },
                },
            ]
        );
    };

    // Group seats into rows of 8 for the grid
    const chunked = [];
    for (let i = 0; i < seats.length; i += 8) {
        chunked.push(seats.slice(i, i + 8));
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <StatusBar style="dark" />
            <View className="px-4 pt-4 pb-2 bg-white border-b border-gray-200 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-3 p-2">
                    <Text className="text-indigo-600 text-base">←</Text>
                </TouchableOpacity>
                <View>
                    <Text className="text-2xl font-bold text-gray-900">Choose Your Seat</Text>
                    <Text className="text-gray-500 text-sm">
                        Tap an available seat to select it
                    </Text>
                </View>
            </View>

            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ padding: 16 }}
            >
                {/* Already has a seat */}
                {student?.current_seat_id ? (
                    <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                        <Text className="text-emerald-700 font-bold">You already have a seat assigned.</Text>
                        <Text className="text-emerald-600 text-sm mt-1">
                            Contact the admin if you need to change it.
                        </Text>
                    </View>
                ) : null}

                {loading ? (
                    <ActivityIndicator size="large" color="#4f46e5" className="mt-10" />
                ) : error ? (
                    <View className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <Text className="text-red-600 text-sm">{error}</Text>
                    </View>
                ) : seats.length === 0 ? (
                    <View className="bg-white rounded-xl p-6 border border-gray-200 items-center">
                        <Text className="text-gray-500 text-center">
                            No seats are currently available. Please contact the admin.
                        </Text>
                    </View>
                ) : (
                    <>
                        <View className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                            <Text className="text-sm font-semibold text-gray-600 mb-1">
                                {seats.length} seats available
                            </Text>
                            <View className="flex-row items-center gap-3 mt-1">
                                <View className="h-7 w-7 rounded-lg bg-emerald-100 border-2 border-emerald-400 items-center justify-center">
                                    <Text className="text-[10px] font-bold text-emerald-700">A</Text>
                                </View>
                                <Text className="text-xs text-gray-500">Available — tap to select</Text>
                            </View>
                        </View>

                        {chunked.map((row, rowIdx) => (
                            <View key={rowIdx} className="flex-row flex-wrap gap-2 mb-2">
                                {row.map((seat) => {
                                    const isBusy = selectingId === seat.id;
                                    return (
                                        <TouchableOpacity
                                            key={seat.id}
                                            onPress={() => handleSelectSeat(seat)}
                                            disabled={!!selectingId}
                                            style={{ width: "11%" }}
                                            className={`aspect-square rounded-xl border-2 items-center justify-center ${
                                                isBusy
                                                    ? "bg-indigo-100 border-indigo-300"
                                                    : "bg-emerald-50 border-emerald-400"
                                            }`}
                                        >
                                            {isBusy ? (
                                                <ActivityIndicator size="small" color="#4f46e5" />
                                            ) : (
                                                <Text className="text-[11px] font-bold text-emerald-700">
                                                    {seat.seat_number}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ))}

                        <Text className="text-xs text-gray-400 text-center mt-4">
                            Pull down to refresh seat availability
                        </Text>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
