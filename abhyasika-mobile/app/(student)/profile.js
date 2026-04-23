import {
    View,
    Text,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../../context/AuthContext";
import Toast from "react-native-toast-message";

const INDIGO  = "#4f46e5";
const EDITABLE = ["name", "email", "address", "city", "state", "pincode"];

export default function ProfileScreen() {
    const { api, logout, student } = useAuth();
    const [profile, setProfile] = useState(null);
    const [form, setForm]       = useState({});
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving]   = useState(false);
    const [error, setError]     = useState("");

    const load = useCallback(async () => {
        try {
            setError("");
            const data = await api.getStudentProfile();
            setProfile(data);
            const initial = {};
            EDITABLE.forEach((k) => { initial[k] = data?.[k] ?? ""; });
            setForm(initial);
        } catch (err) {
            setError(err?.message ?? "Failed to load profile");
        } finally {
            setLoading(false);
        }
    }, [api]);

    useEffect(() => { load(); }, [load]);

    const set = (key) => (value) => setForm((p) => ({ ...p, [key]: value }));

    const save = async () => {
        try {
            setSaving(true);
            const updated = await api.updateStudentProfile(form);
            setProfile(updated);
            setEditing(false);
            Toast.show({ type: "success", text1: "Profile updated ✓", text2: "Your details have been saved.", visibilityTime: 2500 });
        } catch (err) {
            Toast.show({ type: "error", text1: "Update failed", text2: err?.message ?? "Could not save profile.", visibilityTime: 3000 });
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () =>
        Alert.alert("Logout", "Are you sure you want to log out?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Logout", style: "destructive", onPress: () => {
                    Toast.show({ type: "info", text1: "Logged out", text2: "See you soon! 👋", visibilityTime: 2000 });
                    logout();
                },
            },
        ]);

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: "#f4f5fb", justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color={INDIGO} />
            </SafeAreaView>
        );
    }

    const initials = (profile?.name ?? student?.name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f4f5fb" }}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={{
                backgroundColor: "#fff",
                paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16,
                borderBottomWidth: 1, borderBottomColor: "#f0f0f8",
                flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                shadowColor: INDIGO, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
            }}>
                <View>
                    <Text style={{ fontSize: 22, fontWeight: "800", color: "#111827" }}>My Profile</Text>
                    <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>View and edit your details</Text>
                </View>
                {!editing ? (
                    <TouchableOpacity
                        onPress={() => setEditing(true)}
                        style={{
                            backgroundColor: INDIGO, paddingHorizontal: 16, paddingVertical: 9,
                            borderRadius: 10,
                            shadowColor: INDIGO, shadowOpacity: 0.25, shadowRadius: 6, elevation: 2,
                        }}
                    >
                        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Edit</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
                {error ? (
                    <View style={{
                        backgroundColor: "#fff5f5", borderRadius: 12, borderLeftWidth: 4,
                        borderLeftColor: "#ef4444", padding: 14, marginBottom: 16,
                    }}>
                        <Text style={{ color: "#ef4444", fontSize: 13 }}>{error}</Text>
                    </View>
                ) : null}

                {/* Avatar + name */}
                <View style={{ alignItems: "center", marginBottom: 22 }}>
                    <View style={{
                        width: 72, height: 72, borderRadius: 36,
                        backgroundColor: INDIGO, alignItems: "center", justifyContent: "center",
                        shadowColor: INDIGO, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
                    }}>
                        <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800" }}>{initials}</Text>
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827", marginTop: 10 }}>
                        {profile?.name ?? "—"}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{profile?.phone ?? ""}</Text>
                </View>

                {/* Editable section */}
                <SectionCard title="Editable Information">
                    <EField label="Full Name"  value={editing ? form.name    : profile?.name}    onChange={set("name")}    editing={editing} />
                    <EField label="Email"       value={editing ? form.email   : profile?.email}   onChange={set("email")}   editing={editing} keyboardType="email-address" />
                    <EField label="Address"     value={editing ? form.address : profile?.address} onChange={set("address")} editing={editing} />
                    <View style={{ flexDirection: "row", gap: 12 }}>
                        <View style={{ flex: 1 }}>
                            <EField label="City"  value={editing ? form.city  : profile?.city}  onChange={set("city")}  editing={editing} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <EField label="State" value={editing ? form.state : profile?.state} onChange={set("state")} editing={editing} />
                        </View>
                    </View>
                    <EField label="Pincode" value={editing ? form.pincode : profile?.pincode} onChange={set("pincode")} editing={editing} keyboardType="number-pad" last />
                </SectionCard>

                {/* Read-only section */}
                <SectionCard title="Account Information">
                    <RField label="Phone"          value={profile?.phone} />
                    <RField label="Gender"         value={profile?.gender} />
                    <RField label="Aadhaar / PAN"  value={profile?.aadhaar || profile?.pan_card} />
                    <RField label="Join Date"      value={profile?.join_date} last />
                </SectionCard>

                {/* Edit actions */}
                {editing ? (
                    <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                        <TouchableOpacity
                            onPress={() => { setEditing(false); load(); }}
                            style={{
                                flex: 1, borderWidth: 1.5, borderColor: "#e5e7eb",
                                borderRadius: 12, paddingVertical: 14, alignItems: "center",
                                backgroundColor: "#fff",
                            }}
                        >
                            <Text style={{ color: "#374151", fontWeight: "600", fontSize: 15 }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={save}
                            disabled={saving}
                            style={{
                                flex: 1, backgroundColor: INDIGO,
                                borderRadius: 12, paddingVertical: 14, alignItems: "center",
                                opacity: saving ? 0.7 : 1,
                                shadowColor: INDIGO, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
                            }}
                        >
                            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                                {saving ? "Saving…" : "Save Changes"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity
                        onPress={handleLogout}
                        style={{
                            marginTop: 4, borderWidth: 1.5, borderColor: "#fecaca",
                            borderRadius: 12, paddingVertical: 14, alignItems: "center",
                            backgroundColor: "#fff5f5",
                        }}
                    >
                        <Text style={{ color: "#ef4444", fontWeight: "600", fontSize: 15 }}>Logout</Text>
                    </TouchableOpacity>
                )}

                <View style={{ height: 20 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Section card ──────────────────────────────────────────────────────────────
function SectionCard({ title, children }) {
    return (
        <View style={{
            backgroundColor: "#fff", borderRadius: 16, padding: 18, marginBottom: 16,
            shadowColor: "#4f46e5", shadowOpacity: 0.06, shadowRadius: 10,
            shadowOffset: { width: 0, height: 3 }, elevation: 2,
        }}>
            <Text style={{
                fontSize: 10, fontWeight: "700", color: "#a5b4fc",
                letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14,
            }}>
                {title}
            </Text>
            {children}
        </View>
    );
}

// ── Editable field ────────────────────────────────────────────────────────────
function EField({ label, value, onChange, editing, keyboardType, last }) {
    return (
        <View style={{ marginBottom: last ? 0 : 14 }}>
            <Text style={{ fontSize: 11, color: "#9ca3af", fontWeight: "600", marginBottom: 5 }}>{label}</Text>
            {editing ? (
                <TextInput
                    value={value ?? ""}
                    onChangeText={onChange}
                    keyboardType={keyboardType ?? "default"}
                    style={{
                        borderWidth: 1.5, borderColor: "#e0e2f7",
                        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
                        fontSize: 14, color: "#111827", backgroundColor: "#fafafa",
                    }}
                />
            ) : (
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}>{value || "—"}</Text>
            )}
        </View>
    );
}

// ── Read-only field ───────────────────────────────────────────────────────────
function RField({ label, value, last }) {
    return (
        <View style={{
            marginBottom: last ? 0 : 14,
            paddingBottom: last ? 0 : 14,
            borderBottomWidth: last ? 0 : 1,
            borderBottomColor: "#f3f4f6",
        }}>
            <Text style={{ fontSize: 11, color: "#9ca3af", fontWeight: "600", marginBottom: 4 }}>{label}</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151" }}>{value || "—"}</Text>
        </View>
    );
}
