import type { Dispatch, RefObject, ReactNode } from "react";
import type {
  Chart,
  DeepPartial,
  Styles,
  SymbolInfo,
  KLineData,
  OverlayTemplate,
} from "klinecharts";
import type { TerminalPeriod } from "../data/periods";
import type {
  Alert,
  MeasureState,
  ReplayState,
} from "./featureTypes";

/**
 * Explicit partial symbol type — avoids `PickPartial<SymbolInfo, ...>` which
 * degenerates when SymbolInfo has an index signature `[key: string]: unknown`.
 */
export interface PartialSymbolInfo {
  ticker: string;
  pricePrecision?: number;
  volumePrecision?: number;
  [key: string]: unknown;
}

export interface Datafeed {
  searchSymbols(
    search: string,
    signal?: AbortSignal,
  ): Promise<PartialSymbolInfo[]>;
  getHistoryKLineData(
    symbol: SymbolInfo,
    period: TerminalPeriod,
    from: number,
    to: number,
  ): Promise<KLineData[]>;
  subscribe(
    symbol: SymbolInfo,
    period: TerminalPeriod,
    callback: (data: KLineData) => void,
  ): void;
  unsubscribe(symbol: SymbolInfo, period: TerminalPeriod): void;
}

export interface KlinechartsUIOptions {
  datafeed: Datafeed;
  defaultSymbol?: PartialSymbolInfo;
  defaultPeriod?: TerminalPeriod;
  defaultTheme?: string;
  defaultTimezone?: string;
  defaultMainIndicators?: string[];
  defaultSubIndicators?: string[];
  defaultLocale?: string;
  periods?: TerminalPeriod[];
  styles?: DeepPartial<Styles>;
  registerExtensions?: boolean;
  /**
   * Additional overlay templates to register on mount (e.g. `orderLine`, custom overlays).
   * These are registered once, alongside the built-in drawing-tool overlays.
   */
  overlays?: OverlayTemplate[];
  children: ReactNode;
  /** Called on every dispatched action with the resulting new state and previous state. */
  onStateChange?: (
    action: KlinechartsUIAction,
    nextState: KlinechartsUIState,
    prevState: KlinechartsUIState,
  ) => void;
  onSymbolChange?: (symbol: PartialSymbolInfo) => void;
  onPeriodChange?: (period: TerminalPeriod) => void;
  onThemeChange?: (theme: string) => void;
  onTimezoneChange?: (timezone: string) => void;
  onMainIndicatorsChange?: (indicators: string[]) => void;
  onSubIndicatorsChange?: (indicators: Record<string, string>) => void;
  onSettingsChange?: (settings: Record<string, unknown>) => void;
}

export interface KlinechartsUIState {
  chart: Chart | null;
  datafeed: Datafeed;
  symbol: PartialSymbolInfo | null;
  period: TerminalPeriod;
  theme: string;
  timezone: string;
  isLoading: boolean;
  locale: string;
  periods: TerminalPeriod[];
  mainIndicators: string[];
  subIndicators: Record<string, string>;
  /**
   * Custom Y-axis bindings for indicators, keyed by indicator id
   * (`main_<name>` / `sub_<name>`), value is the bound `yAxisId`.
   * Only populated for indicators explicitly bound to a secondary
   * (non-default) axis via `useIndicators`. Indicators on the shared
   * default axis are absent. Used to persist bindings across
   * undo/redo and layout presets.
   */
  indicatorAxes: Record<string, string>;
  /**
   * Visibility overrides for indicators, keyed by indicator id
   * (`main_<name>` / `sub_<name>`), value is whether the indicator is shown.
   * Mirrors the `visible` flag held inside klinecharts so `useIndicators` can
   * expose a reactive getter (the chart instance has no React-friendly read
   * path). Only populated for indicators whose visibility has been toggled
   * away from the default; an absent key means visible (`true`). Updated by
   * `setIndicatorVisible` and the collapse/expand helpers, and rebuilt when a
   * layout preset is restored so the mirror never drifts from the chart.
   */
  indicatorVisibility: Record<string, boolean>;
  /**
   * Price alerts (`useAlerts`). Lives in the shared store rather than per-hook
   * local state so every consumer (toolbar, list panel, status bar, sound
   * trigger) observes one synchronized list. The crossing poller and the
   * `onAlertTriggered` listener are owned by the provider, not the hook.
   */
  alerts: Alert[];
  /**
   * Measure-tool state (`useMeasure`). Shared so the toolbar toggle and the
   * result readout panel stay in sync regardless of where each is mounted.
   */
  measure: MeasureState;
  /**
   * Historical-replay control state (`useReplay`). Shared so play/pause/step
   * controls in different components drive one session. The playback interval
   * and data buffers are owned by the provider (see the `replay*Ref` fields on
   * the dispatch value), guaranteeing a single timer no matter how many hook
   * instances are mounted.
   */
  replay: ReplayState;
  styles: DeepPartial<Styles> | undefined;
  screenshotUrl: string | null;
}

