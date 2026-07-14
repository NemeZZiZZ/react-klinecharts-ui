import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import type { KLineData } from "klinecharts";
import { renderHookWithProvider } from "../../test/renderHook";
import type { Datafeed } from "../provider/types";

// `registerIndicator` registers into klinecharts' global registry. Capture each
// template so tests can assert on the projected calc / tooltip behavior
// without driving a real canvas chart (which the mock chart doesn't run).
const registeredIndicators = new Map<
  string,
  Record<string, unknown>
>();

vi.mock("klinecharts", async () => {
  const actual = await vi.importActual<typeof import("klinecharts")>("klinecharts");
  return {
    ...actual,
    registerIndicator: vi.fn((template: Record<string, unknown>) => {
      registeredIndicators.set(template.name as string, template);
    }),
  };
});

// Import AFTER the mock is registered.
import { useCompare } from "./useCompare";

// BTC-like main candles and ETH-like compare candles sharing timestamps.
const MAIN: KLineData[] = [
  { timestamp: 1000, open: 64000, high: 64100, low: 63900, close: 64000, volume: 10 },
  { timestamp: 2000, open: 64000, high: 64300, low: 63900, close: 64200, volume: 11 },
  { timestamp: 3000, open: 64200, high: 64500, low: 64100, close: 64400, volume: 12 },
];
// ETH: 3000 → 3300 (+10%). Anchored at the same first timestamp as BTC.
const COMPARE: KLineData[] = [
  { timestamp: 1000, open: 3000, high: 3010, low: 2990, close: 3000, volume: 100 },
  { timestamp: 2000, open: 3000, high: 3100, low: 2990, close: 3100, volume: 110 },
  { timestamp: 3000, open: 3100, high: 3310, low: 3090, close: 3300, volume: 120 },
];

beforeEach(() => {
  registeredIndicators.clear();
});

/** Make the fake datafeed return `history` for the next compare fetch. */
function setCompareHistory(datafeed: Datafeed, history: KLineData[]) {
  // The fake datafeed ignores its arguments and only the return value matters,
  // so swap in a stub resolved to `history`.
  datafeed.getHistoryKLineData = (() =>
    Promise.resolve(history)) as typeof datafeed.getHistoryKLineData;
}

