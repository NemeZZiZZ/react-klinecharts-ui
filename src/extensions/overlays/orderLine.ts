import type { OverlayTemplate } from "react-klinecharts";

export interface OrderLineFontStyle {
  size?: number;
  family?: string;
  weight?: string;
}

export interface OrderLinePadding {
  x?: number;
  y?: number;
}

export interface OrderLineMarkStyle {
  /** Mark text color. Default: "#ffffff" */
  color?: string;
  /** Mark background color (falls back to top-level `color`). */
  bg?: string;
  /** Mark border radius. Default: 2 */
  borderRadius?: number;
  /** Mark font. Defaults: size=11, family="Helvetica Neue, Arial, sans-serif", weight="bold" */
  font?: OrderLineFontStyle;
  /** Mark padding. Defaults: x=4, y=2 */
  padding?: OrderLinePadding;
}

export interface OrderLineLabelStyle {
  /** Label text color (falls back to top-level `color`). */
  color?: string;
  /** Label background color. Default: "transparent" */
  bg?: string;
  /** Label border radius. Default: 0 */
  borderRadius?: number;
  /** Label font. Defaults: size=11, family="Helvetica Neue, Arial, sans-serif", weight="normal" */
  font?: OrderLineFontStyle;
  /** Label padding. Defaults: x=0, y=0 */
  padding?: OrderLinePadding;
  /** Label offset from anchor. Defaults: x=8, y=3 */
  offset?: OrderLinePadding;
}

export interface OrderLineLineStyle {
  /** Line dash style. Default: "dashed" */
  style?: "solid" | "dashed" | "dotted";
  /** Line thickness. Default: 1 */
  width?: number;
  /** Dash pattern [dash, gap]. Default: [4, 2] (matches chart built-in lines) */
  dashedValue?: [number, number];
}

export interface OrderLineExtendData {
  /** Primary color for line, mark bg, and label fallback. Default: "rgba(255, 165, 0, 0.85)" */
  color?: string;
  /** Optional text label displayed above the line. */
  text?: string;
  /** Line style overrides. */
  line?: OrderLineLineStyle;
  /** Y-axis price mark style overrides. */
  mark?: OrderLineMarkStyle;
  /** Text label style overrides. */
  label?: OrderLineLabelStyle;
}

const DEFAULT_FONT_FAMILY = "Helvetica Neue, Arial, sans-serif";

const orderLine: OverlayTemplate = {
  name: "orderLine",
  totalStep: 2,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createYAxisFigures: ({ chart, overlay, coordinates }) => {
    if (coordinates.length < 1) return [];
    const y = coordinates[0].y;
    const price = overlay.points[0]?.value;
    if (price == null) return [];
    const d = (overlay.extendData ?? {}) as OrderLineExtendData;
    const color = d.color ?? "rgba(255, 165, 0, 0.85)";
    const m = d.mark;
    const precision = chart.getSymbol()?.pricePrecision ?? 2;
    return [
      {
        type: "text",
        attrs: {
          x: 0,
          y,
          text: price.toFixed(precision),
          align: "left",
          baseline: "middle",
        },
        styles: {
          color: m?.color ?? "#ffffff",
          size: m?.font?.size ?? 11,
          family: m?.font?.family ?? DEFAULT_FONT_FAMILY,
          weight: m?.font?.weight ?? "bold",
          paddingLeft: m?.padding?.x ?? 4,
          paddingRight: m?.padding?.x ?? 4,
          paddingTop: m?.padding?.y ?? 4,
          paddingBottom: m?.padding?.y ?? 4,
          backgroundColor: m?.bg ?? color,
          borderRadius: m?.borderRadius ?? 2,
        },
      },
    ];
  },
  createPointFigures: ({ coordinates, bounding, overlay }) => {
    if (coordinates.length < 1) return [];

    const y = coordinates[0].y;
    const d = (overlay.extendData ?? {}) as OrderLineExtendData;
    const color = d.color ?? "rgba(255, 165, 0, 0.85)";
    const ln = d.line;

    const figures: ReturnType<
      NonNullable<OverlayTemplate["createPointFigures"]>
    > = [
      {
        type: "line",
        attrs: {
          coordinates: [
            { x: 0, y },
            { x: bounding.width, y },
          ],
        },
        styles: {
          style: ln?.style ?? "dashed",
          color,
          size: ln?.width ?? 1,
          dashedValue: ln?.dashedValue ?? [4, 2],
        },
      },
    ];

    if (d.text) {
      const lb = d.label;
      figures.push({
        type: "text",
        ignoreEvent: true,
        attrs: {
          x: lb?.offset?.x ?? 8,
          y: y - (lb?.offset?.y ?? 3),
          text: d.text,
          align: "left",
          baseline: "bottom",
        },
        styles: {
          color: lb?.color ?? color,
          size: lb?.font?.size ?? 11,
          family: lb?.font?.family ?? DEFAULT_FONT_FAMILY,
          weight: lb?.font?.weight ?? "normal",
          paddingLeft: lb?.padding?.x ?? 0,
          paddingRight: lb?.padding?.x ?? 0,
          paddingTop: lb?.padding?.y ?? 0,
          paddingBottom: lb?.padding?.y ?? 0,
          backgroundColor: lb?.bg ?? "transparent",
          borderRadius: lb?.borderRadius ?? 0,
        },
      });
    }

    return figures;
  },
  performEventPressedMove: ({ points, performPoint }) => {
    points[0].value = performPoint.value;
  },
};

export default orderLine;
