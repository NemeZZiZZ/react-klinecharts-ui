import { useState } from "react";
import { useChartAxes } from "react-klinecharts-ui";

/** Toggles built-in axis overrides — showcases `useChartAxes`. */
export function ChartAxesToolbar() {
  const { overrideYAxis, overrideXAxis } = useChartAxes();
  const [reverse, setReverse] = useState(false);
  const [inside, setInside] = useState(false);
  const [zoom, setZoom] = useState(true);

  return (
    <>
      <button
        onClick={() => {
          const next = !reverse;
          setReverse(next);
          overrideYAxis({ reverse: next });
        }}
      >
        Reverse Y: {reverse ? "on" : "off"}
      </button>
      <button
        onClick={() => {
          const next = !inside;
          setInside(next);
          overrideYAxis({ inside: next });
        }}
      >
        Inside labels: {inside ? "on" : "off"}
      </button>
      <button
        onClick={() => {
          const next = !zoom;
          setZoom(next);
          overrideXAxis({ scrollZoomEnabled: next });
        }}
      >
        X zoom: {zoom ? "on" : "off"}
      </button>
    </>
  );
}
