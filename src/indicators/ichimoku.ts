import type { IndicatorTemplate, KLineData, Indicator } from "klinecharts";
import { slidingMinMax } from "./window";

const ichimoku: IndicatorTemplate = {
  name: "Ichimoku",
  shortName: "Ichimoku",
  calcParams: [9, 26, 52, 26],
  figures: [
    { key: "tenkan", title: "Tenkan: ", type: "line" },
    { key: "kijun", title: "Kijun: ", type: "line" },
    { key: "chikou", title: "Chikou: ", type: "line" },
    { key: "spanA", title: "Span A: ", type: "line" },
    { key: "spanB", title: "Span B: ", type: "line" },
  ],
  calc: (dataList: KLineData[], indicator: Indicator) => {
    const params = indicator.calcParams as number[];
    const tenkanPeriod = params[0];
    const kijunPeriod = params[1];
    const spanBPeriod = params[2];
    const offset = params[3];

    const highs = dataList.map((d) => d.high);
    const lows = dataList.map((d) => d.low);

    // Each line is (highest high + lowest low) / 2 over its window. The three
    // windows are computed ONCE up front in O(n) each (monotone deques) —
    // the previous version re-scanned the window inside the per-bar map, so
    // the tenkan window was walked ~3x (tenkan + spanA's prevTenkan) and the
    // kijun/spanB windows ~2x each.
    const midline = (period: number): (number | null)[] => {
      const highestHigh = slidingMinMax(highs, period).max;
      const lowestLow = slidingMinMax(lows, period).min;
      return highestHigh.map((hi, i) =>
        hi === null || lowestLow[i] === null ? null : (hi + lowestLow[i]!) / 2,
      );
    };

    const tenkanAll = midline(tenkanPeriod);
    const kijunAll = midline(kijunPeriod);
    const spanBAll = midline(spanBPeriod);

    return dataList.map((_kLineData: KLineData, index: number) => {
      const item: Record<string, number | null> = {
        tenkan: tenkanAll[index] ?? null,
        kijun: kijunAll[index] ?? null,
        chikou: null,
        spanA: null,
        spanB: null,
      };

      // Chikou (lagging) span = the current close displaced `offset` bars
      // INTO THE PAST (TradingView behavior): the value displayed at bar
      // `index` is the close of bar `index + offset`. The line therefore
      // trails price and ends `offset` bars before the last bar — the last
      // `offset` entries are null, so no unknown data is ever shown at the
      // right edge. The displaced plot IS the definition of Chikou, not
      // look-ahead bias: at display position `index` the "future" close is
      // already `offset` bars in the past relative to the latest bar.
      const chikouIndex = index + offset;
      if (chikouIndex < dataList.length) {
        item.chikou = dataList[chikouIndex].close;
      }

      // Both spans are plotted `offset` bars ahead, i.e. read off the already
      // computed lines at `index - offset` — no window is ever re-scanned.
      const prevIndex = index - offset;
      if (prevIndex >= 0) {
        const prevTenkan = tenkanAll[prevIndex];
        const prevKijun = kijunAll[prevIndex];
        if (prevTenkan != null && prevKijun != null) {
          item.spanA = (prevTenkan + prevKijun) / 2;
        }
        item.spanB = spanBAll[prevIndex] ?? null;
      }

      return item;
    });
  },
};

export default ichimoku;
