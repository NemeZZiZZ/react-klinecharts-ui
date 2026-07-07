import { useCallback, useEffect, useMemo, useRef } from "react";
import { KLineChart } from "react-klinecharts";
import type { Chart } from "klinecharts";
import { useKlinechartsUI, createDataLoader } from "react-klinecharts-ui";

/**
 * Minimal, dependency-free chart view for the documentation demos. It mirrors
 * the example app's ChartView but drops Tailwind/shadcn so it can live inside
 * the docs site with plain inline styles.
 */
export function ChartView({ height = 380 }: { height?: number }) {
  const { state, dispatch, datafeed } = useKlinechartsUI();

  const dataLoader = useMemo(
    () => createDataLoader(datafeed, dispatch),
    [datafeed, dispatch],
  );

  const mainIndicatorsRef = useRef(state.mainIndicators);
  const subIndicatorsRef = useRef(state.subIndicators);
  useEffect(() => {
    mainIndicatorsRef.current = state.mainIndicators;
    subIndicatorsRef.current = state.subIndicators;
  }, [state.mainIndicators, state.subIndicators]);

  const handleReady = useCallback(
    (chart: Chart) => {
      dispatch({ type: "SET_CHART", chart });

      mainIndicatorsRef.current.forEach((name) => {
        chart.createIndicator(
          { name, id: `main_${name}` },
          { isStack: true, pane: { id: "candle_pane" } },
        );
      });

      Object.keys(subIndicatorsRef.current).forEach((name) => {
        chart.createIndicator({ name, id: `sub_${name}` });
      });
    },
    [dispatch],
  );

  return (
    <div style={{ position: "relative", height, width: "100%" }}>
      <KLineChart
        style={{ position: "absolute", inset: 0 }}
        dataLoader={dataLoader}
        symbol={state.symbol ?? undefined}
        period={state.period}
        locale={state.locale}
        timezone={state.timezone}
        styles={state.theme}
        onReady={handleReady}
      />
    </div>
  );
}
