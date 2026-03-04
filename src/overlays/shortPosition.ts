import type { OverlayTemplate } from "react-klinecharts";

const shortPosition: OverlayTemplate = {
  name: "shortPosition",
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: (params: any) => {
    const { coordinates, overlay, yAxis } = params;
    const figures: any[] = [];
    if (coordinates.length > 1 && yAxis) {
      const startX = coordinates[0].x;
      const endX = coordinates[1].x;
      const entryY = coordinates[0].y;
      const targetY = coordinates[1].y;
      const stopY =
        coordinates.length > 2 ? coordinates[2].y : entryY - 40;

      const entryPrice = overlay.points[0].value!;
      const targetPrice = overlay.points[1].value!;
      const stopPrice =
        overlay.points[2]?.value ?? yAxis.convertFromPixel(stopY);

      const reward = entryPrice - targetPrice;
      const risk = stopPrice - entryPrice;
      const rr = risk > 0 ? (reward / risk).toFixed(2) : "0.00";

      const profitPercent = ((reward / entryPrice) * 100).toFixed(2);
      const lossPercent = ((risk / entryPrice) * 100).toFixed(2);

      // Target Box (Profit) - Green
      figures.push({
        type: "rect",
        attrs: {
          x: Math.min(startX, endX),
          y: Math.min(entryY, targetY),
          width: Math.abs(startX - endX),
          height: Math.abs(entryY - targetY),
        },
        styles: { color: "rgba(38, 166, 154, 0.2)", style: "fill" },
      });

      // Stop Box (Loss) - Red
      figures.push({
        type: "rect",
        attrs: {
          x: Math.min(startX, endX),
          y: Math.min(entryY, stopY),
          width: Math.abs(startX - endX),
          height: Math.abs(entryY - stopY),
        },
        styles: { color: "rgba(239, 83, 80, 0.2)", style: "fill" },
      });

      // Entry Line
      figures.push({
        type: "line",
        attrs: {
          coordinates: [
            { x: startX, y: entryY },
            { x: endX, y: entryY },
          ],
        },
        styles: { color: "#888888", size: 2 },
      });

      // Profit Label
      figures.push({
        type: "text",
        attrs: {
          x: endX,
          y: targetY,
          text: `Target: ${targetPrice.toFixed(2)} (${profitPercent}%)`,
          align: "left",
          baseline: "top",
        },
        styles: {
          color: "#26a69a",
          backgroundColor: "rgba(0,0,0,0.6)",
          paddingLeft: 4,
          paddingRight: 4,
        },
      });

      // Loss Label
      figures.push({
        type: "text",
        attrs: {
          x: endX,
          y: stopY,
          text: `Stop: ${stopPrice.toFixed(2)} (${lossPercent}%)`,
          align: "left",
          baseline: "bottom",
        },
        styles: {
          color: "#ef5350",
          backgroundColor: "rgba(0,0,0,0.6)",
          paddingLeft: 4,
          paddingRight: 4,
        },
      });

      // R/R Label (Center)
      figures.push({
        type: "text",
        attrs: {
          x: Math.min(startX, endX) + Math.abs(startX - endX) / 2,
          y: entryY,
          text: `R/R Ratio: ${rr}`,
          align: "center",
          baseline: "middle",
        },
        styles: {
          color: "#ffffff",
          backgroundColor: "rgba(0,0,0,0.8)",
          paddingLeft: 6,
          paddingRight: 6,
          borderRadius: 2,
        },
      });
    }
    return figures;
  },
};

export default shortPosition;
