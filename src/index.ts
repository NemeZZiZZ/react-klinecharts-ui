// Provider
export { KlinechartsUIProvider } from "./provider/ChartTerminalProvider";
export {
  KlinechartsUIStateContext,
  KlinechartsUIDispatchContext,
  useKlinechartsUI,
} from "./provider/ChartTerminalContext";
export type {
  KlinechartsUIOptions,
  KlinechartsUIState,
  KlinechartsUIAction,
  KlinechartsUIContextValue,
  KlinechartsUIDispatchValue,
  Datafeed,
  PartialSymbolInfo,
} from "./provider/types";

// Hooks
export {
  useKlinechartsUITheme,
  type UseKlinechartsUIThemeReturn,
} from "./hooks/useKlinechartsUITheme";
export {
  useKlinechartsUILoading,
  type UseKlinechartsUILoadingReturn,
} from "./hooks/useKlinechartsUILoading";
export { usePeriods, type UsePeriodsReturn } from "./hooks/usePeriods";
export {
  useTimezone,
  type UseTimezoneReturn,
  type TimezoneItem,
} from "./hooks/useTimezone";
export {
  useSymbolSearch,
  type UseSymbolSearchReturn,
} from "./hooks/useSymbolSearch";
export {
  useIndicators,
  type UseIndicatorsReturn,
  type IndicatorInfo,
} from "./hooks/useIndicators";
export {
  useDrawingTools,
  type UseDrawingToolsReturn,
  type DrawingToolItem,
  type DrawingCategoryItem,
} from "./hooks/useDrawingTools";
export {
  useKlinechartsUISettings,
  type UseKlinechartsUISettingsReturn,
  type KlinechartsUISettingsState,
  type CandleTypeItem,
} from "./hooks/useKlinechartsUISettings";
export {
  useScreenshot,
  type UseScreenshotReturn,
} from "./hooks/useScreenshot";
export {
  useFullscreen,
  type UseFullscreenReturn,
} from "./hooks/useFullscreen";
export {
  useOrderLines,
  type UseOrderLinesReturn,
  type OrderLineOptions,
} from "./hooks/useOrderLines";
export {
  useUndoRedo,
  type UseUndoRedoReturn,
  type UndoRedoAction,
  type UndoRedoActionType,
} from "./hooks/useUndoRedo";
export {
  useLayoutManager,
  type UseLayoutManagerReturn,
  type LayoutEntry,
  type ChartLayoutState,
} from "./hooks/useLayoutManager";
export {
  useScriptEditor,
  type UseScriptEditorReturn,
  type ScriptPlacement,
} from "./hooks/useScriptEditor";
export {
  useCrosshair,
  type UseCrosshairReturn,
  type CrosshairBarData,
} from "./hooks/useCrosshair";
export {
  useAlerts,
  type UseAlertsReturn,
  type Alert,
  type AlertCondition,
} from "./hooks/useAlerts";
export {
  useDataExport,
  type UseDataExportReturn,
  type ExportFormat,
} from "./hooks/useDataExport";
export {
  useWatchlist,
  type UseWatchlistReturn,
  type WatchlistItem,
} from "./hooks/useWatchlist";
export {
  useReplay,
  type UseReplayReturn,
  type ReplaySpeed,
} from "./hooks/useReplay";
export {
  useCompare,
  type UseCompareReturn,
  type CompareSymbol,
} from "./hooks/useCompare";
export {
  useMeasure,
  type UseMeasureReturn,
  type MeasureResult,
  type MeasurePoint,
} from "./hooks/useMeasure";
export {
  useAnnotations,
  type UseAnnotationsReturn,
  type Annotation,
} from "./hooks/useAnnotations";
// Data
export {
  DEFAULT_PERIODS,
  type TerminalPeriod,
  TIMEZONES,
  MAIN_INDICATORS,
  SUB_INDICATORS,
  INDICATOR_PARAMS,
  DRAWING_CATEGORIES,
  CANDLE_TYPES,
  PRICE_AXIS_TYPES,
  YAXIS_POSITIONS,
  COMPARE_RULES,
  TOOLTIP_SHOW_RULES,
} from "./data";
export type {
  TimezoneOption,
  IndicatorParamConfig,
  IndicatorDefinition,
  DrawingTool,
  DrawingToolCategory,
  MagnetMode,
  CandleTypeOption,
  PriceAxisType,
  YAxisPosition,
  CompareRule,
  TooltipShowRule,
} from "./data";

// Utils
export { createDataLoader } from "./utils/createDataLoader";
export { default as TA } from "./utils/TA";

// Drawing-tool overlay templates
export * from "./overlays";

// Custom indicator templates
export * from "./indicators";

// Extensions (registration + optional overlays)
export {
  registerExtensions,
  overlays,
  indicators,
  orderLine,
  depthOverlay,
} from "./extensions";
export type {
  OrderLineExtendData,
  OrderLineLineStyle,
  OrderLineMarkStyle,
  OrderLineLabelStyle,
  OrderLineFontStyle,
  OrderLinePadding,
  DepthOverlayExtendData,
  DepthOverlayRow,
} from "./extensions";
