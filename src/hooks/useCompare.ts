import { useState, useCallback, useEffect, useRef, useId } from "react";
import { registerIndicator } from "klinecharts";
import type {
  KLineData,
  IndicatorCreateTooltipDataSourceParams,
  IndicatorTooltipData,
} from "klinecharts";
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
  /** Add a symbol — fetches data, projects onto the main price scale, renders as an overlay line */
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
 * Per-bar comparison result returned by the indicator's `calc`.
 *
 * `value` is the compare-symbol's close projected onto the main symbol's price
 * scale (so the line draws over the candles and shares the candle y-axis,
 * instead of collapsing the chart with a separate percentage scale):
 *   value = mainBase * (compareClose / compareBase)
 * `pct` is the real percentage change of the compare symbol from its own
 * anchor — shown in the tooltip/legend, never drawn on the axis.
 */
export interface CompareIndicatorResult {
  value: number | null;
  pct: number | null;
}

/**
 * Headless hook for comparing multiple symbols on the same chart.
 *
 * Fetches historical data for each added symbol via the datafeed, then
 * projects each compare price onto the main symbol's price scale relative to
 * a shared anchor bar (first aligned candle). The projected line draws over
 * the candles and shares the candle y-axis (no separate percentage scale that
 * would collapse the chart). The real percentage change is surfaced in the
 * indicator tooltip via `createTooltipDataSource`.
 */
