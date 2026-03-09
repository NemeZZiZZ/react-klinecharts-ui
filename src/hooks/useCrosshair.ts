import { useState, useEffect, useCallback, useRef } from "react";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";

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
  const [barData, setBarData] = useState<CrosshairBarData | null>(null);
  const rafRef = useRef<number>(0);

  const handler = useCallback(
    (event: any) => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;

        const klineData = event?.kLineData;
        if (!klineData) {
          setBarData(null);
          return;
        }

        const pricePrecision = state.symbol?.pricePrecision ?? 2;
        const open = klineData.open ?? 0;
        const close = klineData.close ?? 0;
        const change = parseFloat((close - open).toFixed(pricePrecision));
        const changePercent =
          open !== 0
            ? parseFloat(((change / open) * 100).toFixed(2))
            : 0;

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
    [state.symbol?.pricePrecision],
  );

  useEffect(() => {
    const chart = state.chart;
    if (!chart) return;

    (chart as any).subscribeAction?.("onCrosshairChange", handler);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      (chart as any).unsubscribeAction?.("onCrosshairChange", handler);
    };
  }, [state.chart, handler]);

  return { barData };
}
