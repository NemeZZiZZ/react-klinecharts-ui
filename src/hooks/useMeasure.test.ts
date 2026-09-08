import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";
import type { KLineData } from "klinecharts";
import { renderHookWithProvider } from "../../test/renderHook";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";
import { createMockChart } from "../../test/mockChart";
import { useMeasure } from "./useMeasure";

const bars = (base: number): KLineData[] =>
  Array.from({ length: 5 }, (_, i) => ({
    timestamp: base + i * 60,
    open: 10 + i,
    high: 12 + i,
    low: 9 + i,
    close: 11 + i,
    volume: 10,
  }));

function useMeasureWithDispatch() {
  const measure = useMeasure();
  const { dispatch } = useKlinechartsUI();
  return { ...measure, dispatch };
}

/** Pull the onDrawEnd closure the hook handed to createOverlay. */
function drawEndOf(chart: { createOverlay: { mock: { calls: unknown[][] } } }) {
  const cfg = chart.createOverlay.mock.calls[0][0] as {
    onDrawEnd: (event: unknown) => void;
  };
  return cfg.onDrawEnd;
}

const DRAW_EVENT = {
  overlay: {
    points: [
      { dataIndex: 0, value: 10 },
      { dataIndex: 2, value: 12 },
    ],
  },
};

describe("useMeasure", () => {
  it("computes the result from the drawn segment", () => {
    const { result, chart } = renderHookWithProvider(() => useMeasure(), {
      initialData: bars(1000),
    });
    act(() => result.current.startMeasure());
    expect(result.current.isActive).toBe(true);
    act(() => drawEndOf(chart)(DRAW_EVENT));
    expect(result.current.isActive).toBe(false);
    expect(result.current.result).toMatchObject({
      priceDiff: 2,
      bars: 2,
      from: { timestamp: 1000, barIndex: 0 },
      to: { timestamp: 1120, barIndex: 2 },
    });
  });

  it("onDrawEnd measures against the CURRENT chart, not the one from startMeasure time", () => {
    const { result, chart } = renderHookWithProvider(
      () => useMeasureWithDispatch(),
      { initialData: bars(1000) },
    );
    act(() => result.current.startMeasure());
    const onDrawEnd = drawEndOf(chart);
    // Swap the chart before the user finishes the second click.
    act(() =>
      result.current.dispatch({
        type: "SET_CHART",
        chart: createMockChart(bars(5000)) as never,
      } as never),
    );
    act(() => onDrawEnd(DRAW_EVENT));
    // Timestamps from the NEW chart's data — the old closure's chart is gone.
    expect(result.current.result?.from.timestamp).toBe(5000);
    expect(result.current.result?.to.timestamp).toBe(5120);
  });
});
