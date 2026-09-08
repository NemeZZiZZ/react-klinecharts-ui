import { describe, it, expect, vi, type Mock } from "vitest";
import { render, act } from "@testing-library/react";
import { useEffect, type MutableRefObject } from "react";
import { KlinechartsUIProvider } from "../provider/ChartTerminalProvider";
import { useKlinechartsUIDispatch } from "../provider/ChartTerminalContext";
import type { Datafeed, KlinechartsUIAction } from "../provider/types";
import type { SymbolInfo } from "klinecharts";
import type { TerminalPeriod } from "../data/periods";
import type { Dispatch } from "react";
import type { KLineData } from "klinecharts";
import { useWatchlist, type UseWatchlistReturn } from "./useWatchlist";
import { fakeDatafeed } from "../../test/renderHook";

const BAR: KLineData = {
  timestamp: 1000,
  open: 100,
  high: 105,
  low: 99,
  close: 103,
  volume: 10,
};

type SubscribeMock = Mock<
  (
    symbol: SymbolInfo,
    period: TerminalPeriod,
    callback: (bar: KLineData) => void,
  ) => void
>;
type UnsubscribeMock = Mock<
  (symbol: SymbolInfo, period: TerminalPeriod) => void
>;

function spyFeed(): Datafeed & {
  subscribe: SubscribeMock;
  unsubscribe: UnsubscribeMock;
} {
  const subscribe: SubscribeMock = vi.fn(() => {});
  const unsubscribe: UnsubscribeMock = vi.fn(() => {});
  return { ...fakeDatafeed(), subscribe, unsubscribe };
}

/** Child mounting one useWatchlist instance, mirrored into a ref. */
function WatchlistSlot({
  resultRef,
}: {
  resultRef: MutableRefObject<UseWatchlistReturn | null>;
}) {
  const value = useWatchlist();
  useEffect(() => {
    resultRef.current = value;
  });
  return null;
}

/** Child exposing the provider dispatch into a ref. */
function DispatchSlot({
  dispatchRef,
}: {
  dispatchRef: MutableRefObject<Dispatch<KlinechartsUIAction> | null>;
}) {
  const { dispatch } = useKlinechartsUIDispatch();
  useEffect(() => {
    dispatchRef.current = dispatch;
  });
  return null;
}

function setup(feed: Datafeed) {
  const aRef: MutableRefObject<UseWatchlistReturn | null> = { current: null };
  const bRef: MutableRefObject<UseWatchlistReturn | null> = { current: null };
  const dispatchRef: MutableRefObject<Dispatch<KlinechartsUIAction> | null> = {
    current: null,
  };
  const view = (f: Datafeed) => (
    <KlinechartsUIProvider datafeed={f}>
      <WatchlistSlot resultRef={aRef} />
      <WatchlistSlot resultRef={bRef} />
      <DispatchSlot dispatchRef={dispatchRef} />
    </KlinechartsUIProvider>
  );
  const rendered = render(view(feed));
  const need = <T,>(ref: MutableRefObject<T | null>): T => {
    if (!ref.current) throw new Error("slot ref not populated");
    return ref.current;
  };
  return {
    a: () => need(aRef),
    b: () => need(bRef),
    dispatch: () => need(dispatchRef),
    swapFeed: (f: Datafeed) => rendered.rerender(view(f)),
  };
}

