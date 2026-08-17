import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getStorage<T>(
  key: string,
): Promise<T | null> {
  try {
    const value = await AsyncStorage.getItem(key);

    if (value === null) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`Failed to read storage: ${key}`, error);
    return null;
  }
}

export async function setStorage<T>(
  key: string,
  value: T,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      key,
      JSON.stringify(value),
    );
  } catch (error) {
    console.error(`Failed to write storage: ${key}`, error);
  }
}

export async function removeStorage(
  key: string,
): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to remove storage: ${key}`, error);
  }
}
