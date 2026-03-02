import { registerOverlay } from "react-klinecharts";
import * as drawingOverlays from "../overlays";
import orderLine from "./overlays/orderLine";

/**
 * Built-in drawing-tool overlays registered by default.
 * Does NOT include optional overlays like `orderLine` — those are
 * registered explicitly by the consumer via the `overlays` provider prop.
 */
export const overlays = Object.values(drawingOverlays);

let registered = false;

export function registerExtensions(): void {
  if (registered) return;
  overlays.forEach((overlay) => registerOverlay(overlay));
  registered = true;
}

export { orderLine };
export type {
  OrderLineExtendData,
  OrderLineLineStyle,
  OrderLineMarkStyle,
  OrderLineLabelStyle,
  OrderLineFontStyle,
  OrderLinePadding,
} from "./overlays/orderLine";
