import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";
import { renderHookWithProvider } from "../../test/renderHook";
import { useAlerts } from "../hooks/useAlerts";
import { useIndicators } from "../hooks/useIndicators";
import type { StorageAdapter, StorageOptions } from "../storage";

/** Map-backed in-memory adapter; exposes the underlying store for assertions. */
function memoryAdapter(): StorageAdapter & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  };
}

describe("storage adapter — hydrate", () => {
  it("seeds the provider with alerts read from the adapter on mount", () => {
    const a = memoryAdapter();
    a.store.set(
      "rkui:alerts",
      JSON.stringify([
        { id: "x1", price: 100, condition: "crossing_up", triggered: false },
      ]),
    );
    const { result } = renderHookWithProvider(() => useAlerts(), { storage: { adapter: a } });
    expect(result.current.alerts.map((al) => al.id)).toEqual(["x1"]);
  });

  it("hydrates indicators (main/sub/axes/visibility) on mount", () => {
    const a = memoryAdapter();
    a.store.set(
      "rkui:indicators",
      JSON.stringify({
        main: ["BOLL"],
        sub: { MACD: "pane_macd" },
        axes: { "main_BOLL": "boll_axis" },
        visibility: { "sub_MACD": false },
      }),
    );
    const { result } = renderHookWithProvider(() => useIndicators(), { storage: { adapter: a } });
    expect(result.current.isMainIndicatorActive("BOLL")).toBe(true);
    expect(result.current.isSubIndicatorActive("MACD")).toBe(true);
    expect(result.current.indicatorAxes).toEqual({ main_BOLL: "boll_axis" });
    expect(result.current.indicatorVisibility).toEqual({ sub_MACD: false });
  });

  it("REGRESSION: stored indicators win over defaultMainIndicators (saved prefs survive reload)", () => {
    // The consumer passes defaultMainIndicators=["MA"], but storage holds the
    // user's saved ["EMA","BOLL"]. Persistence semantics: stored wins.
    const a = memoryAdapter();
    a.store.set("rkui:indicators", JSON.stringify({ main: ["EMA", "BOLL"] }));
    const { result } = renderHookWithProvider(() => useIndicators(), {
      storage: { adapter: a },
      defaultMainIndicators: ["MA"],
    });
    expect(result.current.isMainIndicatorActive("EMA")).toBe(true);
    expect(result.current.isMainIndicatorActive("BOLL")).toBe(true);
    expect(result.current.isMainIndicatorActive("MA")).toBe(false);
  });
});

describe("storage adapter — write-back", () => {
  it("writes the alerts slice when an alert is added", () => {
    const a = memoryAdapter();
    const opts: StorageOptions = { adapter: a };
    const { result } = renderHookWithProvider(() => useAlerts(), { storage: opts });
    act(() => result.current.addAlert(500, "crossing_up"));
    const stored = JSON.parse(a.store.get("rkui:alerts")!);
    expect(stored.length).toBe(1);
    expect(stored[0].price).toBe(500);
  });

  it("writes the indicators slice when an indicator is toggled", () => {
    const a = memoryAdapter();
    const { result } = renderHookWithProvider(() => useIndicators(), { storage: { adapter: a } });
    act(() => result.current.addMainIndicator("EMA"));
    const stored = JSON.parse(a.store.get("rkui:indicators")!);
    expect(stored.main).toContain("EMA");
  });

  it("respects namespace filtering: disabled namespaces are not written", () => {
    const a = memoryAdapter();
    const { result } = renderHookWithProvider(() => useAlerts(), {
      storage: { adapter: a, namespaces: ["settings"] }, // alerts NOT persisted
    });
    act(() => result.current.addAlert(500, "crossing_up"));
    expect(a.store.has("rkui:alerts")).toBe(false);
  });

  it("uses a custom key prefix when provided", () => {
    const a = memoryAdapter();
    const { result } = renderHookWithProvider(() => useAlerts(), {
      storage: { adapter: a, keyPrefix: "myapp:" },
    });
    act(() => result.current.addAlert(500, "crossing_up"));
    expect(a.store.has("myapp:alerts")).toBe(true);
    expect(a.store.has("rkui:alerts")).toBe(false);
  });
});

describe("storage adapter — disabled (backward compat)", () => {
  it("omitting the storage prop behaves exactly like pre-1.1.0 (no persistence)", () => {
    const { result } = renderHookWithProvider(() => useAlerts());
    act(() => result.current.addAlert(500, "crossing_up"));
    // Nothing to assert on storage (none configured); the point is the hook
    // still works and the store starts empty.
    expect(result.current.alerts.length).toBe(1);
  });
});

describe("storage adapter — adapter failure is non-fatal", () => {
  it("a throwing setItem does not break the chart", () => {
    const throwing: StorageAdapter = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
    };
    const { result } = renderHookWithProvider(() => useAlerts(), { storage: { adapter: throwing } });
    expect(() => act(() => result.current.addAlert(500, "crossing_up"))).not.toThrow();
    expect(result.current.alerts.length).toBe(1);
  });

  it("corrupt hydrated JSON falls back to defaults instead of crashing", () => {
    const a = memoryAdapter();
    a.store.set("rkui:alerts", "{not json");
    const { result } = renderHookWithProvider(() => useAlerts(), { storage: { adapter: a } });
    expect(result.current.alerts).toEqual([]);
  });
});
