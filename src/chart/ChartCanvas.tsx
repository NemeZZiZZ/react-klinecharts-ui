import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
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
   * Inline styles applied to the chart container div. The container has no
   * default size — give the chart a height either via this prop (e.g.
   * `style={{ height: 500 }}`), a `className` with a height, or a parent
   * with a constrained height. See the README "Chart sizing" section.
   */
  style?: CSSProperties;
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
 * The chart renders inside a plain container `<div>` with no default size —
 * see the `style` prop and the README "Chart sizing" section. A ref is
 * forwarded to the klinecharts `Chart` instance once it is ready.
 */
export const ChartCanvas = forwardRef<Chart, ChartCanvasProps>(
  function ChartCanvas(
    { className, style, children, options, styles },
    ref,
  ): ReactNode {
    const {
      state,
      dispatch,
      datafeed,
      replayActiveRef,
      replaySavedDataRef,
      replayIndexRef,
    } = useKlinechartsUI();

    // Generation counter shared by every loader instance of THIS chart: when the
    // datafeed prop is swapped, the rebuilt loader bumps the same counter, so an
    // init still in flight on the previous loader detects it is stale and
    // discards its result instead of delivering old-feed bars onto the new chart.
    // Kept per chart instance — sharing one ref across workspace charts would
    // cross-invalidate their independent requests.
    const loaderGenRef = useRef(0);

    // Dev-only timer for the zero-height container warning (see handleReady).
    const heightWarnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );
    const clearHeightWarnTimer = useCallback(() => {
      if (heightWarnTimerRef.current !== null) {
        clearTimeout(heightWarnTimerRef.current);
        heightWarnTimerRef.current = null;
      }
    }, []);

    const dataLoader = useMemo(
      () =>
        createDataLoader(
          datafeed,
          dispatch,
          {
            active: replayActiveRef,
            savedData: replaySavedDataRef,
            index: replayIndexRef,
          },
          // Passing the ref OBJECT (never dereferencing `.current`) during
          // render is safe: the loader only bumps/reads the counter inside its
          // async getBars callbacks, long after render has committed.
          // eslint-disable-next-line react-hooks/refs
          loaderGenRef,
        ),
      [datafeed, dispatch, replayActiveRef, replaySavedDataRef, replayIndexRef],
    );

    // Keep the latest default indicator lists in refs so `handleReady` stays
    // stable (only depends on `dispatch`) yet reads current values when the
    // chart finishes initializing.
    const mainIndicatorsRef = useRef(state.mainIndicators);
    const subIndicatorsRef = useRef(state.subIndicators);
    // Persisted per-indicator Y-axis bindings and visibility (restored from
    // storage into provider state). They must reach the fresh chart too: an
    // indicator re-created without its `yAxisId` rebinds to the pane's default
    // axis, and one re-created without `visible: false` reappears on screen
    // while the provider (and every UI checkbox) still claims it is hidden.
    const indicatorAxesRef = useRef(state.indicatorAxes);
    const indicatorVisibilityRef = useRef(state.indicatorVisibility);
    useEffect(() => {
      mainIndicatorsRef.current = state.mainIndicators;
      subIndicatorsRef.current = state.subIndicators;
      indicatorAxesRef.current = state.indicatorAxes;
      indicatorVisibilityRef.current = state.indicatorVisibility;
    }, [
      state.mainIndicators,
      state.subIndicators,
      state.indicatorAxes,
      state.indicatorVisibility,
    ]);

    // Persisted per-indicator settings to re-apply on the fresh chart, keyed by
    // the same `main_<name>` / `sub_<name>` ids every hook uses.
    const axisOverride = useCallback(
      (id: string) => {
        const yAxisId = indicatorAxesRef.current[id];
        const visible = indicatorVisibilityRef.current[id];
        return {
          ...(yAxisId ? { yAxisId } : {}),
          ...(visible === false ? { visible: false } : {}),
        };
      },
      [],
    );

    const handleReady = useCallback(
      (chart: Chart) => {
        // The bridge: register the chart instance so every hook can drive it.
        dispatch({ type: "SET_CHART", chart });

        // Bootstrap the provider's default indicators onto the fresh chart,
        // mirroring the canonical pattern in examples/ChartView.tsx.
        mainIndicatorsRef.current.forEach((name) => {
          const id = `main_${name}`;
          // klinecharts v10: createIndicator(value, isStack). The pane is set by
          // passing paneId on the IndicatorCreate value (the old 2nd-arg options
          // object was removed in the 10.0.0 stable release).
          chart.createIndicator(
            {
              name,
              id,
              paneId: "candle_pane",
              ...axisOverride(id),
            },
            true,
          );
        });

        const subUpdates: Record<string, string> = {};
        Object.keys(subIndicatorsRef.current).forEach((name) => {
          const id = `sub_${name}`;
          chart.createIndicator({ name, id, ...axisOverride(id) });
          const ind = chart.getIndicators({ id })[0];
          if (ind?.paneId) subUpdates[name] = ind.paneId;
        });
        if (Object.keys(subUpdates).length > 0) {
          dispatch({
            type: "SET_SUB_INDICATORS",
            indicators: { ...subIndicatorsRef.current, ...subUpdates },
          });
        }

        // Dev-only: a zero-height container is the #1 integration pitfall —
        // the canvas is created at height 0 and stays blank, with no error.
        // klinecharts observes the container with a ResizeObserver, so a chart
        // that gets a real size later recovers on its own; the check is
        // therefore delayed past the first layout passes (hidden tabs, dock
        // panels sized on a later frame) and skipped while deliberately hidden.
        if (process.env.NODE_ENV !== "production") {
          clearHeightWarnTimer();
          heightWarnTimerRef.current = setTimeout(() => {
            heightWarnTimerRef.current = null;
            const container = chart.getDom();
            if (!container || !container.isConnected) return;
            const computed = window.getComputedStyle(container);
            if (
              computed.display === "none" ||
              computed.visibility === "hidden"
            ) {
              return;
            }
            if (container.clientHeight === 0) {
              console.warn(
                "[react-klinecharts-ui] ChartCanvas: the chart container still has zero height ~1.5s after mount, so the canvas cannot render. The container <div> has no default size — give it a height via the `style` prop (e.g. style={{ height: 500 }}), a `className` with a height, or a parent with a constrained height. See the \"Chart sizing\" section in the README.",
              );
            }
          }, 1500);
        }
      },
      [dispatch, clearHeightWarnTimer, axisOverride],
    );

    // Clear the registered chart on unmount: react-klinecharts disposes the
    // klinecharts instance in its own cleanup without notifying onReady, and
    // without this every `state.chart?.x()` across the hooks would keep driving
    // a dead chart (the `?.` guard only covers null and would silently swallow
    // the problem) — including the provider pollers reading getDataList() from
    // a disposed instance.
    useEffect(
      () => () => {
        clearHeightWarnTimer();
        dispatch({ type: "SET_CHART", chart: null });
      },
      [dispatch, clearHeightWarnTimer],
    );

    return (
      <KLineChart
        className={className}
        style={style}
        options={options}
        styles={styles ?? state.theme}
        dataLoader={dataLoader}
        symbol={state.symbol ?? undefined}
        period={state.period}
        locale={state.locale}
        timezone={state.timezone}
        onReady={handleReady}
        ref={ref}
      >
        {children}
      </KLineChart>
    );
  },
);
