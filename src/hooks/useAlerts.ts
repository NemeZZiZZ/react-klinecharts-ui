import { useCallback } from "react";
import {
  useKlinechartsUI,
  useKlinechartsUIDispatch,
} from "../provider/ChartTerminalContext";
import type { Alert, AlertCondition } from "../provider/featureTypes";

export type { Alert, AlertCondition } from "../provider/featureTypes";

export interface UseAlertsReturn {
  alerts: Alert[];
  addAlert: (
    price: number,
    condition: AlertCondition,
    message?: string,
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
    (price: number, condition: AlertCondition, message?: string): string => {
      const id = `alert_${++alertCounter}`;

      const alert: Alert = {
        id,
        price,
        condition,
        message,
        triggered: false,
      };

      dispatch({ type: "SET_ALERTS", alerts: [...state.alerts, alert] });

      if (state.chart) {
        state.chart.createOverlay({
          name: "horizontalStraightLine",
          id,
          groupId: "price_alerts",
          points: [{ value: price }],
          styles: {
            line: {
              style: "dashed",
              color: "#ff9800",
              size: 1,
            },
          },
          lock: true,
        });
      }

      return id;
    },
    [state.chart, state.alerts, dispatch],
  );

  const removeAlert = useCallback(
    (id: string) => {
      dispatch({
        type: "SET_ALERTS",
        alerts: state.alerts.filter((a) => a.id !== id),
      });
      state.chart?.removeOverlay({ id });
    },
    [state.chart, state.alerts, dispatch],
  );

  const clearAlerts = useCallback(() => {
    for (const alert of state.alerts) {
      state.chart?.removeOverlay({ id: alert.id });
    }
    dispatch({ type: "SET_ALERTS", alerts: [] });
  }, [state.chart, state.alerts, dispatch]);

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
