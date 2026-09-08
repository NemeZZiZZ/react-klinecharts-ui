import {
  useReducer,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  useSyncExternalStore,
  type ReactElement,
} from "react";
import type {
  Datafeed,
  KlinechartsUIOptions,
  KlinechartsUIState,
  KlinechartsUIAction,
} from "./types";
import {
  KlinechartsUIStateContext,
  KlinechartsUIDispatchContext,
} from "./ChartTerminalContext";
import { DEFAULT_PERIODS, type TerminalPeriod } from "../data/periods";
import { registerExtensions, ensureAlertLineRegistered } from "../extensions";
import {
  registerOverlay,
  type KLineData,
  type SymbolInfo,
} from "klinecharts";
import { resolveStorage, type ResolvedStorage, type StorageOptions } from "../storage";
import { createUndoRedoStore } from "./undoRedoStore";
import { createSharedState } from "./sharedState";
import {
  readDrawingOverlays,
  drawingOverlaysEqual,
  type DrawingOverlayInfo,
} from "./drawingOverlays";
import {
  createLayoutBackend,
  readLayoutEntry,
  writeLayoutEntry,
  readLayoutIds,
  writeLayoutIndex,
  serializeChartLayout,
  layoutContentSignature,
  generateLayoutId,
  type LayoutEntry,
} from "./layouts";
import type { Alert } from "./featureTypes";
import {
  applyWatchlistTick,
  blankWatchlistItem,
  type WatchlistItem,
} from "./watchlist";

