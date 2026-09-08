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
import type { StorageOptions, ResolvedStorage } from "../storage";

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
  /**
   * Search symbols by a query string. Optional — when omitted,
   * `useSymbolSearch` simply returns no results.
   * signal — AbortSignal to cancel the request when a newer query is typed.
   */
  searchSymbols?(
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
  /**
   * Optional persistence configuration. When provided, the provider hydrates
   * the listed namespaces (alerts, settings, indicators) from the adapter on
   * mount and writes them back on every change. Defaults to `localStorage`
   * (SSR-safe). Omit entirely to disable persistence (pre-1.1.0 behaviour).
   *
   * Note: this covers the reducer store only. Per-hook `useState` values
   * (script code, compared symbols, watchlist, annotations) are not yet
   * persisted — see the roadmap.
   */
  storage?: StorageOptions;
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
   * Collapsed sub-indicator panes (`useIndicators`): pane id -> the pane
   * height it had before collapsing, so expanding can restore it.
   *
   * Shared (instead of the `useRef` set/height map the hook used to keep) so
   * `isSubIndicatorCollapsed` is reactive — a ref read never re-renders, so a
   * UI that renders a collapse/expand button from it kept showing the stale
   * state — and so every consumer of the hook agrees. Cleared by `SET_CHART`:
   * pane ids are minted per chart instance and never reused.
   */
  collapsedPanes: Record<string, number>;
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
  | { type: "SET_CHART"; chart: Chart | null }
  | { type: "SET_SYMBOL"; symbol: PartialSymbolInfo }
  | { type: "SET_PERIOD"; period: TerminalPeriod }
  | { type: "SET_THEME"; theme: string }
  | { type: "SET_TIMEZONE"; timezone: string }
  | { type: "SET_LOADING"; isLoading: boolean }
  | { type: "SET_MAIN_INDICATORS"; indicators: string[] }
  | { type: "SET_SUB_INDICATORS"; indicators: Record<string, string> }
  | { type: "SET_INDICATOR_AXES"; axes: Record<string, string> }
  | { type: "SET_INDICATOR_VISIBILITY"; visibility: Record<string, boolean> }
  | { type: "SET_COLLAPSED_PANES"; panes: Record<string, number> }
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

/** A mounted useUndoRedo instance's callable surface (see undoRedoInstancesRef). */
export interface UndoRedoInstance {
  pushAction: UndoRedoListener;
  undo: () => void;
  redo: () => void;
}

/**
 * Minimal external store shared by every hook instance of one provider, read
 * with `useSyncExternalStore` (see `createSharedState`).
 */
export interface SharedState<T> {
  /** Register a subscriber; returns the unsubscribe function. */
  subscribe: (listener: () => void) => () => void;
  /** Current value (stable reference until the next `set`). */
  get: () => T;
  /** Replace the value (or compute it from the previous one) and notify. */
  set: (next: T | ((prev: T) => T)) => void;
}

export type UndoRedoActionType =
  | "overlay_added"
  | "overlays_removed"
  | "indicator_toggled";

export interface UndoRedoAction {
  type: UndoRedoActionType;
  /** Snapshot data needed to undo/redo this action */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

/**
 * The undo/redo history, owned by the provider (`undoRedoStoreRef`) instead of
 * by any single `useUndoRedo` instance — see `createUndoRedoStore`.
 *
 * `subscribe`/`getUndoStack`/`getRedoStack` are consumed with
 * `useSyncExternalStore`, so every mounted instance renders the same history.
 * Mutations come in two flavours: `pushAction` and `clear` notify immediately,
 * while `popUndo`/`popRedo`/`appendUndo`/`appendRedo` stay silent so undo() and
 * redo() can apply a whole batch and then `notify()` once.
 */
export interface UndoRedoStore {
  /** Register a subscriber; returns the unsubscribe function. */
  subscribe: (listener: () => void) => () => void;
  /** Current undo stack (stable reference until the next mutation). */
  getUndoStack: () => UndoRedoAction[];
  /** Current redo stack (stable reference until the next mutation). */
  getRedoStack: () => UndoRedoAction[];
  /** Record a new action: appends to the undo stack, clears redo, notifies. */
  pushAction: (action: UndoRedoAction) => void;
  /** Remove and return the top of the undo stack (does not notify). */
  popUndo: () => UndoRedoAction | undefined;
  /** Remove and return the top of the redo stack (does not notify). */
  popRedo: () => UndoRedoAction | undefined;
  /** Push onto the undo stack (does not notify). */
  appendUndo: (action: UndoRedoAction) => void;
  /** Push onto the redo stack (does not notify). */
  appendRedo: (action: UndoRedoAction) => void;
  /** Drop both stacks and notify. */
  clear: () => void;
  /** Notify subscribers after a batch of silent mutations. */
  notify: () => void;
  /**
   * Claim the shared re-entrancy guard. Returns false when undo/redo is
   * already running, so a second (auto-repeat) call is a no-op.
   */
  beginProcessing: () => boolean;
  endProcessing: () => void;
}

/** The stable, dispatch-only slice of the context (never changes after mount). */
export interface KlinechartsUIDispatchValue {
  dispatch: Dispatch<KlinechartsUIAction>;
  /**
   * Active datafeed. Included in the memo deps so the context (and consumers)
   * update when the consumer swaps the `datafeed` prop at runtime — pass a
   * stable reference (useMemo/useRef) to avoid re-rendering on every render.
   */
  datafeed: Datafeed;
  /**
   * Optional settings-change callback. Included in the memo deps so a swap of
   * the callback prop is observed by `useKlinechartsUISettings` — pass a stable
   * reference (useCallback) to avoid re-rendering on every render.
   */
  onSettingsChange?: (settings: Record<string, unknown>) => void;
  fullscreenContainerRef: RefObject<HTMLElement | null>;
  /** Ref populated by useUndoRedo; other hooks call it to record actions. */
  undoRedoListenerRef: RefObject<UndoRedoListener | null>;
  /**
   * Mounted useUndoRedo instances of THIS provider, in mount order. The first
   * entry owns the single-slot `undoRedoListenerRef` and the global hotkeys;
   * when it unmounts the next instance is promoted automatically. Kept per
   * provider (not module-global) so independent charts each get their own
   * owner.
   */
  undoRedoInstancesRef: RefObject<UndoRedoInstance[]>;
  /**
   * Provider-owned undo/redo history shared by every `useUndoRedo` instance of
   * this provider (the stacks are a property of the chart, not of a hook).
   * Instances mirror it with `useSyncExternalStore`, so all of them report the
   * same `canUndo`/`canRedo` and undo the same entry.
   */
  undoRedoStoreRef: RefObject<UndoRedoStore>;
  /**
   * Provider-owned chart settings (`useKlinechartsUISettings`), shared by every
   * instance of that hook: the settings are a property of the chart, so two
   * components using the hook must read/write one value instead of two
   * divergent copies that overwrite each other in storage. `null` until the
   * first instance hydrates it. Exposed as the store itself (not a ref) — it
   * is created once with `useMemo`, like `dispatch` and `storage`.
   */
  settingsStore: SharedState<unknown>;
  /**
   * Provider-owned snapshot of the `drawing_tools` overlays, shared by every
   * `useDrawingTools` instance. klinecharts v10 exposes no overlay
   * add/remove event, so the list has to be polled — the provider runs ONE
   * interval for the whole chart instead of one per hook instance, and only
   * while at least one instance is mounted.
   */
  drawingOverlaysStore: SharedState<unknown>;
  /**
   * Register a consumer of `drawingOverlaysStore`. The polling interval starts
   * at the first subscriber and stops at the last unsubscribe, so a chart that
   * never mounts a drawing toolbar pays nothing. Returns the unsubscribe.
   */
  subscribeDrawingOverlays: () => () => void;
  /** Re-read the overlays now (after a create/remove/override in any hook). */
  refreshDrawingOverlays: () => void;
  /**
   * Provider-owned list of saved layouts, shared by every `useLayoutManager`
   * instance (previously hook-local state: two instances hydrated two copies
   * and each ran its own auto-save sweep over the same storage key).
   */
  layoutStore: SharedState<unknown>;
  /**
   * Provider-owned auto-save flag for layouts. Kept in a shared store (not in
   * `KlinechartsUIState`) so all `useLayoutManager` instances see and toggle
   * one value while the sweep itself stays provider-owned.
   */
  layoutAutoSaveStore: SharedState<boolean>;
  /**
   * Provider-owned watchlist (see `watchlist.ts`), shared by every
   * `useWatchlist` instance: the quote subscriptions are a property of the
   * provider, so two components using the hook observe one list instead of
   * each opening its own datafeed subscription for the same tickers.
   */
  watchlistStore: SharedState<unknown>;
  /**
   * Subscribe this provider to realtime quotes for `ticker` (no-op when
   * already subscribed) and add its row to `watchlistStore`.
   */
  subscribeWatchlist: (ticker: string) => void;
  /** Drop the subscription for `ticker` and remove its row. */
  unsubscribeWatchlist: (ticker: string) => void;
  /**
   * Listener set registered via `useAlerts.onAlertTriggered`; invoked by the
   * provider-owned crossing poller when an alert fires. A Set so multiple
   * components (toolbar, status bar, sound trigger) can all observe firings
   * without one overwriting the other. `onAlertTriggered` returns an unsubscribe.
   */
  alertTriggeredListenersRef: RefObject<Set<(alert: Alert) => void>>;
  /**
   * Provider-owned replay resources, shared across every `useReplay` instance
   * so there is exactly one playback timer and one data buffer. The hook reads
   * and writes these instead of its own refs; the provider clears the interval
   * on unmount.
   */
  replayIntervalRef: RefObject<ReturnType<typeof setInterval> | null>;
  replaySavedDataRef: RefObject<KLineData[]>;
  replayIndexRef: RefObject<number>;
  /**
   * Synchronous mirror of `state.replay.isReplaying` read by the replay hook
   * so it can flip the replay-aware DataLoader intercept's mode (and reload the
   * chart) in the same tick as start/stop, without waiting for the state-sync
   * effect.
   */
  replayActiveRef: RefObject<boolean>;
  /**
   * Resolved persistence configuration, or `null` when the consumer did not
   * pass the `storage` option (persistence disabled — pre-1.1.0 behaviour).
   * Hooks and tests read/write through this so they share one adapter.
   */
  storage: ResolvedStorage | null;
}

/** Combined context value returned by `useKlinechartsUI()`. */
export interface KlinechartsUIContextValue extends KlinechartsUIDispatchValue {
  state: KlinechartsUIState;
}
