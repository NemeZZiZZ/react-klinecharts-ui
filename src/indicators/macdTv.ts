import type { IndicatorTemplate, KLineData, Indicator } from "react-klinecharts";
import TA from "../utils/TA";

const macdTv: IndicatorTemplate = {
  name: "MACD_TV",
  shortName: "MACD (TV)",
  calcParams: [12, 26, 9],
  figures: [
    {
      key: "histogram",
      title: "Histogram: ",
      type: "bar",
      baseValue: 0,
      styles: (data: any) => {
        const current = data.current?.histogram ?? 0;
        const pre = data.prev?.histogram ?? 0;
        let color = "#26A69A";

        if (current > 0) {
          color = current > pre ? "#26A69A" : "#B2DFDB";
        } else if (current < 0) {
          color = current < pre ? "#FF5252" : "#FFCDD2";
        } else {
          color = "#B2DFDB";
        }

        return { color };
      },
    },
    {
      key: "macd",
      title: "MACD: ",
      type: "line",
      styles: () => ({ color: "#2962FF" }),
    },
    {
      key: "signal",
      title: "Signal: ",
      type: "line",
      styles: () => ({ color: "#FF6D00" }),
    },
  ],
  calc: (dataList: KLineData[], indicator: Indicator) => {
    const fast = indicator.calcParams[0] as number;
    const slow = indicator.calcParams[1] as number;
    const signalLen = indicator.calcParams[2] as number;

    const closes = dataList.map((d) => d.close);
    const { dif, dea, macd } = TA.macd(closes, fast, slow, signalLen);

    return dataList.map((_, i) => ({
      macd: dif[i],
      signal: dea[i],
      histogram: macd[i],
    }));
  },
};

export default macdTv;
