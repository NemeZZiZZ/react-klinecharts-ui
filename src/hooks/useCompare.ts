import { useState, useCallback, useEffect, useRef } from "react";
import { registerIndicator } from "react-klinecharts";
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

let colorIndex = 0;
let compareCounter = 0;

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

  const addSymbol = useCallback(
    async (ticker: string, color?: string) => {
      if (!state.chart || !datafeed) return;
      if (indicatorsRef.current.has(ticker)) return;

      const assignedColor =
        color ?? DEFAULT_COLORS[colorIndex++ % DEFAULT_COLORS.length];

      const mainDataList = state.chart.getDataList();
      if (!mainDataList || mainDataList.length === 0) return;

      const from = mainDataList[0].timestamp;
      const to = mainDataList[mainDataList.length - 1].timestamp;

      // Fetch compare symbol data
      const compareData = await datafeed.getHistoryKLineData(
        { ticker } as any,
        { ...state.period!, label: "" },
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

      // Build %-change array aligned to main chart timeline
      const normalizedData = mainDataList.map((mainBar) => {
        const close = compareMap.get(mainBar.timestamp);
        return {
          pct: close != null ? ((close - bp) / bp) * 100 : NaN,
        };
      });

      // Register custom indicator
      const indicatorName = `__cmp_${++compareCounter}_${ticker}`;

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
        calc: () => normalizedData,
      });

      // Place on main pane
      const paneId = state.chart.createIndicator(
        { name: indicatorName },
        true,
        { id: "candle_pane" },
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
    [state.chart, state.period, datafeed],
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
