import type { Chart } from "klinecharts";
import type { PartialSymbolInfo } from "../provider/types";
import type { TerminalPeriod } from "../data/periods";
import type { Dispatch } from "react";

/** One chart cell in a workspace grid. */
export interface ChartCell {
  /** Stable cell id (used as React key + workspace registry key). */
  id: string;
  symbol: PartialSymbolInfo;
  period: TerminalPeriod;
}

/** Top-level workspace state. */
export interface WorkspaceState {
  /** The chart cells that make up the layout grid. */
  cells: ChartCell[];
  /** Currently focused cell (drives keyboard shortcuts etc.). */
  activeCellId: string | null;
}

export type WorkspaceAction =
  | { type: "SET_CELLS"; cells: ChartCell[] }
  | { type: "ADD_CELL"; cell: ChartCell }
  | { type: "REMOVE_CELL"; id: string }
  | { type: "SET_CELL_SYMBOL"; id: string; symbol: PartialSymbolInfo }
  | { type: "SET_CELL_PERIOD"; id: string; period: TerminalPeriod }
  | { type: "SET_ACTIVE_CELL"; id: string | null };

/** Channels that can be mirrored between charts in the workspace. */
export type SyncChannel = "crosshair" | "scroll" | "zoom" | "symbol" | "period";

/** Default: every channel mirrored (fully-linked workspace). */
export const DEFAULT_SYNC_CONFIG: Record<SyncChannel, boolean> = {
  crosshair: true,
  scroll: true,
  zoom: true,
  symbol: true,
  period: true,
};

/** Per-channel enable/disable for chart mirroring. */
export type SyncConfig = Partial<Record<SyncChannel, boolean>>;

/**
 * The workspace context value. Exposes the reducer state, the dispatch, and a
 * chart-instance registry that `useChartSync` populates and the sync logic
 * iterates over. The registry is intentionally a mutable ref (Map) — chart
 * instances come and go as cells mount/unmount and we don't want a state bump
 * on every registration.
 */
export interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
  /** cellId → Chart instance registry. */
  chartsRef: { current: Map<string, Chart> };
  /** Re-entrancy guard so mirroring doesn't feedback-loop. */
  broadcastingRef: { current: boolean };
  /** Resolved sync config (defaults merged in). */
  sync: Record<SyncChannel, boolean>;
}
