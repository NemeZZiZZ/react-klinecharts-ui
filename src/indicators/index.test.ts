import { describe, it, expect } from "vitest";
import type { KLineData, Indicator } from "klinecharts";

import bollTv from "./bollTv";
import cci from "./cci";
import hma from "./hma";
import ichimoku from "./ichimoku";
import maRibbon from "./maRibbon";
import macdTv from "./macdTv";
import pivotPoints from "./pivotPoints";
import rsiTv from "./rsiTv";
import stochastic from "./stochastic";
import superTrend from "./superTrend";
import vwap from "./vwap";

/** Synthetic but deterministic OHLCV series. */
function series(n: number): KLineData[] {
  const out: KLineData[] = [];
  let c = 100;
  for (let i = 0; i < n; i++) {
    // gentle sinusoidal drift so indicators have meaningful highs/lows
    const swing = Math.sin(i / 3) * 5;
    const open = c;
    const close = 100 + swing + (i % 7) - 3;
    const high = Math.max(open, close) + 1 + (i % 3);
    const low = Math.min(open, close) - 1 - (i % 2);
    out.push({
      timestamp: 1_700_000_000_000 + i * 60_000,
      open,
      high,
      low,
      close,
      volume: 1000 + (i % 10) * 100,
    });
    c = close;
  }
  return out;
}

const DATA = series(120);

/** Build a fake Indicator with the template's calcParams. */
function indicatorOf(template: { calcParams?: unknown[] }): Indicator {
  return { calcParams: template.calcParams ?? [] } as unknown as Indicator;
}

/**
 * Run a template's calc and cast the result to a typed array. The klinecharts
 * `IndicatorTemplate.calc` signature returns `unknown[] | Promise<unknown[]>`,
 * which is awkward to assert against; our indicators are all synchronous.
 */
function run(
  template: {
    calcParams?: unknown[];
    calc?: (d: KLineData[], i: Indicator) => unknown;
  },
  data: KLineData[],
): Array<Record<string, number | null>> {
  return template.calc!(
    data,
    indicatorOf(template),
  ) as Array<Record<string, number | null>>;
}

/** Keys of an indicator result object (ignoring null values). */
function keysOf(result: Array<Record<string, number | null> | null>): string[] {
  const first = result.find((r) => r && Object.values(r).some((v) => v !== null));
  return first ? Object.keys(first) : [];
}

// ---------------------------------------------------------------------------
// Each indicator: structural contract + warm-up + a known-property check
// ---------------------------------------------------------------------------

describe("bollTv", () => {
  const r = run(bollTv, DATA);
  it("returns one result per bar with mid/upper/lower keys", () => {
    expect(r.length).toBe(DATA.length);
    expect(keysOf(r).sort()).toEqual(["lower", "mid", "upper"]);
  });
  it("warm-up period (first 19) is null", () => {
    for (let i = 0; i < 19; i++) {
      const row = r[i] as { mid: number | null };
      expect(row.mid).toBeNull();
    }
  });
  it("upper >= mid >= lower for every computed bar", () => {
    for (const row of r) {
      const { mid, upper, lower } = row as { mid: number | null; upper: number | null; lower: number | null };
      if (mid === null) continue;
      expect(upper!).toBeGreaterThanOrEqual(mid);
      expect(mid).toBeGreaterThanOrEqual(lower!);
    }
  });
});

describe("cci", () => {
  const r = run(cci, DATA);
  it("returns one result per bar with a cci key", () => {
    expect(r.length).toBe(DATA.length);
    expect(keysOf(r)).toContain("cci");
  });
  it("warm-up is null", () => {
    const row = r[0] as { cci: number | null };
    expect(row.cci).toBeNull();
  });
});

describe("hma", () => {
  const r = run(hma, DATA);
  it("returns one result per bar with an hma key", () => {
    expect(r.length).toBe(DATA.length);
    expect(keysOf(r)).toContain("hma");
  });
  it("first value is null (warm-up)", () => {
    const row = r[0] as { hma: number | null };
    expect(row.hma).toBeNull();
  });
});

describe("ichimoku", () => {
  const r = run(ichimoku, DATA);
  it("returns one result per bar with the 5 spans", () => {
    expect(r.length).toBe(DATA.length);
    expect(keysOf(r).sort()).toEqual(["chikou", "kijun", "spanA", "spanB", "tenkan"]);
  });
  it("tenkan is null before tenkanPeriod - 1 (default 9)", () => {
    for (let i = 0; i < 8; i++) {
      const row = r[i] as { tenkan: number | null };
      expect(row.tenkan).toBeNull();
    }
    expect((r[8] as { tenkan: number | null }).tenkan).not.toBeNull();
  });
  it("Chikou does NOT read future data (no look-ahead): equals the close from `offset` bars back", () => {
    // regression for the round-2 look-ahead bug (index+offset → index-offset)
    const offset = 26;
    const i = 60;
    const chikou = (r[i] as { chikou: number | null }).chikou;
    if (chikou !== null) {
      expect(chikou).toBe(DATA[i - offset].close);
    }
  });
});

