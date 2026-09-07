import type { SharedState } from "./types";

/**
 * A tiny external store shared by every hook instance of one provider.
 *
 * Used for state that is a property of the chart/provider rather than of a
 * single hook: `useKlinechartsUISettings` (settings) keeps it in the dispatch
 * context so two components using the hook read and write ONE value instead of
 * diverging copies that fight over the same storage key.
 */
export function createSharedState<T>(initial: T): SharedState<T> {
  let value = initial;
  const listeners = new Set<() => void>();

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get: () => value,
    set(next) {
      const resolved =
        typeof next === "function"
          ? (next as (prev: T) => T)(value)
          : next;
      if (resolved === value) return;
      value = resolved;
      listeners.forEach((listener) => listener());
    },
  };
}
