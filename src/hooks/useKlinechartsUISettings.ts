import {
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { useKlinechartsUI, useKlinechartsUIDispatch } from "../provider/ChartTerminalContext";
import type { SharedState } from "../provider/types";
import {
  CANDLE_TYPES,
  PRICE_AXIS_TYPES,
  YAXIS_POSITIONS,
  COMPARE_RULES,
  TOOLTIP_SHOW_RULES,
  type PriceAxisType,
  type YAxisPosition,
  type CompareRule,
  type TooltipShowRule,
} from "../data/candle-types";

export interface CandleTypeItem {
  key: string;
  localeKey: string;
}

export interface KlinechartsUISettingsState {
  // Candle
  candleType: string;
  candleUpColor: string;
  candleDownColor: string;
  compareRule: CompareRule;
  // Price marks
  showLastPrice: boolean;
  showLastPriceLine: boolean;
  showHighPrice: boolean;
  showLowPrice: boolean;
  showIndicatorLastValue: boolean;
  // Axis
  priceAxisType: PriceAxisType;
  yAxisPosition: YAxisPosition;
  yAxisInside: boolean;
  reverseCoordinate: boolean;
  showTimeAxis: boolean;
  // Chart elements
  showGrid: boolean;
  showCrosshair: boolean;
  // Tooltips
  showCandleTooltip: boolean;
  showIndicatorTooltip: boolean;
  tooltipShowRule: TooltipShowRule;
}

export interface UseKlinechartsUISettingsReturn extends KlinechartsUISettingsState {
  candleTypes: CandleTypeItem[];
  priceAxisTypes: { key: PriceAxisType; localeKey: string }[];
  yAxisPositions: { key: YAxisPosition; localeKey: string }[];
  compareRules: { key: CompareRule; localeKey: string }[];
  tooltipShowRules: { key: TooltipShowRule; localeKey: string }[];
  setCandleType: (type: string) => void;
  setCandleUpColor: (color: string) => void;
  setCandleDownColor: (color: string) => void;
  setCompareRule: (rule: CompareRule) => void;
  setShowLastPrice: (show: boolean) => void;
  setShowLastPriceLine: (show: boolean) => void;
  setShowHighPrice: (show: boolean) => void;
  setShowLowPrice: (show: boolean) => void;
  setShowIndicatorLastValue: (show: boolean) => void;
  setPriceAxisType: (type: PriceAxisType) => void;
  setYAxisPosition: (position: YAxisPosition) => void;
  setYAxisInside: (inside: boolean) => void;
  setReverseCoordinate: (reverse: boolean) => void;
  setShowTimeAxis: (show: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setShowCrosshair: (show: boolean) => void;
  setShowCandleTooltip: (show: boolean) => void;
  setShowIndicatorTooltip: (show: boolean) => void;
  setTooltipShowRule: (rule: TooltipShowRule) => void;
  resetToDefaults: () => void;
}

const defaultSettings: KlinechartsUISettingsState = {
  candleType: "candle_solid",
  candleUpColor: "#2DC08E",
  candleDownColor: "#F92855",
  compareRule: "current_open",
  showLastPrice: true,
  showLastPriceLine: true,
  showHighPrice: true,
  showLowPrice: true,
  showIndicatorLastValue: true,
  priceAxisType: "normal",
  yAxisPosition: "right",
  yAxisInside: false,
  reverseCoordinate: false,
  showTimeAxis: true,
  showGrid: true,
  showCrosshair: true,
  showCandleTooltip: true,
  showIndicatorTooltip: true,
  tooltipShowRule: "always",
};

/**
 * Every setting that maps onto a klinecharts style, as one nested object.
 * Used when a fresh chart instance appears: the per-setting setters only ever
 * touch the chart they were called on, so without this a recreated chart would
 * silently keep the library defaults (colors, grid, tooltips, price marks…).
 */
function buildStyles(settings: KlinechartsUISettingsState): Record<string, unknown> {
  return {
    candle: {
      type: settings.candleType,
      bar: {
        upColor: settings.candleUpColor,
        upBorderColor: settings.candleUpColor,
        upWickColor: settings.candleUpColor,
        downColor: settings.candleDownColor,
        downBorderColor: settings.candleDownColor,
        downWickColor: settings.candleDownColor,
        compareRule: settings.compareRule,
      },
      priceMark: {
        last: {
          show: settings.showLastPrice,
          line: { show: settings.showLastPriceLine },
        },
        high: { show: settings.showHighPrice },
        low: { show: settings.showLowPrice },
      },
      tooltip: {
        show: settings.showCandleTooltip,
        showRule: settings.tooltipShowRule,
      },
    },
    indicator: {
      // klinecharts defaults lastValueMark.show to false, while our default
      // settings keep it on — the explicit write keeps chart and UI in sync.
      lastValueMark: { show: settings.showIndicatorLastValue },
      tooltip: {
        show: settings.showIndicatorTooltip,
        showRule: settings.tooltipShowRule,
      },
    },
    grid: { show: settings.showGrid },
    xAxis: { show: settings.showTimeAxis },
    crosshair: { show: settings.showCrosshair },
  };
}

export function useKlinechartsUISettings(): UseKlinechartsUISettingsReturn {
  const { state, onSettingsChange } = useKlinechartsUI();
  const { storage, settingsStore } = useKlinechartsUIDispatch();

  // Settings live in a provider-owned store, NOT in this hook's useState: two
  // components calling the hook used to get two independent copies, each
  // writing the whole slice to the same storage key, so a change made in one
  // panel was invisible to (and eventually overwritten by) the other.
  const store = settingsStore as unknown as SharedState<
    KlinechartsUISettingsState | null
  >;
  const stored = useSyncExternalStore(store.subscribe, store.get, store.get);
  const settings = stored ?? defaultSettings;

  const setSettings = useCallback(
    (updater: (prev: KlinechartsUISettingsState) => KlinechartsUISettingsState) => {
      store.set((prev) => updater(prev ?? defaultSettings));
    },
    [store],
  );

  // Hydrate the shared store once per provider (first instance wins) from the
  // storage adapter, if the "settings" namespace is configured. Falls back to
  // built-in defaults when storage is absent, the namespace is disabled, or the
  // stored value is missing/corrupt.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (store.get() !== null) return;
    let initial = defaultSettings;
    if (storage && storage.persists("settings")) {
      try {
        const raw = storage.adapter.getItem(storage.key("settings"));
        if (raw) initial = { ...defaultSettings, ...JSON.parse(raw) };
      } catch {
        // corrupt entry — fall through to defaults
      }
    }
    store.set(initial);
  }, [store, storage]);

  // Consumer notification. The callback is read through a ref so an inline
  // (unstable) `onSettingsChange` prop does not re-fire on every render — the
  // old version had the callback in its dep array and spammed the consumer.
  const onSettingsChangeRef = useRef(onSettingsChange);
  useEffect(() => {
    onSettingsChangeRef.current = onSettingsChange;
  });
  const lastNotifiedRef = useRef<string | null>(null);
  useEffect(() => {
    const json = JSON.stringify(settings);
    if (lastNotifiedRef.current === null) {
      // First observed snapshot (defaults or the hydration result) is not a
      // user change.
      lastNotifiedRef.current = json;
      return;
    }
    if (lastNotifiedRef.current === json) return;
    lastNotifiedRef.current = json;
    onSettingsChangeRef.current?.({ ...settings });
  }, [settings]);

  // Write the settings slice back through the storage adapter whenever it
  // changes. Content-compared, so hydrating from storage does not immediately
  // write the same value back. Guarded by the resolved storage config.
  const lastPersistedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!storage || !storage.persists("settings")) return;
    const json = JSON.stringify(settings);
    if (lastPersistedRef.current === json) return;
    lastPersistedRef.current = json;
    try {
      storage.adapter.setItem(storage.key("settings"), json);
    } catch {
      // adapter failure is non-fatal
    }
  }, [settings, storage]);

  const candleTypes = useMemo(
    () =>
      CANDLE_TYPES.map((ct) => ({
        key: ct.key,
        localeKey: ct.localeKey,
      })),
    []
  );

  const priceAxisTypes = useMemo(
    () => PRICE_AXIS_TYPES.map((pat) => ({ key: pat, localeKey: pat })),
    []
  );

  const yAxisPositions = useMemo(
    () => YAXIS_POSITIONS.map((p) => ({ key: p, localeKey: p })),
    []
  );

  const compareRules = useMemo(
    () => COMPARE_RULES.map((r) => ({ key: r, localeKey: r })),
    []
  );

  const tooltipShowRules = useMemo(
    () => TOOLTIP_SHOW_RULES.map((r) => ({ key: r, localeKey: r })),
    []
  );

  const applyPaneAxis = useCallback(
    (axis: Record<string, unknown>) => {
      // klinecharts v10: axis configuration moved off setPaneOptions to
      // overrideYAxis. NOTE: klinecharts beta2 .d.ts mistypes the parameter of
      // `overrideYAxis` as `XAxisOverride` (the param names of overrideYAxis /
      // overrideXAxis are swapped in the core typings), while the runtime
      // correctly applies these fields to the Y (price) axis — hence the cast.
      (
        state.chart as unknown as {
          overrideYAxis?: (axis: Record<string, unknown>) => void;
        }
      )?.overrideYAxis?.({ paneId: "candle_pane", ...axis });
    },
    [state.chart, setSettings]
  );

  // Apply the current settings whenever a NEW chart instance appears — keyed on
  // the chart identity, not on a one-shot "already applied" flag: a chart
  // recreated at runtime (remount, renderer swap) used to come back with
  // klinecharts' own defaults while this hook still reported the user's
  // settings, leaving UI and chart permanently out of sync.
  const appliedChartRef = useRef<unknown>(null);
  useEffect(() => {
    const chart = state.chart;
    if (!chart || appliedChartRef.current === chart) return;
    appliedChartRef.current = chart;

    // Everything expressible as styles, in one call.
    chart.setStyles(buildStyles(settings));

    // Sync axis settings via overrideYAxis (klinecharts v10: setPaneOptions no
    // longer handles axis configuration).
    const needsAxisOverride =
      settings.reverseCoordinate ||
      settings.priceAxisType !== "normal" ||
      settings.yAxisPosition !== "right" ||
      settings.yAxisInside;
    if (needsAxisOverride) {
      applyPaneAxis({
        ...(settings.priceAxisType !== "normal" && { name: settings.priceAxisType }),
        ...(settings.reverseCoordinate && { reverse: true }),
        ...(settings.yAxisPosition !== "right" && { position: settings.yAxisPosition }),
        ...(settings.yAxisInside && { inside: true }),
      });
    }
  }, [state.chart, settings, applyPaneAxis]);

  const applyStyle = useCallback(
    (path: string, value: unknown) => {
      const parts = path.split(".");
      const styleObj: Record<string, unknown> = {};
      let current: Record<string, unknown> = styleObj;
      for (let i = 0; i < parts.length - 1; i++) {
        current[parts[i]] = {};
        current = current[parts[i]] as Record<string, unknown>;
      }
      current[parts[parts.length - 1]] = value;
      state.chart?.setStyles(styleObj);
    },
    [state.chart, setSettings]
  );


  const setCandleType = useCallback(
    (type: string) => {
      applyStyle("candle.type", type);
      setSettings((s) => ({ ...s, candleType: type }));
    },
    [applyStyle, setSettings]
  );

  const setCandleUpColor = useCallback(
    (color: string) => {
      state.chart?.setStyles({
        candle: {
          bar: { upColor: color, upBorderColor: color, upWickColor: color },
        },
      });
      setSettings((s) => ({ ...s, candleUpColor: color }));
    },
    [state.chart, setSettings]
  );

  const setCandleDownColor = useCallback(
    (color: string) => {
      state.chart?.setStyles({
        candle: {
          bar: { downColor: color, downBorderColor: color, downWickColor: color },
        },
      });
      setSettings((s) => ({ ...s, candleDownColor: color }));
    },
    [state.chart, setSettings]
  );

  const setCompareRule = useCallback(
    (rule: CompareRule) => {
      applyStyle("candle.bar.compareRule", rule);
      setSettings((s) => ({ ...s, compareRule: rule }));
    },
    [applyStyle, setSettings]
  );

  const setShowLastPrice = useCallback(
    (show: boolean) => {
      applyStyle("candle.priceMark.last.show", show);
      setSettings((s) => ({ ...s, showLastPrice: show }));
    },
    [applyStyle, setSettings]
  );

  const setShowLastPriceLine = useCallback(
    (show: boolean) => {
      applyStyle("candle.priceMark.last.line.show", show);
      setSettings((s) => ({ ...s, showLastPriceLine: show }));
    },
    [applyStyle, setSettings]
  );

  const setShowHighPrice = useCallback(
    (show: boolean) => {
      applyStyle("candle.priceMark.high.show", show);
      setSettings((s) => ({ ...s, showHighPrice: show }));
    },
    [applyStyle, setSettings]
  );

  const setShowLowPrice = useCallback(
    (show: boolean) => {
      applyStyle("candle.priceMark.low.show", show);
      setSettings((s) => ({ ...s, showLowPrice: show }));
    },
    [applyStyle, setSettings]
  );

  const setShowIndicatorLastValue = useCallback(
    (show: boolean) => {
      applyStyle("indicator.lastValueMark.show", show);
      setSettings((s) => ({ ...s, showIndicatorLastValue: show }));
    },
    [applyStyle, setSettings]
  );

  const setPriceAxisType = useCallback(
    (type: PriceAxisType) => {
      applyPaneAxis({ name: type });
      setSettings((s) => ({ ...s, priceAxisType: type }));
    },
    [applyPaneAxis, setSettings]
  );

  const setYAxisPosition = useCallback(
    (position: YAxisPosition) => {
      applyPaneAxis({ position });
      setSettings((s) => ({ ...s, yAxisPosition: position }));
    },
    [applyPaneAxis, setSettings]
  );

  const setYAxisInside = useCallback(
    (inside: boolean) => {
      applyPaneAxis({ inside });
      setSettings((s) => ({ ...s, yAxisInside: inside }));
    },
    [applyPaneAxis, setSettings]
  );

  const setReverseCoordinate = useCallback(
    (reverse: boolean) => {
      applyPaneAxis({ reverse });
      setSettings((s) => ({ ...s, reverseCoordinate: reverse }));
    },
    [applyPaneAxis, setSettings]
  );

  const setShowGrid = useCallback(
    (show: boolean) => {
      applyStyle("grid.show", show);
      setSettings((s) => ({ ...s, showGrid: show }));
    },
    [applyStyle, setSettings]
  );

  const setShowTimeAxis = useCallback(
    (show: boolean) => {
      applyStyle("xAxis.show", show);
      setSettings((s) => ({ ...s, showTimeAxis: show }));
    },
    [applyStyle, setSettings]
  );

  const setShowCrosshair = useCallback(
    (show: boolean) => {
      applyStyle("crosshair.show", show);
      setSettings((s) => ({ ...s, showCrosshair: show }));
    },
    [applyStyle, setSettings]
  );

  const setShowCandleTooltip = useCallback(
    (show: boolean) => {
      applyStyle("candle.tooltip.show", show);
      setSettings((s) => ({ ...s, showCandleTooltip: show }));
    },
    [applyStyle, setSettings]
  );

  const setShowIndicatorTooltip = useCallback(
    (show: boolean) => {
      applyStyle("indicator.tooltip.show", show);
      setSettings((s) => ({ ...s, showIndicatorTooltip: show }));
    },
    [applyStyle, setSettings]
  );

  const setTooltipShowRule = useCallback(
    (rule: TooltipShowRule) => {
      state.chart?.setStyles({
        candle: { tooltip: { showRule: rule } },
        indicator: { tooltip: { showRule: rule } },
      });
      setSettings((s) => ({ ...s, tooltipShowRule: rule }));
    },
    [state.chart, setSettings]
  );

  const resetToDefaults = useCallback(() => {
    setSettings(() => defaultSettings);
    state.chart?.setStyles(state.theme);
    // setStyles(theme) restores klinecharts' built-in lastValueMark.show:
    // false, while defaultSettings.showIndicatorLastValue is true (the
    // bootstrap effect above exists for the same reason). Re-apply the
    // library default so the UI toggle and the chart stay in sync.
    if (defaultSettings.showIndicatorLastValue) {
      state.chart?.setStyles({
        indicator: { lastValueMark: { show: true } },
      });
    }
    // Reset axis options to defaults
    applyPaneAxis({ name: "normal", reverse: false, position: "right", inside: false });
  }, [state.chart, state.theme, applyPaneAxis, setSettings]);

  return {
    ...settings,
    candleTypes,
    priceAxisTypes,
    yAxisPositions,
    compareRules,
    tooltipShowRules,
    setCandleType,
    setCandleUpColor,
    setCandleDownColor,
    setCompareRule,
    setShowLastPrice,
    setShowLastPriceLine,
    setShowHighPrice,
    setShowLowPrice,
    setShowIndicatorLastValue,
    setPriceAxisType,
    setYAxisPosition,
    setYAxisInside,
    setReverseCoordinate,
    setShowTimeAxis,
    setShowGrid,
    setShowCrosshair,
    setShowCandleTooltip,
    setShowIndicatorTooltip,
    setTooltipShowRule,
    resetToDefaults,
  };
}
