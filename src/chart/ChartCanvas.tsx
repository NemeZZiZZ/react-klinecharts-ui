import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { KLineChart } from "react-klinecharts";
import type { Chart, Options, DeepPartial, Styles } from "klinecharts";
import {
  useKlinechartsUI,
} from "../provider/ChartTerminalContext";
import { createDataLoader } from "../utils/createDataLoader";

export interface ChartCanvasProps {
  /** className applied to the chart container div. */
  className?: string;
  /**
   * Optional children rendered inside `<KLineChart>` (use the `<Widget>`
   * component from `react-klinecharts` to portal React into chart DOM layers).
   */
  children?: ReactNode;
  /**
   * Chart initialization options, applied once on mount. Forwarded to
   * `<KLineChart>` as the `options` prop.
   */
  options?: Options;
  /**
   * Styles override applied on mount and whenever it changes. Forwarded to
   * `<KLineChart>` as the `styles` prop.
   */
  styles?: string | DeepPartial<Styles>;
}

/**
 * Thin renderer wrapper for `react-klinecharts-ui`.
 *
 * `react-klinecharts-ui` is **headless / renderer-agnostic**: it only needs a
 * klinecharts `Chart` instance to be registered via
 * `dispatch({ type: "SET_CHART", chart })`. This component wires the
 * `<KLineChart>` renderer from `react-klinecharts` to that bridge for you —
 * building the data loader, forwarding symbol/period/theme/locale/timezone
 * from provider state, bootstrapping the default indicators, and dispatching
 * `SET_CHART` on ready.
 *
 * It is the fastest path to a working chart. For full control (custom
 * lifecycle, a different renderer, or direct `klinecharts.init()`), render the
 * chart yourself and dispatch `SET_CHART` — see the README "Renderer-agnostic"
 * section.
 *
 * This entry point requires `react-klinecharts` as an optional peer
 * dependency. Install it explicitly when you import from
 * `react-klinecharts-ui/chart`.
 */
export function ChartCanvas({
  className,
  children,
  options,
  styles,
}: ChartCanvasProps): ReactNode {
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

  // Keep the latest default indicator lists in refs so `handleReady` stays
  // stable (only depends on `dispatch`) yet reads current values when the
  // chart finishes initializing.
  const mainIndicatorsRef = useRef(state.mainIndicators);
  const subIndicatorsRef = useRef(state.subIndicators);
  useEffect(() => {
    mainIndicatorsRef.current = state.mainIndicators;
    subIndicatorsRef.current = state.subIndicators;
  }, [state.mainIndicators, state.subIndicators]);

  const handleReady = useCallback(
    (chart: Chart) => {
      // The bridge: register the chart instance so every hook can drive it.
      dispatch({ type: "SET_CHART", chart });

      // Bootstrap the provider's default indicators onto the fresh chart,
      // mirroring the canonical pattern in examples/ChartView.tsx.
      mainIndicatorsRef.current.forEach((name) => {
        // klinecharts v10: createIndicator(value, isStack). The pane is set by
        // passing paneId on the IndicatorCreate value (the old 2nd-arg options
        // object was removed in the 10.0.0 stable release).
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
    <KLineChart
      className={className}
      options={options}
      styles={styles ?? state.theme}
      dataLoader={dataLoader}
      symbol={state.symbol ?? undefined}
      period={state.period}
      locale={state.locale}
      timezone={state.timezone}
      onReady={handleReady}
    >
      {children}
    </KLineChart>
  );
}
