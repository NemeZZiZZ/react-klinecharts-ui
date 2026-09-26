import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { KlinechartsUIProvider } from "../provider/ChartTerminalProvider";
import { useKlinechartsUIDispatch } from "../provider/ChartTerminalContext";
import { createMockChart, type MockChart } from "../../test/mockChart";
import { fakeDatafeed } from "../../test/renderHook";
import { useKlinechartsUISettings } from "./useKlinechartsUISettings";
import type { StorageAdapter } from "../storage";
import type { KlinechartsUIAction } from "../provider/types";

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

function settingsKey(adapter: { store: Map<string, string> }): string {
  const key = [...adapter.store.keys()].find((k) => k.includes("settings"));
  return key ?? "rkui:settings";
}

function makeWrapper(opts: {
  adapter?: StorageAdapter;
  onSettingsChange?: (s: unknown) => void;
}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <KlinechartsUIProvider
        datafeed={fakeDatafeed()}
        storage={opts.adapter ? { adapter: opts.adapter } : undefined}
        onSettingsChange={opts.onSettingsChange}
      >
        {children}
      </KlinechartsUIProvider>
    );
  };
}

function useHarness(chart: MockChart | null) {
  const { dispatch } = useKlinechartsUIDispatch();
  useEffect(() => {
    if (chart) {
      dispatch({ type: "SET_CHART", chart: chart as never } as KlinechartsUIAction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart]);
  const settings = useKlinechartsUISettings();
  return { settings, dispatch };
}

/** Tests that don't need the dispatch handle. */
function useSettingsOnly(chart: MockChart | null) {
  return useHarness(chart).settings;
}

describe("useKlinechartsUISettings — hydration & notify", () => {
  it("does NOT fire onSettingsChange on mount when persisted settings exist", () => {
    const adapter = memoryAdapter();
    adapter.setItem(
      "rkui:settings",
      JSON.stringify({ candleUpColor: "#ABCABC" }),
    );
    const onSettingsChange = vi.fn();
    renderHook(() => useSettingsOnly(null), {
      wrapper: makeWrapper({ adapter, onSettingsChange }),
    });
    act(() => {});
    expect(onSettingsChange).not.toHaveBeenCalled();
  });

  it("does NOT overwrite the stored settings with defaults on mount", () => {
    const adapter = memoryAdapter();
    const seeded = JSON.stringify({ candleUpColor: "#ABCABC" });
    adapter.setItem("rkui:settings", seeded);
    renderHook(() => useSettingsOnly(null), {
      wrapper: makeWrapper({ adapter }),
    });
    act(() => {});
    expect(adapter.getItem("rkui:settings")).toBe(seeded);
  });

  it("hydrates the persisted value into the returned settings", () => {
    const adapter = memoryAdapter();
    adapter.setItem(
      "rkui:settings",
      JSON.stringify({ candleUpColor: "#ABCABC" }),
    );
    const { result } = renderHook(() => useSettingsOnly(null), {
      wrapper: makeWrapper({ adapter }),
    });
    expect(result.current.candleUpColor).toBe("#ABCABC");
  });

  it("a real settings change fires onSettingsChange once and persists", () => {
    const adapter = memoryAdapter();
    const onSettingsChange = vi.fn();
    const { result } = renderHook(() => useSettingsOnly(null), {
      wrapper: makeWrapper({ adapter, onSettingsChange }),
    });
    act(() => {
      result.current.setCandleUpColor("#111111");
    });
    expect(onSettingsChange).toHaveBeenCalledTimes(1);
    expect(onSettingsChange.mock.calls[0]![0]).toMatchObject({
      candleUpColor: "#111111",
    });
    const stored = JSON.parse(adapter.getItem(settingsKey(adapter))!);
    expect(stored.candleUpColor).toBe("#111111");
  });
});

describe("useKlinechartsUISettings — chart style ownership", () => {
  it("re-applies custom settings ON TOP of the theme preset after a theme change", () => {
    const chart = createMockChart();
    const { result } = renderHook(() => useHarness(chart), {
      wrapper: makeWrapper({}),
    });
    act(() => {
      result.current.settings.setCandleUpColor("#123123");
    });
    chart.setStyles.mockClear();

    // Theme toggle (the real useKlinechartsUITheme.setTheme applies the preset
    // synchronously in the click handler, then SET_THEME lands here).
    act(() => {
      result.current.dispatch({ type: "SET_THEME", theme: "dark" });
    });

    const calls = chart.setStyles.mock.calls as Array<[unknown]>;
    const themeIdx = calls.findIndex((c) => c[0] === "dark");
    const customIdx = calls.findIndex(
      (c) =>
        typeof c[0] === "object" &&
        c[0] !== null &&
        (c[0] as { candle?: { bar?: { upColor?: string } } }).candle?.bar
          ?.upColor === "#123123",
    );
    // Theme preset rebased first, custom settings re-applied over it.
    expect(themeIdx).toBeGreaterThanOrEqual(0);
    expect(customIdx).toBeGreaterThan(themeIdx);
  });

  it("re-applies settings when a NEW chart instance appears", () => {
    const chartA = createMockChart();
    const { result, rerender } = renderHook(
      ({ chart }) => useHarness(chart),
      { wrapper: makeWrapper({}), initialProps: { chart: chartA as MockChart | null } },
    );
    act(() => {
      result.current.settings.setCandleUpColor("#321321");
    });
    const appliedOnA = chartA.setStyles.mock.calls.length;
    expect(appliedOnA).toBeGreaterThan(0);

    // Chart swap: a fresh instance must receive the CURRENT settings, not the
    // klinecharts defaults (the one-shot guard used to skip this entirely).
    const chartB = createMockChart();
    rerender({ chart: chartB });
    expect(chartB.setStyles.mock.calls.length).toBeGreaterThan(0);
    const payloads = chartB.setStyles.mock.calls.map((c) => c[0]);
    expect(
      payloads.some(
        (p) =>
          typeof p === "object" &&
          p !== null &&
          (p as { candle?: { bar?: { upColor?: string } } }).candle?.bar
            ?.upColor === "#321321",
      ),
    ).toBe(true);
  });
});
