import type { IndicatorTemplate, KLineData } from "react-klinecharts";

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
      const date = new Date(kLineData.timestamp).toLocaleDateString();
      if (date !== lastDate) {
        cumulativeVolume = 0;
        cumulativePriceVolume = 0;
        lastDate = date;
      }
      const price = (kLineData.high + kLineData.low + kLineData.close) / 3;
      cumulativeVolume += kLineData.volume ?? 0;
      cumulativePriceVolume += price * (kLineData.volume ?? 0);
      return {
        vwap: cumulativePriceVolume / (cumulativeVolume || 1),
      };
    });
  },
};

export default vwap;
