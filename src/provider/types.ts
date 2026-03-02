import type { Dispatch, RefObject, ReactNode } from "react";
import type {
  Chart,
  DeepPartial,
  Styles,
  SymbolInfo,
  KLineData,
  OverlayTemplate,
} from "react-klinecharts";
import type { TerminalPeriod } from "../data/periods";

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
  | { type: "SET_STYLES"; styles: DeepPartial<Styles> | undefined }
  | { type: "SET_LOCALE"; locale: string }
  | { type: "SET_SCREENSHOT_URL"; url: string | null };

/** The stable, dispatch-only slice of the context (never changes after mount). */
export interface KlinechartsUIDispatchValue {
  dispatch: Dispatch<KlinechartsUIAction>;
  datafeed: Datafeed;
  onSettingsChange?: (settings: Record<string, unknown>) => void;
  fullscreenContainerRef: RefObject<HTMLElement | null>;
}

/** Combined context value returned by `useKlinechartsUI()`. */
export interface KlinechartsUIContextValue extends KlinechartsUIDispatchValue {
  state: KlinechartsUIState;
}
