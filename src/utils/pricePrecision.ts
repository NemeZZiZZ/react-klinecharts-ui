import type { KLineData } from "klinecharts";

/** klinecharts renders tick labels via `toFixed(precision)` — beyond 12 the
 * label width alone would eat the axis, and no real instrument ticks finer. */
const MAX_PRICE_PRECISION = 12;

/** The klinecharts default when a symbol carries no pricePrecision. */
const DEFAULT_PRICE_PRECISION = 2;

/**
 * Decimals of the order of magnitude of `v`: the minimal `d` such that
 * `10^-d <= v`. Rounding to ONE significant digit first makes the result
 * immune to float-subtraction noise — noise perturbs the mantissa, never the
 * exponent, and a rounding boundary crossing only ever yields a harmless ±1.
 */
function orderDecimals(v: number): number {
  const exp = Number(v.toExponential(0).split("e")[1]);
  return Math.max(0, -exp);
}

/**
 * Detects the price precision implied by the smallest movement in `data`.
 *
 * klinecharts clamps the candle-pane Y axis to `10^-pricePrecision` per tick
 * (default 0.01): for sub-cent instruments (PEPE @ 5e-6, ticks of 1e-8) the
 * axis force-expands to ±0.04 and every `toFixed(2)` label reads "0.00" —
 * the chart renders as a flat line. Detecting the precision from the loaded
 * bars and feeding it back into the symbol fixes both the scale and labels.
 *
 * Returns `null` when the data implies the default (or nothing detectable),
 * so normal symbols never trigger a symbol refresh. An explicit
 * `pricePrecision` on the symbol always wins (enforced by the reducer).
 */
export function detectPricePrecision(data: KLineData[]): number | null {
  let minDelta = Infinity;
  let minPrice = Infinity;
  let prevClose: number | undefined;

  const track = (delta: number) => {
    if (delta > 0 && delta < minDelta) minDelta = delta;
  };

  for (const { open, high, low, close } of data) {
    if (
      !Number.isFinite(open) || !Number.isFinite(high) ||
      !Number.isFinite(low) || !Number.isFinite(close)
    ) {
      continue;
    }
    for (const price of [open, high, low, close]) {
      if (price > 0 && price < minPrice) minPrice = price;
    }
    track(Math.abs(high - low));
    track(Math.abs(close - open));
    const bodyTop = Math.max(open, close);
    const bodyBottom = Math.min(open, close);
    track(high - bodyTop);
    track(bodyBottom - low);
    if (prevClose !== undefined) track(Math.abs(close - prevClose));
    prevClose = close;
  }

  const base =
    minDelta !== Infinity
      ? orderDecimals(minDelta)
      : minPrice !== Infinity
        ? orderDecimals(minPrice)
        : 0;
  return base > DEFAULT_PRICE_PRECISION
    ? Math.min(base, MAX_PRICE_PRECISION)
    : null;
}
