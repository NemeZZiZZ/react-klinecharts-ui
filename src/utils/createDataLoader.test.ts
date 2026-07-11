import { describe, it, expect, vi } from "vitest";
import { createDataLoader } from "./createDataLoader";
import type { KLineData } from "klinecharts";
import type { Datafeed, KlinechartsUIAction } from "../provider/types";

const bars = (n: number): KLineData[] =>
  Array.from({ length: n }, (_, i) => ({
    timestamp: 1_700_000_000_000 + i * 60_000,
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    volume: 1000,
  }));

function makeDatafeed(history: KLineData[]): Datafeed {
  return {
    searchSymbols: async () => [],
    getHistoryKLineData: async () => history,
    subscribe: () => {},
    unsubscribe: () => {},
  };
}

describe("createDataLoader", () => {
  it("returns a DataLoader with getBars / subscribeBar / unsubscribeBar", () => {
    const dispatch = vi.fn();
    const loader = createDataLoader(makeDatafeed([]), dispatch);
    expect(typeof loader.getBars).toBe("function");
    expect(typeof loader.subscribeBar).toBe("function");
    expect(typeof loader.unsubscribeBar).toBe("function");
  });

  it("init load applies the data via the klinecharts callback and sets loading", async () => {
    const dispatch = vi.fn();
    const history = bars(5);
    const loader = createDataLoader(makeDatafeed(history), dispatch);
    const cb = vi.fn();

    await loader.getBars({
      // klinecharts getBars params shape
      type: "init",
      symbol: { ticker: "T" },
      period: { span: 1, type: "minute" },
      callback: cb,
    } as never);

    // The datafeed's history is handed to the klinecharts callback.
    expect(cb).toHaveBeenCalledTimes(1);
    const [data, more] = cb.mock.calls[0];
    expect(data).toHaveLength(5);
    expect(more).toEqual({ forward: true, backward: false });
    // SET_LOADING dispatched at start (true) and end (false).
    const types = dispatch.mock.calls.map((c) => (c[0] as KlinechartsUIAction).type);
    expect(types).toContain("SET_LOADING");
    const loadingFlags = dispatch.mock.calls
      .filter((c) => (c[0] as KlinechartsUIAction).type === "SET_LOADING")
      .map((c) => (c[0] as { isLoading: boolean }).isLoading);
    expect(loadingFlags).toEqual([true, false]);
  });

  it("empty history triggers the callback with forward:false", async () => {
    const dispatch = vi.fn();
    const loader = createDataLoader(makeDatafeed([]), dispatch);
    const cb = vi.fn();
    await loader.getBars({
      type: "init",
      symbol: { ticker: "T" },
      period: { span: 1, type: "minute" },
      callback: cb,
    } as never);
    const [, more] = cb.mock.calls[0];
    expect(more).toEqual({ forward: false, backward: false });
  });

  it("subscribeBar wires the datafeed.subscribe → callback for realtime ticks", () => {
    const dispatch = vi.fn();
    let subscribed: ((bar: KLineData) => void) | null = null;
    const feed: Datafeed = {
      searchSymbols: async () => [],
      getHistoryKLineData: async () => [],
      subscribe: (_s, _p, cb) => {
        subscribed = cb;
      },
      unsubscribe: () => {},
    };
    const loader = createDataLoader(feed, dispatch);
    const cb = vi.fn();
    loader.subscribeBar!({
      symbol: { ticker: "T" },
      period: { span: 1, type: "minute" },
      callback: cb,
    } as never);
    expect(subscribed).not.toBeNull();
    const tick = bars(1)[0]!;
    subscribed!(tick);
    expect(cb).toHaveBeenCalledWith(tick);
  });

  it("getBars swallows datafeed errors and still calls the callback", async () => {
    const dispatch = vi.fn();
    const feed: Datafeed = {
      searchSymbols: async () => [],
      getHistoryKLineData: async () => {
        throw new Error("network");
      },
      subscribe: () => {},
      unsubscribe: () => {},
    };
    const loader = createDataLoader(feed, dispatch);
    const cb = vi.fn();
    await loader.getBars({
      type: "init",
      symbol: { ticker: "T" },
      period: { span: 1, type: "minute" },
      callback: cb,
    } as never);
    // Recovery path calls back with empty data so klinecharts closes the request.
    expect(cb).toHaveBeenCalledWith([], expect.anything());
  });
});

describe("createDataLoader — replay intercept", () => {
  it("serves the saved buffer truncated to the replay index while active", async () => {
    const dispatch = vi.fn();
    const history = bars(10);
    // The live datafeed must NEVER be hit during replay.
    const feed: Datafeed = {
      searchSymbols: async () => [],
      getHistoryKLineData: vi.fn().mockResolvedValue(history),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    const saved = bars(10);
    const replay = {
      active: { current: true },
      savedData: { current: saved },
      index: { current: 4 },
    };
    const loader = createDataLoader(feed, dispatch, replay);
    const cb = vi.fn();
    await loader.getBars({
      type: "init",
      symbol: { ticker: "T" },
      period: { span: 1, type: "minute" },
      callback: cb,
    } as never);

    expect(feed.getHistoryKLineData).not.toHaveBeenCalled();
    const [data] = cb.mock.calls[0];
    expect(data).toHaveLength(4);
    expect(data).toEqual(saved.slice(0, 4));
  });

  it("delegates to the live datafeed when replay is inactive", async () => {
    const dispatch = vi.fn();
    const history = bars(5);
    const feed: Datafeed = {
      searchSymbols: async () => [],
      getHistoryKLineData: vi.fn().mockResolvedValue(history),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    const replay = {
      active: { current: false },
      savedData: { current: [] },
      index: { current: 0 },
    };
    const loader = createDataLoader(feed, dispatch, replay);
    const cb = vi.fn();
    await loader.getBars({
      type: "init",
      symbol: { ticker: "T" },
      period: { span: 1, type: "minute" },
      callback: cb,
    } as never);

    expect(feed.getHistoryKLineData).toHaveBeenCalledTimes(1);
    const [data] = cb.mock.calls[0];
    expect(data).toHaveLength(5);
  });

  it("subscribeBar is a no-op while replay is active", () => {
    const dispatch = vi.fn();
    const feed: Datafeed = {
      searchSymbols: async () => [],
      getHistoryKLineData: async () => [],
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    const replay = {
      active: { current: true },
      savedData: { current: [] },
      index: { current: 0 },
    };
    const loader = createDataLoader(feed, dispatch, replay);
    loader.subscribeBar!({
      symbol: { ticker: "T" },
      period: { span: 1, type: "minute" },
      callback: vi.fn(),
    } as never);
    expect(feed.subscribe).not.toHaveBeenCalled();
  });
});
