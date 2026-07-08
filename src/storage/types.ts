/**
 * Web Storage-compatible adapter. Pass `localStorage`, `sessionStorage`, a
 * remote/IndexedDB wrapper, or an in-memory fake.
 *
 * Methods are **synchronous** to match the Web Storage API. For async backends
 * (IndexedDB, fetch-to-server), wrap them in a sync cache that reads from
 * memory and flushes in the background — the adapter contract is sync.
 */
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Which slices of the provider store are persisted. Defaults to all three.
 *
 * - `"alerts"` — the price-alert list (`state.alerts`, including each alert's
 *   `triggered` flag and `extendData`).
 * - `"settings"` — the `useKlinechartsUISettings` object (candle type, colors,
 *   axes, grid, tooltips, …).
 * - `"indicators"` — the active main/sub indicator lists, their pane ids,
 *   custom Y-axis bindings, and visibility overrides.
 */
export type StorageNamespace = "alerts" | "settings" | "indicators";

export const DEFAULT_STORAGE_NAMESPACES: readonly StorageNamespace[] = [
  "alerts",
  "settings",
  "indicators",
];

/** Default key prefix; namespaced keys become `${prefix}${namespace}`. */
export const DEFAULT_STORAGE_KEY_PREFIX = "rkui:";

/**
 * Options passed to `<KlinechartsUIProvider storage={...}>`. All fields
 * optional; omitting `storage` entirely disables persistence (the default —
 * backward-compatible with pre-1.1.0 behaviour).
 */
export interface StorageOptions {
  /**
   * The adapter instance. Defaults to `localStorage` (SSR-safe: a no-op
   * adapter when `localStorage` is undefined, e.g. during server rendering).
   */
  adapter?: StorageAdapter;
  /** Key prefix. Default `"rkui:"`. */
  keyPrefix?: string;
  /** Which namespaces to persist. Default: all three. */
  namespaces?: readonly StorageNamespace[];
}

/**
 * Resolved storage configuration (adapter + namespaces + prefix), computed
 * once on mount and exposed via the dispatch context so hooks/tests can read
 * and write through the same adapter the provider uses.
 */
export interface ResolvedStorage {
  adapter: StorageAdapter;
  namespaces: ReadonlySet<StorageNamespace>;
  keyPrefix: string;
  /** Build the storage key for a namespace: `${keyPrefix}${namespace}`. */
  key(namespace: StorageNamespace): string;
  /** Whether a namespace is configured for persistence. */
  persists(namespace: StorageNamespace): boolean;
}
