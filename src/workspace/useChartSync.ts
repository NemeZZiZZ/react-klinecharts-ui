import { useEffect } from "react";
import type { Chart, Crosshair, VisibleRange } from "klinecharts";
import { useWorkspace } from "./WorkspaceContext";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";

export interface UseChartSyncOptions {
  /** This cell's id; must match a cell in the workspace state. */
  cellId: string;
}

/**
 * Bridge hook: call this inside a `<KlinechartsUIProvider>` (typically via a
 * `<ChartSyncBridge cellId={...} />` component). It registers the provider's
 * chart with the workspace registry and mirrors viewport/crosshair/zoom events
 * to the other registered charts, and keeps the workspace's notion of this
 * cell's symbol/period up to date.
 *
 * Mirroring uses only the PUBLIC klinecharts API (`executeAction`,
 * `scrollToTimestamp`, `setBarSpace`), not internal `_chartStore` fields, so it
 * survives klinecharts version upgrades. A re-entrancy guard
 * (`broadcastingRef`) prevents feedback loops.
 *
 * Limitations: klinecharts has no `setVisibleRange`, so scroll sync aligns the
 * right edge via `scrollToTimestamp(realTo)` — close but not pixel-exact.
 */
export function useChartSync({ cellId }: UseChartSyncOptions): void {
  const { chartsRef, broadcastingRef, sync, dispatch: workspaceDispatch } =
    useWorkspace();
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

    const onCrosshairChange = (data?: unknown) => {
      if (!sync.crosshair) return;
      const crosshair = data as Crosshair | undefined;
      if (!crosshair) return;
      broadcast((target) => target.executeAction("onCrosshairChange", crosshair));
    };

    const onScroll = () => {
      if (!sync.scroll) return;
      let range: VisibleRange | null = null;
      try {
        range = chart.getVisibleRange();
      } catch {
        return;
      }
      if (!range || range.realTo == null) return;
      broadcast((target) =>
        target.scrollToTimestamp(range!.realTo as number, 0),
      );
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
  }, [chart, cellId, chartsRef, broadcastingRef, sync.crosshair, sync.scroll, sync.zoom]);

  // Keep the workspace's notion of this cell's symbol/period in sync with the
  // provider. (Symbol/period linking ACROSS cells is the consumer's job — read
  // `useWorkspace().state.cells` and dispatch `SET_SYMBOL`/`SET_PERIOD` into
  // the per-cell provider when a cell entry changes. This effect only writes
  // outward to the workspace, never inward to the provider.)
  useEffect(() => {
    if (state.symbol) {
      workspaceDispatch({ type: "SET_CELL_SYMBOL", id: cellId, symbol: state.symbol });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.symbol]);

  useEffect(() => {
    workspaceDispatch({ type: "SET_CELL_PERIOD", id: cellId, period: state.period });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.period]);
}

