import { describe, it, expect } from "vitest";
import TA from "./TA";

const ROUNDED = (arr: (number | null)[], digits = 4) =>
  arr.map((v) => (v === null ? null : +v.toFixed(digits)));

const CLOSE = [10, 11, 12, 11, 13, 14, 13, 15, 16, 15, 17, 18, 17, 19, 20];
const N = CLOSE.length;

describe("TA.sma", () => {
  it("returns null for the first period-1 values, then the running average", () => {
    const out = TA.sma([1, 2, 3, 4, 5], 3);
    expect(out).toEqual([null, null, 2, 3, 4]);
  });

  it("emits a single valid value when length === period", () => {
    expect(TA.sma([2, 4, 6], 3)).toEqual([null, null, 4]);
  });

  it("returns all-null when length < period", () => {
    expect(TA.sma([1, 2], 5)).toEqual([null, null]);
  });

  it("handles constant series (every window averages to the constant)", () => {
    const out = TA.sma([7, 7, 7, 7], 2);
    expect(out).toEqual([null, 7, 7, 7]);
  });
});

describe("TA.ema", () => {
  it("seeds with the SMA of the first `period` values", () => {
    // SMA(1..3) of [1,2,3] = 2; then alpha = 2/(3+1) = 0.5
    const out = TA.ema([1, 2, 3, 4], 3);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).toBe(2);
    // next: 4*0.5 + 2*0.5 = 3
    expect(out[3]).toBe(3);
  });

  it("produces all-null when length < period", () => {
    expect(TA.ema([1, 2], 5)).toEqual([null, null]);
  });
});

describe("TA.rma", () => {
  it("seeds with SMA and then applies Wilder's alpha = 1/period", () => {
    // SMA([2,4,6]) over period 3 = 4; next = 8 * (1/3) + 4 * (2/3) = 16/3
    const out = TA.rma([2, 4, 6, 8], 3);
    expect(out[2]).toBe(4);
    expect(out[3]).toBeCloseTo(8 / 3 + (4 * 2) / 3, 10);
  });
});

describe("TA.wma", () => {
  it("weights the most recent value highest (weight = period - j)", () => {
    // period 3, weights 1,2,3 (sum 6); for [1,2,3]: (1*3 + 2*2 + 3*1)/6 = (3+4+3)/6 wait
    // implementation: data[i-j] * (period - j), j=0..period-1
    // i=2: data[2]*3 + data[1]*2 + data[0]*1 = 3*3+2*2+1*1 = 14; /6 = 2.3333
    const out = TA.wma([1, 2, 3], 3);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).toBeCloseTo(14 / 6, 10);
  });
});

describe("TA.stdev", () => {
  it("returns null during warm-up, population stdev afterwards", () => {
    // period 3 over [2,4,6]: mean=4, variance = ((2-4)^2+(4-4)^2+(6-4)^2)/3 = 8/3
    const out = TA.stdev([2, 4, 6], 3);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).toBeCloseTo(Math.sqrt(8 / 3), 10);
  });

  it("returns 0 for a constant window", () => {
    const out = TA.stdev([5, 5, 5], 3);
    expect(out[2]).toBe(0);
  });
});

describe("TA.rsi", () => {
  it("never exceeds [0, 100] and returns 100 when there are no down moves", () => {
    // strictly increasing series → all up moves, all down moves = 0 → RSI = 100
    const rising = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const out = TA.rsi(rising, 14).filter((v): v is number => v !== null);
    expect(out.every((v) => v === 100)).toBe(true);
  });

  it("is 0 for a strictly falling series (after warm-up)", () => {
    const falling = Array.from({ length: 20 }, (_, i) => 20 - i);
    const out = TA.rsi(falling, 14).filter((v): v is number => v !== null);
    expect(out.every((v) => v === 0)).toBe(true);
  });

  it("returns null during the warm-up window", () => {
    const out = TA.rsi(CLOSE, 14);
    for (let i = 0; i < 13; i++) expect(out[i]).toBeNull();
  });
});

