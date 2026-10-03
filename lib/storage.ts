/**
 * lib/storage.ts
 *
 * Resilient, versioned client-side storage utility.
 * - Namespaced storage access
 * - Schema version check on read (mismatch / corrupt → returns fallback safely, never throws)
 * - Detects unavailable storage (private browsing, quotas, disabled) and falls back to in-memory store
 * - Synchronous local writes without spinners
 */

const CURRENT_SCHEMA_VERSION = 1;
const memoryStore = new Map<string, string>();
let storageAvailable: boolean | null = null;

function checkStorageAvailability(): boolean {
  if (typeof window === "undefined") return false;
  if (storageAvailable !== null) return storageAvailable;

  try {
    const testKey = "__storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    storageAvailable = true;
  } catch (err) {
    console.warn(
      "[Storage] localStorage is unavailable (quota, private browsing, or blocked). Falling back to in-memory store.",
      err
    );
    storageAvailable = false;
  }
  return storageAvailable;
}

export function buildStorageKey(namespace: string, key: string, version: number = CURRENT_SCHEMA_VERSION): string {
  return `roadmap:${namespace}:v${version}:${key}`;
}

export function getItem<T extends { version?: number } | unknown>(
  key: string,
  fallback: T,
  expectedVersion: number = CURRENT_SCHEMA_VERSION
): T {
  try {
    const isAvailable = checkStorageAvailability();
    const raw = isAvailable && typeof window !== "undefined"
      ? window.localStorage.getItem(key)
      : memoryStore.get(key) ?? null;

    if (raw === null) return fallback;

    const parsed = JSON.parse(raw);

    // If item contains a version field, guard against version mismatch
    if (parsed && typeof parsed === "object" && "version" in parsed) {
      if (typeof parsed.version === "number" && parsed.version !== expectedVersion) {
        console.warn(
          `[Storage] Version mismatch for key "${key}". Expected v${expectedVersion}, found v${parsed.version}. Resetting to fallback.`
        );
        return fallback;
      }
    }

    return parsed as T;
  } catch (err) {
    console.warn(`[Storage] Corrupt JSON read for key "${key}". Falling back to default.`, err);
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): boolean {
  try {
    const serialized = JSON.stringify(value);
    const isAvailable = checkStorageAvailability();

    if (isAvailable && typeof window !== "undefined") {
      window.localStorage.setItem(key, serialized);
    }
    // Mirror to memory store for safety
    memoryStore.set(key, serialized);
    return true;
  } catch (err) {
    console.warn(`[Storage] Failed to write key "${key}" to localStorage. Falling back to memory store.`, err);
    memoryStore.set(key, JSON.stringify(value));
    return false;
  }
}

export function removeItem(key: string): void {
  try {
    const isAvailable = checkStorageAvailability();
    if (isAvailable && typeof window !== "undefined") {
      window.localStorage.removeItem(key);
    }
    memoryStore.delete(key);
  } catch (err) {
    console.warn(`[Storage] Error removing key "${key}".`, err);
    memoryStore.delete(key);
  }
}

export function isStoragePersisted(): boolean {
  return checkStorageAvailability();
}