describe("useCompare — price projection (not raw %)", () => {
  it("registers an indicator and stacks it on the candle pane", async () => {
    const { result, chart } = renderHookWithProvider(() => useCompare(), {
      initialData: MAIN,
    });

    await act(async () => {
      await result.current.addSymbol("ETHUSDT");
    });

    // createIndicator was called with paneId candle_pane and isStack=true.
    const calls = chart.createIndicator.mock.calls;
    const call = calls[calls.length - 1] as [
      Record<string, unknown>,
      boolean,
    ];
    expect(call[1]).toBe(true);
    expect(call[0].paneId).toBe("candle_pane");
  });

  it("projects compare closes onto the main price scale (not raw percentages)", async () => {
    const { result } = renderHookWithProvider(() => useCompare(), {
      // The fake datafeed returns the SAME history it was seeded with for
      // every getHistoryKLineData call, so seeding with COMPARE makes the
      // compare fetch return the ETH candles.
      initialData: COMPARE,
    });

    // We need the MAIN chart data to be BTC while the compare fetch returns
    // ETH. renderHookWithProvider seeds both the chart and the fake datafeed
    // with the same array, so override the chart data to BTC after mount and
    // keep the datafeed returning ETH (compare) candles.
    // Re-render path is awkward; instead drive a dedicated scenario below.

    await act(async () => {
      await result.current.addSymbol("ETHUSDT");
    });

    const tpl = registeredIndicators.get(
      [...registeredIndicators.keys()].find((k) => k.endsWith("ETHUSDT"))!,
    )!;
    const calc = tpl.calc as (dataList: KLineData[]) => unknown[];
    // dataList here is the MAIN chart data (BTC) because addSymbol reads
    // state.chart.getDataList() to build compareMap. But the fake datafeed
    // returns COMPARE for the compare fetch, so compareMap = ETH closes.
    // mainBase = first MAIN close (anchor). With the renderHookWithProvider
    // setup above both main and compare are COMPARE, so this just sanity-
    // checks the shape; the projection math is asserted in the next test.
    const out = calc(COMPARE);
    expect(out).toHaveLength(3);
    expect(out[0]).toHaveProperty("value");
    expect(out[0]).toHaveProperty("pct");
  });

  it("value is projected onto the main scale; pct is the real compare change", async () => {
    // Build the scenario directly: main BTC chart, compare fetch returns ETH.
    // We emulate this by seeding the chart with MAIN and overriding the
    // datafeed's history to COMPARE.
    const { result, datafeed } = renderHookWithProvider(
      () => useCompare(),
      { initialData: MAIN },
    );
    // Swap the datafeed to return ETH candles for the compare symbol fetch.
    setCompareHistory(datafeed, COMPARE);
    // getDataList returns MAIN (BTC) — already seeded via initialData.

    await act(async () => {
      await result.current.addSymbol("ETHUSDT");
    });

    const tpl = registeredIndicators.get(
      [...registeredIndicators.keys()].find((k) => k.endsWith("ETHUSDT"))!,
    )!;
    const calc = tpl.calc as (dataList: KLineData[]) => Array<{
      value: number | null;
      pct: number | null;
    }>;
    const out = calc(MAIN);

    // Anchor: mainBase=64000 (BTC first close), compareBase=3000 (ETH first close).
    // Bar 0: ETH=3000 → value = 64000*(3000/3000) = 64000, pct = 0%
    expect(out[0].value).toBeCloseTo(64000, 2);
    expect(out[0].pct).toBeCloseTo(0, 5);
    // Bar 1: ETH=3100 → value = 64000*(3100/3000) = 66133.33, pct = +3.333%
    expect(out[1].value).toBeCloseTo(66133.33, 1);
    expect(out[1].pct).toBeCloseTo((100 * (3100 - 3000)) / 3000, 3);
    // Bar 2: ETH=3300 → value = 64000*(3300/3000) = 70400, pct = +10%
    expect(out[2].value).toBeCloseTo(70400, 2);
    expect(out[2].pct).toBeCloseTo(10, 5);

    // The projected values live in BTC's price domain (~64k–70k), NOT in the
    // small percentage range (±10) that previously collapsed the chart.
    for (const r of out) {
      expect(r.value).toBeGreaterThan(1000);
    }
  });

  it("uses series:'price' so klinecharts syncs precision to the main symbol", async () => {
    const { result } = renderHookWithProvider(() => useCompare(), {
      initialData: MAIN,
    });
    await act(async () => {
      await result.current.addSymbol("ETHUSDT");
    });
    const tpl = registeredIndicators.get(
      [...registeredIndicators.keys()].find((k) => k.endsWith("ETHUSDT"))!,
    )!;
    expect(tpl.series).toBe("price");
  });

  it("createTooltipDataSource reports the real percentage, not the projected price", async () => {
    const { result, datafeed } = renderHookWithProvider(
      () => useCompare(),
      { initialData: MAIN },
    );
    setCompareHistory(datafeed, COMPARE);

    await act(async () => {
      await result.current.addSymbol("ETHUSDT");
    });

    const tpl = registeredIndicators.get(
      [...registeredIndicators.keys()].find((k) => k.endsWith("ETHUSDT"))!,
    )!;
    const ctds = tpl.createTooltipDataSource as (p: {
      indicator: { result: Array<{ value: number | null; pct: number | null }> };
      crosshair: { dataIndex?: number };
    }) => { legends: Array<{ title: { text: string }; value: { text: string } }> };

    // Crosshair on the last bar (ETH +10%).
    const calc = tpl.calc as (d: KLineData[]) => Array<{
      value: number | null;
      pct: number | null;
    }>;
    const resultArr = calc(MAIN);
    const tip = ctds({
      indicator: { result: resultArr },
      crosshair: { dataIndex: 2 },
    });
    expect(tip.legends).toHaveLength(1);
    expect(tip.legends[0].title.text).toContain("ETHUSDT");
    expect(tip.legends[0].value.text).toContain("+10.00%");

    // First bar should read 0.00% (not "+0.00%").
    const tip0 = ctds({
      indicator: { result: resultArr },
      crosshair: { dataIndex: 0 },
    });
    expect(tip0.legends[0].value.text).toBe("0.00%");
  });

  it("removeSymbol removes the chart indicator", async () => {
    const { result, chart } = renderHookWithProvider(() => useCompare(), {
      initialData: MAIN,
    });
    await act(async () => {
      await result.current.addSymbol("ETHUSDT");
    });
    chart.removeIndicator.mockClear();
    act(() => result.current.removeSymbol("ETHUSDT"));
    expect(chart.removeIndicator).toHaveBeenCalled();
    expect(result.current.symbols).toHaveLength(0);
  });

  it("toggleSymbol flips visibility via overrideIndicator", async () => {
    const { result, chart } = renderHookWithProvider(() => useCompare(), {
      initialData: MAIN,
    });
    await act(async () => {
      await result.current.addSymbol("ETHUSDT");
    });
    chart.overrideIndicator.mockClear();
    act(() => result.current.toggleSymbol("ETHUSDT"));
    expect(chart.overrideIndicator).toHaveBeenCalled();
    expect(
      result.current.symbols.find((s) => s.ticker === "ETHUSDT")?.visible,
    ).toBe(false);
  });

  it("tracks the compare base price on the symbol metadata", async () => {
    const { result, datafeed } = renderHookWithProvider(
      () => useCompare(),
      { initialData: MAIN },
    );
    setCompareHistory(datafeed, COMPARE);
    await act(async () => {
      await result.current.addSymbol("ETHUSDT");
    });
    const sym = result.current.symbols.find((s) => s.ticker === "ETHUSDT");
    expect(sym).toBeDefined();
    // basePrice is the compare symbol's anchor close (ETH first bar = 3000),
    // not the main symbol's price.
    expect(sym?.basePrice).toBe(3000);
  });
});
