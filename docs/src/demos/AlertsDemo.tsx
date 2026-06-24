import { useEffect, useState } from "react";
import { useAlerts, useKlinechartsUI } from "react-klinecharts-ui";
import { DemoFrame } from "./DemoFrame";

function Toolbar() {
  const { state } = useKlinechartsUI();
  const { alerts, addAlert, clearAlerts, onAlertTriggered } = useAlerts();
  const [fired, setFired] = useState<string | null>(null);

  useEffect(() => {
    onAlertTriggered((alert) => setFired(alert.message ?? `${alert.price}`));
  }, [onAlertTriggered]);

  function lastClose(): number | null {
    const data = state.chart?.getDataList();
    if (!data || data.length === 0) return null;
    return data[data.length - 1].close;
  }

  function add(direction: "up" | "down") {
    const price = lastClose();
    if (price == null) return;
    const level = +(price * (direction === "up" ? 1.01 : 0.99)).toFixed(2);
    addAlert(
      level,
      direction === "up" ? "crossing_up" : "crossing_down",
      `Crossed ${level}`,
      { color: direction === "up" ? "#26a69a" : "#ef5350" },
    );
  }

  return (
    <>
      <button onClick={() => add("up")}>Alert +1%</button>
      <button onClick={() => add("down")}>Alert −1%</button>
      <button onClick={clearAlerts}>Clear</button>
      <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>
        {alerts.length} active{fired ? ` · fired: ${fired}` : ""}
      </span>
    </>
  );
}

/** Self-contained demo for `useAlerts` — alerts draw their own chart lines. */
export function AlertsDemo() {
  return (
    <DemoFrame
      toolbar={<Toolbar />}
      note="Alerts poll the latest candle once per second and fire when the close crosses the level."
    />
  );
}
