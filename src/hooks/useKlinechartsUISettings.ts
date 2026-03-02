import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";
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

export function useKlinechartsUISettings(): UseKlinechartsUISettingsReturn {
  const { state, onSettingsChange } = useKlinechartsUI();
  const [settings, setSettings] = useState<KlinechartsUISettingsState>(defaultSettings);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    onSettingsChange?.({ ...settings });
  }, [settings, onSettingsChange]);

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

  // Apply initial settings when chart becomes available
  const hasAppliedInitial = useRef(false);
  useEffect(() => {
    if (!state.chart || hasAppliedInitial.current) return;
    hasAppliedInitial.current = true;

    // Sync axis settings via setPaneOptions (not styles)
    const needsPaneOptions =
      settings.reverseCoordinate ||
      settings.priceAxisType !== "normal" ||
      settings.yAxisPosition !== "right" ||
      settings.yAxisInside;
    if (needsPaneOptions) {
      state.chart.setPaneOptions({
        id: "candle_pane",
        axis: {
          ...(settings.priceAxisType !== "normal" && { name: settings.priceAxisType }),
          ...(settings.reverseCoordinate && { reverse: true }),
          ...(settings.yAxisPosition !== "right" && { position: settings.yAxisPosition }),
          ...(settings.yAxisInside && { inside: true }),
        },
      });
    }

    // Sync indicator last value mark (klinecharts defaults to show: false)
    if (settings.showIndicatorLastValue) {
      state.chart.setStyles({
        indicator: { lastValueMark: { show: true } },
      });
    }
  }, [state.chart]); // eslint-disable-line react-hooks/exhaustive-deps

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
    [state.chart]
  );

  const applyPaneAxis = useCallback(
    (axis: Record<string, unknown>) => {
      state.chart?.setPaneOptions({ id: "candle_pane", axis });
    },
    [state.chart]
  );

  const setCandleType = useCallback(
    (type: string) => {
      applyStyle("candle.type", type);
      setSettings((s) => ({ ...s, candleType: type }));
    },
    [applyStyle]
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
    [state.chart]
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
    [state.chart]
  );

  const setCompareRule = useCallback(
    (rule: CompareRule) => {
      applyStyle("candle.bar.compareRule", rule);
      setSettings((s) => ({ ...s, compareRule: rule }));
    },
    [applyStyle]
  );

  const setShowLastPrice = useCallback(
    (show: boolean) => {
      applyStyle("candle.priceMark.last.show", show);
      setSettings((s) => ({ ...s, showLastPrice: show }));
    },
    [applyStyle]
  );

  const setShowLastPriceLine = useCallback(
    (show: boolean) => {
      applyStyle("candle.priceMark.last.line.show", show);
      setSettings((s) => ({ ...s, showLastPriceLine: show }));
    },
    [applyStyle]
  );

  const setShowHighPrice = useCallback(
    (show: boolean) => {
      applyStyle("candle.priceMark.high.show", show);
      setSettings((s) => ({ ...s, showHighPrice: show }));
    },
    [applyStyle]
  );

  const setShowLowPrice = useCallback(
    (show: boolean) => {
      applyStyle("candle.priceMark.low.show", show);
      setSettings((s) => ({ ...s, showLowPrice: show }));
    },
    [applyStyle]
  );

  const setShowIndicatorLastValue = useCallback(
    (show: boolean) => {
      applyStyle("indicator.lastValueMark.show", show);
      setSettings((s) => ({ ...s, showIndicatorLastValue: show }));
    },
    [applyStyle]
  );

  const setPriceAxisType = useCallback(
    (type: PriceAxisType) => {
      applyPaneAxis({ name: type });
      setSettings((s) => ({ ...s, priceAxisType: type }));
    },
    [applyPaneAxis]
  );

  const setYAxisPosition = useCallback(
    (position: YAxisPosition) => {
      applyPaneAxis({ position });
      setSettings((s) => ({ ...s, yAxisPosition: position }));
    },
    [applyPaneAxis]
  );

  const setYAxisInside = useCallback(
    (inside: boolean) => {
      applyPaneAxis({ inside });
      setSettings((s) => ({ ...s, yAxisInside: inside }));
    },
    [applyPaneAxis]
  );

  const setReverseCoordinate = useCallback(
    (reverse: boolean) => {
      applyPaneAxis({ reverse });
      setSettings((s) => ({ ...s, reverseCoordinate: reverse }));
    },
    [applyPaneAxis]
  );

  const setShowGrid = useCallback(
    (show: boolean) => {
      applyStyle("grid.show", show);
      setSettings((s) => ({ ...s, showGrid: show }));
    },
    [applyStyle]
  );

  const setShowTimeAxis = useCallback(
    (show: boolean) => {
      applyStyle("xAxis.show", show);
      setSettings((s) => ({ ...s, showTimeAxis: show }));
    },
    [applyStyle]
  );

  const setShowCrosshair = useCallback(
    (show: boolean) => {
      applyStyle("crosshair.show", show);
      setSettings((s) => ({ ...s, showCrosshair: show }));
    },
    [applyStyle]
  );

  const setShowCandleTooltip = useCallback(
    (show: boolean) => {
      applyStyle("candle.tooltip.show", show);
      setSettings((s) => ({ ...s, showCandleTooltip: show }));
    },
    [applyStyle]
  );

  const setShowIndicatorTooltip = useCallback(
    (show: boolean) => {
      applyStyle("indicator.tooltip.show", show);
      setSettings((s) => ({ ...s, showIndicatorTooltip: show }));
    },
    [applyStyle]
  );

  const setTooltipShowRule = useCallback(
    (rule: TooltipShowRule) => {
      state.chart?.setStyles({
        candle: { tooltip: { showRule: rule } },
        indicator: { tooltip: { showRule: rule } },
      });
      setSettings((s) => ({ ...s, tooltipShowRule: rule }));
    },
    [state.chart]
  );

  const resetToDefaults = useCallback(() => {
    setSettings(defaultSettings);
    state.chart?.setStyles(state.theme);
    // Reset axis options to defaults
    state.chart?.setPaneOptions({
      id: "candle_pane",
      axis: { name: "normal", reverse: false, position: "right", inside: false },
    });
  }, [state.chart, state.theme]);

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
