import { useEffect, useRef } from "react";
import { useKlinechartsUI } from "react-klinecharts-ui";

function playBeep() {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 880;
  gain.gain.value = 0.3;
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  osc.stop(ctx.currentTime + 0.3);
}

/**
 * Side-effect-only component that monitors order line crossings
 * and plays a beep sound via the Web Audio API when the latest
 * close price crosses an order line price.
 */
export function OrderLineAlertSound() {
  const { state } = useKlinechartsUI();
  const prevCloseRef = useRef<number | null>(null);

  useEffect(() => {
    if (!state.chart) return;

    const interval = setInterval(() => {
      const dataList = state.chart?.getDataList();
      if (!dataList || dataList.length === 0) return;

      const currentClose = dataList[dataList.length - 1].close;
      const prevClose = prevCloseRef.current;

      if (prevClose === null) {
        prevCloseRef.current = currentClose;
        return;
      }

      prevCloseRef.current = currentClose;

      // Get all order line overlays from the chart
      const orderLines = state.chart?.getOverlays({ name: "orderLine" }) ?? [];

      for (const overlay of orderLines) {
        const orderPrice = overlay.points[0]?.value;
        if (orderPrice == null) continue;

        const crossedUp = prevClose < orderPrice && currentClose >= orderPrice;
        const crossedDown = prevClose > orderPrice && currentClose <= orderPrice;

        if (crossedUp || crossedDown) {
          playBeep();
          break; // one beep per tick is enough
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state.chart]);

  return null;
}
