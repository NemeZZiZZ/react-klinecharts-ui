import {
  useReducer,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  type ReactElement,
} from "react";
import type {
  KlinechartsUIOptions,
  KlinechartsUIState,
  KlinechartsUIAction,
} from "./types";
import {
  KlinechartsUIStateContext,
  KlinechartsUIDispatchContext,
} from "./ChartTerminalContext";
import { DEFAULT_PERIODS } from "../data/periods";
import { registerExtensions } from "../extensions";
import { registerOverlay } from "klinecharts";

export function reducer(
  state: KlinechartsUIState,
  action: KlinechartsUIAction,
): KlinechartsUIState {
  switch (action.type) {
    case "SET_CHART":
      return { ...state, chart: action.chart };
    case "SET_SYMBOL":
      return { ...state, symbol: action.symbol };
    case "SET_PERIOD":
      return { ...state, period: action.period };
    case "SET_THEME":
      return { ...state, theme: action.theme };
    case "SET_TIMEZONE":
      return { ...state, timezone: action.timezone };
    case "SET_LOADING":
      return { ...state, isLoading: action.isLoading };
    case "SET_MAIN_INDICATORS":
      return { ...state, mainIndicators: action.indicators };
    case "SET_SUB_INDICATORS":
      return { ...state, subIndicators: action.indicators };
    case "SET_INDICATOR_AXES":
      return { ...state, indicatorAxes: action.axes };
    case "SET_INDICATOR_VISIBILITY":
      return { ...state, indicatorVisibility: action.visibility };
    case "SET_ALERTS":
      return { ...state, alerts: action.alerts };
    case "ADD_ALERT":
      return { ...state, alerts: [...state.alerts, action.alert] };
    case "REMOVE_ALERT":
      return {
        ...state,
        alerts: state.alerts.filter((a) => a.id !== action.id),
      };
    case "CLEAR_ALERTS":
      return { ...state, alerts: [] };
    case "MARK_ALERT_TRIGGERED": {
      if (action.ids.length === 0) return state;
      const triggered = new Set(action.ids);
      return {
        ...state,
        alerts: state.alerts.map((a) =>
          triggered.has(a.id) ? { ...a, triggered: true } : a,
        ),
      };
    }
    case "SET_MEASURE":
      return { ...state, measure: { ...state.measure, ...action.measure } };
    case "SET_REPLAY":
      return { ...state, replay: { ...state.replay, ...action.replay } };
    case "SET_STYLES":
      return { ...state, styles: action.styles };
    case "SET_LOCALE":
      return { ...state, locale: action.locale };
    case "SET_SCREENSHOT_URL":
      return { ...state, screenshotUrl: action.url };
    default:
      return state;
  }
}

