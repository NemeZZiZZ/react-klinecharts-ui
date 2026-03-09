import { useState, useCallback, useRef, useEffect } from "react";
import {
  useKlinechartsUI,
  useKlinechartsUIDispatch,
} from "../provider/ChartTerminalContext";
import type { SymbolInfo, KLineData } from "react-klinecharts";
import type { TerminalPeriod } from "../data/periods";

export interface WatchlistItem {
  ticker: string;
  lastPrice: number | null;
  change: number | null;
  changePercent: number | null;
}

export interface UseWatchlistReturn {
  items: WatchlistItem[];
  addSymbol: (ticker: string) => void;
  removeSymbol: (ticker: string) => void;
  switchSymbol: (ticker: string) => void;
  activeSymbol: string | null;
}

export function useWatchlist(): UseWatchlistReturn {
  const { state } = useKlinechartsUI();
  const { dispatch, datafeed } = useKlinechartsUIDispatch();

  const [items, setItems] = useState<WatchlistItem[]>([]);

  // Track active subscriptions so we can clean them up.
  const subscriptionsRef = useRef<
    Map<string, { symbolInfo: SymbolInfo; period: TerminalPeriod }>
  >(new Map());

  const activeSymbol = state.symbol?.ticker ?? null;

  const addSymbol = useCallback(
    (ticker: string) => {
      // Prevent duplicates.
      setItems((prev) => {
        if (prev.some((item) => item.ticker === ticker)) return prev;
        return [
          ...prev,
          { ticker, lastPrice: null, change: null, changePercent: null },
        ];
      });

      if (subscriptionsRef.current.has(ticker)) return;

      const symbolInfo = { ticker } as SymbolInfo;
      const period = state.period;

      subscriptionsRef.current.set(ticker, { symbolInfo, period });

      datafeed.subscribe(symbolInfo, period, (bar: KLineData) => {
        setItems((prev) =>
          prev.map((item) => {
            if (item.ticker !== ticker) return item;
            const change = bar.close - bar.open;
            const changePercent =
              bar.open !== 0 ? (change / bar.open) * 100 : null;
            return {
              ...item,
              lastPrice: bar.close,
              change,
              changePercent,
            };
          }),
        );
      });
    },
    [datafeed, state.period],
  );

  const removeSymbol = useCallback(
    (ticker: string) => {
      const sub = subscriptionsRef.current.get(ticker);
      if (sub) {
        datafeed.unsubscribe(sub.symbolInfo, sub.period);
        subscriptionsRef.current.delete(ticker);
      }
      setItems((prev) => prev.filter((item) => item.ticker !== ticker));
    },
    [datafeed],
  );

  const switchSymbol = useCallback(
    (ticker: string) => {
      dispatch({ type: "SET_SYMBOL", symbol: { ticker } });
    },
    [dispatch],
  );

  // Clean up all subscriptions on unmount.
  useEffect(() => {
    return () => {
      subscriptionsRef.current.forEach((sub) => {
        datafeed.unsubscribe(sub.symbolInfo, sub.period);
      });
      subscriptionsRef.current.clear();
    };
  }, [datafeed]);

  return {
    items,
    addSymbol,
    removeSymbol,
    switchSymbol,
    activeSymbol,
  };
}
