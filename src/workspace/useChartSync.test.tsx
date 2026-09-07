/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { render, act } from "@testing-library/react";
import { useEffect } from "react";
import type { KLineData } from "klinecharts";
import { WorkspaceProvider, useWorkspace, type ChartCell } from "./index";
import type { SyncConfig } from "./types";
import { useChartSync } from "./useChartSync";
import { KlinechartsUIProvider } from "../provider/ChartTerminalProvider";
import { useKlinechartsUIDispatch } from "../provider/ChartTerminalContext";
import {
  createMockChart,
  emitAction,
  type MockChart,
} from "../../test/mockChart";
import { fakeDatafeed } from "../../test/renderHook";

const cell = (id: string): ChartCell => ({
  id,
  symbol: { ticker: id, pricePrecision: 2 },
  period: { span: 1, type: "minute", label: "1m" },
});

const bars = (count: number, start = 1000, step = 60): KLineData[] =>
  Array.from({ length: count }, (_, i) => ({
    timestamp: start + i * step,
    open: 1,
    high: 2,
    low: 0.5,
    close: 1.5,
    volume: 10,
  }));

/** Injects the source chart into the provider, then runs the sync hook. */
function Bridge({ cellId, chart }: { cellId: string; chart: MockChart }) {
  const { dispatch } = useKlinechartsUIDispatch();
  useEffect(() => {
    dispatch({ type: "SET_CHART", chart: chart as never } as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart]);
  useChartSync({ cellId });
  return null;
}

/** Registers a sibling chart under another cell id. */
function Register({ id, chart }: { id: string; chart: MockChart }) {
  const { chartsRef } = useWorkspace();
  useEffect(() => {
    chartsRef.current.set(id, chart as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, chart]);
  return null;
}

function Scene({
  source,
  target,
  sync,
}: {
  source: MockChart;
  target: MockChart;
  sync?: SyncConfig;
}) {
  return (
    <WorkspaceProvider defaultCells={[cell("a"), cell("b")]} sync={sync}>
      <KlinechartsUIProvider datafeed={fakeDatafeed()}>
        <Register id="b" chart={target} />
        <Bridge cellId="a" chart={source} />
      </KlinechartsUIProvider>
    </WorkspaceProvider>
  );
}

describe("useChartSync — crosshair mirrors TIME, not pixels", () => {
  it("converts the source pixel to a timestamp and back to the target's pixel", () => {
    const source = createMockChart(bars(50));
    const target = createMockChart(bars(50, 1000, 300)); // different timeframe
    source.convertFromPixel.mockReturnValue([
      { dataIndex: 7, timestamp: 1420 },
    ]);
    target.convertToPixel.mockReturnValue({ x: 321 });

    render(<Scene source={source} target={target} />);
    act(() => {
      emitAction(source, "onCrosshairChange", {
        x: 100,
        y: 40,
        paneId: "candle_pane",
      });
    });

    expect(source.convertFromPixel).toHaveBeenCalledWith([{ x: 100 }], {
      paneId: "candle_pane",
    });
    expect(target.convertToPixel).toHaveBeenCalledWith(
      { timestamp: 1420 },
      {
        paneId: "candle_pane",
      },
    );
    // The target's OWN pixel for that moment — never the source's x, and no y.
    expect(target.executeAction).toHaveBeenCalledWith("onCrosshairChange", {
      x: 321,
      paneId: "candle_pane",
    });
  });

  it("does not forward the raw crosshair object (pixel + y)", () => {
    const source = createMockChart(bars(50));
    const target = createMockChart(bars(50));
    source.convertFromPixel.mockReturnValue([{ timestamp: 1420 }]);
    target.convertToPixel.mockReturnValue({ x: 12 });

    render(<Scene source={source} target={target} />);
    act(() => {
      emitAction(source, "onCrosshairChange", {
        x: 100,
        y: 40,
        paneId: "candle_pane",
      });
    });

    const call = target.executeAction.mock.calls[0];
    expect(call[1]).not.toHaveProperty("y");
    expect(call[1].x).not.toBe(100);
  });

  it("skips the broadcast when the pixel maps to no timestamp", () => {
    const source = createMockChart(bars(50));
    const target = createMockChart(bars(50));
    // klinecharts returns an empty point when there is no bar under the cursor.
    source.convertFromPixel.mockReturnValue([{}]);

    render(<Scene source={source} target={target} />);
    act(() => {
      emitAction(source, "onCrosshairChange", { x: 100, y: 40 });
    });

    expect(target.convertToPixel).not.toHaveBeenCalled();
    expect(target.executeAction).not.toHaveBeenCalled();
  });

  it("skips the broadcast when the source crosshair has no x", () => {
    const source = createMockChart(bars(50));
    const target = createMockChart(bars(50));

    render(<Scene source={source} target={target} />);
    act(() => {
      emitAction(source, "onCrosshairChange", { paneId: "candle_pane" });
    });

    expect(source.convertFromPixel).not.toHaveBeenCalled();
    expect(target.executeAction).not.toHaveBeenCalled();
  });

  it("falls back to candle_pane when the sibling has no such pane", () => {
    const source = createMockChart(bars(50));
    const target = createMockChart(bars(50));
    source.convertFromPixel.mockReturnValue([{ timestamp: 1420 }]);
    target.convertToPixel.mockImplementation((_p: unknown, filter: any) =>
      filter?.paneId === "candle_pane" ? { x: 77 } : {},
    );

    render(<Scene source={source} target={target} />);
    act(() => {
      emitAction(source, "onCrosshairChange", { x: 100, paneId: "pane_1" });
    });

    expect(target.executeAction).toHaveBeenCalledWith("onCrosshairChange", {
      x: 77,
      paneId: "candle_pane",
    });
  });

  it("does nothing when the crosshair channel is disabled", () => {
    const source = createMockChart(bars(50));
    const target = createMockChart(bars(50));
    source.convertFromPixel.mockReturnValue([{ timestamp: 1420 }]);

    render(
      <Scene source={source} target={target} sync={{ crosshair: false }} />,
    );
    act(() => {
      emitAction(source, "onCrosshairChange", { x: 100, y: 40 });
    });

    expect(target.executeAction).not.toHaveBeenCalled();
  });
});

describe("useChartSync — scroll mirrors the right edge by timestamp", () => {
  it("sends the right-edge bar's timestamp, not the bar index", () => {
    const source = createMockChart(bars(10));
    const target = createMockChart(bars(10));
    source.getVisibleRange.mockReturnValue({
      from: 0,
      to: 5,
      realFrom: 0,
      realTo: 5,
    });

    render(<Scene source={source} target={target} />);
    act(() => {
      emitAction(source, "onScroll", { distance: 12 });
    });

    // realTo is EXCLUSIVE: the right-most visible bar is index 4 → 1000 + 4*60.
    expect(target.scrollToTimestamp).toHaveBeenCalledWith(1240, 0);
    // The old bug: the bar index was handed to scrollToTimestamp as if it were
    // a timestamp, so binarySearchNearest always picked the first bar.
    expect(target.scrollToTimestamp).not.toHaveBeenCalledWith(5, 0);
  });

  it("clamps to the last bar when scrolled into the future", () => {
    const source = createMockChart(bars(10));
    const target = createMockChart(bars(10));
    source.getVisibleRange.mockReturnValue({
      from: 6,
      to: 10,
      realFrom: 6,
      realTo: 14,
    });

    render(<Scene source={source} target={target} />);
    act(() => {
      emitAction(source, "onScroll", { distance: 12 });
    });

    expect(target.scrollToTimestamp).toHaveBeenCalledWith(1540, 0); // index 9
  });

  it("skips the broadcast when the source has no data", () => {
    const source = createMockChart();
    const target = createMockChart(bars(10));
    source.getVisibleRange.mockReturnValue({
      from: 0,
      to: 0,
      realFrom: 0,
      realTo: 5,
    });

    render(<Scene source={source} target={target} />);
    act(() => {
      emitAction(source, "onScroll", { distance: 12 });
    });

    expect(target.scrollToTimestamp).not.toHaveBeenCalled();
  });

  it("does nothing when the scroll channel is disabled", () => {
    const source = createMockChart(bars(10));
    const target = createMockChart(bars(10));
    source.getVisibleRange.mockReturnValue({
      from: 0,
      to: 5,
      realFrom: 0,
      realTo: 5,
    });

    render(<Scene source={source} target={target} sync={{ scroll: false }} />);
    act(() => {
      emitAction(source, "onScroll", { distance: 12 });
    });

    expect(target.scrollToTimestamp).not.toHaveBeenCalled();
  });
});

describe("useChartSync — zoom", () => {
  it("mirrors the source bar space to siblings", () => {
    const source = createMockChart(bars(10));
    const target = createMockChart(bars(10));
    source.getBarSpace.mockReturnValue({ bar: 12, halfBar: 6, gapBar: 2 });

    render(<Scene source={source} target={target} />);
    act(() => {
      emitAction(source, "onZoom");
    });

    expect(target.setBarSpace).toHaveBeenCalledWith(12);
  });
});
