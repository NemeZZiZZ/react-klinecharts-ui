import { useKlinechartsUI, useCrosshair } from "react-klinecharts-ui";

/**
 * Displays OHLCV data for the bar under the crosshair.
 * Uses the useCrosshair hook from the library.
 */
export function CrosshairDataPanel() {
  const { state } = useKlinechartsUI();
  const { barData } = useCrosshair();

  if (!barData) return null;

  const precision = (state.symbol as any)?.pricePrecision ?? 2;
  const isPositive = barData.change >= 0;
  const changeColor = isPositive ? "text-green-500" : "text-red-500";

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
        O <span className={changeColor}>{formatPrice(barData.open)}</span>
      </span>
      <span className="text-muted-foreground">
        H <span className={changeColor}>{formatPrice(barData.high)}</span>
      </span>
      <span className="text-muted-foreground">
        L <span className={changeColor}>{formatPrice(barData.low)}</span>
      </span>
      <span className="text-muted-foreground">
        C <span className={changeColor}>{formatPrice(barData.close)}</span>
      </span>
      <span className={changeColor}>
        {isPositive ? "+" : ""}
        {formatPrice(barData.change)} ({isPositive ? "+" : ""}
        {barData.changePercent.toFixed(2)}%)
      </span>
      <span className="text-muted-foreground">
        Vol {formatVolume(barData.volume)}
      </span>
    </div>
  );
}
