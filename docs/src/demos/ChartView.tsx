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
  const {
    state,
    dispatch,
    datafeed,
    replayActiveRef,
    replaySavedDataRef,
    replayIndexRef,
  } = useKlinechartsUI();

  const dataLoader = useMemo(
    () =>
      createDataLoader(datafeed, dispatch, {
        active: replayActiveRef,
        savedData: replaySavedDataRef,
        index: replayIndexRef,
      }),
    [datafeed, dispatch, replayActiveRef, replaySavedDataRef, replayIndexRef],
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
          { name, id: `main_${name}`, paneId: "candle_pane" },
          true,
        );
      });

      Object.keys(subIndicatorsRef.current).forEach((name) => {
        chart.createIndicator({ name, id: `sub_${name}` }, false);
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
