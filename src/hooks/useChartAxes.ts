import { useCallback } from "react";
import type { XAxisOverride, YAxisOverride, YAxisFilter, YAxis, Nullable } from "klinecharts";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";

export type { XAxisOverride, YAxisOverride, YAxisFilter, YAxis } from "klinecharts";

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
  /**
   * Create a standalone Y axis on a pane (klinecharts v10 multi-YAxis support).
   * Returns the new axis id, or `null` on failure. `createYAxis` is idempotent
   * per axis `id`: re-creating an existing axis is a no-op. Added in klinecharts
   * 10.0.0.
   */
  createYAxis: (yAxis: YAxisOverride) => Nullable<string>;
  /**
   * Remove Y axes matching the filter (by `id`, `paneId`, and/or `name`).
   * Returns `true` if at least one axis was removed. Added in klinecharts 10.0.0.
   */
  removeYAxis: (filter: YAxisFilter) => boolean;
  /**
   * Read the Y axes currently on the chart, optionally filtered by `id` /
   * `paneId` / `name`. Added in klinecharts 10.0.0.
   */
  getYAxes: (filter?: YAxisFilter) => YAxis[];
}

// klinecharts 10.0.0 ships `overrideXAxis` / `overrideYAxis` with their
// parameter types crossed in the published `.d.ts` (`overrideXAxis` is typed to
// accept `YAxisOverride` and vice-versa). The runtime is correct, so we cast
// through this shape to expose semantically-correct signatures to consumers.
// Verified still present in the 10.0.0 stable release.
type AxisOverrideChart = {
  overrideXAxis: (override: XAxisOverride) => void;
  overrideYAxis: (override: YAxisOverride) => void;
  createYAxis: (yAxis: YAxisOverride) => Nullable<string>;
  removeYAxis: (filter: YAxisFilter) => boolean;
  getYAxes: (filter: YAxisFilter) => YAxis[];
};

/**
 * Headless hook for the chart's X / Y axes (klinecharts v10 `overrideXAxis` /
 * `overrideYAxis` plus the 10.0.0 multi-YAxis management API:
 * `createYAxis` / `removeYAxis` / `getYAxes`). For binding indicators to
 * additional secondary Y-axes, use {@link useIndicators} instead.
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

  const createYAxis = useCallback(
    (yAxis: YAxisOverride) => {
      if (!state.chart) return null;
      return (state.chart as unknown as AxisOverrideChart).createYAxis(yAxis);
    },
    [state.chart],
  );

  const removeYAxis = useCallback(
    (filter: YAxisFilter) => {
      if (!state.chart) return false;
      return (state.chart as unknown as AxisOverrideChart).removeYAxis(filter);
    },
    [state.chart],
  );

  const getYAxes = useCallback(
    (filter?: YAxisFilter) => {
      if (!state.chart) return [];
      return (state.chart as unknown as AxisOverrideChart).getYAxes(
        filter ?? {},
      );
    },
    [state.chart],
  );

  return { overrideXAxis, overrideYAxis, createYAxis, removeYAxis, getYAxes };
}
