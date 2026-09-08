import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";
import type { KLineData } from "klinecharts";
import { renderHookWithProvider } from "../../test/renderHook";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";
import { createMockChart } from "../../test/mockChart";
import { useOrderLines } from "./useOrderLines";

const bars = (base: number): KLineData[] =>
  Array.from({ length: 5 }, (_, i) => ({
    timestamp: base + i * 60,
    open: 10 + i,
    high: 12 + i,
    low: 9 + i,
    close: 11 + i,
    volume: 10,
  }));

function useOrderLinesWithDispatch() {
  const lines = useOrderLines();
  const { dispatch } = useKlinechartsUI();
  return { ...lines, dispatch };
}

describe("useOrderLines", () => {
  it("updateOrderLine persists into the reconciliation state (R13)", () => {
    const { result, chart } = renderHookWithProvider(
      () => useOrderLinesWithDispatch(),
      { initialData: bars(1000) },
    );
    let id: string | null = null;
    act(() => {
      id = result.current.createOrderLine({ price: 100 });
    });
    expect(id).not.toBeNull();

    act(() => result.current.updateOrderLine(id!, { price: 250, draggable: true }));

    // Swap the chart: the reconciliation effect recreates the line from the
    // TRACKED options. Without the updateOrderLine → linesRef sync the
    // recreated line reverted to price 100 and lock: true.
    const chart2 = createMockChart(bars(2000));
    act(() =>
      result.current.dispatch({ type: "SET_CHART", chart: chart2 } as never),
    );

    const recreated = (chart2.createOverlay.mock.calls as unknown[][])
      .map((c) => c[0] as Record<string, unknown>)
      .find((cfg) => cfg.id === id);
    expect(recreated).toBeDefined();
    expect(recreated!.points).toEqual([
      { timestamp: 2240, value: 250 },
    ]);
    expect(recreated!.lock).toBe(false);
    // Old chart dropped the line via the unmount/chart-swap cleanup.
    expect(chart.removeOverlay).toHaveBeenCalledWith({ id });
  });
});
