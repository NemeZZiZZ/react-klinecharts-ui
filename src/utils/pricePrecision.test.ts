import { describe, it, expect } from "vitest";
import { detectPricePrecision } from "./pricePrecision";
import type { KLineData } from "klinecharts";

const bar = (overrides: Partial<KLineData>): KLineData => ({
  timestamp: 1_700_000_000_000,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: 1000,
  ...overrides,
} as KLineData);

describe("detectPricePrecision", () => {
  it("returns null for empty data", () => {
    expect(detectPricePrecision([])).toBeNull();
  });

  it("returns null for regular >= 0.01 price scales (default precision holds)", () => {
    const data = [
      bar({ open: 100, high: 101, low: 99, close: 100.5 }),
      bar({ open: 100.5, high: 102, low: 100, close: 101.5 }),
      bar({ open: 101.5, high: 103, low: 101, close: 102 }),
    ];
    expect(detectPricePrecision(data)).toBeNull();
  });

  it("returns null when float-subtraction noise stays in the default scale", () => {
    // 65000.12 - 65000.11 = 0.010000000001818989 in IEEE754 — the noise must
    // NOT inflate the detected precision for a 0.01-tick symbol.
    const data = [
      bar({ open: 65000.11, high: 65000.13, low: 65000.1, close: 65000.12 }),
      bar({ open: 65000.12, high: 65000.15, low: 65000.11, close: 65000.13 }),
    ];
    expect(detectPricePrecision(data)).toBeNull();
  });

  it("detects 8 for PEPE-scale prices with 1e-8 movements", () => {
    const data = Array.from({ length: 5 }, (_, i) => {
      const close = 0.00000498 + i * 1e-8;
      return bar({
        timestamp: 1_700_000_000_000 + i * 60_000,
        open: i === 0 ? 0.00000498 : 0.00000498 + (i - 1) * 1e-8,
        high: close + 1e-8,
        low: close - 1e-8,
        close,
      });
    });
    expect(detectPricePrecision(data)).toBe(8);
  });

  it("detects 6 for a flat series at 0.000005 (price fallback, no deltas)", () => {
    const data = [
      bar({ open: 0.000005, high: 0.000005, low: 0.000005, close: 0.000005 }),
      bar({ timestamp: 1_700_000_060_000, open: 0.000005, high: 0.000005, low: 0.000005, close: 0.000005 }),
    ];
    expect(detectPricePrecision(data)).toBe(6);
  });

  it("detects 3 for a 0.005 tick", () => {
    const data = [
      bar({ open: 0.52, high: 0.525, low: 0.515, close: 0.525 }),
      bar({ timestamp: 1_700_000_060_000, open: 0.525, high: 0.53, low: 0.52, close: 0.53 }),
    ];
    expect(detectPricePrecision(data)).toBe(3);
  });

  it("clamps the maximum at 12", () => {
    const data = [
      bar({ open: 1e-13, high: 2e-13, low: 0.5e-13, close: 1.5e-13 }),
    ];
    expect(detectPricePrecision(data)).toBe(12);
  });

  it("ignores non-finite bars", () => {
    const data = [
      bar({ open: Number.NaN, high: Number.NaN, low: Number.NaN, close: Number.NaN }),
      bar({ open: 100, high: 101, low: 99, close: 100 }),
    ];
    expect(detectPricePrecision(data)).toBeNull();
  });
});
