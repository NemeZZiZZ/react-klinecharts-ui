import { useMeasure } from "react-klinecharts-ui";

/** Toggle the measure tool and read its result — showcases `useMeasure`. */
export function MeasureToolbar() {
  const { isActive, startMeasure, cancelMeasure, result } = useMeasure();
  return (
    <>
      <button
        data-active={isActive}
        onClick={isActive ? cancelMeasure : startMeasure}
      >
        {isActive ? "Measuring… (click two points)" : "Measure"}
      </button>
      {result ? (
        <span style={{ fontSize: "0.75rem" }}>
          Δ {result.priceDiff} ({result.pricePercent}%) · {result.bars} bars
        </span>
      ) : null}
    </>
  );
}
