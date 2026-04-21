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
import Toast from "react-native-toast-message";

const INDIGO = "#4f46e5";

const sortSeatsByNumber = (items = []) =>
    [...items].sort((a, b) =>
        String(a?.seat_number ?? "").localeCompare(
            String(b?.seat_number ?? ""),
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
            // Only fetch seats admin specifically offered to this student
            const data = await api.getOfferedSeats();
            setSeats(data ?? []);
        } catch (err) {
            setError(err?.message ?? "Failed to load seat options");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [api]);

    useEffect(() => { load(); }, [load]);

    const onRefresh = () => { setRefreshing(true); load(); };

    const sortedSeats = useMemo(() => sortSeatsByNumber(seats), [seats]);

    const seatGap     = 12;
    const cols        = width < 360 ? 4 : width < 520 ? 5 : 6;
    const seatSize    = (Math.max(width - 40, 280) - seatGap * (cols - 1)) / cols;

    const handleSelectSeat = (seat) => {
        Alert.alert(
            "Confirm Seat",
            `Choose Seat #${seat.seat_number}? This cannot be changed without admin help.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm",
                    onPress: async () => {
                        setSelectingId(seat.id);
                        try {
                            await api.selectSeat(seat.id);
                            Toast.show({
                                type: "success",
                                text1: `Seat #${seat.seat_number} confirmed! 🪑`,
                                text2: "Your seat is now assigned.",
                                visibilityTime: 2500,
                            });
                            router.replace("/(student)/home");
                        } catch (err) {
                            Toast.show({
                                type: "error",
                                text1: "Selection failed",
                                text2: err?.message ?? "Could not assign seat.",
                                visibilityTime: 3000,
                            });
                        } finally {
                            setSelectingId(null);
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f4f5fb" }}>
            <StatusBar style="dark" />

            {/* Nav bar */}
            <View style={{
                flexDirection: "row", alignItems: "center",
                backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
                borderBottomWidth: 1, borderBottomColor: "#f0f0f8",
                shadowColor: INDIGO, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
            }}>
                <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12, padding: 4 }}>
                    <Text style={{ color: INDIGO, fontSize: 14, fontWeight: "700" }}>← Back</Text>
                </TouchableOpacity>
                <View>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: "#111827" }}>Choose Your Seat</Text>
                    <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>
                        Select from seats admin has sent you
                    </Text>
                </View>
            </View>

            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={INDIGO} />}
                contentContainerStyle={{ padding: 20 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Already has a seat */}
                {student?.current_seat_id ? (
                    <View style={{
                        backgroundColor: "#f0fdf4", borderRadius: 14,
                        borderLeftWidth: 4, borderLeftColor: "#059669",
                        padding: 16, marginBottom: 16,
                    }}>
                        <Text style={{ fontWeight: "700", color: "#065f46", fontSize: 14 }}>
                            You already have a seat assigned.
                        </Text>
                        <Text style={{ color: "#047857", fontSize: 12, marginTop: 4 }}>
                            Contact the admin if you need to change it.
                        </Text>
                    </View>
                ) : null}

                {loading ? (
                    <ActivityIndicator size="large" color={INDIGO} style={{ marginTop: 60 }} />
                ) : error ? (
                    <View style={{
                        backgroundColor: "#fff5f5", borderRadius: 14,
                        borderLeftWidth: 4, borderLeftColor: "#ef4444", padding: 16,
                    }}>
                        <Text style={{ color: "#ef4444", fontSize: 13 }}>{error}</Text>
                    </View>
                ) : sortedSeats.length === 0 ? (
                    /* ── Waiting for admin ── */
                    <View style={{
                        backgroundColor: "#fff", borderRadius: 20,
                        padding: 32, alignItems: "center",
                        shadowColor: INDIGO, shadowOpacity: 0.07, shadowRadius: 14,
                        shadowOffset: { width: 0, height: 4 }, elevation: 3,
                    }}>
                        <Text style={{ fontSize: 48, marginBottom: 16 }}>⏳</Text>
                        <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 8, textAlign: "center" }}>
                            Waiting for Admin
                        </Text>
                        <Text style={{ fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 20 }}>
                            The admin will send you a list of available seats once your payment is confirmed.
                            {"\n\n"}Pull down to refresh.
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Info card */}
                        <View style={{
                            backgroundColor: "#fff", borderRadius: 14,
                            padding: 16, marginBottom: 16,
                            flexDirection: "row", alignItems: "center",
                            shadowColor: INDIGO, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
                        }}>
                            <View style={{
                                width: 36, height: 36, borderRadius: 10,
                                backgroundColor: "#eef2ff", alignItems: "center", justifyContent: "center",
                                marginRight: 12,
                            }}>
                                <Text style={{ fontSize: 18 }}>🪑</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827" }}>
                                    {sortedSeats.length} seat{sortedSeats.length !== 1 ? "s" : ""} available for you
                                </Text>
                                <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                                    Tap a seat to select it · Cannot be changed without admin
                                </Text>
                            </View>
                        </View>

                        {/* Seat grid */}
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: seatGap }}>
                            {sortedSeats.map((seat) => {
                                const busy = selectingId === seat.id;
                                return (
                                    <TouchableOpacity
                                        key={seat.id}
                                        onPress={() => handleSelectSeat(seat)}
                                        disabled={!!selectingId}
                                        activeOpacity={0.75}
                                        style={{
                                            width: seatSize, height: seatSize,
                                            borderRadius: 14,
                                            alignItems: "center", justifyContent: "center",
                                            backgroundColor: busy ? "#eef2ff" : "#fff",
                                            borderWidth: 2,
                                            borderColor: busy ? INDIGO : "#34d399",
                                            shadowColor: busy ? INDIGO : "#059669",
                                            shadowOpacity: 0.15,
                                            shadowRadius: 6,
                                            elevation: 2,
                                        }}
                                    >
                                        {busy ? (
                                            <ActivityIndicator size="small" color={INDIGO} />
                                        ) : (
                                            <Text style={{ fontSize: 12, fontWeight: "800", color: "#065f46" }}>
                                                {seat.seat_number}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <Text style={{ marginTop: 20, textAlign: "center", fontSize: 11, color: "#c4b5fd" }}>
                            Pull down to refresh
                        </Text>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
