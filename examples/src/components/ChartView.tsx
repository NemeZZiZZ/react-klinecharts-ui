import { useCallback, useEffect, useMemo, useRef } from "react";
import { KLineChart } from "react-klinecharts";
import type { Chart } from "klinecharts";
import { useKlinechartsUI, createDataLoader } from "react-klinecharts-ui";
import { IndicatorPaneOverlays } from "./IndicatorPaneOverlays";
import { OrderLineOverlays } from "./OrderLineOverlays";
import { Watermark } from "./Watermark";
import { ChartContextMenu } from "./ChartContextMenu";
import { cn } from "@/lib/utils";

interface ChartViewProps {
  className?: string;
}

export function ChartView({ className }: ChartViewProps) {
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

  // Refs so onReady always reads the latest indicator lists without
  // being recreated on every render (stable dispatch dep only).
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
        // klinecharts v10: createIndicator(value, isStack) — paneId lives on
        // the IndicatorCreate value.
        chart.createIndicator(
          { name, id: `main_${name}`, paneId: "candle_pane" },
          true,
        );
      });

      const subUpdates: Record<string, string> = {};
      Object.keys(subIndicatorsRef.current).forEach((name) => {
        const id = `sub_${name}`;
        chart.createIndicator({ name, id });
        const ind = chart.getIndicators({ id })[0];
        if (ind?.paneId) subUpdates[name] = ind.paneId;
      });
      if (Object.keys(subUpdates).length > 0) {
        dispatch({
          type: "SET_SUB_INDICATORS",
          indicators: { ...subIndicatorsRef.current, ...subUpdates },
        });
      }
    },
    [dispatch],
  );

  return (
    <ChartContextMenu className={cn("grid relative", className)}>
      <KLineChart
        className="absolute inset-0 z-2"
        dataLoader={dataLoader}
        symbol={state.symbol ?? undefined}
        period={state.period}
        locale={state.locale}
        timezone={state.timezone}
        styles={state.theme}
        onReady={handleReady}
      >
        <Watermark className="row-start-1 col-start-1 z-1" />
        <IndicatorPaneOverlays />
        <OrderLineOverlays />
      </KLineChart>
    </ChartContextMenu>
  );
}
