import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render } from "@testing-library/react";
import { useEffect, type MutableRefObject } from "react";
import type { KLineData } from "klinecharts";
import { KlinechartsUIProvider } from "./ChartTerminalProvider";
import { useKlinechartsUI } from "./ChartTerminalContext";
import type { Datafeed, KlinechartsUIAction, KlinechartsUIState } from "./types";
import { createMockChart } from "../../test/mockChart";

const idleDatafeed: Datafeed = {
  searchSymbols: async () => [],
  getHistoryKLineData: async () => [],
  subscribe: () => {},
  unsubscribe: () => {},
};

function bar(
  timestamp: number,
  close: number,
  high = close,
  low = close,
): KLineData {
  return { timestamp, open: close, close, high, low, volume: 1 } as KLineData;
}

/** Mirrors the provider state into a ref so the test can assert on alerts. */
function StateProbe({
  stateRef,
}: {
  stateRef: MutableRefObject<KlinechartsUIState | null>;
}) {
  const { state } = useKlinechartsUI();
  useEffect(() => {
    stateRef.current = state;
  });
  return null;
}

function Harness({
  data,
  price,
  condition = "crossing_up",
  stateRef,
}: {
  data: KLineData[];
  price: number;
  condition?: "crossing_up" | "crossing_down" | "crossing";
  stateRef: MutableRefObject<KlinechartsUIState | null>;
}) {
  const { dispatch } = useKlinechartsUI();
  useEffect(() => {
    dispatch({
      type: "SET_CHART",
      chart: createMockChart(data) as never,
    } as KlinechartsUIAction);
    dispatch({
      type: "ADD_ALERT",
      alert: {
        id: "a1",
        price,
        condition,
        triggered: false,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <StateProbe stateRef={stateRef} />;
}

function renderPoller(
  data: KLineData[],
  price: number,
  condition?: "crossing_up" | "crossing_down" | "crossing",
) {
  const stateRef: MutableRefObject<KlinechartsUIState | null> = { current: null };
  render(
    <KlinechartsUIProvider datafeed={idleDatafeed}>
      <Harness data={data} price={price} condition={condition} stateRef={stateRef} />
    </KlinechartsUIProvider>,
  );
  return stateRef;
}

describe("provider alert poller", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires when the wick touched the level but the close came back below it", () => {
    vi.useFakeTimers();
    // Previous (final) bar closed at 99 — below the 100 level. The forming bar
    // wicked up to 102 and is currently printing 98: the level WAS crossed
    // inside the bar. Regression: the poller only sampled `close`, so 98 < 100
    // read as "never crossed" and the alert stayed silent forever.
    const state = renderPoller(
      [bar(1, 99), bar(2, 98, 102, 97)],
      100,
      "crossing_up",
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(state.current!.alerts[0]!.triggered).toBe(true);
  });

  it("fires on a crossing_down when the wick dipped under the level", () => {
    vi.useFakeTimers();
    const state = renderPoller(
      [bar(1, 101), bar(2, 103, 104, 97)],
      100,
      "crossing_down",
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(state.current!.alerts[0]!.triggered).toBe(true);
  });

  it("does not fire when the level was never reached", () => {
    vi.useFakeTimers();
    const state = renderPoller([bar(1, 99), bar(2, 98, 102, 97)], 500);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(state.current!.alerts[0]!.triggered).toBe(false);
  });

  it("does not fire when the price stayed on the same side of the level", () => {
    vi.useFakeTimers();
    // Both the baseline (99) and the current bar (98, high 99.5) are below the
    // 100 level — no crossing happened, only proximity.
    const state = renderPoller([bar(1, 99), bar(2, 98, 99.5, 97)], 100);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(state.current!.alerts[0]!.triggered).toBe(false);
  });
});
