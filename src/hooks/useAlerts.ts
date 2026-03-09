import { useCallback, useEffect, useRef, useState } from "react";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";

export type AlertCondition = "crossing_up" | "crossing_down" | "crossing";

export interface Alert {
  id: string;
  price: number;
  condition: AlertCondition;
  message?: string;
  triggered: boolean;
}

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

export function useAlerts(): UseAlertsReturn {
  const { state } = useKlinechartsUI();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const callbackRef = useRef<((alert: Alert) => void) | null>(null);
  const prevCloseRef = useRef<number | null>(null);

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

      setAlerts((prev) => [...prev, alert]);

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
    [state.chart],
  );

  const removeAlert = useCallback(
    (id: string) => {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      state.chart?.removeOverlay({ id });
    },
    [state.chart],
  );

  const clearAlerts = useCallback(() => {
    setAlerts((prev) => {
      for (const alert of prev) {
        state.chart?.removeOverlay({ id: alert.id });
      }
      return [];
    });
  }, [state.chart]);

  const onAlertTriggered = useCallback(
    (callback: (alert: Alert) => void) => {
      callbackRef.current = callback;
    },
    [],
  );

  // Poll for price crossings every second
  useEffect(() => {
    if (!state.chart) return;

    const interval = setInterval(() => {
      const dataList = state.chart?.getDataList();
      if (!dataList || dataList.length === 0) return;

      const lastBar = dataList[dataList.length - 1];
      const currentClose = lastBar.close;
      const prevClose = prevCloseRef.current;

      if (prevClose === null) {
        prevCloseRef.current = currentClose;
        return;
      }

      prevCloseRef.current = currentClose;

      setAlerts((prev) => {
        let changed = false;
        const next = prev.map((alert) => {
          if (alert.triggered) return alert;

          let shouldTrigger = false;

          if (alert.condition === "crossing_up") {
            shouldTrigger = prevClose < alert.price && currentClose >= alert.price;
          } else if (alert.condition === "crossing_down") {
            shouldTrigger = prevClose > alert.price && currentClose <= alert.price;
          } else if (alert.condition === "crossing") {
            shouldTrigger =
              (prevClose < alert.price && currentClose >= alert.price) ||
              (prevClose > alert.price && currentClose <= alert.price);
          }

          if (shouldTrigger) {
            changed = true;
            const triggered = { ...alert, triggered: true };
            callbackRef.current?.(triggered);
            return triggered;
          }

          return alert;
        });

        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.chart]);

  return {
    alerts,
    addAlert,
    removeAlert,
    clearAlerts,
    onAlertTriggered,
  };
}
