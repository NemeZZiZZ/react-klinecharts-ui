import { useCrosshair } from "react-klinecharts-ui";

/** Live OHLCV readout that follows the cursor — showcases `useCrosshair`. */
export function CrosshairPanel() {
  const { barData } = useCrosshair();

  return (
    <div
      className="kc-demo__note"
      style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}
    >
      {barData ? (
        <>
          <span>O {barData.open}</span>
          <span>H {barData.high}</span>
          <span>L {barData.low}</span>
          <span>C {barData.close}</span>
          <span>Vol {barData.volume}</span>
          <span
            style={{ color: barData.change >= 0 ? "#2DC08E" : "#F92855" }}
          >
            {barData.change >= 0 ? "+" : ""}
            {barData.changePercent}%
          </span>
        </>
      ) : (
        <span>Hover over the chart to read OHLCV…</span>
      )}
    </div>
  );
}
