import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

export default function LandingScreen() {
    const router = useRouter();

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar style="dark" />
            <View className="flex-1 justify-center px-8">
                <View className="items-center mb-12">
                    <View className="w-24 h-24 bg-blue-600 rounded-full items-center justify-center mb-4">
                        <Text className="text-white text-4xl font-bold">A</Text>
                    </View>
                    <Text className="text-3xl font-bold text-gray-900">Abhyasika</Text>
                    <Text className="text-gray-500 mt-2 text-center">
                        Study room membership, made simple.
                    </Text>
                </View>

                <View className="space-y-4">
                    <TouchableOpacity
                        className="w-full bg-blue-600 rounded-xl py-4 items-center"
                        onPress={() => router.push("/(auth)/student-login")}
                    >
                        <Text className="text-white font-bold text-lg">I'm a Student</Text>
                        <Text className="text-blue-100 text-xs mt-1">
                            Register, pay fees, view your plan
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="w-full border-2 border-gray-300 rounded-xl py-4 items-center mt-4"
                        onPress={() => router.push("/(auth)/admin-login")}
                    >
                        <Text className="text-gray-900 font-bold text-lg">Admin Login</Text>
                        <Text className="text-gray-500 text-xs mt-1">
                            Manage students and payments
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}
