import { describe, it, expect, beforeEach } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { renderHookWithProvider } from "../../test/renderHook";
import { useLayoutManager, type LayoutEntry } from "./useLayoutManager";
import type { StorageAdapter } from "../storage";

/** In-memory StorageAdapter with an inspectable backing map. */
function memoryAdapter(): StorageAdapter & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  };
}

function seedEntry(id: string, name: string): LayoutEntry {
  return {
    id,
    name,
    symbol: "TESTUSDT",
    period: "1h",
    timestamp: 1,
    lastModified: 1,
    state: {
      version: "1.0",
      meta: { symbol: "TESTUSDT", period: "1h", timestamp: 1, lastModified: 1 },
      indicators: [],
      drawings: [],
    },
  };
}

describe("useLayoutManager persistence routing", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back to legacy localStorage keys when no storage is configured", () => {
    const { result } = renderHookWithProvider(() => useLayoutManager());

    let id: string | null = null;
    act(() => {
      id = result.current.saveLayout("Legacy");
    });

    expect(id).toBeTypeOf("string");
    // Historical keys, so layouts saved by pre-2.0.4 versions stay visible.
    expect(localStorage.getItem("klinecharts_layout_index")).toBeTruthy();
    expect(localStorage.getItem(`klinecharts_layout:${id}`)).toBeTruthy();
    expect(result.current.layouts).toHaveLength(1);
  });

  it("routes reads and writes through the provider storage adapter", () => {
    const adapter = memoryAdapter();
    const { result } = renderHookWithProvider(() => useLayoutManager(), {
      storage: { adapter },
    });

    let id: string | null = null;
    act(() => {
      id = result.current.saveLayout("Adapted");
    });

    expect(id).toBeTypeOf("string");
    expect(adapter.store.get("rkui:layout_index")).toBeTruthy();
    expect(adapter.store.get(`rkui:layout:${id}`)).toBeTruthy();
    // Nothing leaks into the legacy keys when an adapter is configured.
    expect(localStorage.getItem("klinecharts_layout_index")).toBeNull();
    expect(result.current.layouts).toHaveLength(1);
  });

  it("disables persistence when the layouts namespace is excluded", () => {
    const adapter = memoryAdapter();
    const { result } = renderHookWithProvider(() => useLayoutManager(), {
      storage: { adapter, namespaces: ["alerts"] },
    });

    let id: string | null = null;
    act(() => {
      id = result.current.saveLayout("Denied");
    });

    expect(id).toBeNull();
    // "alerts" is persisted by the provider itself, so only assert that no
    // layout keys were touched.
    expect([...adapter.store.keys()]).not.toContain("rkui:layout_index");
    expect(localStorage.getItem("klinecharts_layout_index")).toBeNull();
    expect(result.current.layouts).toHaveLength(0);
  });

  it("merges legacy localStorage layouts into a configured adapter once", async () => {
    // Pre-2.0.4 state: layouts lived in raw localStorage even when a storage
    // adapter was configured for the other slices.
    const legacy = seedEntry("legacy-1", "Old Layout");
    localStorage.setItem(
      "klinecharts_layout_index",
      JSON.stringify(["legacy-1"]),
    );
    localStorage.setItem(
      "klinecharts_layout:legacy-1",
      JSON.stringify(legacy),
    );

    const adapter = memoryAdapter();
    adapter.store.set("rkui:layout_index", JSON.stringify(["adapter-1"]));
    adapter.store.set(
      "rkui:layout:adapter-1",
      JSON.stringify(seedEntry("adapter-1", "New Layout")),
    );

    const { result } = renderHookWithProvider(() => useLayoutManager(), {
      storage: { adapter },
    });

    await waitFor(() => {
      expect(result.current.layouts).toHaveLength(2);
    });
    // Existing adapter entries keep their order; migrated ids append.
    expect(JSON.parse(adapter.store.get("rkui:layout_index")!)).toEqual([
      "adapter-1",
      "legacy-1",
    ]);
    expect(adapter.store.get("rkui:layout:legacy-1")).toBeTruthy();
    // Legacy keys are cleaned up after a successful copy.
    expect(localStorage.getItem("klinecharts_layout_index")).toBeNull();
    expect(localStorage.getItem("klinecharts_layout:legacy-1")).toBeNull();
  });

  it("never throws when the adapter write fails (quota/private mode)", () => {
    const adapter = memoryAdapter();
    adapter.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    const { result } = renderHookWithProvider(() => useLayoutManager(), {
      storage: { adapter },
    });

    expect(() =>
      act(() => {
        result.current.saveLayout("Quota");
      }),
    ).not.toThrow();
  });

  it("renames and deletes through the adapter", () => {
    const adapter = memoryAdapter();
    const { result } = renderHookWithProvider(() => useLayoutManager(), {
      storage: { adapter },
    });

    let id: string | null = null;
    act(() => {
      id = result.current.saveLayout("Original");
    });
    const entryKey = `rkui:layout:${id}`;

    act(() => {
      result.current.renameLayout(id!, "Renamed");
    });
    const renamed = JSON.parse(adapter.store.get(entryKey)!) as LayoutEntry;
    expect(renamed.name).toBe("Renamed");
    expect(result.current.layouts[0]?.name).toBe("Renamed");

    act(() => {
      result.current.deleteLayout(id!);
    });
    expect(adapter.store.get(entryKey)).toBeUndefined();
    expect(JSON.parse(adapter.store.get("rkui:layout_index")!)).toEqual([]);
    expect(result.current.layouts).toHaveLength(0);
  });

  it("persists and restores drawing lock/visible/mode (R6)", async () => {
    const adapter = memoryAdapter();
    const { result, chart } = renderHookWithProvider(
      () => useLayoutManager(),
      { storage: { adapter } },
    );

    // Seed a drawing whose flags differ from the defaults.
    (chart.createOverlay as (cfg: Record<string, unknown>) => unknown)({
      name: "segment",
      groupId: "drawing_tools",
      points: [
        { timestamp: 1000, value: 1 },
        { timestamp: 1060, value: 2 },
      ],
      lock: true,
      visible: false,
      mode: "strong_magnet",
    });

    let id: string | null = null;
    act(() => {
      id = result.current.saveLayout("Flags");
    });

    const stored = JSON.parse(
      adapter.store.get(`rkui:layout:${id}`)!,
    ) as LayoutEntry;
    expect(stored.state.drawings[0]).toMatchObject({
      name: "segment",
      lock: true,
      visible: false,
      mode: "strong_magnet",
    });

    // Wipe the chart and reload: the flags must be passed to createOverlay.
    act(() =>
      (chart.removeOverlay as (filter: Record<string, unknown>) => unknown)(
        {},
      ),
    );
    chart.createOverlay.mockClear();
    let ok = false;
    act(() => {
      ok = result.current.loadLayout(id!);
    });
    expect(ok).toBe(true);
    const restored = chart.createOverlay.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .find((cfg) => cfg.name === "segment");
    expect(restored).toMatchObject({
      groupId: "drawing_tools",
      lock: true,
      visible: false,
      mode: "strong_magnet",
    });
  });

  it("loads pre-seeded entries from the adapter after mount", async () => {
    const adapter = memoryAdapter();
    adapter.store.set("rkui:layout_index", JSON.stringify(["seed-1"]));
    adapter.store.set(
      "rkui:layout:seed-1",
      JSON.stringify(seedEntry("seed-1", "Seeded")),
    );

    const { result } = renderHookWithProvider(() => useLayoutManager(), {
      storage: { adapter },
    });

    await waitFor(() => expect(result.current.layouts).toHaveLength(1));
    expect(result.current.layouts[0]?.name).toBe("Seeded");
  });
});

describe("useLayoutManager — общее состояние провайдера", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("два экземпляра хука видят ОДИН список layouts", async () => {
    // Регрессия: список жил в useState хука, поэтому два компонента
    // (панель layouts + тулбар) показывали разные копии и каждый держал
    // свой таймер автосохранения на один и тот же ключ хранилища.
    const { result } = renderHookWithProvider(() => ({
      a: useLayoutManager(),
      b: useLayoutManager(),
    }));

    act(() => {
      result.current.a.saveLayout("Shared");
    });

    await waitFor(() => expect(result.current.b.layouts).toHaveLength(1));
    expect(result.current.b.layouts[0]?.name).toBe("Shared");

    act(() => {
      result.current.b.deleteLayout(result.current.b.layouts[0]!.id);
    });
    expect(result.current.a.layouts).toHaveLength(0);
  });

  it("флаг автосохранения общий для всех экземпляров", () => {
    const { result } = renderHookWithProvider(() => ({
      a: useLayoutManager(),
      b: useLayoutManager(),
    }));
    expect(result.current.b.autoSaveEnabled).toBe(false);
    act(() => {
      result.current.a.setAutoSaveEnabled(true);
    });
    expect(result.current.b.autoSaveEnabled).toBe(true);
  });
});
