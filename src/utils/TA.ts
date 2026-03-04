/**
 * Technical Analysis (TA) Utility Library
 * Ported logic to match TradingView / Pine Script calculations.
 */

const TA = {
  /**
   * Simple Moving Average (SMA)
   * Optimized with running sum.
   */
  sma: (data: number[], period: number): (number | null)[] => {
    const result: (number | null)[] = [];
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
      if (i >= period) {
        sum -= data[i - period];
      }
      if (i >= period - 1) {
        result.push(sum / period);
      } else {
        result.push(null);
      }
    }
    return result;
  },

  /**
   * Exponential Moving Average (EMA)
   * alpha = 2 / (period + 1)
   */
  ema: (data: number[], period: number): (number | null)[] => {
    const result: (number | null)[] = [];
    const alpha = 2 / (period + 1);
    let prevEma: number | null = null;

    for (let i = 0; i < data.length; i++) {
      if (prevEma === null) {
        if (i === period - 1) {
          let sum = 0;
          for (let j = 0; j <= i; j++) sum += data[j];
          prevEma = sum / period;
          result.push(prevEma);
        } else {
          result.push(null);
        }
      } else {
        prevEma = data[i] * alpha + prevEma * (1 - alpha);
        result.push(prevEma);
      }
    }
    return result;
  },

  /**
   * Running Moving Average (RMA / Wilder's MA)
   * Used in RSI, alpha = 1 / period
   */
  rma: (data: number[], period: number): (number | null)[] => {
    const result: (number | null)[] = [];
    const alpha = 1 / period;
    let prevRma: number | null = null;

    for (let i = 0; i < data.length; i++) {
      if (prevRma === null) {
        if (i === period - 1) {
          let sum = 0;
          for (let j = 0; j <= i; j++) sum += data[j];
          prevRma = sum / period;
          result.push(prevRma);
        } else {
          result.push(null);
        }
      } else {
        prevRma = data[i] * alpha + prevRma * (1 - alpha);
        result.push(prevRma);
      }
    }
    return result;
  },

  /**
   * Standard Deviation
   */
  stdev: (data: number[], period: number): (number | null)[] => {
    const result: (number | null)[] = [];
    const sma = TA.sma(data, period);

    for (let i = 0; i < data.length; i++) {
      const currentSma = sma[i];
      if (currentSma === null) {
        result.push(null);
      } else {
        let sumSq = 0;
        for (let j = 0; j < period; j++) {
          sumSq += Math.pow(data[i - j] - currentSma, 2);
        }
        result.push(Math.sqrt(sumSq / period));
      }
    }
    return result;
  },

  /**
   * Relative Strength Index (RSI)
   */
  rsi: (data: number[], period: number): (number | null)[] => {
    const changes: number[] = [0];
    for (let i = 1; i < data.length; i++) {
      changes.push(data[i] - data[i - 1]);
    }

    const ups = changes.map((c) => Math.max(c, 0));
    const downs = changes.map((c) => Math.max(-c, 0));

    const avgUps = TA.rma(ups, period);
    const avgDowns = TA.rma(downs, period);

    return avgUps.map((up, i) => {
      const down = avgDowns[i];
      if (up === null || down === null) return null;
      if (down === 0) return 100;
      const rs = up / down;
      return 100 - 100 / (1 + rs);
    });
  },

  /**
   * Moving Average Convergence Divergence (MACD)
   */
  macd: (
    data: number[],
    fastPeriod: number,
    slowPeriod: number,
    signalPeriod: number,
  ) => {
    const fastEma = TA.ema(data, fastPeriod);
    const slowEma = TA.ema(data, slowPeriod);
    const dif = fastEma.map((f, i) =>
      f !== null && slowEma[i] !== null
        ? f - (slowEma[i] as number)
        : null,
    );
    const dea = TA.ema(
      dif.filter((v) => v !== null) as number[],
      signalPeriod,
    );

    let deaIdx = 0;
    const fullDea = dif.map((v) => (v === null ? null : dea[deaIdx++]));
    const macd = dif.map((v, i) =>
      v !== null && fullDea[i] !== null
        ? v - (fullDea[i] as number)
        : null,
    );

    return { dif, dea: fullDea, macd };
  },

  /**
   * Bollinger Bands (BOLL)
   */
  bollinger: (data: number[], period: number, multiplier: number) => {
    const mid = TA.sma(data, period);
    const std = TA.stdev(data, period);
    const upper = mid.map((m, i) =>
      m !== null && std[i] !== null
        ? m + multiplier * (std[i] as number)
        : null,
    );
    const lower = mid.map((m, i) =>
      m !== null && std[i] !== null
        ? m - multiplier * (std[i] as number)
        : null,
    );

    return { mid, upper, lower };
  },

  /**
   * Weighted Moving Average (WMA)
   */
  wma: (data: number[], period: number): (number | null)[] => {
    const result: (number | null)[] = [];
    let sumWeight = 0;
    for (let i = 1; i <= period; i++) sumWeight += i;

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += data[i - j] * (period - j);
        }
        result.push(sum / sumWeight);
      }
    }
    return result;
  },

  /**
   * True Range (TR)
   */
  tr: (highs: number[], lows: number[], closes: number[]): number[] => {
    const result: number[] = [];
    for (let i = 0; i < highs.length; i++) {
      if (i === 0) {
        result.push(highs[i] - lows[i]);
      } else {
        const tr = Math.max(
          highs[i] - lows[i],
          Math.abs(highs[i] - closes[i - 1]),
          Math.abs(lows[i] - closes[i - 1]),
        );
        result.push(tr);
      }
    }
    return result;
  },

  /**
   * Average True Range (ATR)
   */
  atr: (
    highs: number[],
    lows: number[],
    closes: number[],
    period: number,
  ): (number | null)[] => {
    const tr = TA.tr(highs, lows, closes);
    return TA.rma(tr, period);
  },

  /**
   * Volume Weighted Average Price (VWAP)
   */
  vwap: (
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[],
  ): (number | null)[] => {
    let totalVolume = 0;
    let totalVolumePrice = 0;
    return highs.map((h, i) => {
      const price = (h + lows[i] + closes[i]) / 3;
      totalVolume += volumes[i];
      totalVolumePrice += price * volumes[i];
      return totalVolume === 0 ? price : totalVolumePrice / totalVolume;
    });
  },

  /**
   * Commodity Channel Index (CCI)
   */
  cci: (
    highs: number[],
    lows: number[],
    closes: number[],
    period: number,
  ): (number | null)[] => {
    const tp = highs.map((h, i) => (h + lows[i] + closes[i]) / 3);
    const smaTp = TA.sma(tp, period);
    const result: (number | null)[] = [];

    for (let i = 0; i < tp.length; i++) {
      const currentSma = smaTp[i];
      if (currentSma === null) {
        result.push(null);
      } else {
        let meanDev = 0;
        for (let j = 0; j < period; j++) {
          meanDev += Math.abs(tp[i - j] - currentSma);
        }
        meanDev /= period;
        if (meanDev === 0) {
          result.push(0);
        } else {
          result.push((tp[i] - currentSma) / (0.015 * meanDev));
        }
      }
    }
    return result;
  },

  /**
   * Hull Moving Average (HMA)
   */
  hma: (data: number[], period: number): (number | null)[] => {
    const halfPeriod = Math.floor(period / 2);
    const sqrtPeriod = Math.floor(Math.sqrt(period));
    const wma1 = TA.wma(data, halfPeriod);
    const wma2 = TA.wma(data, period);

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
      if (v === null) return null;
      return finalHma[finalIndex++] ?? null;
    });
  },
};

export default TA;
