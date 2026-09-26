import type { KLineData } from "klinecharts";

export interface WatchlistItem {
  ticker: string;
  lastPrice: number | null;
  /**
   * Move of the CURRENTLY FORMING bar (close − open of the subscribed
   * period's bar) — NOT the day/session change a watchlist column usually
   * shows: it collapses to ~0 on every new bar and creeps up as the bar
   * forms. Computing a true day change requires a session-open baseline the
   * realtime subscription does not provide; consumers needing it should
   * fetch the daily open themselves (the examples' WatchlistPanel does).
   */
  change: number | null;
  /** `change` as a percentage of the forming bar's open. */
  changePercent: number | null;
}

/** Blank row for a freshly added ticker (no quote yet). */
export function blankWatchlistItem(ticker: string): WatchlistItem {
  return { ticker, lastPrice: null, change: null, changePercent: null };
}

/**
 * Fold one realtime bar into the watchlist snapshot. Pure — returns a new
 * array, so the shared store only notifies when the ticker is actually listed.
 */
export function applyWatchlistTick(
  items: WatchlistItem[],
  ticker: string,
  bar: KLineData,
): WatchlistItem[] {
  return items.map((item) => {
    if (item.ticker !== ticker) return item;
    const change = bar.close - bar.open;
    const changePercent = bar.open !== 0 ? (change / bar.open) * 100 : null;
    return {
      ...item,
      lastPrice: bar.close,
      change,
      changePercent,
    };
  });
}
