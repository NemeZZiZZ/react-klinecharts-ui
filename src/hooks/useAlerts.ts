import { useCallback } from "react";
import {
  useKlinechartsUI,
  useKlinechartsUIDispatch,
} from "../provider/ChartTerminalContext";
import type { Alert, AlertCondition } from "../provider/featureTypes";
import { ensureAlertLineRegistered } from "../extensions";
import type { AlertLineExtendData } from "../extensions/overlays/alertLine";

export type { Alert, AlertCondition } from "../provider/featureTypes";
export type { AlertLineExtendData } from "../extensions/overlays/alertLine";

export interface UseAlertsReturn {
  alerts: Alert[];
  addAlert: (
    price: number,
    condition: AlertCondition,
    message?: string,
    extendData?: AlertLineExtendData,
  ) => string;
  removeAlert: (id: string) => void;
  clearAlerts: () => void;
  onAlertTriggered: (callback: (alert: Alert) => void) => void;
}

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
  const { alertTriggeredListenerRef } = useKlinechartsUIDispatch();
  const alerts = state.alerts;

  const addAlert = useCallback(
    (
      price: number,
      condition: AlertCondition,
      message?: string,
      extendData?: AlertLineExtendData,
    ): string => {
      const id = `alert_${++alertCounter}`;

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
      state.chart?.removeOverlay({ id });
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
      alertTriggeredListenerRef.current = callback;
    },
    [alertTriggeredListenerRef],
  );

  return {
    alerts,
    addAlert,
    removeAlert,
    clearAlerts,
    onAlertTriggered,
  };
}
