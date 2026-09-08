import type { Chart } from "klinecharts";
import { DRAWING_GROUP_ID } from "./drawingOverlays";
import type { ResolvedStorage } from "../storage";

export const STORAGE_KEY_PREFIX = "klinecharts_layout:";
export const INDEX_KEY = "klinecharts_layout_index";
export const STATE_VERSION = "1.0";

export interface ChartLayoutState {
  version: string;
  meta: {
    symbol: string;
    period: string;
    timestamp: number;
    lastModified: number;
  };
  indicators: Array<{
    paneId: string;
    name: string;
    calcParams: any[];
    visible: boolean;
    styles?: any;
    /** Custom Y-axis the indicator is bound to (klinecharts v10 multiple y-axes). */
    yAxisId?: string;
  }>;
  drawings: Array<{
    name: string;
    points: any[];
    styles?: any;
    extendData?: any;
    /** Drawing flags — a locked/hidden drawing must survive a layout reload. */
    lock?: boolean;
    visible?: boolean;
    mode?: string;
  }>;
}

export interface LayoutEntry {
  id: string;
  name: string;
  symbol: string;
  period: string;
  timestamp: number;
  lastModified: number;
  state: ChartLayoutState;
}

/**
 * Storage access for layouts: adapter-backed when the consumer configured
 * `storage`, legacy raw `localStorage` otherwise. `null` when the consumer
 * explicitly excluded "layouts" from `storage.namespaces` — persistence
 * disabled, mirroring the opt-out semantics of the other slices. Every write
 * is guarded: a failing backend (quota exceeded, private mode, remote hiccup)
 * must never crash the chart, same contract as the provider's `writeNs`.
 * Reads are guarded and SSR-safe.
 */
export interface LayoutBackend {
  /** Adapter-backed storage (legacy keys live in raw localStorage). */
  isAdapter: boolean;
  indexKey: string;
  entryPrefix: string;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export function createLayoutBackend(
  storage: ResolvedStorage | null,
): LayoutBackend | null {
  if (storage) {
    if (!storage.persists("layouts")) return null;
    return {
      isAdapter: true,
      indexKey: `${storage.keyPrefix}layout_index`,
      entryPrefix: `${storage.keyPrefix}layout:`,
      getItem: (key: string) => {
        try {
          return storage.adapter.getItem(key);
        } catch {
          return null;
        }
      },
      setItem: (key: string, value: string) => {
        try {
          storage.adapter.setItem(key, value);
        } catch {
          // non-fatal: quota / remote hiccup
        }
      },
      removeItem: (key: string) => {
        try {
          storage.adapter.removeItem(key);
        } catch {
          // non-fatal
        }
      },
    };
  }
  return {
    isAdapter: false,
    indexKey: INDEX_KEY,
    entryPrefix: STORAGE_KEY_PREFIX,
    getItem: (key: string) => {
      if (typeof localStorage === "undefined") return null;
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: (key: string, value: string) => {
      if (typeof localStorage === "undefined") return;
      try {
        localStorage.setItem(key, value);
      } catch {
        // non-fatal: quota/private-mode
      }
    },
    removeItem: (key: string) => {
      if (typeof localStorage === "undefined") return;
      try {
        localStorage.removeItem(key);
      } catch {
        // non-fatal
      }
    },
  };
}

export function readLayoutIds(backend: LayoutBackend | null): string[] {
  if (!backend) return [];
  try {
    const raw = backend.getItem(backend.indexKey);
    const parsed = raw ? JSON.parse(raw) : [];
    // Shape check: a corrupted index must degrade to "no layouts", not crash
    // every later .map/.filter on a non-array.
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readLayoutEntry(
  backend: LayoutBackend | null,
  id: string,
): LayoutEntry | null {
  if (!backend) return null;
  try {
    const raw = backend.getItem(backend.entryPrefix + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function readAllLayoutEntries(
  backend: LayoutBackend | null,
): LayoutEntry[] {
  return readLayoutIds(backend)
    .map((id) => readLayoutEntry(backend, id))
    .filter((e): e is LayoutEntry => e !== null);
}

export function writeLayoutEntry(
  backend: LayoutBackend | null,
  id: string,
  entry: LayoutEntry,
): void {
  backend?.setItem(backend.entryPrefix + id, JSON.stringify(entry));
}

export function writeLayoutIndex(
  backend: LayoutBackend | null,
  ids: string[],
): void {
  backend?.setItem(backend.indexKey, JSON.stringify(ids));
}

export function deleteLayoutEntry(
  backend: LayoutBackend | null,
  id: string,
): void {
  backend?.removeItem(backend.entryPrefix + id);
}

export function generateLayoutId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface SerializeChartLayoutParams {
  chart: Chart | null;
  symbol: string;
  period: string;
  /** Custom Y-axis bindings (indicator id -> axis id) tracked by the provider. */
  indicatorAxes: Record<string, string>;
}

/**
 * Snapshot the current chart state for saving into a layout.
 * Lives outside the hook: used identically by `saveLayout` and by the
 * provider-owned auto-save sweep.
 */
export function serializeChartLayout({
  chart,
  symbol,
  period,
  indicatorAxes,
}: SerializeChartLayoutParams): ChartLayoutState | null {
  if (!chart) return null;

  const indicators: ChartLayoutState["indicators"] = [];
  // Use the public `getIndicators()` API (returns a flat Indicator[]). The
  // previous code called `getIndicatorByPaneId()`, which is not part of the
  // klinecharts public API, so its body never ran and indicators were never
  // serialized.
  const allIndicators = chart.getIndicators();
  for (const indicator of allIndicators) {
    // Persist a custom axis binding only when it was explicitly tracked
    // (avoids serializing the pane's default axis id).
    const yAxisId = indicatorAxes[indicator.id];
    indicators.push({
      paneId: indicator.paneId,
      name: indicator.name,
      calcParams: indicator.calcParams,
      visible: indicator.visible,
      ...(indicator.styles ? { styles: indicator.styles } : {}),
      ...(yAxisId ? { yAxisId } : {}),
    });
  }

  const drawings: ChartLayoutState["drawings"] = [];
  // Only drawing-tools overlays. Serializing everything here previously
  // captured alert/order lines too, and loadLayout then recreated them
  // without id/groupId/lock — breaking the alert line↔state pairing and
  // duplicating them as plain drawings on every save.
  const allOverlays = chart.getOverlays({ groupId: DRAWING_GROUP_ID });
  if (allOverlays) {
    for (const overlay of allOverlays) {
      drawings.push({
        name: overlay.name,
        points: overlay.points,
        styles: overlay.styles,
        extendData: overlay.extendData,
        // Undo/redo payloads already carry these; layouts must too — a locked
        // or hidden drawing used to reload unlocked and visible.
        ...(overlay.lock != null ? { lock: overlay.lock } : {}),
        ...(overlay.visible != null ? { visible: overlay.visible } : {}),
        ...(overlay.mode != null ? { mode: overlay.mode } : {}),
      });
    }
  }

  return {
    version: STATE_VERSION,
    meta: {
      symbol,
      period,
      timestamp: Date.now(),
      lastModified: Date.now(),
    },
    indicators,
    drawings,
  };
}

/**
 * Content signature of a layout — persisted fields only: meta.timestamp /
 * lastModified are `Date.now()` stamps and would differ on every sweep,
 * making auto-save rewrite an unchanged layout forever.
 */
export function layoutContentSignature(state: ChartLayoutState): string {
  return JSON.stringify({
    symbol: state.meta.symbol,
    period: state.meta.period,
    indicators: state.indicators,
    drawings: state.drawings,
  });
}
