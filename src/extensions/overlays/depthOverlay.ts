import type { OverlayTemplate } from "react-klinecharts";

export interface DepthOverlayRow {
  price: number;
  qty: number;
  side: "bid" | "ask";
}

export interface DepthOverlayExtendData {
  rows: DepthOverlayRow[];
  maxQty: number;
  /** Max bar width as fraction of chart width (0–1). Default: 0.3 */
  maxBarWidth?: number;
  /** Ask bar color. Default: "rgba(239,83,80,0.25)" */
  askColor?: string;
  /** Bid bar color. Default: "rgba(38,166,154,0.25)" */
  bidColor?: string;
}

const depthOverlay: OverlayTemplate = {
  name: "depthOverlay",
  totalStep: 2,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  lock: true,
  visible: true,
  zLevel: -1,
  createPointFigures: ({ overlay, bounding, yAxis }) => {
    const d = overlay.extendData as DepthOverlayExtendData | undefined;
    if (!d || !d.rows || d.rows.length === 0 || !yAxis) return [];

    const maxBarFraction = d.maxBarWidth ?? 0.3;
    const maxBarPx = bounding.width * maxBarFraction;
    const askColor = d.askColor ?? "rgba(239,83,80,0.25)";
    const bidColor = d.bidColor ?? "rgba(38,166,154,0.25)";
    const maxQty = d.maxQty || 1;

    const figures: any[] = [];

    for (const row of d.rows) {
      const y = (yAxis as any).convertToPixel(row.price);
      if (y == null || y < 0 || y > bounding.height) continue;

      const barWidth = (row.qty / maxQty) * maxBarPx;
      const barHeight = Math.max(2, bounding.height / d.rows.length * 0.8);
      const color = row.side === "ask" ? askColor : bidColor;

      // Draw from right edge toward left
      figures.push({
        type: "rect",
        attrs: {
          x: bounding.width - barWidth,
          y: y - barHeight / 2,
          width: barWidth,
          height: barHeight,
        },
        styles: {
          color,
        },
        ignoreEvent: true,
      });
    }

    return figures;
  },
};

export default depthOverlay;
