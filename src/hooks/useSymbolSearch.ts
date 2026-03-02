import { useState, useCallback, useRef, useEffect } from "react";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";
import type { PartialSymbolInfo } from "../provider/types";

export interface UseSymbolSearchReturn {
  query: string;
  results: PartialSymbolInfo[];
  isSearching: boolean;
  activeSymbol: PartialSymbolInfo | null;
  setQuery: (query: string) => void;
  selectSymbol: (symbol: PartialSymbolInfo) => void;
  clearResults: () => void;
}

export function useSymbolSearch(debounceMs = 300): UseSymbolSearchReturn {
  const { state, dispatch, datafeed } = useKlinechartsUI();
  const [query, setQueryState] = useState("");
  const [results, setResults] = useState<PartialSymbolInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // AbortController for the in-flight fetch — cancelled when a new query arrives.
  const abortRef = useRef<AbortController | null>(null);

  const setQuery = useCallback(
    (q: string) => {
      setQueryState(q);

      // Cancel previous debounce timer.
      if (timerRef.current) clearTimeout(timerRef.current);

      // Cancel previous in-flight request.
      abortRef.current?.abort();
      abortRef.current = null;

      if (!q.trim()) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      timerRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;

        try {
          const data = await datafeed.searchSymbols(q, controller.signal);
          if (!controller.signal.aborted) {
            setResults(data);
          }
        } catch {
          if (!controller.signal.aborted) {
            setResults([]);
          }
        } finally {
          if (!controller.signal.aborted) {
            setIsSearching(false);
          }
        }
      }, debounceMs);
    },
    [datafeed, debounceMs]
  );

  const selectSymbol = useCallback(
    (symbol: PartialSymbolInfo) => {
      dispatch({ type: "SET_SYMBOL", symbol });
      setQueryState("");
      setResults([]);
    },
    [dispatch]
  );

  const clearResults = useCallback(() => {
    setQueryState("");
    setResults([]);
    setIsSearching(false);
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return {
    query,
    results,
    isSearching,
    activeSymbol: state.symbol,
    setQuery,
    selectSymbol,
    clearResults,
  };
}