export function KlinechartsUIProvider({
  datafeed,
  defaultSymbol,
  defaultPeriod,
  defaultTheme = "light",
  defaultTimezone = "Asia/Shanghai",
  defaultMainIndicators = ["MA"],
  defaultSubIndicators = ["VOL"],
  defaultLocale = "en-US",
  periods,
  styles,
  registerExtensions: shouldRegister = true,
  overlays: extraOverlays,
  children,
  onStateChange,
  onSymbolChange,
  onPeriodChange,
  onThemeChange,
  onTimezoneChange,
  onMainIndicatorsChange,
  onSubIndicatorsChange,
  onSettingsChange,
}: KlinechartsUIOptions): ReactElement {
  // Lazy initializer — runs only once, avoiding a new object on every render.
  const [state, dispatch] = useReducer(
    reducer,
    {
      datafeed,
      defaultSymbol,
      defaultPeriod,
      defaultTheme,
      defaultTimezone,
      defaultMainIndicators,
      defaultSubIndicators,
      defaultLocale,
      periods,
      styles,
    },
    (opts) => ({
      chart: null,
      datafeed: opts.datafeed,
      symbol: opts.defaultSymbol ?? null,
      period: opts.defaultPeriod ?? (opts.periods ?? DEFAULT_PERIODS)[0],
      theme: opts.defaultTheme ?? "light",
      timezone: opts.defaultTimezone ?? "Asia/Shanghai",
      isLoading: false,
      locale: opts.defaultLocale ?? "en-US",
      periods: opts.periods ?? DEFAULT_PERIODS,
      mainIndicators: opts.defaultMainIndicators ?? ["MA"],
      subIndicators: (opts.defaultSubIndicators ?? ["VOL"]).reduce(
        (acc, name) => ({ ...acc, [name]: "" }),
        {} as Record<string, string>,
      ),
      indicatorAxes: {},
      indicatorVisibility: {},
      alerts: [],
      measure: { isActive: false, fromPoint: null, result: null },
      replay: {
        isReplaying: false,
        isPaused: false,
        speed: 1 as const,
        barIndex: 0,
        totalBars: 0,
      },
      styles: opts.styles,
      screenshotUrl: null,
    }),
  );

  const fullscreenContainerRef = useRef<HTMLElement | null>(null);
  const undoRedoListenerRef = useRef<import("./types").UndoRedoListener | null>(null);

  // Provider-owned feature resources (single owner across all hook instances).
  const alertTriggeredListenerRef = useRef<
    ((alert: import("./featureTypes").Alert) => void) | null
  >(null);
  const replayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const replaySavedDataRef = useRef<import("klinecharts").KLineData[]>([]);
  const replayIndexRef = useRef<number>(0);
  // Last seen close price, used by the alerts poller to detect crossings.
  const alertPrevCloseRef = useRef<number | null>(null);

  // Tracks the current state so enhancedDispatch can compute the new state
  // synchronously (reducer is pure, so we can call it before dispatch).
  // `enhancedDispatch` keeps this ref in sync on every dispatched action; the
  // effect below catches any state change that bypasses enhancedDispatch (e.g.
  // SET_CHART registered from a hook). Mutating a ref during render is not
  // allowed by React 19, so we defer to a commit-phase effect.
  const stateRef = useRef(state);

  // Keep latest callbacks in a ref so enhancedDispatch closure never goes stale.
  const callbacksRef = useRef({
    onStateChange,
    onSymbolChange,
    onPeriodChange,
    onThemeChange,
    onTimezoneChange,
    onMainIndicatorsChange,
    onSubIndicatorsChange,
  });

  useEffect(() => {
    stateRef.current = state;
    callbacksRef.current = {
      onStateChange,
      onSymbolChange,
      onPeriodChange,
      onThemeChange,
      onTimezoneChange,
      onMainIndicatorsChange,
      onSubIndicatorsChange,
    };
  });

  /**
   * Wraps dispatch so that per-action callbacks are called synchronously.
   * Because React's dispatch is async, we pre-compute the new state by
   * calling reducer() directly (it is pure) — this gives onStateChange the
   * correct post-action state without any useEffect delay.
   */
  const enhancedDispatch = useCallback((action: KlinechartsUIAction) => {
    const prevState = stateRef.current;
    const newState = reducer(prevState, action);
    stateRef.current = newState; // Update immediately so sequential sync dispatches see the new state
    dispatch(action);
    const cbs = callbacksRef.current;
    cbs.onStateChange?.(action, newState, prevState);
    switch (action.type) {
      case "SET_SYMBOL":
        cbs.onSymbolChange?.(action.symbol);
        break;
      case "SET_PERIOD":
        cbs.onPeriodChange?.(action.period);
        break;
      case "SET_THEME":
        cbs.onThemeChange?.(action.theme);
        break;
      case "SET_TIMEZONE":
        cbs.onTimezoneChange?.(action.timezone);
        break;
      case "SET_MAIN_INDICATORS":
        cbs.onMainIndicatorsChange?.(action.indicators);
        break;
      case "SET_SUB_INDICATORS":
        cbs.onSubIndicatorsChange?.(action.indicators);
        break;
    }
  }, []);

  // Capture initial overlays in a ref so the effect doesn't re-run when the
  // consumer passes an inline array (which would be a new reference each render).
  const extraOverlaysRef = useRef(extraOverlays);

  // Mirror datafeed and onSettingsChange into refs so dispatchValue (below)
  // stays referentially stable even when the consumer passes inline props.
  // Without this, an inline datafeed/object or arrow-function callback would
  // recreate dispatchValue on every render and re-render every hook consumer.
  const datafeedRef = useRef(datafeed);
  const onSettingsChangeRef = useRef(onSettingsChange);
  useEffect(() => {
    datafeedRef.current = datafeed;
    onSettingsChangeRef.current = onSettingsChange;
  });

  useEffect(() => {
    if (shouldRegister) {
      registerExtensions();
    }
    extraOverlaysRef.current?.forEach((overlay) => registerOverlay(overlay));
  }, [shouldRegister]);

  useEffect(() => {
    if (state.chart && state.styles) {
      state.chart.setStyles(state.styles);
    }
  }, [state.chart, state.styles]);

  // Provider-owned price-alert poller (single owner). Runs one 1s interval —
  // only while there is a chart and at least one alert — reads the live alert
  // list from stateRef, marks crossings triggered, and notifies the listener
  // registered via useAlerts.onAlertTriggered. Replaces the per-hook interval
  // so multiple useAlerts instances can no longer each spawn a poller.
  const hasAlerts = state.alerts.length > 0;
  useEffect(() => {
    const chart = state.chart;
    if (!chart || !hasAlerts) return;

    // Seed on (re)start so the first tick never fires a spurious crossing.
    alertPrevCloseRef.current = null;

    const interval = setInterval(() => {
      const dataList = chart.getDataList();
      if (!dataList || dataList.length === 0) return;

      const currentClose = dataList[dataList.length - 1].close;
      const prevClose = alertPrevCloseRef.current;
      alertPrevCloseRef.current = currentClose;
      if (prevClose === null) return;

      const alerts = stateRef.current.alerts;
      const triggeredIds: string[] = [];
      for (const alert of alerts) {
        if (alert.triggered) continue;

        const crossedUp =
          prevClose < alert.price && currentClose >= alert.price;
        const crossedDown =
          prevClose > alert.price && currentClose <= alert.price;
        const shouldTrigger =
          alert.condition === "crossing_up"
            ? crossedUp
            : alert.condition === "crossing_down"
              ? crossedDown
              : crossedUp || crossedDown;

        if (shouldTrigger) {
          triggeredIds.push(alert.id);
          alertTriggeredListenerRef.current?.({ ...alert, triggered: true });
        }
      }

      // Use the granular MARK_ALERT_TRIGGERED action (not SET_ALERTS) so a
      // concurrent add/remove cannot revert the triggered flag: the reducer
      // only flips `triggered` on the listed ids and leaves everything else.
      if (triggeredIds.length > 0) {
        enhancedDispatch({
          type: "MARK_ALERT_TRIGGERED",
          ids: triggeredIds,
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state.chart, hasAlerts, enhancedDispatch]);

  // When the underlying data is replaced (symbol/period change), the KLineChart
  // component is NOT remounted — it just reloads data — so the poller effect
  // above does not re-run and alertPrevCloseRef keeps the OLD symbol's last
  // close. That would compare the new symbol's close against the old one,
  // producing spurious triggers or missed crossings. Reset the baseline here.
  useEffect(() => {
    alertPrevCloseRef.current = null;
  }, [state.symbol, state.period]);

  // Provider owns the replay playback interval — clear it if the provider
  // unmounts (the hook no longer clears it on its own unmount, since the timer
  // is shared across instances).
  useEffect(() => {
    return () => {
      if (replayIntervalRef.current !== null) {
        clearInterval(replayIntervalRef.current);
        replayIntervalRef.current = null;
      }
    };
  }, []);

  // Dispatch context is stable across renders: it only depends on
  // `enhancedDispatch` (which is itself a stable useCallback with []). datafeed
  // and onSettingsChange are read through refs so inline consumer props don't
  // recreate this object — every useKlinechartsUI() consumer would otherwise
  // re-render on each provider render.
  const dispatchValue = useMemo(
    () => ({
      dispatch: enhancedDispatch,
      datafeed: datafeedRef.current,
      onSettingsChange: onSettingsChangeRef.current,
      fullscreenContainerRef,
      undoRedoListenerRef,
      alertTriggeredListenerRef,
      replayIntervalRef,
      replaySavedDataRef,
      replayIndexRef,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enhancedDispatch],
  );

  return (
    <KlinechartsUIStateContext.Provider value={state}>
      <KlinechartsUIDispatchContext.Provider value={dispatchValue}>
        {children}
      </KlinechartsUIDispatchContext.Provider>
    </KlinechartsUIStateContext.Provider>
  );
}
