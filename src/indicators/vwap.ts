import type { IndicatorTemplate, KLineData } from "klinecharts";

const vwap: IndicatorTemplate = {
  name: "VWAP",
  shortName: "VWAP",
  calcParams: [],
  figures: [{ key: "vwap", title: "VWAP: ", type: "line" }],
  calc: (dataList: KLineData[]) => {
    let cumulativeVolume = 0;
    let cumulativePriceVolume = 0;
    let lastDay = -1;
    return dataList.map((kLineData: KLineData) => {
      // Derive the day key from UTC so server-side and browser-side rendering
      // agree on the session boundary. Integer division on the millisecond
      // epoch gives the same UTC day bucket as `toISOString().slice(0, 10)`
      // but without allocating a Date and a string per bar.
      // (Note: this is still "UTC day", not the chart's configured timezone —
      // klinecharts' calc has no access to it.)
      const day = Math.floor(kLineData.timestamp / 86_400_000);
      if (day !== lastDay) {
        cumulativeVolume = 0;
        cumulativePriceVolume = 0;
        lastDay = day;
      }
      const price = (kLineData.high + kLineData.low + kLineData.close) / 3;
      cumulativeVolume += kLineData.volume ?? 0;
      cumulativePriceVolume += price * (kLineData.volume ?? 0);
      return {
        // Zero-volume prefix (illiquid open, volume-less feeds): fall back
        // to the typical price — same semantics as TA.vwap — instead of
        // `|| 1`, which rendered a misleading 0 line until the first
        // non-zero volume bar.
        vwap:
          cumulativeVolume === 0
            ? price
            : cumulativePriceVolume / cumulativeVolume,
      };
    });
  },
};

export default vwap;
