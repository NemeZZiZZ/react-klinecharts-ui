import { registerOverlay, registerIndicator } from "klinecharts";
import * as drawingOverlays from "../overlays";
import * as customIndicators from "../indicators";
import orderLine from "./overlays/orderLine";
import depthOverlay from "./overlays/depthOverlay";
import alertLine from "./overlays/alertLine";

/**
 * Drawing-tool overlays registered by default.
 */
export const overlays = Object.values(drawingOverlays);

/**
 * Optional feature overlays that are also registered automatically, so
 * consumers don't have to pass them through the `overlays` provider prop:
 *
 * - `orderLine`  — drawn by `useOrderLines`.
 * - `alertLine`  — drawn by `useAlerts`.
 * - `depthOverlay` — order-book depth visualization.
 *
 * `useAlerts` additionally registers `alertLine` lazily (see
 * `ensureAlertLineRegistered`) so it works even when automatic registration
 * is disabled on the provider.
 */
export const featureOverlays = [orderLine, depthOverlay, alertLine];

/**
 * Custom indicator templates (TradingView-style) registered by default.
 */
export const indicators = Object.values(customIndicators);

let registered = false;

export function registerExtensions(): void {
  if (registered) return;
  overlays.forEach((overlay) => registerOverlay(overlay));
  featureOverlays.forEach((overlay) => registerOverlay(overlay));
  indicators.forEach((indicator) => registerIndicator(indicator));
  registered = true;
}

let alertLineRegistered = false;

/**
 * Idempotently registers the `alertLine` overlay. Called by `useAlerts` before
 * creating its first overlay so the template is always available regardless of
 * whether the provider ran `registerExtensions()`.
 */
export function ensureAlertLineRegistered(): void {
  if (alertLineRegistered) return;
  registerOverlay(alertLine);
  alertLineRegistered = true;
}

export { orderLine };
export { depthOverlay };
export { alertLine };
export type {
  OrderLineExtendData,
  OrderLineLineStyle,
  OrderLineMarkStyle,
  OrderLineLabelStyle,
  OrderLineFontStyle,
  OrderLinePadding,
} from "./overlays/orderLine";
export type {
  DepthOverlayExtendData,
  DepthOverlayRow,
} from "./overlays/depthOverlay";
export type { AlertLineExtendData } from "./overlays/alertLine";
