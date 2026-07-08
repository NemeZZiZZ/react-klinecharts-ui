import type { StorageAdapter, StorageOptions, ResolvedStorage, StorageNamespace } from "./types";
import {
  DEFAULT_STORAGE_NAMESPACES,
  DEFAULT_STORAGE_KEY_PREFIX,
} from "./types";

/**
 * An in-memory no-op adapter, returned when `localStorage` is unavailable
 * (SSR, restricted environments). Reads return `null`, writes are discarded —
 * the provider stays functional, just nothing persists.
 */
const NOOP_ADAPTER: StorageAdapter = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/**
 * Resolve `window.localStorage` lazily and SSR-safely. Never throws; falls
 * back to `NOOP_ADAPTER` when the global is absent or access is denied (e.g.
 * cookies disabled in some browsers throw on `localStorage` access).
 */
export function createDefaultStorage(): StorageAdapter {
  if (typeof localStorage === "undefined") return NOOP_ADAPTER;
  try {
    // Touch a property to confirm access isn't denied (Safari private mode
    // and disabled-storage quotas throw on use, not on the global reference).
    const probe = localStorage.getItem("__rkui_probe__");
    return probe === null ? localStorage : localStorage;
  } catch {
    return NOOP_ADAPTER;
  }
}

/**
 * Turn raw `StorageOptions` into a `ResolvedStorage` with helpers. Called once
 * on mount by the provider; the result is referentially stable for the life
 * of the provider instance.
 */
export function resolveStorage(options: StorageOptions | undefined): ResolvedStorage {
  const adapter = options?.adapter ?? createDefaultStorage();
  const keyPrefix = options?.keyPrefix ?? DEFAULT_STORAGE_KEY_PREFIX;
  const namespaces = new Set<StorageNamespace>(
    options?.namespaces ?? DEFAULT_STORAGE_NAMESPACES,
  );
  return {
    adapter,
    namespaces,
    keyPrefix,
    key(namespace) {
      return `${keyPrefix}${namespace}`;
    },
    persists(namespace) {
      return namespaces.has(namespace);
    },
  };
}
