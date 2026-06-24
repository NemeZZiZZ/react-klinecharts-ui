import { useKlinechartsUISettings } from "react-klinecharts-ui";

/** Switch candle type and price-axis scale — showcases `useKlinechartsUISettings`. */
export function SettingsToolbar() {
  const {
    candleType,
    candleTypes,
    setCandleType,
    priceAxisType,
    priceAxisTypes,
    setPriceAxisType,
  } = useKlinechartsUISettings();

  return (
    <>
      <label style={{ fontSize: "0.8125rem" }}>
        Candle:{" "}
        <select
          value={candleType}
          onChange={(e) => setCandleType(e.target.value)}
        >
          {candleTypes.map((c) => (
            <option key={c.key} value={c.key}>
              {c.key}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: "0.8125rem" }}>
        Y-axis:{" "}
        <select
          value={priceAxisType}
          onChange={(e) =>
            setPriceAxisType(e.target.value as typeof priceAxisType)
          }
        >
          {priceAxisTypes.map((p) => (
            <option key={p.key} value={p.key}>
              {p.key}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
