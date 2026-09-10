import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Typed error for storage failures.
 * Thrown on real corruption (JSON parse failure) rather than
 * silently swallowed, so callers can surface issues instead of
 * silently overwriting a user's data.
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly key: string,
    public readonly operation: "read" | "write" | "remove",
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export async function getStorage<T>(
  key: string,
): Promise<T | null> {
  let value: string | null;

  try {
    value = await AsyncStorage.getItem(key);
  } catch (error) {
    console.error(`Failed to read storage: ${key}`, error);
    return null;
  }

  if (value === null) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    // Corrupted JSON — surface it rather than returning null,
    // since a subsequent save would silently destroy the data.
    console.error(`Corrupted JSON in ${key}`, error);
    throw new StorageError(
      `Corrupted JSON in ${key}`,
      key,
      "read",
    );
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
    // Surface write failures so callers can show feedback —
    // a silent swallow turns a lost save into a confusing no-op.
    console.error(`Failed to write storage: ${key}`, error);
    throw new StorageError(`Failed to write ${key}`, key, "write");
  }
}

export async function removeStorage(
  key: string,
): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to remove storage: ${key}`, error);
    throw new StorageError(`Failed to remove ${key}`, key, "remove");
  }
}