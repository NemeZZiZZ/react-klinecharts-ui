import type { IndicatorTemplate, KLineData, Indicator } from "react-klinecharts";
import TA from "../utils/TA";

const hma: IndicatorTemplate = {
  name: "HMA",
  shortName: "HMA",
  calcParams: [9],
  figures: [{ key: "hma", title: "HMA: ", type: "line" }],
  calc: (dataList: KLineData[], indicator: Indicator) => {
    const period = indicator.calcParams[0] as number;
    const halfPeriod = Math.floor(period / 2);
    const sqrtPeriod = Math.floor(Math.sqrt(period));

    const closes = dataList.map((d) => d.close);
    const wma1 = TA.wma(closes, halfPeriod);
    const wma2 = TA.wma(closes, period);

    const diff = wma1.map((v, i) => {
      if (v !== null && wma2[i] !== null) {
        return 2 * v - (wma2[i] as number);
      }
      return null;
    });

    const diffValues = diff.filter((v) => v !== null) as number[];
    const finalHma = TA.wma(diffValues, sqrtPeriod);

    let finalIndex = 0;
    return diff.map((v) => {
      if (v === null) return { hma: null };
      const res = finalHma[finalIndex++];
      return { hma: res };
    });
  },
};

export default hma;
