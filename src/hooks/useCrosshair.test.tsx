/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useEffect } from "react";
import type { ReactNode } from "react";
import type { KLineData } from "klinecharts";
import { renderHookWithProvider } from "../../test/renderHook";
import {
  createMockChart,
  emitAction,
  type MockChart,
} from "../../test/mockChart";
import { fakeDatafeed } from "../../test/renderHook";
import { KlinechartsUIProvider } from "../provider/ChartTerminalProvider";
import { useKlinechartsUIDispatch } from "../provider/ChartTerminalContext";
import { useCrosshair } from "./useCrosshair";

const bars: KLineData[] = [
  { timestamp: 1000, open: 10, high: 12, low: 9, close: 11, volume: 100 },
  { timestamp: 2000, open: 11, high: 13, low: 10, close: 12.5, volume: 120 },
  { timestamp: 3000, open: 12.5, high: 14, low: 12, close: 13, volume: 90 },
];

/** Renders the hook against a chart the test configured BEFORE mount. */
function renderWithChart(chart: MockChart) {
  const SetChart = () => {
    const { dispatch } = useKlinechartsUIDispatch();
    useEffect(() => {
      dispatch({ type: "SET_CHART", chart: chart as never } as never);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  };

  const wrapper = ({ children }: { children: ReactNode }) => (
    <KlinechartsUIProvider datafeed={fakeDatafeed(bars)}>
      <SetChart />
      {children}
    </KlinechartsUIProvider>
  );

  return renderHook(() => useCrosshair(), { wrapper });
}

/** The hook throttles through requestAnimationFrame — let the frame run. */
async function flushFrame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

async function emit(chart: any, event: unknown) {
  await act(async () => {
    emitAction(chart, "onCrosshairChange", event);
  });
  await flushFrame();
}

describe("useCrosshair", () => {
  it("resolves the bar from the pixel — kLineData is never delivered", async () => {
    const { result, chart } = renderHookWithProvider(() => useCrosshair(), {
      initialData: bars,
    });
    chart.__setData(bars);
    chart.convertFromPixel.mockReturnValue([{ dataIndex: 1, timestamp: 2000 }]);

    await emit(chart, { x: 120, y: 40, paneId: "candle_pane" });

    expect(chart.convertFromPixel).toHaveBeenCalledWith([{ x: 120 }], {
      paneId: "candle_pane",
    });
    expect(result.current.barData).toMatchObject({
      open: 11,
      high: 13,
      low: 10,
      close: 12.5,
      volume: 120,
      timestamp: 2000,
    });
    expect(result.current.barData!.change).toBe(1.5);
    expect(result.current.barData!.changePercent).toBeCloseTo(13.64, 1);
  });

  it("reads kLineData off the event when a caller supplies it", async () => {
    const { result, chart } = renderHookWithProvider(() => useCrosshair(), {
      initialData: bars,
    });
    chart.__setData(bars);

    await emit(chart, { x: 120, y: 40, kLineData: bars[2] });

    expect(chart.convertFromPixel).not.toHaveBeenCalled();
    expect(result.current.barData).toMatchObject({ timestamp: 3000 });
  });

  it("reports null when the pixel maps to no bar", async () => {
    const { result, chart } = renderHookWithProvider(() => useCrosshair(), {
      initialData: bars,
    });
    chart.__setData(bars);
    // klinecharts returns a point without dataIndex when there is no bar.
    chart.convertFromPixel.mockReturnValue([{}]);

    await emit(chart, { x: 120, y: 40, paneId: "candle_pane" });

    expect(result.current.barData).toBeNull();
  });

  it("reports null when the resolved index is outside the loaded history", async () => {
    const { result, chart } = renderHookWithProvider(() => useCrosshair(), {
      initialData: bars,
    });
    chart.__setData(bars);
    chart.convertFromPixel.mockReturnValue([{ dataIndex: 99 }]);

    await emit(chart, { x: 120, y: 40, paneId: "candle_pane" });

    expect(result.current.barData).toBeNull();
  });

  it("reports null when the crosshair carries no x", async () => {
    const { result, chart } = renderHookWithProvider(() => useCrosshair(), {
      initialData: bars,
    });
    chart.__setData(bars);

    await emit(chart, { paneId: "candle_pane" });

    expect(chart.convertFromPixel).not.toHaveBeenCalled();
    expect(result.current.barData).toBeNull();
  });

  it("clears when the cursor leaves the chart (klinecharts emits no event)", async () => {
    const container = document.createElement("div");
    const chart = createMockChart(bars);
    chart.getDom.mockReturnValue(container);
    chart.convertFromPixel.mockReturnValue([{ dataIndex: 1 }]);

    const { result } = renderWithChart(chart);
    await emit(chart, { x: 120, y: 40, paneId: "candle_pane" });
    expect(result.current.barData).not.toBeNull();

    await act(async () => {
      container.dispatchEvent(new MouseEvent("mouseleave"));
    });

    expect(result.current.barData).toBeNull();
  });

  it("detaches the mouseleave listener on unmount", async () => {
    const container = document.createElement("div");
    const chart = createMockChart(bars);
    chart.getDom.mockReturnValue(container);
    chart.convertFromPixel.mockReturnValue([{ dataIndex: 1 }]);

    const removeSpy = vi.spyOn(container, "removeEventListener");
    const { unmount } = renderWithChart(chart);
    await emit(chart, { x: 120, y: 40, paneId: "candle_pane" });
    unmount();

    expect(removeSpy).toHaveBeenCalledWith("mouseleave", expect.any(Function));
    removeSpy.mockRestore();
  });

  it("falls back to the default pane id", async () => {
    const { chart } = renderHookWithProvider(() => useCrosshair(), {
      initialData: bars,
    });
    chart.__setData(bars);
    chart.convertFromPixel.mockReturnValue([{ dataIndex: 0 }]);

    await emit(chart, { x: 10 });

    expect(chart.convertFromPixel).toHaveBeenCalledWith([{ x: 10 }], {
      paneId: "candle_pane",
    });
  });
});
