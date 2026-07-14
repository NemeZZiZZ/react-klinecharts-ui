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
import { resolveStorage, type ResolvedStorage, type StorageOptions } from "../storage";
import type { Alert } from "./featureTypes";

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
  // NOTE: no destructuring default here — the init function must distinguish
  // "consumer passed default*" (wins) from "use stored value" (hydrate).
  defaultMainIndicators,
  defaultSubIndicators,
  defaultLocale = "en-US",
  periods,
  styles,
  registerExtensions: shouldRegister = true,
  overlays: extraOverlays,
  storage: storageOptions,
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
  // Resolve storage once for the lifetime of the provider. `storageOptions` is
  // captured by value (not reference) so an inline consumer prop won't churn
  // the resolved object. `null` when persistence is disabled.
  const resolvedStorage = useMemo<ResolvedStorage | null>(
    () => (storageOptions ? resolveStorage(storageOptions as StorageOptions) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

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
      storage: resolvedStorage,
    },
    (opts) => {
      const s = opts.storage as ResolvedStorage | null;
      const read = <T,>(ns: "alerts" | "settings" | "indicators", fallback: T): T => {
        if (!s || !s.persists(ns)) return fallback;
        try {
          const raw = s.adapter.getItem(s.key(ns));
          return raw ? (JSON.parse(raw) as T) : fallback;
        } catch {
          return fallback;
        }
      };

      // Hydrate indicators. Stored shape: { main: string[], sub: Record<string,string>, axes, visibility }.
      const storedIndicators = read<{
        main?: string[];
        sub?: Record<string, string>;
        axes?: Record<string, string>;
        visibility?: Record<string, boolean>;
      }>("indicators", {});

      return {
        chart: null,
        datafeed: opts.datafeed,
        symbol: opts.defaultSymbol ?? null,
        period: opts.defaultPeriod ?? (opts.periods ?? DEFAULT_PERIODS)[0],
        theme: opts.defaultTheme ?? "light",
        timezone: opts.defaultTimezone ?? "Asia/Shanghai",
        isLoading: false,
        locale: opts.defaultLocale ?? "en-US",
        periods: opts.periods ?? DEFAULT_PERIODS,
        // Persistence semantics: STORED values win over `default*` props —
        // the user's saved configuration should survive reload even when the
        // app passes defaults. Only when storage is empty/unconfigured do the
        // `default*` props apply, falling back to the built-ins last.
        // (Settings live in useKlinechartsUISettings useState and hydrate
        // separately via the dispatch-context `storage`.)
        mainIndicators:
          storedIndicators.main ?? opts.defaultMainIndicators ?? ["MA"],
        subIndicators: storedIndicators.sub ??
          (opts.defaultSubIndicators
            ? opts.defaultSubIndicators.reduce(
                (acc, name) => ({ ...acc, [name]: "" }),
                {} as Record<string, string>,
              )
            : { VOL: "" }),
        indicatorAxes: storedIndicators.axes ?? {},
        indicatorVisibility: storedIndicators.visibility ?? {},
        alerts: read<Alert[]>("alerts", []),
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
      };
    },
  );

  const fullscreenContainerRef = useRef<HTMLElement | null>(null);
  const undoRedoListenerRef = useRef<import("./types").UndoRedoListener | null>(null);

  // Provider-owned feature resources (single owner across all hook instances).
  // Multi-listener: several components (toolbar, status bar, sound trigger) can
  // observe alert firings without one overwriting the other.
  const alertTriggeredListenersRef = useRef<
    Set<(alert: import("./featureTypes").Alert) => void>
  >(new Set());
  const replayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const replaySavedDataRef = useRef<import("klinecharts").KLineData[]>([]);
  const replayIndexRef = useRef<number>(0);
  // Mirror of `state.replay.isReplaying` read by the replay-aware DataLoader
  // intercept (in createDataLoader, wired by ChartCanvas). A ref (not state) so
  // the loader — created once per chart — always sees the current flag.
  const replayActiveRef = useRef(false);
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
    replayActiveRef.current = state.replay.isReplaying;
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

  // datafeed and onSettingsChange are NOT mirrored into refs for the dispatch
  // context: a ref read inside useMemo would go stale when the consumer swaps
  // the prop at runtime (e.g. authenticated feed after login), silently leaving
  // useCompare / useSymbolSearch / useWatchlist / ChartCanvas on the old feed.
  // Instead they are included in the useMemo deps below so the context — and its
  // consumers — update when the prop reference changes. Consumers that pass an
  // inline datafeed object / arrow callback every render should memoize it.

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
    // Per-alert previous value cache (alertId → last seen value), so indicator
    // targets get their own crossing baseline (the price baseline only works
    // for price targets). Seeded lazily — first observation never fires.
    const prevValueByAlert = new Map<string, number>();

    const interval = setInterval(() => {
      const dataList = chart.getDataList();
      if (!dataList || dataList.length === 0) return;
      const lastIdx = dataList.length - 1;

      // Cache indicator results keyed by indicatorId so multiple alerts on the
      // same indicator don't re-query the chart.
      const indicatorCache = new Map<string, number | null>();

      const readIndicatorValue = (
        indicatorId: string,
        figureKey: string,
      ): number | null => {
        const cacheKey = `${indicatorId}:${figureKey}`;
        if (indicatorCache.has(cacheKey)) return indicatorCache.get(cacheKey)!;
        let value: number | null = null;
        try {
          const indicators = chart.getIndicators({ id: indicatorId });
          const ind = indicators?.[0];
          const result = ind?.result;
          const last = Array.isArray(result) ? result[lastIdx] : null;
          if (last && typeof last === "object") {
            const v = (last as Record<string, unknown>)[figureKey];
            value = typeof v === "number" ? v : null;
          }
        } catch {
          value = null;
        }
        indicatorCache.set(cacheKey, value);
        return value;
      };

      const alerts = stateRef.current.alerts;
      const triggeredIds: string[] = [];
      for (const alert of alerts) {
        if (alert.triggered) continue;

        const target = alert.target ?? { type: "price" } as const;
        let currentValue: number | null;
        if (target.type === "indicator") {
          currentValue = readIndicatorValue(target.indicatorId, target.figureKey);
        } else {
          currentValue = dataList[lastIdx].close;
        }
        if (currentValue === null || !Number.isFinite(currentValue)) continue;

        const prevValue = prevValueByAlert.get(alert.id) ?? null;
        prevValueByAlert.set(alert.id, currentValue);
        if (prevValue === null) continue; // first observation seeds the baseline

        const crossedUp = prevValue < alert.price && currentValue >= alert.price;
        const crossedDown = prevValue > alert.price && currentValue <= alert.price;
        const shouldTrigger =
          alert.condition === "crossing_up"
            ? crossedUp
            : alert.condition === "crossing_down"
              ? crossedDown
              : crossedUp || crossedDown;

        if (shouldTrigger) {
          triggeredIds.push(alert.id);
          const fired = { ...alert, triggered: true };
          alertTriggeredListenersRef.current.forEach((cb) => cb(fired));
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

  // --- Persistence write-back ------------------------------------------------
  // Each persisted slice is written through its own effect on the relevant
  // state field. Effects (not enhancedDispatch interception) so raw `dispatch`
  // calls and reducer state changes are covered uniformly, and the writes stay
  // in the commit phase (React 19 compliant). All writes are guarded by the
  // resolved storage config and swallow adapter errors so a failing backend
  // never breaks the chart.
  const writeNs = useCallback(
    (ns: "alerts" | "indicators", value: unknown) => {
      if (!resolvedStorage || !resolvedStorage.persists(ns)) return;
      try {
        resolvedStorage.adapter.setItem(
          resolvedStorage.key(ns),
          JSON.stringify(value),
        );
      } catch {
        // adapter failure (quota, serialization) is non-fatal for the chart
      }
    },
    [resolvedStorage],
  );

  useEffect(() => {
    writeNs("alerts", state.alerts);
  }, [state.alerts, writeNs]);

  useEffect(() => {
    writeNs("indicators", {
      main: state.mainIndicators,
      sub: state.subIndicators,
      axes: state.indicatorAxes,
      visibility: state.indicatorVisibility,
    });
  }, [
    state.mainIndicators,
    state.subIndicators,
    state.indicatorAxes,
    state.indicatorVisibility,
    writeNs,
  ]);

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
      datafeed,
      onSettingsChange,
      fullscreenContainerRef,
      undoRedoListenerRef,
      alertTriggeredListenersRef,
      replayIntervalRef,
      replaySavedDataRef,
      replayIndexRef,
      replayActiveRef,
      storage: resolvedStorage,
    }),
    [enhancedDispatch, resolvedStorage, datafeed, onSettingsChange],
  );

  return (
    <KlinechartsUIStateContext.Provider value={state}>
      <KlinechartsUIDispatchContext.Provider value={dispatchValue}>
        {children}
      </KlinechartsUIDispatchContext.Provider>
    </KlinechartsUIStateContext.Provider>
  );
}
