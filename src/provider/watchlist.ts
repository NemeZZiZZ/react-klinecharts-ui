import type { KLineData } from "klinecharts";

export interface WatchlistItem {
  ticker: string;
  lastPrice: number | null;
  change: number | null;
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
