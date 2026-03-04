import type { IndicatorTemplate, KLineData, Indicator } from "react-klinecharts";
import TA from "../utils/TA";

const superTrend: IndicatorTemplate = {
  name: "SuperTrend",
  shortName: "SuperTrend",
  calcParams: [10, 3],
  figures: [
    { key: "up", title: "Up: ", type: "line" },
    { key: "down", title: "Down: ", type: "line" },
  ],
  calc: (dataList: KLineData[], indicator: Indicator) => {
    const period = indicator.calcParams[0] as number;
    const factor = indicator.calcParams[1] as number;

    const highs = dataList.map((d) => d.high);
    const lows = dataList.map((d) => d.low);
    const closes = dataList.map((d) => d.close);
    const atr = TA.atr(highs, lows, closes, period);

    let trend = 1;
    let up = 0;
    let down = 0;

    return dataList.map((kLineData: KLineData, index: number) => {
      const currentAtr = atr[index];
      if (currentAtr === null) return { up: null, down: null };

      const mid = (kLineData.high + kLineData.low) / 2;
      const basicUpper = mid + factor * currentAtr;
      const basicLower = mid - factor * currentAtr;

      if (index === 0 || atr[index - 1] === null) {
        up = basicUpper;
        down = basicLower;
      } else {
        const prevUp = up;
        const prevDown = down;
        const prevClose = dataList[index - 1].close;

        up =
          basicUpper < prevUp || prevClose > prevUp
            ? basicUpper
            : prevUp;
        down =
          basicLower > prevDown || prevClose < prevDown
            ? basicLower
            : prevDown;
      }

      if (trend === 1 && kLineData.close < down) {
        trend = -1;
      } else if (trend === -1 && kLineData.close > up) {
        trend = 1;
      }

      return {
        up: trend === 1 ? down : null,
        down: trend === -1 ? up : null,
      };
    });
  },
};

export default superTrend;
