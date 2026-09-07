import { useEffect } from "react";
import type { Chart, Coordinate, Point } from "klinecharts";
import { useWorkspace } from "./WorkspaceContext";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";

export interface UseChartSyncOptions {
  /** This cell's id; must match a cell in the workspace state. */
  cellId: string;
}

/** klinecharts' main pane id (`PaneIdConstants.CANDLE`). */
const CANDLE_PANE_ID = "candle_pane";

/**
 * Pixel → time: the timestamp of the bar under `x` on `chart`'s own scale.
 *
 * `onCrosshairChange` hands subscribers the RAW crosshair (`{ x, y, paneId }`):
 * `ChartImp.executeAction` calls `setCrosshair(data, { notExecuteAction: true })`
 * and the store re-emits the argument it received, not its enriched internal
 * crosshair. `timestamp`/`dataIndex`/`kLineData` are therefore always
 * `undefined` on the mouse path, even though `Crosshair` declares them.
 */
function crosshairTimestamp(
  chart: Chart,
  x: number,
  paneId: string,
): number | null {
  const converted = chart.convertFromPixel([{ x }], { paneId });
  const point = (Array.isArray(converted) ? converted[0] : converted) as
    | Partial<Point>
    | undefined;
  const timestamp = point?.timestamp;
  return typeof timestamp === "number" && Number.isFinite(timestamp)
    ? timestamp
    : null;
}

