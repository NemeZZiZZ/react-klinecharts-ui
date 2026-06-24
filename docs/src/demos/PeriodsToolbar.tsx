import { usePeriods } from "react-klinecharts-ui";

/** Toolbar that switches the active period — showcases `usePeriods`. */
export function PeriodsToolbar() {
  const { periods, activePeriod, setPeriod } = usePeriods();
  return (
    <>
      {periods.map((p) => (
        <button
          key={p.label}
          data-active={activePeriod.label === p.label}
          onClick={() => setPeriod(p)}
        >
          {p.label}
        </button>
      ))}
    </>
  );
}
