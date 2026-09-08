/**
 * Technical Analysis (TA) Utility Library
 * Ported logic to match TradingView / Pine Script calculations.
 */

const TA = {
  /**
   * Simple Moving Average (SMA)
   * Optimized with running sum.
   *
   * A non-finite input resets the window (emits null until a full fresh
   * window accumulates) instead of poisoning the running sum — and every
   * later value — with NaN forever.
   */
  sma: (data: number[], period: number): (number | null)[] => {
    if (period < 1) return data.map(() => null);
    const result: (number | null)[] = [];
    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (!Number.isFinite(v)) {
        sum = 0;
        count = 0;
        result.push(null);
        continue;
      }
      sum += v;
      count += 1;
      if (count > period) {
        // Leaving value is inside the current finite run, hence finite.
        sum -= data[i - period] as number;
        count = period;
      }
      result.push(count === period ? sum / period : null);
    }
    return result;
  },

  /**
   * Exponential Moving Average (EMA)
   * alpha = 2 / (period + 1)
   *
   * A non-finite input restarts the seeding instead of seeding NaN (the old
   * seed summed the first `period` values unconditionally, so one NaN in the
   * head poisoned the whole series through the recursion).
   */
  ema: (data: number[], period: number): (number | null)[] => {
    if (period < 1) return data.map(() => null);
    const result: (number | null)[] = [];
    const alpha = 2 / (period + 1);
    let prevEma: number | null = null;
    let seedSum = 0;
    let seedCount = 0;

    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (!Number.isFinite(v)) {
        prevEma = null;
        seedSum = 0;
        seedCount = 0;
        result.push(null);
        continue;
      }
      if (prevEma === null) {
        seedSum += v;
        seedCount += 1;
        if (seedCount === period) {
          prevEma = seedSum / period;
          result.push(prevEma);
        } else {
          result.push(null);
        }
      } else {
        prevEma = v * alpha + prevEma * (1 - alpha);
        result.push(prevEma);
      }
    }
    return result;
  },

  /**
   * Running Moving Average (RMA / Wilder's MA)
   * Used in RSI, alpha = 1 / period
   *
   * Same non-finite restart semantics as `ema` (see above).
   */
  rma: (data: number[], period: number): (number | null)[] => {
    if (period < 1) return data.map(() => null);
    const result: (number | null)[] = [];
    const alpha = 1 / period;
    let prevRma: number | null = null;
    let seedSum = 0;
    let seedCount = 0;

    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (!Number.isFinite(v)) {
        prevRma = null;
        seedSum = 0;
        seedCount = 0;
        result.push(null);
        continue;
      }
      if (prevRma === null) {
        seedSum += v;
        seedCount += 1;
        if (seedCount === period) {
          prevRma = seedSum / period;
          result.push(prevRma);
        } else {
          result.push(null);
        }
      } else {
        prevRma = v * alpha + prevRma * (1 - alpha);
        result.push(prevRma);
      }
    }
    return result;
  },

  /**
   * Standard Deviation (population)
   *
   * Single pass in O(n): maintains the running sum and sum of squares, using
   * Var = E[x²] − E[x]² instead of re-scanning the window against the SMA on
   * every bar (O(n·period)) plus the extra SMA array. `Math.max(0, …)` clamps
   * the catastrophic-cancellation residue on near-constant windows so the
   * result is exactly 0 instead of a tiny NaN-after-sqrt.
   */
  stdev: (data: number[], period: number): (number | null)[] => {
    if (period < 1) return data.map(() => null);
    const result: (number | null)[] = [];
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (!Number.isFinite(v)) {
        sum = 0;
        sumSq = 0;
        count = 0;
        result.push(null);
        continue;
      }
      sum += v;
      sumSq += v * v;
      count += 1;
      if (count > period) {
        const out = data[i - period] as number;
        sum -= out;
        sumSq -= out * out;
        count = period;
      }
      if (count === period) {
        const mean = sum / period;
        result.push(Math.sqrt(Math.max(0, sumSq / period - mean * mean)));
      } else {
        result.push(null);
      }
    }
    return result;
  },

  /**
   * Relative Strength Index (RSI)
   */
  rsi: (data: number[], period: number): (number | null)[] => {
    // Degenerate period: rma(…, 0) would seed at index -1 and poison the
    // whole series — emit nulls instead.
    if (period < 1) return data.map(() => null);
    // Canonical Wilder seeding: the first average covers the FIRST `period`
    // price changes (bars 1..period), so the first RSI value lands on bar
    // `period` (Pine's ta.rsi matches: ta.change(src) is na on bar 0 and the
    // rma seed spans the first `length` non-na changes). A fake leading 0
    // change would both start the series one bar early and bias the seed —
    // and, through Wilder smoothing, every later value on mixed series.
    const changes: number[] = [];
    for (let i = 1; i < data.length; i++) {
      changes.push(data[i] - data[i - 1]);
    }

    const ups = changes.map((c) => Math.max(c, 0));
    const downs = changes.map((c) => Math.max(-c, 0));

    const avgUps = TA.rma(ups, period);
    const avgDowns = TA.rma(downs, period);

    // changes[k] describes data bar k+1 — shift results back onto the data
    // index axis with a leading null for bar 0.
    const result: (number | null)[] = [null];
    for (let k = 0; k < changes.length; k++) {
      const up = avgUps[k];
      const down = avgDowns[k];
      if (up === null || down === null) {
        result.push(null);
        continue;
      }
      if (up === 0 && down === 0) {
        // Flat market: no up AND no down movement, so the ratio is 0/0 and
        // RSI is undefined (Pine yields na here) — null, not 100.
        result.push(null);
        continue;
      }
      if (down === 0) {
        result.push(100);
        continue;
      }
      const rs = up / down;
      result.push(100 - 100 / (1 + rs));
    }
    return result;
  },

  /**
   * Moving Average Convergence Divergence (MACD)
   *
   * Defaults match the de-facto standard (12/26/9) promised by the docs;
   * without them an `ema(undefined)` silently returned an all-null series.
   */
  macd: (
    data: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9,
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
   *
   * Single pass in O(n): mid and band width come out of one running window
   * (sum + sum of squares). The previous version called `sma` AND `stdev`,
   * and `stdev` internally called `sma` again — three window passes and two
   * throwaway arrays per calc. Defaults are the de-facto standard 20/2.
   */
  bollinger: (
    data: number[],
    period: number = 20,
    multiplier: number = 2,
  ) => {
    const mid: (number | null)[] = [];
    const upper: (number | null)[] = [];
    const lower: (number | null)[] = [];
    if (period < 1) {
      return {
        mid: data.map(() => null),
        upper: data.map(() => null),
        lower: data.map(() => null),
      };
    }
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (!Number.isFinite(v)) {
        sum = 0;
        sumSq = 0;
        count = 0;
        mid.push(null);
        upper.push(null);
        lower.push(null);
        continue;
      }
      sum += v;
      sumSq += v * v;
      count += 1;
      if (count > period) {
        const out = data[i - period] as number;
        sum -= out;
        sumSq -= out * out;
        count = period;
      }
      if (count === period) {
        const m = sum / period;
        const std = Math.sqrt(Math.max(0, sumSq / period - m * m));
        mid.push(m);
        upper.push(m + multiplier * std);
        lower.push(m - multiplier * std);
      } else {
        mid.push(null);
        upper.push(null);
        lower.push(null);
      }
    }

    return { mid, upper, lower };
  },

  /**
   * Weighted Moving Average (WMA)
   *
   * O(n) via the sliding recurrence
   *   WMA[i] = WMA[i−1] + (period·x[i] − windowSum[i−1]) / weightSum
   * instead of re-summing `period` weighted terms on every bar. The growing
   * phase accumulates weights 1..count directly, which is exactly what the
   * naive loop sums once the window is full.
   */
  wma: (data: number[], period: number): (number | null)[] => {
    if (period < 1) return data.map(() => null);
    const result: (number | null)[] = [];
    const sumWeight = (period * (period + 1)) / 2;
    let weighted = 0;
    let windowSum = 0;
    let count = 0;

    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (!Number.isFinite(v)) {
        weighted = 0;
        windowSum = 0;
        count = 0;
        result.push(null);
        continue;
      }
      if (count < period) {
        weighted += v * (count + 1);
        windowSum += v;
        count += 1;
        result.push(count === period ? weighted / sumWeight : null);
      } else {
        weighted += period * v - windowSum;
        // Leaving value is inside the current finite run, hence finite.
        windowSum += v - (data[i - period] as number);
        result.push(weighted / sumWeight);
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
   *
   * Without `timestamps` this is the plain cumulative VWAP (back-compatible).
   * Pass the bar timestamps to reset the accumulation at each session
   * boundary — a real session VWAP (like the `vwap` chart indicator, which
   * resets on the UTC day) instead of a line dragged by yesterday's volume:
   *   TA.vwap(h, l, c, v, timestamps)                    // UTC-day sessions
   *   TA.vwap(h, l, c, v, timestamps, (ts) => customKey) // custom sessions
   */
  vwap: (
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[],
    timestamps?: number[],
    session: "utc-day" | ((timestamp: number) => string | number) = "utc-day",
  ): (number | null)[] => {
    let totalVolume = 0;
    let totalVolumePrice = 0;
    let sessionKey: string | number | null = null;
    return highs.map((h, i) => {
      const price = (h + lows[i] + closes[i]) / 3;
      const ts = timestamps?.[i];
      if (ts != null && Number.isFinite(ts)) {
        const key =
          typeof session === "function"
            ? session(ts)
            : // UTC day number — integer math, no Date allocation/throw.
              Math.floor(ts / 86400000);
        if (sessionKey !== key) {
          sessionKey = key;
          totalVolume = 0;
          totalVolumePrice = 0;
        }
      }
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
    // TradingView parity: Pine smooths over math.round(sqrt(len)) (and
    // int(len/2), which floors). Flooring the square root diverged for
    // periods like 13, 21, 24, 32. The max(1, …) clamps keep degenerate
    // periods (e.g. 0/1) from producing zero-length windows — wma would
    // divide by sumWeight 0 and leak NaN into the figures.
    const p = Math.max(1, period);
    const halfPeriod = Math.max(1, Math.floor(p / 2));
    const sqrtPeriod = Math.max(1, Math.round(Math.sqrt(p)));
    const wma1 = TA.wma(data, halfPeriod);
    const wma2 = TA.wma(data, p);

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
