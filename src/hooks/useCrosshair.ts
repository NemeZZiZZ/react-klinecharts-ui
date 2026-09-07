import { useState, useEffect, useCallback, useRef } from "react";
import type { Chart, Coordinate, KLineData, Point } from "klinecharts";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";

/** klinecharts' main pane id (`PaneIdConstants.CANDLE`). */
const CANDLE_PANE_ID = "candle_pane";

/** What `onCrosshairChange` actually delivers — the RAW crosshair. */
type RawCrosshair = Partial<Coordinate> & {
  paneId?: string;
  kLineData?: KLineData;
};

/**
 * The bar under the crosshair.
 *
 * `onCrosshairChange` delivers the RAW crosshair — `{ x, y, paneId }` — because
 * `StoreImp.setCrosshair` executes the action with the argument it was given,
 * not with its enriched internal crosshair. `kLineData` / `dataIndex` /
 * `timestamp` are therefore always `undefined` on the mouse path even though
 * `Crosshair` declares them (so `event.kLineData` compiles and silently
 * yields nothing). Resolve the bar from the pixel with the public conversion
 * API instead.
 */
function resolveKLineData(
  chart: Chart | null,
  event?: unknown,
): KLineData | null {
  const crosshair = event as RawCrosshair | undefined;
  if (crosshair?.kLineData) return crosshair.kLineData;
  if (!chart) return null;

  const x = crosshair?.x;
  if (typeof x !== "number" || !Number.isFinite(x)) return null;

  const converted = chart.convertFromPixel([{ x }], {
    paneId: crosshair?.paneId ?? CANDLE_PANE_ID,
  });
  const point = (Array.isArray(converted) ? converted[0] : converted) as
    | Partial<Point>
    | undefined;
  const dataIndex = point?.dataIndex;
  if (typeof dataIndex !== "number") return null;

  // The index is unclamped, so it can point outside the loaded history.
  return chart.getDataList()[dataIndex] ?? null;
}

export interface CrosshairBarData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  change: number;
  changePercent: number;
}

export interface UseCrosshairReturn {
  /** OHLCV data of the bar under the crosshair. Null when cursor is off-chart. */
  barData: CrosshairBarData | null;
}

export function useCrosshair(): UseCrosshairReturn {
  const { state } = useKlinechartsUI();
  const chart = state.chart;
  const [barData, setBarData] = useState<CrosshairBarData | null>(null);
  const rafRef = useRef<number>(0);

  const handler = useCallback(
    (event?: unknown) => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;

        const klineData = resolveKLineData(chart, event);
        if (!klineData) {
          setBarData(null);
          return;
        }

        const pricePrecision = state.symbol?.pricePrecision ?? 2;
        const open = klineData.open ?? 0;
        const close = klineData.close ?? 0;
        const change = parseFloat((close - open).toFixed(pricePrecision));
        const changePercent =
          open !== 0 ? parseFloat(((change / open) * 100).toFixed(2)) : 0;

        setBarData({
          open,
          high: klineData.high ?? 0,
          low: klineData.low ?? 0,
          close,
          volume: klineData.volume ?? 0,
          timestamp: klineData.timestamp ?? 0,
          change,
          changePercent,
        });
      });
    },
    [chart, state.symbol?.pricePrecision],
  );

  useEffect(() => {
    const chart = state.chart;
    if (!chart) return;

    chart.subscribeAction("onCrosshairChange", handler);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      chart.unsubscribeAction("onCrosshairChange", handler);
    };
  }, [state.chart, handler]);

  // klinecharts clears its crosshair on `mouseleave` with `setCrosshair()`,
  // which leaves `_crosshair.paneId` undefined — and `setCrosshair` only emits
  // `onCrosshairChange` when that pane id is a string. So no event reaches us
  // when the cursor leaves and the panel would keep showing the last bar
  // forever. Listen on the chart root to honour the "null when off-chart"
  // contract.
  useEffect(() => {
    const dom = state.chart?.getDom();
    if (!dom) return;

    const clear = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      setBarData(null);
    };

    dom.addEventListener("mouseleave", clear);
    return () => {
      dom.removeEventListener("mouseleave", clear);
    };
  }, [state.chart]);

  return { barData };
}
