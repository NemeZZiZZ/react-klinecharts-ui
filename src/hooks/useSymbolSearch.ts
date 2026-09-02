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

  // Cancels the pending debounce timer and any in-flight request. Shared by
  // setQuery (new input), selectSymbol and clearResults — without it a
  // pending search completed after a select/clear and its results
  // resurrected in the list.
  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const setQuery = useCallback(
    (q: string) => {
      setQueryState(q);

      // Cancel previous debounce timer and in-flight request.
      cancelPending();

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
          // searchSymbols is optional on the Datafeed — without it the search
          // resolves to an empty result list instead of throwing.
          const data =
            (await datafeed.searchSymbols?.(q, controller.signal)) ?? [];
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
    [datafeed, debounceMs, cancelPending]
  );

  const selectSymbol = useCallback(
    (symbol: PartialSymbolInfo) => {
      cancelPending();
      dispatch({ type: "SET_SYMBOL", symbol });
      setQueryState("");
      setResults([]);
      // The aborted fetch deliberately skips its state resets (see the
      // finally above), so the searching flag must be cleared here — same
      // as clearResults — or the spinner stays on after selecting mid-search.
      setIsSearching(false);
    },
    [dispatch, cancelPending]
  );

  const clearResults = useCallback(() => {
    cancelPending();
    setQueryState("");
    setResults([]);
    setIsSearching(false);
  }, [cancelPending]);

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
