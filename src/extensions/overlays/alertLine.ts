import type { OverlayTemplate } from "react-klinecharts";
import type {
  OrderLineLineStyle,
  OrderLineMarkStyle,
  OrderLineLabelStyle,
} from "./orderLine";

export interface AlertLineExtendData {
  /** Primary color for the line, the y-axis mark bg, and label fallback. Default: "#ff9800" */
  color?: string;
  /** Text label displayed above the line. Defaults to the formatted price. */
  text?: string;
  /** Line style overrides. Default: dashed. */
  line?: OrderLineLineStyle;
  /** Y-axis price mark style overrides. */
  mark?: OrderLineMarkStyle;
  /** Text label style overrides. */
  label?: OrderLineLabelStyle;
  /** Whether to show a bell marker before the label text. Default: true */
  showBell?: boolean;
}

const DEFAULT_FONT_FAMILY = "Helvetica Neue, Arial, sans-serif";
const DEFAULT_COLOR = "#ff9800";
/** Bell glyph rendered before the label text when `showBell` is enabled. */
const BELL_MARK = "🔔"; // 🔔

const alertLine: OverlayTemplate = {
  name: "alertLine",
  totalStep: 2,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createYAxisFigures: ({ chart, overlay, coordinates }) => {
    if (coordinates.length < 1) return [];
    const y = coordinates[0].y;
    const price = overlay.points[0]?.value;
    if (price == null) return [];
    const d = (overlay.extendData ?? {}) as AlertLineExtendData;
    const color = d.color ?? DEFAULT_COLOR;
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
  createPointFigures: ({ chart, coordinates, bounding, overlay }) => {
    if (coordinates.length < 1) return [];

    const y = coordinates[0].y;
    const d = (overlay.extendData ?? {}) as AlertLineExtendData;
    const color = d.color ?? DEFAULT_COLOR;
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

    // Label text defaults to the formatted price so an alert is always
    // labelled even when no explicit text was supplied.
    const price = overlay.points[0]?.value;
    const precision = chart.getSymbol()?.pricePrecision ?? 2;
    const baseText =
      d.text ?? (price != null ? price.toFixed(precision) : "");
    const showBell = d.showBell ?? true;
    const text = baseText
      ? showBell
        ? `${BELL_MARK} ${baseText}`
        : baseText
      : showBell
        ? BELL_MARK
        : "";

    if (text) {
      const lb = d.label;
      figures.push({
        type: "text",
        ignoreEvent: true,
        attrs: {
          x: lb?.offset?.x ?? 8,
          y: y - (lb?.offset?.y ?? 3),
          text,
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

export default alertLine;