export type KlinechartsUIAction =
  | { type: "SET_CHART"; chart: Chart }
  | { type: "SET_SYMBOL"; symbol: PartialSymbolInfo }
  | { type: "SET_PERIOD"; period: TerminalPeriod }
  | { type: "SET_THEME"; theme: string }
  | { type: "SET_TIMEZONE"; timezone: string }
  | { type: "SET_LOADING"; isLoading: boolean }
  | { type: "SET_MAIN_INDICATORS"; indicators: string[] }
  | { type: "SET_SUB_INDICATORS"; indicators: Record<string, string> }
  | { type: "SET_INDICATOR_AXES"; axes: Record<string, string> }
  | { type: "SET_INDICATOR_VISIBILITY"; visibility: Record<string, boolean> }
  | { type: "SET_ALERTS"; alerts: Alert[] }
  // Granular alert actions. `SET_ALERTS` does a full replace, which loses
  // updates when two writers race (the hook mutators read `state.alerts` from
  // a closure while the provider poller dispatches off `stateRef.current`).
  // These compose instead of clobbering, so concurrent add/trigger/remove
  // never revert each other.
  | { type: "ADD_ALERT"; alert: Alert }
  | { type: "REMOVE_ALERT"; id: string }
  | { type: "CLEAR_ALERTS" }
  | { type: "MARK_ALERT_TRIGGERED"; ids: string[] }
  | { type: "SET_MEASURE"; measure: Partial<MeasureState> }
  | { type: "SET_REPLAY"; replay: Partial<ReplayState> }
  | { type: "SET_STYLES"; styles: DeepPartial<Styles> | undefined }
  | { type: "SET_LOCALE"; locale: string }
  | { type: "SET_SCREENSHOT_URL"; url: string | null };

/** Callback pushed by useUndoRedo so other hooks can record actions. */
export type UndoRedoListener = (action: { type: string; data: unknown }) => void;

/** The stable, dispatch-only slice of the context (never changes after mount). */
export interface KlinechartsUIDispatchValue {
  dispatch: Dispatch<KlinechartsUIAction>;
  datafeed: Datafeed;
  onSettingsChange?: (settings: Record<string, unknown>) => void;
  fullscreenContainerRef: RefObject<HTMLElement | null>;
  /** Ref populated by useUndoRedo; other hooks call it to record actions. */
  undoRedoListenerRef: RefObject<UndoRedoListener | null>;
  /**
   * Listener set by `useAlerts.onAlertTriggered`; invoked by the provider-owned
   * crossing poller when an alert fires. Last writer wins (one active listener).
   */
  alertTriggeredListenerRef: RefObject<((alert: Alert) => void) | null>;
  /**
   * Provider-owned replay resources, shared across every `useReplay` instance
   * so there is exactly one playback timer and one data buffer. The hook reads
   * and writes these instead of its own refs; the provider clears the interval
   * on unmount.
   */
  replayIntervalRef: RefObject<ReturnType<typeof setInterval> | null>;
  replaySavedDataRef: RefObject<KLineData[]>;
  replayIndexRef: RefObject<number>;
}

/** Combined context value returned by `useKlinechartsUI()`. */
export interface KlinechartsUIContextValue extends KlinechartsUIDispatchValue {
  state: KlinechartsUIState;
}
