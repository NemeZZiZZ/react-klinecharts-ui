import { describe, it, expect } from "vitest";
import {
  createDefaultStorage,
  resolveStorage,
  DEFAULT_STORAGE_KEY_PREFIX,
  DEFAULT_STORAGE_NAMESPACES,
  type StorageAdapter,
} from "./index";

/** Map-backed in-memory adapter for tests. */
function memoryAdapter(): StorageAdapter & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  };
}

describe("createDefaultStorage", () => {
  it("returns a StorageAdapter (real localStorage under jsdom/happy-dom)", () => {
    const a = createDefaultStorage();
    expect(typeof a.getItem).toBe("function");
    expect(typeof a.setItem).toBe("function");
    expect(typeof a.removeItem).toBe("function");
  });

  it("round-trips setItem/getItem/removeItem", () => {
    const a = createDefaultStorage();
    a.setItem("__rkui_test__", "hello");
    expect(a.getItem("__rkui_test__")).toBe("hello");
    a.removeItem("__rkui_test__");
    expect(a.getItem("__rkui_test__")).toBeNull();
  });
});

describe("resolveStorage", () => {
  it("returns null-equivalent behaviour when given undefined → caller decides", () => {
    // resolveStorage(undefined) is never called by the provider when storage
    // is omitted (provider guards with `storageOptions ?`), but the function
    // still tolerates it by defaulting to localStorage adapter.
    const r = resolveStorage(undefined);
    expect(r.keyPrefix).toBe(DEFAULT_STORAGE_KEY_PREFIX);
    expect(r.namespaces.size).toBe(DEFAULT_STORAGE_NAMESPACES.length);
  });

  it("uses the provided adapter, prefix, and namespaces", () => {
    const a = memoryAdapter();
    const r = resolveStorage({ adapter: a, keyPrefix: "myapp:", namespaces: ["alerts"] });
    expect(r.adapter).toBe(a);
    expect(r.keyPrefix).toBe("myapp:");
    expect(r.persists("alerts")).toBe(true);
    expect(r.persists("settings")).toBe(false);
    expect(r.persists("indicators")).toBe(false);
    expect(r.key("alerts")).toBe("myapp:alerts");
  });

  it("defaults to all three namespaces when omitted", () => {
    const r = resolveStorage({ adapter: memoryAdapter() });
    expect(r.persists("alerts")).toBe(true);
    expect(r.persists("settings")).toBe(true);
    expect(r.persists("indicators")).toBe(true);
  });

  it("writes through the adapter via key()/setItem", () => {
    const a = memoryAdapter();
    const r = resolveStorage({ adapter: a });
    r.adapter.setItem(r.key("alerts"), "[]");
    expect(a.store.get(`${DEFAULT_STORAGE_KEY_PREFIX}alerts`)).toBe("[]");
  });
});
