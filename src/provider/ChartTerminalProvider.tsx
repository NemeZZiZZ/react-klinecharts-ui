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
import { registerOverlay } from "react-klinecharts";

function reducer(
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
  const replaySavedDataRef = useRef<import("react-klinecharts").KLineData[]>([]);
  const replayIndexRef = useRef<number>(0);
  // Last seen close price, used by the alerts poller to detect crossings.
  const alertPrevCloseRef = useRef<number | null>(null);

  // Tracks the current state so enhancedDispatch can compute the new state
  // synchronously (reducer is pure, so we can call it before dispatch).
  const stateRef = useRef(state);
  stateRef.current = state;

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
  callbacksRef.current = {
    onStateChange,
    onSymbolChange,
    onPeriodChange,
    onThemeChange,
    onTimezoneChange,
    onMainIndicatorsChange,
    onSubIndicatorsChange,
  };

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
      let changed = false;
      const next = alerts.map((alert) => {
        if (alert.triggered) return alert;

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
          changed = true;
          const triggered = { ...alert, triggered: true };
          alertTriggeredListenerRef.current?.(triggered);
          return triggered;
        }
        return alert;
      });

      if (changed) {
        enhancedDispatch({ type: "SET_ALERTS", alerts: next });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state.chart, hasAlerts, enhancedDispatch]);

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

  // Dispatch context is stable — only recreated if datafeed/onSettingsChange
  // reference changes (which should be rare / memoised by the consumer).
  const dispatchValue = useMemo(
    () => ({
      dispatch: enhancedDispatch,
      datafeed,
      onSettingsChange,
      fullscreenContainerRef,
      undoRedoListenerRef,
      alertTriggeredListenerRef,
      replayIntervalRef,
      replaySavedDataRef,
      replayIndexRef,
    }),
    [enhancedDispatch, datafeed, onSettingsChange],
  );

  return (
    <KlinechartsUIStateContext.Provider value={state}>
      <KlinechartsUIDispatchContext.Provider value={dispatchValue}>
        {children}
      </KlinechartsUIDispatchContext.Provider>
    </KlinechartsUIStateContext.Provider>
  );
}
