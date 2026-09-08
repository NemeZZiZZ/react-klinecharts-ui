import { describe, it, expect } from "vitest";
import { slidingMinMax } from "./window";

// Deterministic pseudo-random series (no Math.random — stable goldens).
const SERIES = Array.from(
  { length: 300 },
  (_, i) => 100 + 20 * Math.sin(i * 0.7) + 5 * Math.sin(i * 2.3),
);

function naive(data: number[], period: number) {
  const min: (number | null)[] = [];
  const max: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1 || period < 1) {
      min.push(null);
      max.push(null);
      continue;
    }
    const win = data.slice(i - period + 1, i + 1);
    min.push(Math.min(...win));
    max.push(Math.max(...win));
  }
  return { min, max };
}

describe("slidingMinMax", () => {
  it.each([1, 2, 3, 9, 14, 52, 300, 500])(
    "matches the naive double loop (period %i)",
    (period) => {
      const fast = slidingMinMax(SERIES, period);
      const slow = naive(SERIES, period);
      expect(fast.min).toEqual(slow.min);
      expect(fast.max).toEqual(slow.max);
    },
  );

  it("matches on constant and monotonic series (tie-heavy deques)", () => {
    for (const data of [
      Array(50).fill(7),
      Array.from({ length: 50 }, (_, i) => i),
      Array.from({ length: 50 }, (_, i) => 50 - i),
    ]) {
      const fast = slidingMinMax(data, 9);
      const slow = naive(data, 9);
      expect(fast.min).toEqual(slow.min);
      expect(fast.max).toEqual(slow.max);
    }
  });

  it("degenerate periods emit all-null", () => {
    for (const period of [0, -3]) {
      const { min, max } = slidingMinMax(SERIES, period);
      expect(min.every((v) => v === null)).toBe(true);
      expect(max.every((v) => v === null)).toBe(true);
    }
  });

  it("warm-up is null before index period - 1", () => {
    const { min, max } = slidingMinMax(SERIES, 14);
    expect(min.slice(0, 13).every((v) => v === null)).toBe(true);
    expect(max.slice(0, 13).every((v) => v === null)).toBe(true);
    expect(min[13]).not.toBeNull();
    expect(max[13]).not.toBeNull();
  });
});