export function useCompare(): UseCompareReturn {
  const { state, datafeed } = useKlinechartsUI();
  const [symbols, setSymbols] = useState<CompareSymbol[]>([]);
  const indicatorsRef = useRef<
    Map<string, { name: string; indicatorId: string | null }>
  >(new Map());
  // Tickers with an in-flight addSymbol fetch. The indicatorsRef entry only
  // appears AFTER the await, so without this two rapid addSymbol calls for
  // the same ticker both passed the guard and registered duplicate
  // indicators; and a removeSymbol during the fetch was "resurrected" when
  // the continuation ran. removeSymbol/clearAll/unmount delete from this set,
  // which is how the post-await continuation knows to bail out.
  const pendingRef = useRef<Set<string>>(new Set());
  // `addSymbol`/`toggleSymbol` only need the CURRENT list to pick a color /
  // resolve visibility — closing over the `symbols` state array would recreate
  // both callbacks (and every downstream memo) on each add/remove/toggle. A
  // ref mirror keeps their identities stable across list changes.
  const symbolsRef = useRef<CompareSymbol[]>([]);
  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbols]);
  // Per-instance salt so two simultaneously-mounted useCompare instances
  // (e.g. multi-terminal on one page) comparing the SAME ticker don't
  // overwrite each other's `calc` closure in klinecharts' global registry.
  // `useId()` is stable for a component instance and unique across instances.
  const instanceSalt = useId().replace(/[^a-zA-Z0-9]/g, "");

  const addSymbol = useCallback(
    async (ticker: string, color?: string) => {
      if (!state.chart || !datafeed) return;
      if (indicatorsRef.current.has(ticker) || pendingRef.current.has(ticker))
        return;

      // Prefer the first palette color nobody is using yet: deriving the color
      // from `symbols.length` alone collides after a remove — [A=0, B=1] minus
      // A leaves length 1, so the next symbol is painted with B's color too.
      // Falls back to the length-based pick once every color is taken, which
      // keeps it stable across add/remove/clear cycles and re-mounts.
      const usedColors = new Set(symbolsRef.current.map((s) => s.color));
      const assignedColor =
        color ??
        DEFAULT_COLORS.find((c) => !usedColors.has(c)) ??
        DEFAULT_COLORS[symbolsRef.current.length % DEFAULT_COLORS.length];

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
      // All synchronous early-outs are past — occupy the pending slot for the
      // whole flight. (Placing the add before the mainDataList check above
      // would leak the slot when the chart has no data yet.)
      pendingRef.current.add(ticker);
      let compareData: Awaited<
        ReturnType<typeof datafeed.getHistoryKLineData>
      >;
      try {
        compareData = await datafeed.getHistoryKLineData(
          symbol,
          state.period,
          from,
          to,
        );
      } catch {
        // Fetch failed — release the pending slot so a retry is possible.
        pendingRef.current.delete(ticker);
        return;
      }

      // Removed/cleared (or the hook unmounted) while the fetch was in
      // flight — the pending slot is already gone; do not register anything.
      if (!pendingRef.current.has(ticker)) return;
      pendingRef.current.delete(ticker);

      if (!compareData || compareData.length === 0) return;

      // Build timestamp → close lookup
      const compareMap = new Map<number, number>();
      for (const bar of compareData) {
        compareMap.set(bar.timestamp, bar.close);
      }

      // Find the anchor: the first bar where BOTH the main chart and the
      // compare symbol have a close. We need both base prices at that shared
      // timestamp so we can project compare prices onto the main scale.
      let compareBase: number | null = null;
      let mainBase: number | null = null;
      for (const bar of mainDataList) {
        const close = compareMap.get(bar.timestamp);
        if (close != null) {
          compareBase = close;
          mainBase = bar.close;
          break;
        }
      }
      if (compareBase === null || compareBase === 0 || mainBase === null) return;
      const cb = compareBase;
      const mb = mainBase;

      // Register custom indicator. `calc` recomputes from the live `dataList`
      // on every call (klinecharts passes the current chart data), so the line
      // stays aligned as the main chart's bar count changes (history scroll,
      // realtime). For bars whose timestamp is missing from `compareMap` (e.g.
      // streamed main bars with no compare-symbol quote yet), we carry forward
      // the last known projected value instead of emitting NaN, so the line
      // doesn't visually break on the right edge. NOTE: a fully live comparison
      // would require subscribing to the compare symbol's realtime updates —
      // not implemented.
      //
      // CRITICAL: the drawn figure (`value`) must be in the MAIN symbol's price
      // domain so it shares the candle y-axis. Emitting raw percentages here
      // made klinecharts blend a small-range series (e.g. ±5) with the candle
      // price range (e.g. ~60000) on the same axis, collapsing the chart. The
      // real percentage change (`pct`) is carried in the result but never
      // drawn — it is surfaced in the tooltip via `createTooltipDataSource`.
      // `series: "price"` makes klinecharts sync the indicator's precision to
      // the main symbol's pricePrecision (like MA/AVP do).
      //
      // Stable per-ticker template name (salted per hook instance) so repeated
      // add/remove cycles overwrite the previous registration instead of
      // leaking a new template on every add (klinecharts has no unregister
      // API), while keeping different useCompare instances isolated when they
      // compare the same ticker on the same page.
      const indicatorName = `__cmp_${instanceSalt}_${ticker}`;

      registerIndicator({
        name: indicatorName,
        shortName: ticker,
        series: "price",
        figures: [
          {
            key: "value",
            title: `${ticker}: `,
            type: "line",
            styles: () => ({ color: assignedColor }),
          },
        ] as any,
        calc: (dataList: KLineData[]) => {
          let lastValue: number | null = null;
          let lastPct: number | null = null;
          return dataList.map((bar) => {
            const close = compareMap.get(bar.timestamp);
            if (close != null) {
              // Project the compare close onto the main price scale:
              //   if ETH goes from 3000→3300 (+10%), draw the line 10% above
              //   the BTC anchor (64000→70400) so it overlays the candles.
              lastValue = mb * (close / cb);
              lastPct = ((close - cb) / cb) * 100;
            }
            return { value: lastValue, pct: lastPct } as CompareIndicatorResult;
          });
        },
        // Show the real percentage change in the tooltip. The drawn `value` is
        // an artificial projection, so we hide it from the legend and report
        // `pct` instead. `eachFigures` would otherwise render `value` with the
        // main symbol's price formatting (misleading), so we fully override
        // the legends here.
        createTooltipDataSource: (
          params: IndicatorCreateTooltipDataSourceParams<CompareIndicatorResult>,
        ): IndicatorTooltipData => {
          const { indicator, crosshair } = params;
          const data =
            indicator.result[crosshair.dataIndex ?? -1] ??
            ({} as CompareIndicatorResult);
          const pct = data.pct;
          const valueText =
            pct == null || !Number.isFinite(pct)
              ? "n/a"
              : `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
          return {
            name: ticker,
            calcParamsText: "",
            features: [],
            legends: [
              {
                title: { text: `${ticker} %: `, color: assignedColor },
                value: { text: valueText, color: assignedColor },
              },
            ],
          };
        },
      });

      // Place on main pane, stacked over the candles. klinecharts v10
      // createIndicator returns the indicator id; paneId lives on the
      // IndicatorCreate value. isStack=true overlays it on the candle pane.
      const indicatorId = state.chart.createIndicator(
        { name: indicatorName, paneId: "candle_pane" },
        true,
      );

      indicatorsRef.current.set(ticker, {
        name: indicatorName,
        indicatorId: typeof indicatorId === "string" ? indicatorId : null,
      });

      setSymbols((prev) => {
        if (prev.some((s) => s.ticker === ticker)) return prev;
        return [
          ...prev,
          { ticker, basePrice: cb, color: assignedColor, visible: true },
        ];
      });
    },
    [state.chart, state.symbol, state.period, datafeed, instanceSalt],
  );

  const removeSymbol = useCallback(
    (ticker: string) => {
      // Also drop a possible in-flight add: its post-await continuation bails
      // when the pending slot is gone.
      pendingRef.current.delete(ticker);
      const info = indicatorsRef.current.get(ticker);
      if (info && state.chart) {
        try {
          state.chart.removeIndicator({ name: info.name });
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

      const sym = symbolsRef.current.find((s) => s.ticker === ticker);
      if (!sym) return;
      const newVisible = !sym.visible;

      // Perform chart side effects outside the setState updater: updaters
      // must stay pure — StrictMode double-invokes them and a concurrent
      // render may discard the result, both toggling the chart without a
      // committed state change (same discipline as useAnnotations).
      state.chart.overrideIndicator({
        name: info.name,
        visible: newVisible,
      });

      setSymbols((prev) =>
        prev.map((s) =>
          s.ticker === ticker ? { ...s, visible: newVisible } : s,
        ),
      );
    },
    [state.chart],
  );

  const clearAll = useCallback(() => {
    pendingRef.current.clear();
    indicatorsRef.current.forEach((info) => {
      try {
        state.chart?.removeIndicator({ name: info.name });
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
      pendingRef.current.clear();
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

  // The projection is anchored to the main series: compareMap and both base
  // prices are baked into the registered indicator's calc closure, and the
  // chart reloads data WITHOUT remounting on a symbol/period change. Keeping
  // the comparisons would draw the old anchors over the new symbol's scale
  // (shared timestamps) or render silent nulls while the symbol stays listed
  // (non-overlapping ones). Drop them — re-adding re-anchors to the new
  // series.
  useEffect(() => {
    if (indicatorsRef.current.size === 0 && pendingRef.current.size === 0)
      return;
    // Deferred: calling setState synchronously inside an effect triggers
    // cascading renders (react-hooks lint), and the chart's own reload effect
    // runs in the same commit anyway. Guarded: without cancellation a stale
    // microtask fires after unmount (or after a newer symbol change already
    // re-added comparisons) and wipes state that no longer belongs to it.
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) clearAll();
    });
    return () => {
      cancelled = true;
    };
  }, [state.symbol, state.period, clearAll]);

  return { symbols, addSymbol, removeSymbol, toggleSymbol, clearAll };
}
