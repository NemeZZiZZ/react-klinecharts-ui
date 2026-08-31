import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useKlinechartsUI, useKlinechartsUIDispatch } from "../provider/ChartTerminalContext";

const STORAGE_KEY_PREFIX = "klinecharts_layout:";
const INDEX_KEY = "klinecharts_layout_index";
const STATE_VERSION = "1.0";
// Same group id as useDrawingTools/useUndoRedo (already duplicated there).
// Layouts persist ONLY user drawings — alert lines ("price_alerts"), order
// lines, annotations and the measure overlay are owned by their own
// subsystems and must neither be serialized nor wiped by a layout load.
const DRAWING_GROUP_ID = "drawing_tools";

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

export interface UseLayoutManagerReturn {
  /** List of saved layout entries */
  layouts: LayoutEntry[];
  /** Save current chart state as a named layout */
  saveLayout: (name: string) => string | null;
  /** Load a layout by ID and apply to the chart */
  loadLayout: (id: string) => boolean;
  /** Delete a layout by ID */
  deleteLayout: (id: string) => void;
  /** Rename a layout */
  renameLayout: (id: string, name: string) => boolean;
  /** Refresh the layouts list from localStorage */
  refreshLayouts: () => void;
  /** Whether auto-save is enabled */
  autoSaveEnabled: boolean;
  /** Toggle auto-save on/off */
  setAutoSaveEnabled: (enabled: boolean) => void;
}

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    },
  );
}

/**
 * Headless hook for saving, loading, and managing named chart layouts.
 * Supports auto-save with 5-second debounce.
 *
 * Persistence routes through the provider's storage adapter when the consumer
 * configured one (`<KlinechartsUIProvider storage={...}>`) — so custom
 * adapters (sessionStorage, IndexedDB sync caches, remote backends) own
 * layout data the same way they own alerts/settings/indicators. Without a
 * configured storage, layouts fall back to direct `localStorage` under the
 * historical keys, so layouts saved by earlier versions keep working.
 */
