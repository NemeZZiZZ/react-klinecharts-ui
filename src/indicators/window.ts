/**
 * Sliding-window min/max in O(n) via monotone deques.
 *
 * Several indicator calcs need the min/max of every trailing `period` window
 * (stochastic's lowest-low/highest-high, ichimoku's tenkan/kijun/spanB). The
 * naive double loop is O(n·period) per window — recomputed from scratch on
 * every chart data change, over the full loaded history. A monotone deque
 * maintains each extremum incrementally: every index is pushed and popped at
 * most once, so one pass yields all windows.
 *
 * Semantics match the naive loop exactly on finite inputs: entries before
 * index `period - 1` are null (warm-up), later entries cover
 * `data[i - period + 1 .. i]`. Non-finite inputs are outside the contract —
 * indicator calcs run on chart data, which is finite (use `TA.*` for
 * NaN-guarded math).
 */
export function slidingMinMax(
  data: number[],
  period: number,
): { min: (number | null)[]; max: (number | null)[] } {
  const n = data.length;
  const min: (number | null)[] = new Array(n);
  const max: (number | null)[] = new Array(n);
  if (period < 1) {
    min.fill(null);
    max.fill(null);
    return { min, max };
  }
  // Index deques with head pointers (Array.shift() is O(n) and would defeat
  // the purpose — the O(n) guarantee needs O(1) eviction from the front).
  const minDq: number[] = [];
  const maxDq: number[] = [];
  let minHead = 0;
  let maxHead = 0;
  for (let i = 0; i < n; i++) {
    const v = data[i];
    while (minDq.length > minHead && data[minDq[minDq.length - 1]!] >= v) {
      minDq.pop();
    }
    minDq.push(i);
    while (maxDq.length > maxHead && data[maxDq[maxDq.length - 1]!] <= v) {
      maxDq.pop();
    }
    maxDq.push(i);
    if (i < period - 1) {
      min[i] = null;
      max[i] = null;
      continue;
    }
    const out = i - period + 1;
    while (minDq[minHead]! < out) minHead++;
    while (maxDq[maxHead]! < out) maxHead++;
    min[i] = data[minDq[minHead]!];
    max[i] = data[maxDq[maxHead]!];
  }
  return { min, max };
}
