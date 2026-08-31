import type { IndicatorTemplate, KLineData } from "klinecharts";

const vwap: IndicatorTemplate = {
  name: "VWAP",
  shortName: "VWAP",
  calcParams: [],
  figures: [{ key: "vwap", title: "VWAP: ", type: "line" }],
  calc: (dataList: KLineData[]) => {
    let cumulativeVolume = 0;
    let cumulativePriceVolume = 0;
    let lastDate = "";
    return dataList.map((kLineData: KLineData) => {
      // Derive the day key from UTC so server-side and browser-side rendering
      // agree on the session boundary. `toLocaleDateString()` would resolve
      // against the host's local timezone and produce inconsistent resets
      // across machines. (Note: this is still "UTC day", not the chart's
      // configured timezone — klinecharts' calc has no access to it.)
      const date = new Date(kLineData.timestamp).toISOString().slice(0, 10);
      if (date !== lastDate) {
        cumulativeVolume = 0;
        cumulativePriceVolume = 0;
        lastDate = date;
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
