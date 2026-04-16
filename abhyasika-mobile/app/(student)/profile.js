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

const EDITABLE = ["name", "email", "address", "city", "state", "pincode"];

export default function ProfileScreen() {
    const { api, logout } = useAuth();
    const [profile, setProfile] = useState(null);
    const [form, setForm] = useState({});
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        try {
            setError("");
            const data = await api.getStudentProfile();
            setProfile(data);
            const initial = {};
            EDITABLE.forEach((key) => {
                initial[key] = data?.[key] ?? "";
            });
            setForm(initial);
        } catch (err) {
            setError(err?.message ?? "Failed to load profile");
        } finally {
            setLoading(false);
        }
    }, [api]);

    useEffect(() => {
        load();
    }, [load]);

    const set = (key) => (value) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const save = async () => {
        try {
            setSaving(true);
            const updated = await api.updateStudentProfile(form);
            setProfile(updated);
            setEditing(false);
            Alert.alert("Success", "Profile updated");
        } catch (err) {
            Alert.alert("Error", err?.message ?? "Failed to save profile");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
                <ActivityIndicator size="large" color="#4f46e5" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <StatusBar style="dark" />
            <View className="px-4 pt-4 pb-2 bg-white border-b border-gray-200 flex-row justify-between items-center">
                <View>
                    <Text className="text-2xl font-bold text-gray-900">My Profile</Text>
                    <Text className="text-gray-500 text-sm">
                        View and edit your details
                    </Text>
                </View>
                {editing ? null : (
                    <TouchableOpacity
                        onPress={() => setEditing(true)}
                        className="bg-indigo-600 px-4 py-2 rounded-lg"
                    >
                        <Text className="text-white font-semibold text-sm">Edit</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {error ? (
                    <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                        <Text className="text-red-600 text-sm">{error}</Text>
                    </View>
                ) : null}

                <View className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                    <Text className="text-xs uppercase tracking-wider text-gray-500 mb-3">
                        Editable Information
                    </Text>

                    <EditableField
                        label="Full Name"
                        value={editing ? form.name : profile?.name}
                        onChange={set("name")}
                        editing={editing}
                    />
                    <EditableField
                        label="Email"
                        value={editing ? form.email : profile?.email}
                        onChange={set("email")}
                        editing={editing}
                        keyboardType="email-address"
                    />
                    <EditableField
                        label="Address"
                        value={editing ? form.address : profile?.address}
                        onChange={set("address")}
                        editing={editing}
                    />
                    <View className="flex-row gap-3">
                        <View className="flex-1">
                            <EditableField
                                label="City"
                                value={editing ? form.city : profile?.city}
                                onChange={set("city")}
                                editing={editing}
                            />
                        </View>
                        <View className="flex-1">
                            <EditableField
                                label="State"
                                value={editing ? form.state : profile?.state}
                                onChange={set("state")}
                                editing={editing}
                            />
                        </View>
                    </View>
                    <EditableField
                        label="Pincode"
                        value={editing ? form.pincode : profile?.pincode}
                        onChange={set("pincode")}
                        editing={editing}
                        keyboardType="number-pad"
                    />
                </View>

                <View className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                    <Text className="text-xs uppercase tracking-wider text-gray-500 mb-3">
                        Read-Only Information
                    </Text>
                    <ReadOnlyField label="Phone" value={profile?.phone} />
                    <ReadOnlyField label="Gender" value={profile?.gender} />
                    <ReadOnlyField label="Aadhaar" value={profile?.aadhaar} />
                    <ReadOnlyField label="PAN" value={profile?.pan_card} />
                    <ReadOnlyField label="Join Date" value={profile?.join_date} />
                    <ReadOnlyField
                        label="Preferred Shift"
                        value={profile?.preferred_shift}
                    />
                </View>

                {editing ? (
                    <View className="flex-row gap-3 mb-4">
                        <TouchableOpacity
                            onPress={() => {
                                setEditing(false);
                                load();
                            }}
                            className="flex-1 border border-gray-300 rounded-lg py-3 items-center"
                        >
                            <Text className="text-gray-700 font-semibold">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={save}
                            disabled={saving}
                            className={`flex-1 bg-indigo-600 rounded-lg py-3 items-center ${
                                saving ? "opacity-70" : ""
                            }`}
                        >
                            <Text className="text-white font-semibold">
                                {saving ? "Saving..." : "Save Changes"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity
                        onPress={logout}
                        className="border border-red-300 rounded-lg py-3 items-center"
                    >
                        <Text className="text-red-600 font-semibold">Logout</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

function EditableField({ label, value, onChange, editing, keyboardType }) {
    return (
        <View className="mb-3">
            <Text className="text-xs text-gray-500 mb-1">{label}</Text>
            {editing ? (
                <TextInput
                    className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-gray-50"
                    value={value ?? ""}
                    onChangeText={onChange}
                    keyboardType={keyboardType ?? "default"}
                />
            ) : (
                <Text className="text-gray-900 font-medium">{value || "—"}</Text>
            )}
        </View>
    );
}

function ReadOnlyField({ label, value }) {
    return (
        <View className="mb-3">
            <Text className="text-xs text-gray-500 mb-1">{label}</Text>
            <Text className="text-gray-900 font-medium">{value || "—"}</Text>
        </View>
    );
}