export function useLayoutManager(): UseLayoutManagerReturn {
  const { state, dispatch } = useKlinechartsUI();
  const { storage } = useKlinechartsUIDispatch();

  // --- Storage backend ------------------------------------------------------
  // Adapter-backed when storage is configured; legacy raw localStorage
  // otherwise. `null` when the consumer explicitly excluded "layouts" from
  // `storage.namespaces` — persistence disabled, mirroring the opt-out
  // semantics of the other slices. Every write is guarded: a failing backend
  // (quota exceeded, private mode, remote hiccup) must never crash the chart,
  // same contract as the provider's writeNs. Reads are guarded and SSR-safe.
  const backend = useMemo(() => {
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
            // non-fatal: adapter failure must not break save/rename/delete
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
  }, [storage]);

  const readLayoutIds = useCallback((): string[] => {
    if (!backend) return [];
    try {
      const raw = backend.getItem(backend.indexKey);
      const parsed = raw ? JSON.parse(raw) : [];
      // Shape check: a corrupted index must degrade to "no layouts", not
      // crash every later .map/.filter on a non-array.
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [backend]);

  const readLayoutEntry = useCallback((id: string): LayoutEntry | null => {
    if (!backend) return null;
    try {
      const raw = backend.getItem(backend.entryPrefix + id);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [backend]);

  const writeLayoutEntry = useCallback((id: string, entry: LayoutEntry) => {
    backend?.setItem(backend.entryPrefix + id, JSON.stringify(entry));
  }, [backend]);

  const writeLayoutIndex = useCallback((ids: string[]) => {
    backend?.setItem(backend.indexKey, JSON.stringify(ids));
  }, [backend]);

  const deleteLayoutEntry = useCallback((id: string) => {
    backend?.removeItem(backend.entryPrefix + id);
  }, [backend]);

  // Layouts load in a mount effect, not in a lazy useState initializer:
  // reading storage during the first render produced a server/client
  // hydration mismatch (server renders [], client renders saved entries).
  const [layouts, setLayouts] = useState<LayoutEntry[]>([]);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveIdRef = useRef<string | null>(null);

  const refreshLayouts = useCallback(() => {
    setLayouts(
      readLayoutIds()
        .map((id) => readLayoutEntry(id))
        .filter((e): e is LayoutEntry => e !== null),
    );
  }, [readLayoutIds, readLayoutEntry]);

  // Intentional setState-in-effect: persisted layouts are hydrated only after
  // mount so the server and the client's first render agree on `[]` (reading
  // localStorage during render would cause an SSR hydration mismatch).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshLayouts();
  }, [refreshLayouts]);

  // One-time legacy migration: pre-2.0.4 versions always wrote layouts to raw
  // localStorage — including apps that had a storage adapter configured (the
  // adapter then only owned alerts/indicators/settings). Without this merge,
  // upgrading with `storage` configured would silently orphan every saved
  // layout. Runs once per backend; copies entries into the adapter, then
  // removes the legacy keys. Legacy reads are guarded; a corrupted legacy
  // index aborts the migration without touching the keys.
  const migratedRef = useRef(false);
  useEffect(() => {
    if (!backend?.isAdapter || migratedRef.current) return;
    migratedRef.current = true;
    if (typeof localStorage === "undefined") return;
    try {
      const legacyIndexRaw = localStorage.getItem(INDEX_KEY);
      if (!legacyIndexRaw) return;
      const legacyIds: unknown = JSON.parse(legacyIndexRaw);
      if (!Array.isArray(legacyIds) || legacyIds.length === 0) return;
      const merged = [...readLayoutIds()];
      for (const id of legacyIds) {
        if (typeof id !== "string" || merged.includes(id)) continue;
        try {
          const raw = localStorage.getItem(STORAGE_KEY_PREFIX + id);
          if (raw) {
            backend.setItem(backend.entryPrefix + id, raw);
            merged.push(id);
          }
        } catch {
          // skip a single unreadable entry, keep migrating the rest
        }
      }
      backend.setItem(backend.indexKey, JSON.stringify(merged));
      // Remove legacy keys only after the adapter copies are written.
      try {
        localStorage.removeItem(INDEX_KEY);
      } catch {
        // non-fatal
      }
      for (const id of legacyIds) {
        if (typeof id !== "string") continue;
        try {
          localStorage.removeItem(STORAGE_KEY_PREFIX + id);
        } catch {
          // non-fatal
        }
      }
      refreshLayouts();
    } catch {
      // Corrupted legacy index — leave the legacy keys untouched.
    }
  }, [backend, readLayoutIds, refreshLayouts]);

  const serializeState = useCallback((): ChartLayoutState | null => {
    const chart = state.chart;
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
      const yAxisId = state.indicatorAxes[indicator.id];
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
        });
      }
    }

    return {
      version: STATE_VERSION,
      meta: {
        symbol: state.symbol?.ticker ?? "",
        period: state.period?.label ?? "",
        timestamp: Date.now(),
        lastModified: Date.now(),
      },
      indicators,
      drawings,
    };
  }, [state.chart, state.symbol, state.period, state.indicatorAxes]);

  const saveLayout = useCallback(
    (name: string): string | null => {
      // Persistence disabled (storage configured without the "layouts"
      // namespace): report failure instead of returning an id that points
      // at nothing.
      if (!backend) return null;
      const chartState = serializeState();
      if (!chartState) return null;

      const id = generateId();
      const now = Date.now();
      const entry: LayoutEntry = {
        id,
        name: name.trim() || `Layout ${new Date(now).toLocaleString()}`,
        symbol: chartState.meta.symbol,
        period: chartState.meta.period,
        timestamp: now,
        lastModified: now,
        state: chartState,
      };

      writeLayoutEntry(id, entry);
      const ids = readLayoutIds();
      if (!ids.includes(id)) {
        ids.push(id);
        writeLayoutIndex(ids);
      }

      refreshLayouts();
      return id;
    },
    [backend, serializeState, refreshLayouts, writeLayoutEntry, readLayoutIds, writeLayoutIndex],
  );

  const loadLayout = useCallback(
    (id: string): boolean => {
      const entry = readLayoutEntry(id);
      if (!entry || !state.chart) return false;

      const chartState = entry.state;
      if (chartState.version !== STATE_VERSION) return false;

      const chart = state.chart;

      // Clear existing drawings only. A bare removeOverlay() (no filter)
      // matches EVERY overlay in klinecharts — it wiped alert lines
      // ("price_alerts" group) and order lines whose state lives elsewhere,
      // permanently breaking their line↔state pairing.
      chart.removeOverlay({ groupId: DRAWING_GROUP_ID });

      // Clear existing indicators. Use the public `getIndicators()` API
      // (flat Indicator[]). The previous code relied on `getIndicatorByPaneId`,
      // which is not a public klinecharts method, so the clear step never ran.
      for (const indicator of chart.getIndicators()) {
        chart.removeIndicator({ id: indicator.id });
      }

      // Restore indicators
      const newMainIndicators: string[] = [];
      const newSubIndicators: Record<string, string> = {};
      const restoredAxes: Record<string, string> = {};
      const restoredVisibility: Record<string, boolean> = {};

      if (chartState.indicators) {
        for (const ind of chartState.indicators) {
          const isMain = ind.paneId === "candle_pane";
          // Use the canonical id convention so the restored indicators stay in
          // sync with useIndicators (removable, axis-trackable).
          const id = isMain ? `main_${ind.name}` : `sub_${ind.name}`;
          chart.createIndicator(
            {
              name: ind.name,
              id,
              calcParams: ind.calcParams,
              visible: ind.visible,
              // klinecharts v10: paneId/yAxisId live on the IndicatorCreate
              // value. Main indicators stack over the candle series.
              paneId: ind.paneId,
              ...(ind.yAxisId ? { yAxisId: ind.yAxisId } : {}),
            },
            isMain,
          );

          if (ind.styles) {
            chart.overrideIndicator({
              name: ind.name,
              id,
              styles: ind.styles,
            });
          }

          if (ind.yAxisId) {
            restoredAxes[id] = ind.yAxisId;
          }

          // Mirror visibility into the sparse map (only when hidden) so the
          // useIndicators getter reflects the restored preset.
          if (ind.visible === false) {
            restoredVisibility[id] = false;
          }

          if (isMain) {
            newMainIndicators.push(ind.name);
          } else {
            newSubIndicators[ind.name] = ind.paneId;
          }
        }
      }

      dispatch({
        type: "SET_MAIN_INDICATORS",
        indicators: newMainIndicators,
      });
      dispatch({
        type: "SET_SUB_INDICATORS",
        indicators: newSubIndicators,
      });
      dispatch({
        type: "SET_INDICATOR_AXES",
        axes: restoredAxes,
      });
      dispatch({
        type: "SET_INDICATOR_VISIBILITY",
        visibility: restoredVisibility,
      });

      // Restore drawings
      if (chartState.drawings) {
        for (const drawing of chartState.drawings) {
          // Pre-2.0.4 layouts serialized EVERY overlay (getOverlays({})),
          // including subsystem-owned ones. Skip those on restore so a legacy
          // layout doesn't resurrect ghost lines the alert/order/annotation
          // systems know nothing about. None of these names appear in the
          // drawing-tools menu, so no legitimate user drawing is dropped
          // ("measure" IS user-drawable and therefore restored normally).
          if (
            drawing.name === "alertLine" ||
            drawing.name === "orderLine" ||
            drawing.name === "depthOverlay" ||
            drawing.name === "simpleAnnotation"
          ) {
            continue;
          }
          chart.createOverlay({
            name: drawing.name,
            points: drawing.points,
            styles: drawing.styles,
            extendData: drawing.extendData,
            // Restore into the drawing group so useDrawingTools (which lists
            // and removes by groupId) sees the restored overlays.
            groupId: DRAWING_GROUP_ID,
          });
        }
      }

      return true;
    },
    [state.chart, dispatch, readLayoutEntry],
  );

  const deleteLayout = useCallback(
    (id: string) => {
      deleteLayoutEntry(id);
      writeLayoutIndex(readLayoutIds().filter((i) => i !== id));
      refreshLayouts();
    },
    [deleteLayoutEntry, writeLayoutIndex, readLayoutIds, refreshLayouts],
  );

  const renameLayout = useCallback(
    (id: string, name: string): boolean => {
      const entry = readLayoutEntry(id);
      if (!entry) return false;
      const updated = {
        ...entry,
        name: name.trim(),
        lastModified: Date.now(),
      };
      writeLayoutEntry(id, updated);
      refreshLayouts();
      return true;
    },
    [readLayoutEntry, writeLayoutEntry, refreshLayouts],
  );

  // Auto-save with 5-second debounce
  useEffect(() => {
    // Persistence disabled (storage configured without the "layouts"
    // namespace): running the timer would only churn state through no-op
    // writes and refreshLayouts([]) re-renders.
    if (!backend) return;
    if (!autoSaveEnabled || !state.chart) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      const chartState = serializeState();
      if (!chartState) return;

      if (autoSaveIdRef.current) {
        // Update existing auto-save slot
        const entry = readLayoutEntry(autoSaveIdRef.current);
        if (entry) {
          const updated = {
            ...entry,
            lastModified: Date.now(),
            state: chartState,
          };
          writeLayoutEntry(autoSaveIdRef.current, updated);
          refreshLayouts();
        }
      } else {
        // Create initial auto-save slot
        const id = generateId();
        const now = Date.now();
        const entry: LayoutEntry = {
          id,
          name: "Auto-save",
          symbol: chartState.meta.symbol,
          period: chartState.meta.period,
          timestamp: now,
          lastModified: now,
          state: chartState,
        };
        writeLayoutEntry(id, entry);
        const ids = readLayoutIds();
        ids.push(id);
        writeLayoutIndex(ids);
        autoSaveIdRef.current = id;
        refreshLayouts();
      }
    }, 5000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    autoSaveEnabled,
    state.chart,
    state.mainIndicators,
    state.subIndicators,
    backend,
    serializeState,
    refreshLayouts,
    readLayoutEntry,
    writeLayoutEntry,
    readLayoutIds,
    writeLayoutIndex,
  ]);

  return {
    layouts,
    saveLayout,
    loadLayout,
    deleteLayout,
    renameLayout,
    refreshLayouts,
    autoSaveEnabled,
    setAutoSaveEnabled,
  };
}