describe("useWatchlist — provider-owned subscriptions", () => {
  it("two instances share one list and open ONE subscription per ticker", () => {
    const feed = spyFeed();
    const h = setup(feed);
    act(() => h.a().addSymbol("AAPL"));
    expect(h.b().items.map((i) => i.ticker)).toEqual(["AAPL"]);
    expect(feed.subscribe).toHaveBeenCalledTimes(1);
    expect(feed.subscribe).toHaveBeenCalledWith(
      { ticker: "AAPL" },
      expect.objectContaining({ span: 1, type: "minute" }),
      expect.any(Function),
    );
  });

  it("a second addSymbol for the same ticker does not resubscribe", () => {
    const feed = spyFeed();
    const h = setup(feed);
    act(() => {
      h.a().addSymbol("AAPL");
      h.b().addSymbol("AAPL");
    });
    expect(feed.subscribe).toHaveBeenCalledTimes(1);
    expect(h.a().items).toHaveLength(1);
  });

  it("ticks update every instance's rows", () => {
    const feed = spyFeed();
    const h = setup(feed);
    act(() => h.a().addSymbol("AAPL"));
    const cb = feed.subscribe.mock.calls[0][2] as (bar: KLineData) => void;
    act(() => cb(BAR));
    for (const inst of [h.a(), h.b()]) {
      expect(inst.items[0]).toMatchObject({
        ticker: "AAPL",
        lastPrice: 103,
        change: 3,
        changePercent: 3,
      });
    }
  });

  it("removeSymbol unsubscribes once and clears both lists", () => {
    const feed = spyFeed();
    const h = setup(feed);
    act(() => h.a().addSymbol("AAPL"));
    act(() => h.b().removeSymbol("AAPL"));
    expect(feed.unsubscribe).toHaveBeenCalledTimes(1);
    expect(h.a().items).toEqual([]);
    expect(h.b().items).toEqual([]);
  });

  it("a period change re-subscribes on the new timeframe (no stale-TF quotes)", () => {
    const feed = spyFeed();
    const h = setup(feed);
    act(() => h.a().addSymbol("AAPL"));
    const oldPeriod = feed.subscribe.mock.calls[0][1];
    act(() =>
      h.dispatch()({
        type: "SET_PERIOD",
        period: { span: 5, type: "minute", label: "5m" },
      }),
    );
    expect(feed.unsubscribe).toHaveBeenCalledWith({ ticker: "AAPL" }, oldPeriod);
    expect(feed.subscribe).toHaveBeenCalledTimes(2);
    expect(feed.subscribe.mock.calls[1][1]).toMatchObject({
      span: 5,
      type: "minute",
    });
    // The row survives the re-subscribe.
    expect(h.a().items.map((i) => i.ticker)).toEqual(["AAPL"]);
  });

  it("switchSymbol still drives the provider symbol", () => {
    const feed = spyFeed();
    const h = setup(feed);
    act(() => h.a().switchSymbol("AAPL"));
    expect(h.a().activeSymbol).toBe("AAPL");
    expect(h.b().activeSymbol).toBe("AAPL");
  });

  it("a throwing subscribe does not zombie-block a later retry", () => {
    const feed = spyFeed();
    feed.subscribe.mockImplementationOnce(() => {
      throw new Error("feed down");
    });
    const h = setup(feed);
    // First attempt throws inside the provider — the hook surfaces nothing,
    // but crucially no subs-map entry is left behind.
    act(() => h.a().addSymbol("AAPL"));
    expect(h.a().items).toEqual([]);
    // Retry with a healthy feed: must subscribe again (not short-circuited
    // by a stale subs entry).
    act(() => h.a().addSymbol("AAPL"));
    expect(feed.subscribe).toHaveBeenCalledTimes(2);
    expect(h.a().items.map((i) => i.ticker)).toEqual(["AAPL"]);
  });

  it("a datafeed swap moves ALL subscriptions to the new feed (R1 regression)", () => {
    const feedA = spyFeed();
    const h = setup(feedA);
    act(() => {
      h.a().addSymbol("AAPL");
      h.a().addSymbol("MSFT");
    });
    expect(feedA.subscribe).toHaveBeenCalledTimes(2);

    const feedB = spyFeed();
    act(() => h.swapFeed(feedB));
    // Both tickers re-subscribed on B and unsubscribed on A — the previous
    // in-loop feedRef assignment short-circuited every ticker after the
    // first, leaving it silently subscribed to the old feed.
    expect(feedA.unsubscribe).toHaveBeenCalledTimes(2);
    expect(feedB.subscribe).toHaveBeenCalledTimes(2);
    expect(h.a().items.map((i) => i.ticker).sort()).toEqual(["AAPL", "MSFT"]);
  });
});
