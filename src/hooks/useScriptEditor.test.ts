import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";
import type { KLineData } from "klinecharts";
import { renderHookWithProvider } from "../../test/renderHook";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";
import { createMockChart } from "../../test/mockChart";
import { useScriptEditor } from "./useScriptEditor";

const BARS: KLineData[] = Array.from({ length: 30 }, (_, i) => ({
  timestamp: 1000 + i * 60,
  open: 100 + i,
  high: 102 + i,
  low: 99 + i,
  close: 101 + i,
  volume: 10,
}));

function useEditorWithDispatch() {
  const editor = useScriptEditor();
  const { dispatch } = useKlinechartsUI();
  return { ...editor, dispatch };
}

describe("useScriptEditor — chart-bound active script", () => {
  it("runScript marks a script active on the current chart", () => {
    const { result, chart } = renderHookWithProvider(
      () => useScriptEditor(),
      { initialData: BARS },
    );
    expect(result.current.hasActiveScript).toBe(false);
    act(() => result.current.runScript());
    expect(result.current.error).toBe("");
    expect(result.current.hasActiveScript).toBe(true);
    expect(chart.createIndicator).toHaveBeenCalled();
  });

  it("a chart swap deactivates the script (ids pointed at the old chart)", () => {
    const { result } = renderHookWithProvider(() => useEditorWithDispatch(), {
      initialData: BARS,
    });
    act(() => result.current.runScript());
    expect(result.current.hasActiveScript).toBe(true);
    act(() =>
      result.current.dispatch({
        type: "SET_CHART",
        chart: createMockChart(BARS) as never,
      } as never),
    );
    // The new chart instance has none of our indicators — the UI must not
    // claim a live script whose id belongs to the discarded chart.
    expect(result.current.hasActiveScript).toBe(false);
  });

  it("removeScript after a swap does not touch the new chart", () => {
    const { result } = renderHookWithProvider(() => useEditorWithDispatch(), {
      initialData: BARS,
    });
    act(() => result.current.runScript());
    const next = createMockChart(BARS);
    act(() =>
      result.current.dispatch({
        type: "SET_CHART",
        chart: next as never,
      } as never),
    );
    expect(() => act(() => result.current.removeScript())).not.toThrow();
    expect(next.removeIndicator).not.toHaveBeenCalled();
  });

  it("re-running removes the previous indicator from the same chart", () => {
    const { result, chart } = renderHookWithProvider(
      () => useScriptEditor(),
      { initialData: BARS },
    );
    act(() => result.current.runScript());
    act(() => result.current.runScript());
    // Second run tears down the first run's indicator before re-adding.
    expect(chart.removeIndicator).toHaveBeenCalled();
    expect(result.current.hasActiveScript).toBe(true);
  });
});
