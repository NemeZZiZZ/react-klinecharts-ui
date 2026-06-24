import { useCallback } from "react";
import type { XAxisOverride, YAxisOverride } from "react-klinecharts";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";

export type { XAxisOverride, YAxisOverride } from "react-klinecharts";

export interface UseChartAxesReturn {
  /**
   * Override the main pane's X (time) axis — e.g. `scrollZoomEnabled`,
   * `name`, or a custom `createTicks` generator. Added in klinecharts
   * 10.0.0-beta2.
   */
  overrideXAxis: (override: XAxisOverride) => void;
  /**
   * Override a Y (value) axis — e.g. `reverse` to flip the price scale,
   * `inside` to draw labels inside the pane, `position`, or a custom
   * `createRange` / `createTicks`. Target a specific axis with `id` / `paneId`.
   * Added in klinecharts 10.0.0-beta2.
   */
  overrideYAxis: (override: YAxisOverride) => void;
}

// klinecharts 10.0.0-beta3 ships these two instance methods with their
// parameter types crossed in the published `.d.ts` (`overrideXAxis` is typed to
// accept `YAxisOverride` and vice-versa). The runtime is correct, so we cast
// through this shape to expose semantically-correct signatures to consumers.
type AxisOverrideChart = {
  overrideXAxis: (override: XAxisOverride) => void;
  overrideYAxis: (override: YAxisOverride) => void;
};

/**
 * Headless hook for overriding the chart's built-in X / Y axes (klinecharts
 * v10 `overrideXAxis` / `overrideYAxis`). For binding indicators to additional
 * secondary Y-axes, use {@link useIndicators} instead.
 */
export function useChartAxes(): UseChartAxesReturn {
  const { state } = useKlinechartsUI();

  const overrideXAxis = useCallback(
    (override: XAxisOverride) => {
      if (!state.chart) return;
      (state.chart as unknown as AxisOverrideChart).overrideXAxis(override);
    },
    [state.chart],
  );

  const overrideYAxis = useCallback(
    (override: YAxisOverride) => {
      if (!state.chart) return;
      (state.chart as unknown as AxisOverrideChart).overrideYAxis(override);
    },
    [state.chart],
  );

  return { overrideXAxis, overrideYAxis };
}
