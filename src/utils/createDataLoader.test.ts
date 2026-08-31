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

  it("forward before any init still invokes the callback (loading flag must not wedge)", async () => {
    const dispatch = vi.fn();
    const loader = createDataLoader(makeDatafeed(bars(5)), dispatch);
    const cb = vi.fn();
    // klinecharts clears its internal loading flag ONLY inside the callback —
    // a bare resolve would block every future load until the next resetData.
    await loader.getBars({
      type: "forward",
      symbol: { ticker: "T" },
      period: { span: 1, type: "minute" },
      callback: cb,
    } as never);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith([], { forward: false, backward: false });
  });

  it("keeps isLoading true while any concurrent request is still in flight", async () => {
    const dispatch = vi.fn();
    let resolveForwardA!: (data: KLineData[]) => void;
    let resolveForwardB!: (data: KLineData[]) => void;
    const feed: Datafeed = {
      searchSymbols: async () => [],
      getHistoryKLineData: vi
        .fn()
        .mockImplementationOnce(async () => bars(5)) // init
        .mockImplementationOnce(
          () => new Promise<KLineData[]>((r) => (resolveForwardA = r)),
        )
        .mockImplementationOnce(
          () => new Promise<KLineData[]>((r) => (resolveForwardB = r)),
        ),
      subscribe: () => {},
      unsubscribe: () => {},
    };
    const loader = createDataLoader(feed, dispatch);
    const loadingFlags = () =>
      dispatch.mock.calls
        .filter((c) => (c[0] as KlinechartsUIAction).type === "SET_LOADING")
        .map((c) => (c[0] as { isLoading: boolean }).isLoading);

    // Init completes first so forward requests have an oldestTimestamp anchor.
    await loader.getBars({
      type: "init",
      symbol: { ticker: "T" },
      period: { span: 1, type: "minute" },
      callback: vi.fn(),
    } as never);
    expect(loadingFlags()).toEqual([true, false]);

    // Two overlapping forwards (fast scroll): the first to settle must NOT
    // clear the flag while the second is still loading.
    const forwardA = loader.getBars({
      type: "forward",
      symbol: { ticker: "T" },
      period: { span: 1, type: "minute" },
      callback: vi.fn(),
    } as never);
    const forwardB = loader.getBars({
      type: "forward",
      symbol: { ticker: "T" },
      period: { span: 1, type: "minute" },
      callback: vi.fn(),
    } as never);
    await Promise.resolve();
    expect(loadingFlags()).toEqual([true, false, true, true]);

    resolveForwardA(bars(2));
    await forwardA;
    expect(loadingFlags()).toEqual([true, false, true, true, true]);

    resolveForwardB(bars(2));
    await forwardB;
    expect(loadingFlags()).toEqual([true, false, true, true, true, false]);
  });

  it("a shared genRef discards a stale init in flight on a previous loader instance", async () => {
    const dispatch = vi.fn();
    const genRef = { current: 0 };
    let resolveOld!: (data: KLineData[]) => void;
    const oldFeed: Datafeed = {
      searchSymbols: async () => [],
      getHistoryKLineData: () =>
        new Promise<KLineData[]>((r) => (resolveOld = r)),
      subscribe: () => {},
      unsubscribe: () => {},
    };
    const oldLoader = createDataLoader(oldFeed, dispatch, undefined, genRef);
    const oldCb = vi.fn();
    const oldDone = oldLoader.getBars({
      type: "init",
      symbol: { ticker: "OLD" },
      period: { span: 1, type: "minute" },
      callback: oldCb,
    } as never);
    await Promise.resolve();

    // Datafeed swap: a new loader on the SAME chart (shared ref) starts init.
    const newLoader = createDataLoader(
      makeDatafeed(bars(3)),
      dispatch,
      undefined,
      genRef,
    );
    const newCb = vi.fn();
    await newLoader.getBars({
      type: "init",
      symbol: { ticker: "NEW" },
      period: { span: 1, type: "minute" },
      callback: newCb,
    } as never);
    expect(newCb).toHaveBeenCalledTimes(1);

    // The old loader's init finally resolves — it must be discarded.
    resolveOld(bars(10));
    await oldDone;
    expect(oldCb).not.toHaveBeenCalled();
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

  it("discards a live init that settles after the replay started", async () => {
    const dispatch = vi.fn();
    let resolveLive!: (data: KLineData[]) => void;
    const feed: Datafeed = {
      searchSymbols: async () => [],
      getHistoryKLineData: () =>
        new Promise<KLineData[]>((r) => (resolveLive = r)),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    const replay = {
      active: { current: false },
      savedData: { current: bars(10) },
      index: { current: 5 },
    };
    const loader = createDataLoader(feed, dispatch, replay);

    // A live init is in flight when the replay starts (startReplay flips the
    // flag BEFORE calling resetData, so the replayed init must invalidate it).
    const liveCb = vi.fn();
    const liveDone = loader.getBars({
      type: "init",
      symbol: { ticker: "T" },
      period: { span: 1, type: "minute" },
      callback: liveCb,
    } as never);
    await Promise.resolve();

    replay.active.current = true;
    const replayCb = vi.fn();
    await loader.getBars({
      type: "init",
      symbol: { ticker: "T" },
      period: { span: 1, type: "minute" },
      callback: replayCb,
    } as never);
    expect(replayCb).toHaveBeenCalledTimes(1);
    const [data] = replayCb.mock.calls[0];
    expect(data).toHaveLength(5);

    // The live init resolves late — it must NOT wipe the replayed prefix.
    resolveLive(bars(20));
    await liveDone;
    expect(liveCb).not.toHaveBeenCalled();
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