export function reducer(
  state: KlinechartsUIState,
  action: KlinechartsUIAction,
): KlinechartsUIState {
  switch (action.type) {
    case "SET_CHART":
      // A fresh chart mints fresh pane ids, so any recorded collapsed pane
      // (and the height it should expand back to) belongs to the old instance.
      return { ...state, chart: action.chart, collapsedPanes: {} };
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
    case "SET_COLLAPSED_PANES":
      return { ...state, collapsedPanes: action.panes };
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
      // Identity guard: the reset effect in useScreenshot fires on mount with
      // url null while the state is already null — without this every mount
      // pays a gratuitous re-render of the whole terminal.
      if (state.screenshotUrl === action.url) return state;
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
          if (!raw) return fallback;
          const parsed: unknown = JSON.parse(raw);
          // Shape check, not just syntax: a stored "null", a string where an
          // array is expected, etc. parses fine but crashes at first use
          // (storedIndicators.main, state.alerts.length, ...). Fall back on
          // any structural mismatch.
          if (parsed === null || typeof parsed !== typeof fallback) {
            return fallback;
          }
          // Symmetric array check: [] for an object fallback (or an object for
          // an array fallback) is the same structural mismatch as a wrong
          // primitive and must fall back too.
          if (Array.isArray(parsed) !== Array.isArray(fallback)) {
            return fallback;
          }
          return parsed as T;
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
        collapsedPanes: {},
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
  const undoRedoInstancesRef = useRef<import("./types").UndoRedoInstance[]>([]);
  // Shared undo/redo history (see createUndoRedoStore). One store per provider
  // so independent charts keep separate histories, while every useUndoRedo
  // instance of a chart sees the same one.
  const undoRedoStore = useMemo(() => createUndoRedoStore(), []);
  const undoRedoStoreRef = useRef(undoRedoStore);
  // Shared chart settings (see createSharedState).
  const settingsStore = useMemo(() => createSharedState<unknown>(null), []);

  // --- Shared drawing-overlay snapshot + single poller ----------------------
  // klinecharts v10 has no overlay add/remove event, so the drawing list has to
  // be polled. The provider owns the snapshot and ONE interval (started at the
  // first useDrawingTools subscriber, stopped at the last unsubscribe) instead
  // of one interval per hook instance — N toolbars used to mean N getOverlays()
  // calls per second, each allocating a fresh array.
  const drawingOverlaysStore = useMemo(
    () => createSharedState<unknown>([] as DrawingOverlayInfo[]),
    [],
  );
  const drawingPollCountRef = useRef(0);
  const drawingPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Shared layouts list + auto-save --------------------------------------
  // Both are a property of the provider (one storage key), not of a hook: with
  // hook-local state two useLayoutManager() consumers hydrated two lists and
  // each ran its own 5s auto-save sweep against the same key.
  const layoutStore = useMemo(
    () => createSharedState<unknown>([] as LayoutEntry[]),
    [],
  );
  const layoutAutoSaveStore = useMemo(() => createSharedState(false), []);
  const layoutBackend = useMemo(
    () => createLayoutBackend(resolvedStorage),
    [resolvedStorage],
  );
  const autoSaveIdRef = useRef<string | null>(null);
  const autoSaveSignatureRef = useRef<string | null>(null);

  // --- Shared watchlist + quote subscriptions -------------------------------
  // Both the rows and the datafeed subscriptions are a property of the
  // provider, not of a hook: with hook-local state two useWatchlist()
  // consumers each subscribed to the same tickers (double quotes per tick)
  // and rendered two independent lists. The provider owns ONE subscription
  // per ticker and one shared row list.
  const watchlistStore = useMemo(
    () => createSharedState<unknown>([] as WatchlistItem[]),
    [],
  );
  const watchlistSubsRef = useRef(
    new Map<string, { symbolInfo: SymbolInfo; period: TerminalPeriod }>(),
  );
  // The datafeed the live subscriptions were opened on. Kept in a ref (not
  // read from props at unsubscribe time) so a runtime datafeed swap
  // unsubscribes from the OLD feed instead of leaking it.
  const watchlistFeedRef = useRef<Datafeed | null>(null);

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

  // --- Shared drawing-overlay polling (one interval per provider) -----------
  const refreshDrawingOverlays = useCallback(() => {
    const next = readDrawingOverlays(stateRef.current.chart);
    const prev = drawingOverlaysStore.get() as DrawingOverlayInfo[];
    // Equality check: the interval ticks every second, and an unconditional
    // `set` would re-render every subscriber with a fresh array even when no
    // drawing changed.
    if (!drawingOverlaysEqual(prev, next)) drawingOverlaysStore.set(next);
  }, [drawingOverlaysStore]);

  const stopDrawingPoll = useCallback(() => {
    if (drawingPollTimerRef.current !== null) {
      clearInterval(drawingPollTimerRef.current);
      drawingPollTimerRef.current = null;
    }
  }, []);

  const startDrawingPoll = useCallback(() => {
    if (drawingPollTimerRef.current !== null) return;
    // No subscribers (no useDrawingTools mounted) or no chart yet — nothing to
    // poll. The effect below starts it as soon as both exist.
    if (drawingPollCountRef.current === 0) return;
    if (!stateRef.current.chart) return;
    drawingPollTimerRef.current = setInterval(() => {
      refreshDrawingOverlays();
    }, 1000);
  }, [refreshDrawingOverlays]);

  const subscribeDrawingOverlays = useCallback(() => {
    drawingPollCountRef.current += 1;
    startDrawingPoll();
    return () => {
      drawingPollCountRef.current -= 1;
      if (drawingPollCountRef.current <= 0) stopDrawingPoll();
    };
  }, [startDrawingPoll, stopDrawingPoll]);

  // (Re)start the single poller when the chart instance changes, and refresh
  // immediately so the shared snapshot never shows the previous chart's
  // drawings (a new chart starts with none).
  useEffect(() => {
    stopDrawingPoll();
    refreshDrawingOverlays();
    startDrawingPoll();
    return stopDrawingPoll;
  }, [state.chart, startDrawingPoll, stopDrawingPoll, refreshDrawingOverlays]);

  // --- Shared watchlist subscriptions (one per ticker per provider) ---------
  const updateWatchlistItem = useCallback(
    (ticker: string, bar: KLineData) => {
      const prev = watchlistStore.get() as WatchlistItem[];
      if (!prev.some((item) => item.ticker === ticker)) return;
      watchlistStore.set(applyWatchlistTick(prev, ticker, bar));
    },
    [watchlistStore],
  );

  const subscribeWatchlist = useCallback(
    (ticker: string) => {
      if (watchlistSubsRef.current.has(ticker)) return;
      const symbolInfo = { ticker } as SymbolInfo;
      const period = stateRef.current.period;
      // Record the sub BEFORE subscribing so a concurrent unsubscribe can see
      // it, but roll everything back if the feed throws — otherwise the
      // dup-guard above would block every retry forever.
      watchlistSubsRef.current.set(ticker, { symbolInfo, period });
      try {
        datafeed.subscribe(symbolInfo, period, (bar: KLineData) =>
          updateWatchlistItem(ticker, bar),
        );
        watchlistFeedRef.current = datafeed;
      } catch {
        watchlistSubsRef.current.delete(ticker);
        return;
      }
      const prev = watchlistStore.get() as WatchlistItem[];
      if (!prev.some((item) => item.ticker === ticker)) {
        watchlistStore.set([...prev, blankWatchlistItem(ticker)]);
      }
    },
    [datafeed, updateWatchlistItem, watchlistStore],
  );

  const unsubscribeWatchlist = useCallback(
    (ticker: string) => {
      const sub = watchlistSubsRef.current.get(ticker);
      if (sub) {
        try {
          (watchlistFeedRef.current ?? datafeed).unsubscribe(
            sub.symbolInfo,
            sub.period,
          );
        } catch {
          // a failing feed must not break list management
        }
        watchlistSubsRef.current.delete(ticker);
      }
      const prev = watchlistStore.get() as WatchlistItem[];
      if (prev.some((item) => item.ticker === ticker)) {
        watchlistStore.set(prev.filter((item) => item.ticker !== ticker));
      }
    },
    [datafeed, watchlistStore],
  );

  // Re-subscribe every watchlist ticker when the period changes: subscriptions
  // are pinned to the period captured at add-time, and without this the rows
  // kept quoting the old timeframe after a period switch. Periods are compared
  // by value (span/type) so a mere object-identity churn does not churn
  // subscriptions. A datafeed swap re-opens the subs on the new feed while
  // unsubscribing from the one they were opened on.
  useEffect(() => {
    const period = state.period;
    // Snapshot the feed the subs were OPENED on before the loop: assigning
    // watchlistFeedRef inside forEach let the second ticker observe the
    // already-updated ref, conclude "same feed", and stay subscribed on the
    // old feed (leak + silence) — or unsubscribe from the wrong feed when the
    // period changed alongside the feed swap.
    const openedFeed = watchlistFeedRef.current ?? datafeed;
    const sameFeed = openedFeed === datafeed;
    watchlistSubsRef.current.forEach((sub, ticker) => {
      const samePeriod =
        sub.period.span === period.span && sub.period.type === period.type;
      if (samePeriod && sameFeed) return;
      try {
        openedFeed.unsubscribe(sub.symbolInfo, sub.period);
      } catch {
        // ignore — the row below re-subscribes either way
      }
      const symbolInfo = { ticker } as SymbolInfo;
      watchlistSubsRef.current.set(ticker, { symbolInfo, period });
      datafeed.subscribe(symbolInfo, period, (bar: KLineData) =>
        updateWatchlistItem(ticker, bar),
      );
    });
    if (watchlistSubsRef.current.size > 0) {
      watchlistFeedRef.current = datafeed;
    }
  }, [state.period, datafeed, updateWatchlistItem]);

  // Unsubscribe everything on provider unmount (the hook no longer owns any
  // subscription, so a shared per-ticker sub must not outlive the provider).
  // Reads the feed from watchlistFeedRef — the one the subs were opened on —
  // so no prop belongs in the dep array.
  useEffect(() => {
    const subs = watchlistSubsRef.current;
    return () => {
      const feed = watchlistFeedRef.current;
      if (feed) {
        subs.forEach((sub) => {
          try {
            feed.unsubscribe(sub.symbolInfo, sub.period);
          } catch {
            // teardown must not throw
          }
        });
      }
      subs.clear();
    };
  }, []);

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

  // Reconcile persisted alerts onto the chart. Alerts hydrate from storage
  // into state, but their alertLine overlays are otherwise created only by
  // useAlerts.addAlert — so after a reload (or a chart remount, or an addAlert
  // call made before the chart existed) the alert list and the poller were
  // live while no lines existed on the chart, and removeAlert's removeOverlay
  // silently no-oped. Recreate missing lines whenever the chart instance or
  // the alert list changes; incremental add/remove stays in useAlerts.
  useEffect(() => {
    const chart = state.chart;
    if (!chart) return;
    const alerts = state.alerts;
    if (alerts.length === 0) return;
    ensureAlertLineRegistered();
    for (const alert of alerts) {
      // Guard against duplicates: addAlert already creates the overlay on the
      // happy path, and re-running this effect must not stack a second line.
      if (chart.getOverlays({ id: alert.id, groupId: "price_alerts" }).length > 0)
        continue;
      chart.createOverlay({
        name: "alertLine",
        id: alert.id,
        groupId: "price_alerts",
        points: [{ value: alert.price }],
        extendData: alert.extendData,
        lock: true,
      });
    }
  }, [state.chart, state.alerts]);

  // Provider-owned price-alert poller (single owner). Runs one 1s interval —
  // only while there is a chart and at least one alert — reads the live alert
  // list from stateRef, marks crossings triggered, and notifies the listener
  // registered via useAlerts.onAlertTriggered. Replaces the per-hook interval
  // so multiple useAlerts instances can no longer each spawn a poller.
  const hasAlerts = state.alerts.length > 0;
  useEffect(() => {
    const chart = state.chart;
    if (!chart || !hasAlerts) return;

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
        // Range of the last bar. Only price targets have one: a 1s sample of
        // the last close misses a crossing that happened *inside* the bar (the
        // wick touched the level and came back between two ticks), so the
        // high/low of the forming bar is used as a second, wider signal.
        let barLow: number | null = null;
        let barHigh: number | null = null;
        if (target.type === "indicator") {
          currentValue = readIndicatorValue(target.indicatorId, target.figureKey);
        } else {
          const bar = dataList[lastIdx];
          currentValue = bar.close;
          barLow = bar.low;
          barHigh = bar.high;
        }
        if (currentValue === null || !Number.isFinite(currentValue)) continue;

        const prevValue = prevValueByAlert.get(alert.id) ?? null;
        prevValueByAlert.set(alert.id, currentValue);

        // Baseline = close of the PREVIOUS (already final) bar: the value the
        // level had to be on the other side of for a crossing to count. Using
        // the previous bar's close instead of the previous 1s sample keeps the
        // baseline correct even when the poll interval is slower than the bar
        // rate. On the very first bar there is no previous bar — fall back to
        // the previous sample (and skip when it is not seeded yet).
        const prevBar = lastIdx > 0 ? dataList[lastIdx - 1] : null;
        const prevBarClose =
          prevBar && typeof prevBar.close === "number" ? prevBar.close : null;
        const baseline =
          barLow !== null && barHigh !== null && prevBarClose !== null
            ? prevBarClose
            : prevValue;
        if (baseline === null || !Number.isFinite(baseline)) continue;

        // The level lies inside the last bar's range, i.e. it was touched at
        // some point during the bar even though the close is back on the
        // baseline side.
        const touched =
          barLow !== null &&
          barHigh !== null &&
          barLow <= alert.price &&
          barHigh >= alert.price;

        const crossedUp =
          baseline < alert.price && (currentValue >= alert.price || touched);
        const crossedDown =
          baseline > alert.price && (currentValue <= alert.price || touched);
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
    // state.symbol/state.period are deps so the per-alert baseline Map is
    // recreated when the underlying data is replaced: the KLineChart component
    // is NOT remounted on a symbol/period change (it just reloads data), and
    // keeping the old baseline would compare the new symbol's first close
    // against the old symbol's last one — spurious crossings.
  }, [state.chart, state.symbol, state.period, hasAlerts, enhancedDispatch]);

  // Auto-save flag for layouts, mirrored from the shared store so the sweep
  // below re-runs when any useLayoutManager instance toggles it.
  const layoutAutoSaveEnabled = useSyncExternalStore(
    layoutAutoSaveStore.subscribe,
    layoutAutoSaveStore.get,
    layoutAutoSaveStore.get,
  );

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

  // --- Layout auto-save sweep (one timer per provider) -----------------------
  //
  // A periodic sweep (every 5s) instead of a deps-driven debounce: the debounce
  // could only observe the state slices in its dependency array, so drawing
  // edits — which live inside klinecharts, have no provider state and no change
  // event — never re-armed it and were never auto-saved, while an untouched
  // chart still got an "Auto-save" entry 5s after enabling.
  //
  // The sweep serializes the chart on an interval and writes only when the
  // layout content actually differs from the last written one. State is read
  // through `stateRef` (not deps) so a symbol/period/axis change does not
  // restart the 5s window — only a chart swap or a toggle does.
  useEffect(() => {
    // Persistence disabled (storage configured without the "layouts"
    // namespace, or no chart): running the timer would only churn no-op writes.
    if (!layoutBackend || !layoutAutoSaveEnabled || !state.chart) {
      // Re-baseline on the next enable so a re-enable does not diff against a
      // stale snapshot from a previous session of the flag.
      autoSaveSignatureRef.current = null;
      return;
    }

    const serialize = () => {
      const current = stateRef.current;
      return serializeChartLayout({
        chart: current.chart,
        symbol: current.symbol?.ticker ?? "",
        period: current.period?.label ?? "",
        indicatorAxes: current.indicatorAxes,
      });
    };

    const upsertEntry = (entry: LayoutEntry) => {
      const prev = layoutStore.get() as LayoutEntry[];
      const index = prev.findIndex((e) => e.id === entry.id);
      if (index === -1) {
        layoutStore.set([...prev, entry]);
        return;
      }
      const next = prev.slice();
      next[index] = entry;
      layoutStore.set(next);
    };

    // Baseline: remember what is already on the chart, so merely enabling
    // auto-save (or this effect re-running) does not write an unchanged copy.
    if (autoSaveSignatureRef.current === null) {
      autoSaveSignatureRef.current = (() => {
        const chartState = serialize();
        return chartState ? layoutContentSignature(chartState) : null;
      })();
    }

    const timer = setInterval(() => {
      const chartState = serialize();
      if (!chartState) return;
      const signature = layoutContentSignature(chartState);
      if (signature === autoSaveSignatureRef.current) return;
      autoSaveSignatureRef.current = signature;

      if (autoSaveIdRef.current) {
        // Update the existing auto-save slot.
        const entry = readLayoutEntry(layoutBackend, autoSaveIdRef.current);
        if (entry) {
          const updated: LayoutEntry = {
            ...entry,
            lastModified: Date.now(),
            state: chartState,
          };
          writeLayoutEntry(layoutBackend, autoSaveIdRef.current, updated);
          upsertEntry(updated);
        }
        return;
      }

      // First sweep that saw a change: create the auto-save slot.
      const id = generateLayoutId();
      const now = Date.now();
      const entry: LayoutEntry = {
        id,
        name: "Auto-save",
        symbol: chartState.meta.symbol,
        period: chartState.meta.period,
        timestamp: now,
        lastModified: now,
        state: chartState,
      };
      writeLayoutEntry(layoutBackend, id, entry);
      const ids = readLayoutIds(layoutBackend);
      ids.push(id);
      writeLayoutIndex(layoutBackend, ids);
      autoSaveIdRef.current = id;
      upsertEntry(entry);
    }, 5000);

    return () => clearInterval(timer);
  }, [
    layoutBackend,
    layoutStore,
    layoutAutoSaveEnabled,
    state.chart,
    // `state.symbol`/`state.period` are intentionally NOT deps (read through
    // stateRef) — including them would restart the 5s window on every symbol
    // switch and delay the first auto-save after it.
  ]);

  // Provider owns the undo/redo hotkeys: one window listener for the whole
  // chart, driving the owning useUndoRedo instance (registry[0]). Previously
  // every instance added its own listener and all but the owner bailed out at
  // the top of the handler — N listeners doing one instance's worth of work,
  // and a single Ctrl+Z was one keystroke away from being applied twice if the
  // ownership guard ever slipped.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const owner = undoRedoInstancesRef.current[0];
      if (!owner) return;

      if (!e.ctrlKey && !e.metaKey) return;

      // Don't hijack native text undo/redo: typing in a symbol search, layout
      // rename, indicator params or the script editor must keep the browser's
      // own Ctrl+Z/Ctrl+Y instead of removing drawings from the chart.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        owner.undo();
      } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        owner.redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoRedoInstancesRef]);

  // Invalidate undo/redo history once its targets are gone: recorded actions
  // carry overlay ids (and indicator pane ids) that only exist on the chart
  // instance / symbol / period they were recorded against. Undoing them later
  // no-ops silently — or hits an unrelated overlay whose id was recycled.
  // Owned by the provider: N useUndoRedo instances must clear the shared store
  // once, not once per instance (a mount-time clear in the hook would wipe the
  // history every time a modal with useUndoRedo() opens).
  useEffect(() => {
    undoRedoStore.clear();
  }, [undoRedoStore, state.chart, state.symbol, state.period]);

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
      undoRedoInstancesRef,
      undoRedoStoreRef,
      settingsStore,
      drawingOverlaysStore,
      subscribeDrawingOverlays,
      refreshDrawingOverlays,
      layoutStore,
      layoutAutoSaveStore,
      watchlistStore,
      subscribeWatchlist,
      unsubscribeWatchlist,
      alertTriggeredListenersRef,
      replayIntervalRef,
      replaySavedDataRef,
      replayIndexRef,
      replayActiveRef,
      storage: resolvedStorage,
    }),
    [
      enhancedDispatch,
      resolvedStorage,
      datafeed,
      onSettingsChange,
      settingsStore,
      drawingOverlaysStore,
      subscribeDrawingOverlays,
      refreshDrawingOverlays,
      layoutStore,
      layoutAutoSaveStore,
      watchlistStore,
      subscribeWatchlist,
      unsubscribeWatchlist,
    ],
  );

  return (
    <KlinechartsUIStateContext.Provider value={state}>
      <KlinechartsUIDispatchContext.Provider value={dispatchValue}>
        {children}
      </KlinechartsUIDispatchContext.Provider>
    </KlinechartsUIStateContext.Provider>
  );
}