describe("TA.macd", () => {
  it("produces dif/dea/macd arrays of the input length", () => {
    const { dif, dea, macd } = TA.macd(CLOSE, 12, 26, 9);
    expect(dif.length).toBe(N);
    expect(dea.length).toBe(N);
    expect(macd.length).toBe(N);
  });

  it("dif is null until enough data for the slow EMA (slowPeriod - 1)", () => {
    // dif[i] = fastEMA[i] - slowEMA[i], both must be non-null. slowEMA(26)
    // first emits at index 25 (0-based). Use a series long enough to cross it.
    const series = Array.from({ length: 30 }, (_, i) => 100 + i);
    const { dif } = TA.macd(series, 12, 26, 9);
    for (let i = 0; i < 25; i++) expect(dif[i]).toBeNull();
    expect(dif[25]).not.toBeNull();
  });

  it("with insufficient data, dif/dea/macd are entirely null", () => {
    const { dif, dea, macd } = TA.macd([1, 2, 3], 12, 26, 9);
    expect(dif.every((v) => v === null)).toBe(true);
    expect(dea.every((v) => v === null)).toBe(true);
    expect(macd.every((v) => v === null)).toBe(true);
  });
});

describe("TA.bollinger", () => {
  it("upper/lower are symmetric around the mid line", () => {
    const { mid, upper, lower } = TA.bollinger(CLOSE, 5, 2);
    for (let i = 0; i < N; i++) {
      if (mid[i] === null) {
        expect(upper[i]).toBeNull();
        expect(lower[i]).toBeNull();
        continue;
      }
      // upper - mid === mid - lower (band width is symmetric)
      expect(upper[i]! - mid[i]!).toBeCloseTo(mid[i]! - lower[i]!, 10);
      // and the mid is the average of upper and lower
      expect(mid[i]).toBeCloseTo((upper[i]! + lower[i]!) / 2, 10);
    }
  });

  it("upper and lower collapse to mid when the window is constant", () => {
    const { mid, upper, lower } = TA.bollinger([5, 5, 5, 5], 3, 2);
    expect(mid[2]).toBe(5);
    expect(upper[2]).toBe(5);
    expect(lower[2]).toBe(5);
  });
});

describe("TA.tr / TA.atr", () => {
  it("first TR bar is high - low (no prior close)", () => {
    const highs = [12, 15, 16];
    const lows = [10, 11, 13];
    const closes = [11, 14, 14];
    const tr = TA.tr(highs, lows, closes);
    expect(tr[0]).toBe(2); // 12 - 10
    // bar 1: max(15-11, |15-11|, |11-11|) = max(4,4,0) = 4
    expect(tr[1]).toBe(4);
  });

  it("ATR propagates null until warm-up completes", () => {
    const highs = Array.from({ length: 20 }, (_, i) => 100 + i);
    const lows = Array.from({ length: 20 }, (_, i) => 95 + i);
    const closes = Array.from({ length: 20 }, (_, i) => 98 + i);
    const atr = TA.atr(highs, lows, closes, 14);
    for (let i = 0; i < 13; i++) expect(atr[i]).toBeNull();
    expect(atr[13]).not.toBeNull();
  });
});

describe("TA.cci", () => {
  it("returns null during warm-up", () => {
    const highs = Array.from({ length: 25 }, (_, i) => 100 + i);
    const lows = Array.from({ length: 25 }, (_, i) => 95 + i);
    const closes = Array.from({ length: 25 }, (_, i) => 98 + i);
    const cci = TA.cci(highs, lows, closes, 14);
    for (let i = 0; i < 13; i++) expect(cci[i]).toBeNull();
    expect(cci[13]).not.toBeNull();
  });

  it("returns 0 when the typical price equals its mean for the whole window", () => {
    // constant H/L/C → tp constant, meanDev nonzero numerator zero → CCI 0
    const cci = TA.cci([10, 10, 10, 10, 10], [10, 10, 10, 10, 10], [10, 10, 10, 10, 10], 3);
    expect(cci.filter((v): v is number => v !== null).every((v) => v === 0)).toBe(true);
  });
});

describe("TA.vwap", () => {
  it("is the cumulative volume-weighted typical price", () => {
    // single bar: VWAP = (H+L+C)/3 (volume cancels in totalVolumePrice/totalVolume
    // only when vol>0; for v=0 the function returns `price` which equals tp)
    const out = TA.vwap([10], [8], [9], [0]);
    expect(out[0]).toBeCloseTo((10 + 8 + 9) / 3, 10);
  });

  it("grows with rising closes and constant volume", () => {
    const out = TA.vwap([2, 4, 6], [1, 2, 3], [1.5, 3, 4.5], [1, 1, 1]);
    expect(out.length).toBe(3);
    expect(out[2] as number).toBeGreaterThan(out[0] as number);
  });
});

describe("TA.hma", () => {
  it("returns an array of the same length with leading nulls during warm-up", () => {
    const data = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i));
    const out = TA.hma(data, 10);
    expect(out.length).toBe(data.length);
    expect(out[0]).toBeNull();
  });
});
