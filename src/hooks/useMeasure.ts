import { useCallback, useEffect } from "react";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";
import type { MeasurePoint, MeasureResult } from "../provider/featureTypes";

export type { MeasurePoint, MeasureResult } from "../provider/featureTypes";

export interface UseMeasureReturn {
  /** Whether measure mode is active (waiting for clicks) */
  isActive: boolean;
  /** Start measure mode — next two clicks on chart set from/to */
  startMeasure: () => void;
  /** Cancel measure mode */
  cancelMeasure: () => void;
  /** Current measurement result (null until both points are set) */
  result: MeasureResult | null;
  /** Clear the current measurement */
  clearResult: () => void;
  /** First point (set after first click) */
  fromPoint: MeasurePoint | null;
}

const MEASURE_OVERLAY_ID = "__measure_line__";

function computeResult(from: MeasurePoint, to: MeasurePoint): MeasureResult {
  const priceDiff = to.price - from.price;
  const pricePercent = from.price !== 0 ? (priceDiff / from.price) * 100 : 0;
  const bars = Math.abs(to.barIndex - from.barIndex);
  const timeDiff = Math.abs(to.timestamp - from.timestamp);
  return { from, to, priceDiff, pricePercent, bars, timeDiff };
}

/**
 * Headless hook for measuring distance/time/percentage between two points.
 *
 * Activates measure mode, captures two clicks on the chart via overlay
 * interaction, then computes price diff, %, bar count, and time diff. The
 * measure state (active/from/result) lives in the shared provider store, so a
 * toolbar toggle and a separate result-readout panel stay in sync no matter
 * where each is mounted.
 */
export function useMeasure(): UseMeasureReturn {
  const { state, dispatch } = useKlinechartsUI();
  const { isActive, fromPoint, result } = state.measure;

  const cleanup = useCallback(() => {
    state.chart?.removeOverlay({ id: MEASURE_OVERLAY_ID });
  }, [state.chart]);

  const startMeasure = useCallback(() => {
    cleanup();
    dispatch({
      type: "SET_MEASURE",
      measure: { isActive: true, fromPoint: null, result: null },
    });

    if (!state.chart) return;

    // Create a segment overlay that the user draws by clicking two points.
    // The onDrawEnd callback fires when the user finishes placing both points.
    state.chart.createOverlay({
      name: "segment",
      id: MEASURE_OVERLAY_ID,
      groupId: "measure",
      styles: {
        line: {
          style: "dashed" as any,
          color: "#FFD600",
          size: 1,
        },
      },
      lock: true,
      onDrawEnd: (event: any) => {
        const overlay = event?.overlay;
        const points = overlay?.points;
        if (!points || points.length < 2) return;

        const chart = state.chart;
        if (!chart) return;

        const dataList = chart.getDataList();
        if (!dataList || dataList.length === 0) return;

        const makePoint = (p: any): MeasurePoint => {
          const idx = Math.max(
            0,
            Math.min(p.dataIndex ?? 0, dataList.length - 1),
          );
          const bar = dataList[idx];
          return {
            price: p.value ?? bar?.close ?? 0,
            timestamp: bar?.timestamp ?? 0,
            barIndex: idx,
          };
        };

        const from = makePoint(points[0]);
        const to = makePoint(points[1]);

        dispatch({
          type: "SET_MEASURE",
          measure: {
            isActive: false,
            fromPoint: from,
            result: computeResult(from, to),
          },
        });
      },
    });
  }, [state.chart, cleanup, dispatch]);

  const cancelMeasure = useCallback(() => {
    cleanup();
    dispatch({ type: "SET_MEASURE", measure: { isActive: false, fromPoint: null } });
  }, [cleanup, dispatch]);

  const clearResult = useCallback(() => {
    cleanup();
    dispatch({ type: "SET_MEASURE", measure: { result: null, fromPoint: null } });
  }, [cleanup, dispatch]);

  // Clean up the overlay on unmount.
  useEffect(() => {
    return () => {
      state.chart?.removeOverlay({ id: MEASURE_OVERLAY_ID });
    };
  }, [state.chart]);

  return {
    isActive,
    startMeasure,
    cancelMeasure,
    result,
    clearResult,
    fromPoint,
  };
}
