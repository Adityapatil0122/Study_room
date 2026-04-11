import AsyncStorage from "@react-native-async-storage/async-storage";

export const SESSION_STORAGE_KEY = "abhyasika-session";

export async function getStoredSession() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setStoredSession(session) {
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export async function clearStoredSession() {
  await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
}
