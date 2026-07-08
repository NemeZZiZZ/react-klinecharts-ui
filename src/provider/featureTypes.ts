/**
 * Shared domain types for stateful feature hooks (`useAlerts`, `useMeasure`,
 * `useReplay`).
 *
 * These live in a neutral module so they can be referenced both by the
 * provider store (`KlinechartsUIState` / actions in `./types`) and by the
 * hooks, without creating a circular import between the two. The hooks
 * re-export them so the public API surface (consumed via the package root)
 * stays unchanged.
 */

import type { AlertLineExtendData } from "../extensions/overlays/alertLine";

// --- Alerts -----------------------------------------------------------------

export type AlertCondition = "crossing_up" | "crossing_down" | "crossing";

/**
 * What an alert watches. Defaults to a price level on the main symbol; an
 * `indicator` target watches a specific figure series value (e.g. RSI
 * crossing 70, MACD signal crossover).
 */
export type AlertTarget =
  | { type: "price" }
  | {
      type: "indicator";
      /** Indicator id as registered with klinecharts (e.g. `sub_RSI_TV`). */
      indicatorId: string;
      /** Figure key whose value is compared (e.g. `rsi`, `macd`, `signal`). */
      figureKey: string;
    };

export interface Alert {
  id: string;
  /**
   * The threshold the target is compared against. For a `price` target this is
   * a price level; for an `indicator` target it is the indicator value to
   * cross (e.g. 70 for RSI overbought).
   */
  price: number;
  condition: AlertCondition;
  message?: string;
  triggered: boolean;
  /**
   * What the alert watches. Omit / `"price"` for the classic price-crossing
   * behaviour; use `"indicator"` for indicator-value crossing.
   */
  target?: AlertTarget;
  /**
   * Visual style for the alert line overlay (color, label text, line/mark
   * styling, bell marker). Persisted in the store so it survives undo/redo
   * and layout presets.
   */
  extendData?: AlertLineExtendData;
}

// --- Measure ----------------------------------------------------------------

export interface MeasurePoint {
  price: number;
  timestamp: number;
  barIndex: number;
}

export interface MeasureResult {
  from: MeasurePoint;
  to: MeasurePoint;
  /** Absolute price difference */
  priceDiff: number;
  /** Percentage change from → to */
  pricePercent: number;
  /** Number of bars between the two points */
  bars: number;
  /** Time difference in milliseconds */
  timeDiff: number;
}

export interface MeasureState {
  /** Whether measure mode is active (waiting for clicks) */
  isActive: boolean;
  /** First point (set after first click) */
  fromPoint: MeasurePoint | null;
  /** Current measurement result (null until both points are set) */
  result: MeasureResult | null;
}

// --- Replay -----------------------------------------------------------------

export type ReplaySpeed = 1 | 2 | 5 | 10;

export interface ReplayState {
  /** Whether a replay session is active */
  isReplaying: boolean;
  /** Whether the replay is currently paused */
  isPaused: boolean;
  /** Current playback speed multiplier */
  speed: ReplaySpeed;
  /** Current bar index in the replay */
  barIndex: number;
  /** Total number of bars in the saved data */
  totalBars: number;
}
