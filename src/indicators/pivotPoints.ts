import type { IndicatorTemplate, KLineData } from "react-klinecharts";

const pivotPoints: IndicatorTemplate = {
  name: "PivotPoints",
  shortName: "Pivot",
  calcParams: [],
  figures: [
    { key: "p", title: "P: ", type: "line" },
    { key: "r1", title: "R1: ", type: "line" },
    { key: "s1", title: "S1: ", type: "line" },
    { key: "r2", title: "R2: ", type: "line" },
    { key: "s2", title: "S2: ", type: "line" },
  ],
  calc: (dataList: KLineData[]) => {
    let lastP: number | null = null;
    let lastR1: number | null = null;
    let lastS1: number | null = null;
    let lastR2: number | null = null;
    let lastS2: number | null = null;
    let lastDate = "";
    let dayHigh = -Infinity;
    let dayLow = Infinity;
    let dayClose = 0;

    return dataList.map((kLineData: KLineData) => {
      const date = new Date(kLineData.timestamp).toLocaleDateString();
      if (date !== lastDate) {
        if (lastDate !== "") {
          lastP = (dayHigh + dayLow + dayClose) / 3;
          lastR1 = 2 * lastP - dayLow;
          lastS1 = 2 * lastP - dayHigh;
          lastR2 = lastP + (dayHigh - dayLow);
          lastS2 = lastP - (dayHigh - dayLow);
        }
        dayHigh = kLineData.high;
        dayLow = kLineData.low;
        dayClose = kLineData.close;
        lastDate = date;
      } else {
        dayHigh = Math.max(dayHigh, kLineData.high);
        dayLow = Math.min(dayLow, kLineData.low);
        dayClose = kLineData.close;
      }

      return {
        p: lastP,
        r1: lastR1,
        s1: lastS1,
        r2: lastR2,
        s2: lastS2,
      };
    });
  },
};

export default pivotPoints;
