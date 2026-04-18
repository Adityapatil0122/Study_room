import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    RefreshControl,
    useWindowDimensions,
} from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";

const sortSeatsByNumber = (items = []) =>
    [...items].sort((left, right) =>
        String(left?.seat_number ?? "").localeCompare(
            String(right?.seat_number ?? ""),
            undefined,
            { numeric: true, sensitivity: "base" }
        )
    );

export default function SeatSelectScreen() {
    const { api, student } = useAuth();
    const router = useRouter();
    const { width } = useWindowDimensions();

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

    const sortedSeats = useMemo(() => sortSeatsByNumber(seats), [seats]);
    const seatGap = 10;
    const seatColumns = width < 360 ? 4 : width < 520 ? 5 : 6;
    const seatCardWidth =
        (Math.max(width - 32, 280) - seatGap * (seatColumns - 1)) / seatColumns;

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

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <StatusBar style="dark" />
            <View className="bg-white border-b border-gray-200 px-4 pb-2 pt-4 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-3 p-2">
                    <Text className="text-base text-indigo-600">&lt;</Text>
                </TouchableOpacity>
                <View>
                    <Text className="text-2xl font-bold text-gray-900">Choose Your Seat</Text>
                    <Text className="text-sm text-gray-500">
                        Tap an available seat to select it
                    </Text>
                </View>
            </View>

            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ padding: 16 }}
            >
                {student?.current_seat_id ? (
                    <View className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <Text className="font-bold text-emerald-700">
                            You already have a seat assigned.
                        </Text>
                        <Text className="mt-1 text-sm text-emerald-600">
                            Contact the admin if you need to change it.
                        </Text>
                    </View>
                ) : null}

                {loading ? (
                    <ActivityIndicator size="large" color="#4f46e5" className="mt-10" />
                ) : error ? (
                    <View className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <Text className="text-sm text-red-600">{error}</Text>
                    </View>
                ) : sortedSeats.length === 0 ? (
                    <View className="items-center rounded-xl border border-gray-200 bg-white p-6">
                        <Text className="text-center text-gray-500">
                            No seats are currently available. Please contact the admin.
                        </Text>
                    </View>
                ) : (
                    <>
                        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
                            <Text className="mb-1 text-sm font-semibold text-gray-600">
                                {sortedSeats.length} seats available
                            </Text>
                            <View className="mt-1 flex-row items-center gap-3">
                                <View className="h-7 w-7 items-center justify-center rounded-lg border-2 border-emerald-400 bg-emerald-100">
                                    <Text className="text-[10px] font-bold text-emerald-700">A</Text>
                                </View>
                                <Text className="text-xs text-gray-500">
                                    Available - tap to select
                                </Text>
                            </View>
                        </View>

                        <View
                            style={{ columnGap: seatGap, rowGap: seatGap }}
                            className="flex-row flex-wrap"
                        >
                            {sortedSeats.map((seat) => {
                                const isBusy = selectingId === seat.id;
                                return (
                                    <TouchableOpacity
                                        key={seat.id}
                                        onPress={() => handleSelectSeat(seat)}
                                        disabled={!!selectingId}
                                        style={{ width: seatCardWidth, height: seatCardWidth }}
                                        className={`items-center justify-center rounded-xl border-2 ${
                                            isBusy
                                                ? "border-indigo-300 bg-indigo-100"
                                                : "border-emerald-400 bg-emerald-50"
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

                        <Text className="mt-4 text-center text-xs text-gray-400">
                            Pull down to refresh seat availability
                        </Text>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
