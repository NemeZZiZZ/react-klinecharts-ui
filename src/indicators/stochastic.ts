import type { IndicatorTemplate, KLineData, Indicator } from "react-klinecharts";

function rollingMinMax(
  data: number[],
  period: number,
): { min: number[]; max: number[] } {
  const min: number[] = [];
  const max: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      min.push(NaN);
      max.push(NaN);
    } else {
      let lo = data[i];
      let hi = data[i];
      for (let j = 1; j < period; j++) {
        if (data[i - j] < lo) lo = data[i - j];
        if (data[i - j] > hi) hi = data[i - j];
      }
      min.push(lo);
      max.push(hi);
    }
  }
  return { min, max };
}

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

    const { min: lowestLow } = rollingMinMax(lows, period);
    const { max: highestHigh } = rollingMinMax(highs, period);

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