/** Time → pixel: the x coordinate of `timestamp` on `chart`'s own scale. */
function timestampToX(
  chart: Chart,
  timestamp: number,
  paneId: string,
): number | null {
  const converted = chart.convertToPixel({ timestamp }, { paneId });
  const coordinate = (Array.isArray(converted) ? converted[0] : converted) as
    | Partial<Coordinate>
    | undefined;
  const x = coordinate?.x;
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

/**
 * Timestamp of the right-most visible bar — the anchor used for scroll sync.
 *
 * `VisibleRange.realTo` is a BAR INDEX (exclusive upper bound), not a
 * timestamp. Passing it straight to `scrollToTimestamp` binary-searches the
 * data list for a timestamp equal to that small integer and always lands on
 * the first bar, scrolling every sibling to the start of loaded history.
 */
function rightEdgeTimestamp(chart: Chart): number | null {
  const range = chart.getVisibleRange();
  if (!range || !Number.isFinite(range.realTo)) return null;
  const dataList = chart.getDataList();
  if (dataList.length === 0) return null;
  const index = Math.min(
    Math.max(Math.round(range.realTo) - 1, 0),
    dataList.length - 1,
  );
  const timestamp = dataList[index]?.timestamp;
  return typeof timestamp === "number" ? timestamp : null;
}

/**
 * Bridge hook: call this inside a `<KlinechartsUIProvider>` (typically via a
 * `<ChartSyncBridge cellId={...} />` component). It registers the provider's
 * chart with the workspace registry and mirrors viewport/crosshair/zoom events
 * to the other registered charts, and keeps the workspace's notion of this
 * cell's symbol/period up to date.
 *
 * Mirroring uses only the PUBLIC klinecharts API (`executeAction`,
 * `convertFromPixel`/`convertToPixel`, `scrollToTimestamp`, `setBarSpace`), not
 * internal `_chartStore` fields, so it survives klinecharts version upgrades.
 * A re-entrancy guard (`broadcastingRef`) prevents feedback loops.
 *
 * Both X-axis channels are mirrored through TIME, never through pixels or bar
 * indices: the source converts its pixel/data index to a timestamp and every
 * target maps that timestamp back onto its own scale. That is what keeps
 * charts with a different scroll position, zoom, timeframe or symbol on the
 * same moment instead of on the same pixel.
 *
 * Limitations: klinecharts has no `setVisibleRange`, so scroll sync aligns the
 * right edge via `scrollToTimestamp(rightEdgeTimestamp)` — close but not
 * pixel-exact (`scrollToDataIndex` preserves the target's own right-side
 * offset, so blank space to the right of the last bar is not reproduced).
 */
export function useChartSync({ cellId }: UseChartSyncOptions): void {
  const {
    chartsRef,
    broadcastingRef,
    sync,
    dispatch: workspaceDispatch,
  } = useWorkspace();
  const { state } = useKlinechartsUI();
  const chart = state.chart;

  // Register/unregister this provider's chart instance with the workspace.
  useEffect(() => {
    if (!chart) return;
    chartsRef.current.set(cellId, chart);
    return () => {
      chartsRef.current.delete(cellId);
    };
  }, [chart, cellId, chartsRef]);

  // Mirror crosshair / scroll / zoom to siblings. Subscribed once the chart is
  // ready; cleaned up on chart change/unmount.
  useEffect(() => {
    if (!chart) return;

    const broadcast = (fn: (target: Chart) => void) => {
      if (broadcastingRef.current) return;
      broadcastingRef.current = true;
      try {
        chartsRef.current.forEach((target, id) => {
          if (id !== cellId) {
            try {
              fn(target);
            } catch {
              // a sibling chart may be mid-teardown; skip it
            }
          }
        });
      } finally {
        broadcastingRef.current = false;
      }
    };

    // Crosshair syncs by TIME, not by pixel. Forwarding the raw crosshair
    // object would mirror a pixel offset: `setCrosshair` recomputes
    // dataIndex/kLineData/timestamp from `x` on the RECEIVING chart's scale,
    // so any sibling with a different scroll, zoom, timeframe or symbol would
    // land on a different bar. Convert the source pixel to a timestamp and
    // let every target map that timestamp back to its own pixel.
    const onCrosshairChange = (data?: unknown) => {
      if (!sync.crosshair) return;
      const crosshair = data as
        | (Partial<Coordinate> & { paneId?: string })
        | undefined;
      const x = crosshair?.x;
      if (typeof x !== "number" || !Number.isFinite(x)) return;
      const paneId = crosshair?.paneId ?? CANDLE_PANE_ID;
      let timestamp: number | undefined;
      try {
        timestamp = crosshairTimestamp(chart, x, paneId) ?? undefined;
      } catch {
        return;
      }
      if (timestamp == null) return;
      const ts = timestamp;
      broadcast((target) => {
        // `y` is deliberately dropped: a foreign instrument's price is
        // meaningless on this scale, and klinecharts only draws the horizontal
        // line when `y` is present.
        let targetPaneId = paneId;
        let targetX: number | undefined;
        try {
          targetX = timestampToX(target, ts, targetPaneId) ?? undefined;
          if (targetX == null && targetPaneId !== CANDLE_PANE_ID) {
            // sibling has no pane with that id (different indicators)
            targetPaneId = CANDLE_PANE_ID;
            targetX = timestampToX(target, ts, targetPaneId) ?? undefined;
          }
        } catch {
          return;
        }
        if (targetX == null) return;
        target.executeAction("onCrosshairChange", {
          x: targetX,
          paneId: targetPaneId,
        });
      });
    };

    const onScroll = () => {
      if (!sync.scroll) return;
      let timestamp: number | undefined;
      try {
        timestamp = rightEdgeTimestamp(chart) ?? undefined;
      } catch {
        return;
      }
      if (timestamp == null) return;
      const ts = timestamp;
      broadcast((target) => target.scrollToTimestamp(ts, 0));
    };

    const onZoom = () => {
      if (!sync.zoom) return;
      let bar = 0;
      try {
        bar = chart.getBarSpace().bar;
      } catch {
        return;
      }
      broadcast((target) => target.setBarSpace(bar));
    };

    chart.subscribeAction("onCrosshairChange", onCrosshairChange);
    chart.subscribeAction("onScroll", onScroll);
    chart.subscribeAction("onZoom", onZoom);

    return () => {
      chart.unsubscribeAction("onCrosshairChange", onCrosshairChange);
      chart.unsubscribeAction("onScroll", onScroll);
      chart.unsubscribeAction("onZoom", onZoom);
    };
  }, [
    chart,
    cellId,
    chartsRef,
    broadcastingRef,
    sync.crosshair,
    sync.scroll,
    sync.zoom,
  ]);

  // Keep the workspace's notion of this cell's symbol/period in sync with the
  // provider. (Symbol/period linking ACROSS cells is the consumer's job — read
  // `useWorkspace().state.cells` and dispatch `SET_SYMBOL`/`SET_PERIOD` into
  // the per-cell provider when a cell entry changes. This effect only writes
  // outward to the workspace, never inward to the provider.)
  useEffect(() => {
    if (state.symbol) {
      workspaceDispatch({
        type: "SET_CELL_SYMBOL",
        id: cellId,
        symbol: state.symbol,
      });
    }
    // cellId is a dep on purpose: without it a cell whose id prop changes
    // keeps dispatching symbol updates for the OLD id (workspaceDispatch is
    // the stable useReducer dispatch).
  }, [state.symbol, cellId, workspaceDispatch]);

  useEffect(() => {
    workspaceDispatch({
      type: "SET_CELL_PERIOD",
      id: cellId,
      period: state.period,
    });
  }, [state.period, cellId, workspaceDispatch]);
}
