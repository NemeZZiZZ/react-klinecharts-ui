import { useState, useEffect, useRef, useCallback } from "react";
import { useKlinechartsUI } from "react-klinecharts-ui";
import type { KLineData } from "react-klinecharts";

interface CrosshairData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  change: number;
  changePercent: number;
}

/**
 * Displays OHLCV data for the bar under the crosshair.
 * Uses onCrosshairChange with RAF throttling.
 */
export function CrosshairDataPanel() {
  const { state } = useKlinechartsUI();
  const [data, setData] = useState<CrosshairData | null>(null);
  const rafRef = useRef<number>(0);

  const precision = (state.symbol as any)?.pricePrecision ?? 2;

  const handleCrosshairChange = useCallback((event: any) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const kLineData = event?.kLineData as KLineData | undefined;
      if (!kLineData || kLineData.timestamp == null) {
        setData(null);
        return;
      }
      const change = kLineData.close - kLineData.open;
      const changePercent =
        kLineData.open !== 0 ? (change / kLineData.open) * 100 : 0;
      setData({
        open: kLineData.open,
        high: kLineData.high,
        low: kLineData.low,
        close: kLineData.close,
        volume: kLineData.volume ?? 0,
        timestamp: kLineData.timestamp,
        change,
        changePercent,
      });
    });
  }, []);

  useEffect(() => {
    const chart = state.chart;
    if (!chart) return;

    chart.setStyles({
      crosshair: {
        show: true,
      },
    });

    (chart as any).subscribeAction?.("onCrosshairChange", handleCrosshairChange);

    return () => {
      cancelAnimationFrame(rafRef.current);
      (chart as any).unsubscribeAction?.("onCrosshairChange", handleCrosshairChange);
    };
  }, [state.chart, handleCrosshairChange]);

  if (!data) return null;

  const isPositive = data.change >= 0;
  const changeColor = isPositive
    ? "text-green-500"
    : "text-red-500";

  const formatPrice = (v: number) => v.toFixed(precision);
  const formatVolume = (v: number) => {
    if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2) + "B";
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
    if (v >= 1_000) return (v / 1_000).toFixed(2) + "K";
    return v.toFixed(2);
  };

  return (
    <div className="flex items-center gap-3 text-xs tabular-nums">
      <span className="text-muted-foreground">
        O <span className={changeColor}>{formatPrice(data.open)}</span>
      </span>
      <span className="text-muted-foreground">
        H <span className={changeColor}>{formatPrice(data.high)}</span>
      </span>
      <span className="text-muted-foreground">
        L <span className={changeColor}>{formatPrice(data.low)}</span>
      </span>
      <span className="text-muted-foreground">
        C <span className={changeColor}>{formatPrice(data.close)}</span>
      </span>
      <span className={changeColor}>
        {isPositive ? "+" : ""}
        {formatPrice(data.change)} ({isPositive ? "+" : ""}
        {data.changePercent.toFixed(2)}%)
      </span>
      <span className="text-muted-foreground">
        Vol {formatVolume(data.volume)}
      </span>
    </div>
  );
}