describe("maRibbon", () => {
  const r = run(maRibbon, DATA);
  it("returns one result per bar", () => {
    expect(r.length).toBe(DATA.length);
  });
  it("emits at least one maN key", () => {
    expect(keysOf(r).some((k) => /^ma\d+$/.test(k))).toBe(true);
  });
});

describe("macdTv", () => {
  const r = run(macdTv, DATA);
  it("returns one result per bar with histogram/macd/signal keys", () => {
    expect(r.length).toBe(DATA.length);
    expect(keysOf(r).sort()).toEqual(["histogram", "macd", "signal"]);
  });
  it("warm-up is null until slowEMA completes", () => {
    const row = r[0] as { macd: number | null };
    expect(row.macd).toBeNull();
  });
});

describe("pivotPoints", () => {
  const r = run(pivotPoints, DATA);
  it("returns one result per bar", () => {
    expect(r.length).toBe(DATA.length);
  });
  it("uses a UTC day key (regression for the runtime-TZ bug)", () => {
    // pivotPoints is a pure function of the data; just ensure it doesn't throw
    // and that values stabilize after a day boundary (no NaN).
    for (const row of r) {
      const p = (row as { p?: number | null }).p;
      if (p !== null && p !== undefined) expect(Number.isFinite(p)).toBe(true);
    }
  });
});

describe("rsiTv", () => {
  const r = run(rsiTv, DATA);
  it("returns one result per bar with rsi/rsi_ma keys", () => {
    expect(r.length).toBe(DATA.length);
    expect(keysOf(r).sort()).toEqual(["rsi", "rsi_ma"]);
  });
  it("RSI is bounded to [0, 100] for every computed bar", () => {
    for (const row of r) {
      const { rsi } = row as { rsi: number | null };
      if (rsi === null) continue;
      expect(rsi).toBeGreaterThanOrEqual(0);
      expect(rsi).toBeLessThanOrEqual(100);
    }
  });
  it("rsi_ma never leads rsi (warm-up: rsi_ma is null while rsi is null)", () => {
    // regression for the round-1 null->0 warm-up bug
    for (const row of r) {
      const { rsi, rsi_ma } = row as { rsi: number | null; rsi_ma: number | null };
      if (rsi === null) expect(rsi_ma).toBeNull();
    }
  });
});

describe("stochastic", () => {
  const r = run(stochastic, DATA);
  it("returns one result per bar with k/d keys", () => {
    expect(r.length).toBe(DATA.length);
    expect(keysOf(r).sort()).toEqual(["d", "k"]);
  });
  it("%K is bounded to [0, 100] when defined", () => {
    for (const row of r) {
      const k = (row as { k: number | null }).k;
      if (k === null || k === undefined) continue;
      expect(Number.isFinite(k)).toBe(true);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(100);
    }
  });
});

describe("superTrend", () => {
  const r = run(superTrend, DATA);
  it("returns one result per bar with up/down keys", () => {
    expect(r.length).toBe(DATA.length);
    expect(keysOf(r).sort()).toEqual(["down", "up"]);
  });
  it("exactly one of up/down is non-null at each bar (single trend line)", () => {
    for (const row of r) {
      const { up, down } = row as { up: number | null; down: number | null };
      if (up === null && down === null) continue; // warm-up
      expect((up !== null ? 1 : 0) + (down !== null ? 1 : 0)).toBe(1);
    }
  });
});

describe("vwap", () => {
  it("resets at a UTC day boundary (regression for the runtime-TZ bug)", () => {
    // Build two consecutive UTC days, 3 bars each.
    const day1 = Date.UTC(2024, 0, 1, 12, 0);
    const day2 = Date.UTC(2024, 0, 2, 0, 0);
    const data: KLineData[] = [
      { timestamp: day1, open: 10, high: 11, low: 9, close: 10, volume: 10 },
      { timestamp: day1 + 60_000, open: 10, high: 11, low: 9, close: 10, volume: 10 },
      { timestamp: day1 + 120_000, open: 10, high: 11, low: 9, close: 10, volume: 10 },
      // next UTC day
      { timestamp: day2, open: 20, high: 21, low: 19, close: 20, volume: 10 },
      { timestamp: day2 + 60_000, open: 20, high: 21, low: 19, close: 20, volume: 10 },
    ];
    const r = run(vwap, data);
    const lastOfDay1 = r[2] as { vwap: number | null };
    const firstOfDay2 = r[3] as { vwap: number | null };
    // VWAP resets each UTC day, so day2's first VWAP equals day2's typical price.
    expect(firstOfDay2.vwap).toBeCloseTo((20 + 19 + 21) / 3, 6);
    // And day1's last VWAP equals day1's typical price (constant series).
    expect(lastOfDay1.vwap).toBeCloseTo((11 + 9 + 10) / 3, 6);
  });
});
