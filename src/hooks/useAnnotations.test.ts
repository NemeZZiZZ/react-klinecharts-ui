import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";
import type { KLineData } from "klinecharts";
import { renderHookWithProvider } from "../../test/renderHook";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";
import { createMockChart } from "../../test/mockChart";
import { useAnnotations } from "./useAnnotations";

const bars = (base: number): KLineData[] =>
  Array.from({ length: 5 }, (_, i) => ({
    timestamp: base + i * 60,
    open: 10 + i,
    high: 12 + i,
    low: 9 + i,
    close: 11 + i,
    volume: 10,
  }));

function useAnnotationsWithDispatch() {
  const annotations = useAnnotations();
  const { dispatch } = useKlinechartsUI();
  return { ...annotations, dispatch };
}

describe("useAnnotations", () => {
  it("updateAnnotation edits survive a chart remount (R14)", () => {
    const { result } = renderHookWithProvider(
      () => useAnnotationsWithDispatch(),
      { initialData: bars(1000) },
    );
    let id = "";
    act(() => {
      id = result.current.addAnnotation("hello", 100, 1000);
    });

    // Update while the chart is unavailable: overrideOverlay is skipped, and
    // before the fix the remount reconciliation recreated the stale overlay.
    const chart2 = createMockChart(bars(2000));
    act(() =>
      result.current.dispatch({ type: "SET_CHART", chart: null } as never),
    );
    act(() =>
      result.current.updateAnnotation(id, { text: "edited", color: "#f00" }),
    );
    act(() =>
      result.current.dispatch({ type: "SET_CHART", chart: chart2 } as never),
    );

    const recreated = (chart2.createOverlay.mock.calls as unknown[][])
      .map((c) => c[0] as Record<string, unknown>)
      .find((cfg) => cfg.id === id);
    expect(recreated).toBeDefined();
    expect(recreated!.extendData).toBe("edited");
    expect(recreated!.styles).toEqual({ text: { color: "#f00" } });
  });
});
