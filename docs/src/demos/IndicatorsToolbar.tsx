import { useIndicators } from "react-klinecharts-ui";

const MAIN = ["MA", "EMA", "BOLL"];
const SUB = ["VOL", "MACD", "RSI", "KDJ"];

/** Add/remove main and sub indicators — showcases `useIndicators`. */
export function IndicatorsToolbar() {
  const {
    toggleMainIndicator,
    toggleSubIndicator,
    isMainIndicatorActive,
    isSubIndicatorActive,
  } = useIndicators();

  return (
    <>
      <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>Main:</span>
      {MAIN.map((name) => (
        <button
          key={name}
          data-active={isMainIndicatorActive(name)}
          onClick={() => toggleMainIndicator(name)}
        >
          {name}
        </button>
      ))}
      <span style={{ fontSize: "0.75rem", opacity: 0.7, marginLeft: "0.5rem" }}>
        Sub:
      </span>
      {SUB.map((name) => (
        <button
          key={name}
          data-active={isSubIndicatorActive(name)}
          onClick={() => toggleSubIndicator(name)}
        >
          {name}
        </button>
      ))}
    </>
  );
}
