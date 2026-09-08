import type { IndicatorTemplate, KLineData, Indicator } from "klinecharts";
import { slidingMinMax } from "./window";

function smaWithNaN(data: number[], period: number): number[] {
  const result: number[] = [];
  let sum = 0;
  let count = 0;
  let windowStart = 0;

  for (let i = 0; i < data.length; i++) {
    if (!isNaN(data[i])) {
      sum += data[i];
      count++;
    }
    if (i >= period) {
      if (!isNaN(data[windowStart])) {
        sum -= data[windowStart];
        count--;
      }
      windowStart++;
    }
    result.push(count === period ? sum / period : NaN);
  }
  return result;
}

const stochastic: IndicatorTemplate = {
  name: "Stochastic",
  shortName: "STOCH",
  calcParams: [14, 3, 3],
  figures: [
    { key: "k", title: "%K: ", type: "line" },
    { key: "d", title: "%D: ", type: "line" },
  ],
  calc: (dataList: KLineData[], indicator: Indicator) => {
    const [period, smoothK, smoothD] = indicator.calcParams as number[];

    const highs = dataList.map((d) => d.high);
    const lows = dataList.map((d) => d.low);
    const closes = dataList.map((d) => d.close);

    const { min: lowestLowRaw } = slidingMinMax(lows, period);
    const { max: highestHighRaw } = slidingMinMax(highs, period);
    // The deque helper pads warm-up with null; the smoothing below works in
    // NaN space, so map across (null → NaN keeps `isNaN` checks downstream).
    const lowestLow = lowestLowRaw.map((v) => v ?? NaN);
    const highestHigh = highestHighRaw.map((v) => v ?? NaN);

    const rawK = closes.map((c, i) => {
      const lo = lowestLow[i];
      const hi = highestHigh[i];
      if (isNaN(lo) || isNaN(hi) || hi === lo) return null;
      return ((c - lo) / (hi - lo)) * 100;
    });

    const validK = rawK.map((v) => v ?? NaN);
    const kSmoothed = smaWithNaN(validK, smoothK);
    const dLine = smaWithNaN(kSmoothed, smoothD);

    return kSmoothed.map((k, i) => ({
      k: isNaN(k) ? null : k,
      d: isNaN(dLine[i]) ? null : dLine[i],
    }));
  },
};

export default stochastic;
