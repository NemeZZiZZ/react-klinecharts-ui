import { useState, useCallback, useEffect, useRef, useId } from "react";
import { registerIndicator } from "klinecharts";
import type { KLineData } from "klinecharts";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";

export interface CompareSymbol {
  ticker: string;
  /** Base price (first bar close) used for percentage normalization */
  basePrice: number | null;
  color: string;
  visible: boolean;
}

export interface UseCompareReturn {
  /** Currently compared symbols */
  symbols: CompareSymbol[];
  /** Add a symbol — fetches data, normalizes to %, renders as indicator line */
  addSymbol: (ticker: string, color?: string) => Promise<void>;
  /** Remove a symbol overlay */
  removeSymbol: (ticker: string) => void;
  /** Toggle visibility of a compared symbol */
  toggleSymbol: (ticker: string) => void;
  /** Clear all comparisons */
  clearAll: () => void;
}

const DEFAULT_COLORS = [
  "#2196f3",
  "#ff9800",
  "#4caf50",
  "#e91e63",
  "#9c27b0",
  "#00bcd4",
  "#ff5722",
  "#8bc34a",
];

/**
 * Headless hook for comparing multiple symbols on the same chart.
 *
 * Fetches historical data for each added symbol via the datafeed,
 * normalizes prices to percentage change from the first bar,
 * and renders each as a custom indicator line on the main pane.
 */
export function useCompare(): UseCompareReturn {
  const { state, datafeed } = useKlinechartsUI();
  const [symbols, setSymbols] = useState<CompareSymbol[]>([]);
  const indicatorsRef = useRef<
    Map<string, { name: string; paneId: string }>
  >(new Map());
  // Per-instance salt so two simultaneously-mounted useCompare instances
  // (e.g. multi-terminal on one page) comparing the SAME ticker don't
  // overwrite each other's `calc` closure in klinecharts' global registry.
  // `useId()` is stable for a component instance and unique across instances.
  const instanceSalt = useId().replace(/[^a-zA-Z0-9]/g, "");

  const addSymbol = useCallback(
    async (ticker: string, color?: string) => {
      if (!state.chart || !datafeed) return;
      if (indicatorsRef.current.has(ticker)) return;

      // Derive the color from the current number of comparisons instead of a
      // monotonically-growing module counter, so it stays stable across
      // add/remove/clear cycles and re-mounts.
      const assignedColor =
        color ??
        DEFAULT_COLORS[symbols.length % DEFAULT_COLORS.length];

      const mainDataList = state.chart.getDataList();
      if (!mainDataList || mainDataList.length === 0) return;

      const from = mainDataList[0].timestamp;
      const to = mainDataList[mainDataList.length - 1].timestamp;

      // Fetch compare symbol data. The compared ticker's precision is not
      // generally known here, so fall back to the main symbol's precision
      // (compare symbols are usually from the same market), then to sane
      // defaults. The previous `{ ticker } as any` discarded precision entirely.
      const mainSymbol = state.symbol;
      const symbol = {
        ticker,
        pricePrecision: mainSymbol?.pricePrecision ?? 2,
        volumePrecision: mainSymbol?.volumePrecision ?? 8,
      };
      const compareData = await datafeed.getHistoryKLineData(
        symbol,
        state.period,
        from,
        to,
      );

      if (!compareData || compareData.length === 0) return;

      // Build timestamp → close lookup
      const compareMap = new Map<number, number>();
      for (const bar of compareData) {
        compareMap.set(bar.timestamp, bar.close);
      }

      // Find the base price (first aligned bar)
      let basePrice: number | null = null;
      for (const bar of mainDataList) {
        const close = compareMap.get(bar.timestamp);
        if (close != null) {
          basePrice = close;
          break;
        }
      }
      if (basePrice === null || basePrice === 0) return;
      const bp = basePrice;

      // Register custom indicator. `calc` recomputes from the live `dataList`
      // on every call (klinecharts passes the current chart data), so the line
      // stays aligned as the main chart's bar count changes (history scroll,
      // realtime). For bars whose timestamp is missing from `compareMap` (e.g.
      // streamed main bars with no compare-symbol quote yet), we carry forward
      // the last known % instead of emitting NaN, so the line doesn't visually
      // break on the right edge. NOTE: a fully live comparison would require
      // subscribing to the compare symbol's realtime updates — not implemented.
      // Stable per-ticker template name (salted per hook instance) so repeated
      // add/remove cycles overwrite the previous registration instead of
      // leaking a new template on every add (klinecharts has no unregister
      // API), while keeping different useCompare instances isolated when they
      // compare the same ticker on the same page.
      const indicatorName = `__cmp_${instanceSalt}_${ticker}`;

      registerIndicator({
        name: indicatorName,
        shortName: ticker,
        figures: [
          {
            key: "pct",
            title: `${ticker} %: `,
            type: "line",
            styles: () => ({ color: assignedColor }),
          },
        ] as any,
        calc: (dataList: KLineData[]) => {
          let lastPct: number | null = null;
          return dataList.map((bar) => {
            const close = compareMap.get(bar.timestamp);
            if (close != null) {
              lastPct = ((close - bp) / bp) * 100;
            }
            return { pct: lastPct };
          });
        },
      });

      // Place on main pane
      const paneId = state.chart.createIndicator(
        { name: indicatorName },
        { isStack: true, pane: { id: "candle_pane" } },
      );

      indicatorsRef.current.set(ticker, {
        name: indicatorName,
        paneId: typeof paneId === "string" ? paneId : "candle_pane",
      });

      setSymbols((prev) => {
        if (prev.some((s) => s.ticker === ticker)) return prev;
        return [
          ...prev,
          { ticker, basePrice: bp, color: assignedColor, visible: true },
        ];
      });
    },
    [state.chart, state.symbol, state.period, datafeed, symbols.length, instanceSalt],
  );

  const removeSymbol = useCallback(
    (ticker: string) => {
      const info = indicatorsRef.current.get(ticker);
      if (info && state.chart) {
        try {
          state.chart.removeIndicator({ name: info.name } as any);
        } catch {
          // indicator may already be removed
        }
        indicatorsRef.current.delete(ticker);
      }
      setSymbols((prev) => prev.filter((s) => s.ticker !== ticker));
    },
    [state.chart],
  );

  const toggleSymbol = useCallback(
    (ticker: string) => {
      const info = indicatorsRef.current.get(ticker);
      if (!info || !state.chart) return;

      setSymbols((prev) => {
        const sym = prev.find((s) => s.ticker === ticker);
        if (!sym) return prev;

        const newVisible = !sym.visible;
        state.chart?.overrideIndicator({
          name: info.name,
          visible: newVisible,
        } as any);

        return prev.map((s) =>
          s.ticker === ticker ? { ...s, visible: newVisible } : s,
        );
      });
    },
    [state.chart],
  );

  const clearAll = useCallback(() => {
    indicatorsRef.current.forEach((info) => {
      try {
        state.chart?.removeIndicator({ name: info.name } as any);
      } catch {
        // ignore
      }
    });
    indicatorsRef.current.clear();
    setSymbols([]);
  }, [state.chart]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      indicatorsRef.current.forEach((info) => {
        try {
          state.chart?.removeIndicator({ name: info.name } as any);
        } catch {
          // ignore
        }
      });
      indicatorsRef.current.clear();
    };
  }, [state.chart]);

  return { symbols, addSymbol, removeSymbol, toggleSymbol, clearAll };
}
