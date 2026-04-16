import AsyncStorage from "@react-native-async-storage/async-storage";

export const SESSION_STORAGE_KEY = "abhyasika-session";
export const USER_TYPE_STORAGE_KEY = "abhyasika-user-type";

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
  await AsyncStorage.multiRemove([SESSION_STORAGE_KEY, USER_TYPE_STORAGE_KEY]);
}

export async function getStoredUserType() {
  try {
    return (await AsyncStorage.getItem(USER_TYPE_STORAGE_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function setStoredUserType(userType) {
  if (!userType) {
    await AsyncStorage.removeItem(USER_TYPE_STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(USER_TYPE_STORAGE_KEY, userType);
}
