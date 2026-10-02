import test from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.get(key) || null;
  }
  setItem(key, value) {
    this.store.set(key, value);
  }
}

function safeGetItem(storage, key, fallback, expectedVersion = 1) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "version" in parsed) {
      if (parsed.version !== expectedVersion) return fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

test("safeGetItem returns fallback when key does not exist", () => {
  const store = new MemoryStorage();
  const res = safeGetItem(store, "missing_key", { fallback: true });
  assert.deepEqual(res, { fallback: true });
});

test("safeGetItem guards against corrupt JSON string", () => {
  const store = new MemoryStorage();
  store.setItem("corrupt", "{invalid: json--;;");
  const res = safeGetItem(store, "corrupt", { safe: true });
  assert.deepEqual(res, { safe: true });
});

test("safeGetItem resets to fallback on schema version mismatch", () => {
  const store = new MemoryStorage();
  store.setItem("old_schema", JSON.stringify({ version: 999, data: "stale" }));
  const res = safeGetItem(store, "old_schema", { version: 1, data: "fresh" }, 1);
  assert.deepEqual(res, { version: 1, data: "fresh" });
});
