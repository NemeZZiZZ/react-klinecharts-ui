import { useCallback } from "react";
import {
  useKlinechartsUI,
  useKlinechartsUIDispatch,
} from "../provider/ChartTerminalContext";
import type { Alert, AlertCondition, AlertTarget } from "../provider/featureTypes";
import { ensureAlertLineRegistered } from "../extensions";
import type { AlertLineExtendData } from "../extensions/overlays/alertLine";

export type { Alert, AlertCondition, AlertTarget } from "../provider/featureTypes";
export type { AlertLineExtendData } from "../extensions/overlays/alertLine";

export interface UseAlertsReturn {
  alerts: Alert[];
  /**
   * Returns the new alert id, or "" when `price` is not finite (the call is
   * ignored — a NaN/Infinity alert could never fire).
   */
  addAlert: (
    price: number,
    condition: AlertCondition,
    message?: string,
    extendData?: AlertLineExtendData,
    /** Alert target: price (default) or an indicator figure value. */
    target?: AlertTarget,
  ) => string;
  removeAlert: (id: string) => void;
  clearAlerts: () => void;
  /**
   * Register a callback fired when any alert crosses its target. Returns an
   * unsubscribe function. Multiple components can register simultaneously —
   * every registered listener is invoked on each firing (no longer
   * last-writer-wins).
   */
  onAlertTriggered: (callback: (alert: Alert) => void) => () => void;
}

// Ids carry a per-page-load session tag: a bare module counter restarts at 1
// on every reload and collided with the alerts hydrated from storage (same
// React key, and two overlays sharing one id — removing one hit both).
const ALERT_ID_SESSION = Math.random().toString(36).slice(2, 8);
let alertCounter = 0;

/**
 * Headless hook for price-crossing alerts.
 *
 * The alert list lives in the shared provider store, and the 1s crossing
 * poller + the `onAlertTriggered` listener are owned by the provider. This
 * means several `useAlerts()` instances (toolbar, list panel, sound trigger)
 * observe and mutate one synchronized list and share a single poller — they no
 * longer drift apart or each spawn their own interval.
 */
export function useAlerts(): UseAlertsReturn {
  const { state, dispatch } = useKlinechartsUI();
  const { alertTriggeredListenersRef } = useKlinechartsUIDispatch();
  const alerts = state.alerts;

  const addAlert = useCallback(
    (
      price: number,
      condition: AlertCondition,
      message?: string,
      extendData?: AlertLineExtendData,
      target?: AlertTarget,
    ): string => {
      // A non-finite price can never cross anything: the poller's comparisons
      // stay false forever and the overlay label renders "NaN". Ignore the
      // call instead of recording a dead alert.
      if (!Number.isFinite(price)) return "";

      const id = `alert_${ALERT_ID_SESSION}_${++alertCounter}`;

      // Default label: explicit text → message → formatted price (using the
      // symbol's precision when available).
      const precision = state.chart?.getSymbol()?.pricePrecision ?? 2;
      const resolvedExtendData: AlertLineExtendData = {
        ...extendData,
        text: extendData?.text ?? message ?? price.toFixed(precision),
      };

      const alert: Alert = {
        id,
        price,
        condition,
        message,
        triggered: false,
        extendData: resolvedExtendData,
        // Persist the target only when it's an indicator alert; omit for the
        // default price target so existing serialized alerts stay compatible.
        ...(target && target.type === "indicator" ? { target } : {}),
      };

      // Use the granular ADD_ALERT action (not SET_ALERTS) so this append
      // composes with a concurrent trigger from the provider poller instead
      // of overwriting the list and reverting `triggered: true` flags.
      dispatch({ type: "ADD_ALERT", alert });

      if (state.chart) {
        // Make sure the alertLine template is registered even when the
        // provider skipped automatic extension registration.
        ensureAlertLineRegistered();
        state.chart.createOverlay({
          name: "alertLine",
          id,
          groupId: "price_alerts",
          points: [{ value: price }],
          extendData: resolvedExtendData,
          lock: true,
        });
      }

      return id;
    },
    [state.chart, dispatch],
  );

  const removeAlert = useCallback(
    (id: string) => {
      dispatch({ type: "REMOVE_ALERT", id });
      // Scope by the group this hook assigns at creation: a bare `{ id }`
      // removes the FIRST overlay with that id in ANY group, so an id clash
      // with a drawing/order overlay would delete foreign UI.
      state.chart?.removeOverlay({ id, groupId: "price_alerts" });
    },
    [state.chart, dispatch],
  );

  const clearAlerts = useCallback(() => {
    // Remove every alert-line overlay at once via the shared groupId, then
    // clear the store. Avoids depending on `state.alerts` (which would make
    // this callback recreate whenever any alert changes).
    state.chart?.removeOverlay({ groupId: "price_alerts" });
    dispatch({ type: "CLEAR_ALERTS" });
  }, [state.chart, dispatch]);

  const onAlertTriggered = useCallback(
    (callback: (alert: Alert) => void) => {
      const set = alertTriggeredListenersRef.current;
      set.add(callback);
      return () => {
        set.delete(callback);
      };
    },
    [alertTriggeredListenersRef],
  );

  return {
    alerts,
    addAlert,
    removeAlert,
    clearAlerts,
    onAlertTriggered,
  };
}
