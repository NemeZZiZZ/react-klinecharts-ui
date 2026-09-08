import { useCallback, useSyncExternalStore } from "react";
import {
  useKlinechartsUI,
  useKlinechartsUIDispatch,
} from "../provider/ChartTerminalContext";
import type { WatchlistItem } from "../provider/watchlist";
import type { SharedState } from "../provider/types";

export type { WatchlistItem } from "../provider/watchlist";

export interface UseWatchlistReturn {
  items: WatchlistItem[];
  addSymbol: (ticker: string) => void;
  removeSymbol: (ticker: string) => void;
  switchSymbol: (ticker: string) => void;
  activeSymbol: string | null;
}

/**
 * Headless watchlist hook.
 *
 * The rows AND the datafeed subscriptions live in the provider-owned
 * `watchlistStore` (see `provider/watchlist.ts`): every `useWatchlist()`
 * instance of one provider observes and mutates one list, and each ticker is
 * subscribed exactly once no matter how many components use the hook. The
 * provider also re-subscribes all tickers when the period changes —
 * subscriptions are pinned to a period, so without that the rows would keep
 * quoting the old timeframe after a period switch.
 */
export function useWatchlist(): UseWatchlistReturn {
  const { state } = useKlinechartsUI();
  const {
    dispatch,
    watchlistStore,
    subscribeWatchlist,
    unsubscribeWatchlist,
  } = useKlinechartsUIDispatch();

  const store = watchlistStore as unknown as SharedState<WatchlistItem[]>;
  const items = useSyncExternalStore(store.subscribe, store.get, store.get);

  const activeSymbol = state.symbol?.ticker ?? null;

  const addSymbol = useCallback(
    (ticker: string) => {
      subscribeWatchlist(ticker);
    },
    [subscribeWatchlist],
  );

  const removeSymbol = useCallback(
    (ticker: string) => {
      unsubscribeWatchlist(ticker);
    },
    [unsubscribeWatchlist],
  );

  const switchSymbol = useCallback(
    (ticker: string) => {
      dispatch({ type: "SET_SYMBOL", symbol: { ticker } });
    },
    [dispatch],
  );

  return {
    items,
    addSymbol,
    removeSymbol,
    switchSymbol,
    activeSymbol,
  };
}
