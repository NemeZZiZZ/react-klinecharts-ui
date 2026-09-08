import {
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useSyncExternalStore,
} from "react";
import { useKlinechartsUI, useKlinechartsUIDispatch } from "../provider/ChartTerminalContext";
// Storage backend, serialization and the layout types live in the provider
// layer: the saved-layout list and the auto-save sweep are provider-owned
// (one storage key per chart — not one per hook instance), so the hook is a
// facade over that shared state.
import {
  STORAGE_KEY_PREFIX,
  INDEX_KEY,
  STATE_VERSION,
  createLayoutBackend,
  readLayoutEntry,
  readAllLayoutEntries,
  writeLayoutEntry,
  readLayoutIds,
  writeLayoutIndex,
  deleteLayoutEntry,
  serializeChartLayout,
  generateLayoutId,
  type ChartLayoutState,
  type LayoutEntry,
} from "../provider/layouts";
import { DRAWING_GROUP_ID } from "../provider/drawingOverlays";
import type { SharedState } from "../provider/types";
import type { OverlayMode } from "klinecharts";

// Re-exported: the types moved to the provider layer, the public API of the
// hook (and of the package) keeps exposing them from here.
export type { ChartLayoutState, LayoutEntry };

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
  const { storage, layoutStore, layoutAutoSaveStore } =
    useKlinechartsUIDispatch();

  // --- Storage backend ------------------------------------------------------
  // Adapter-backed when storage is configured; legacy raw localStorage
  // otherwise. `null` when the consumer explicitly excluded "layouts" from
  // `storage.namespaces` — persistence disabled. Stateless (just guarded
  // reads/writes), so building it per hook instance is fine; the SHARED parts
  // (the list, the auto-save slot and its timer) live in the provider.
  const backend = useMemo(() => createLayoutBackend(storage), [storage]);

  const readIds = useCallback(() => readLayoutIds(backend), [backend]);
  const readEntry = useCallback(
    (id: string) => readLayoutEntry(backend, id),
    [backend],
  );

  // The saved-layout list is provider-owned (`layoutStore`): two components
  // calling this hook must show ONE list, not two copies that each hydrate
  // from storage and each run an auto-save sweep against the same key.
  const entriesStore = layoutStore as unknown as SharedState<LayoutEntry[]>;
  const layouts = useSyncExternalStore(
    entriesStore.subscribe,
    entriesStore.get,
    entriesStore.get,
  );

  // Auto-save flag, same reasoning: shared store, not hook-local useState.
  // The 5s sweep itself runs in the provider (one timer per chart).
  const autoSaveEnabled = useSyncExternalStore(
    layoutAutoSaveStore.subscribe,
    layoutAutoSaveStore.get,
    layoutAutoSaveStore.get,
  );
  const setAutoSaveEnabled = useCallback(
    (enabled: boolean) => {
      layoutAutoSaveStore.set(enabled);
    },
    [layoutAutoSaveStore],
  );

  const refreshLayouts = useCallback(() => {
    entriesStore.set(readAllLayoutEntries(backend));
  }, [entriesStore, backend]);

  // Incremental list update used after a write. `refreshLayouts()` re-reads the
  // index and JSON.parses EVERY stored layout, so a save/rename/delete (and
  // every 5s auto-save sweep) used to cost O(n) storage reads + parses that
  // grew with the number of saved layouts. Writers already hold the entry they
  // just persisted, so the list is patched in place instead.
  const upsertLayout = useCallback(
    (entry: LayoutEntry) => {
      entriesStore.set((prev) => {
        const index = prev.findIndex((e) => e.id === entry.id);
        if (index === -1) return [...prev, entry];
        const next = prev.slice();
        next[index] = entry;
        return next;
      });
    },
    [entriesStore],
  );

  const removeLayoutFromList = useCallback(
    (id: string) => {
      entriesStore.set((prev) => prev.filter((e) => e.id !== id));
    },
    [entriesStore],
  );

  // Layouts are hydrated after mount, not during the first render, so the
  // server and the client's first render agree on `[]` (reading localStorage
  // during render would cause an SSR hydration mismatch).
  useEffect(() => {
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
      const merged = [...readIds()];
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
      // One-off post-mount sync after the migration (same documented pattern
      // as the hydration effect above).
      refreshLayouts();
    } catch {
      // Corrupted legacy index — leave the legacy keys untouched.
    }
  }, [backend, readIds, refreshLayouts]);

  const serializeState = useCallback(
    (): ChartLayoutState | null =>
      serializeChartLayout({
        chart: state.chart,
        symbol: state.symbol?.ticker ?? "",
        period: state.period?.label ?? "",
        indicatorAxes: state.indicatorAxes,
      }),
    [state.chart, state.symbol, state.period, state.indicatorAxes],
  );

  const saveLayout = useCallback(
    (name: string): string | null => {
      // Persistence disabled (storage configured without the "layouts"
      // namespace): report failure instead of returning an id that points
      // at nothing.
      if (!backend) return null;
      const chartState = serializeState();
      if (!chartState) return null;

      const id = generateLayoutId();
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

      writeLayoutEntry(backend, id, entry);
      const ids = readIds();
      if (!ids.includes(id)) {
        ids.push(id);
        writeLayoutIndex(backend, ids);
      }

      upsertLayout(entry);
      return id;
    },
    [backend, serializeState, upsertLayout, readIds],
  );

  const loadLayout = useCallback(
    (id: string): boolean => {
      const entry = readEntry(id);
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
              // value. Main indicators stack over the candle series; sub
              // indicators are created WITHOUT a paneId so klinecharts mints a
              // fresh pane (passing the SAVED id would either resurrect a pane
              // from the previous chart instance or, worse, merge this
              // indicator into an existing pane that happens to share the id).
              // The real pane id is read back below.
              ...(isMain ? { paneId: "candle_pane" } : {}),
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
            // Read the pane back from the chart instead of trusting the saved
            // id: every paneId-keyed operation (collapse, reorder, remove,
            // axis overrides) goes through state.subIndicators, so a stale id
            // from the previous session's chart silently breaks them.
            const created = chart.getIndicators({ id })[0];
            newSubIndicators[ind.name] = created?.paneId ?? ind.paneId;
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
            // Persisted drawing flags (lock/visible/mode) — without them a
            // locked or hidden drawing reloaded unlocked and visible.
            ...(drawing.lock != null ? { lock: drawing.lock } : {}),
            ...(drawing.visible != null ? { visible: drawing.visible } : {}),
            ...(drawing.mode != null
              ? { mode: drawing.mode as OverlayMode }
              : {}),
          });
        }
      }

      return true;
    },
    [state.chart, dispatch, readEntry],
  );

  const deleteLayout = useCallback(
    (id: string) => {
      deleteLayoutEntry(backend, id);
      writeLayoutIndex(backend, readIds().filter((i) => i !== id));
      removeLayoutFromList(id);
    },
    [backend, readIds, removeLayoutFromList],
  );

  const renameLayout = useCallback(
    (id: string, name: string): boolean => {
      const entry = readEntry(id);
      if (!entry) return false;
      const updated: LayoutEntry = {
        ...entry,
        name: name.trim(),
        lastModified: Date.now(),
      };
      writeLayoutEntry(backend, id, updated);
      upsertLayout(updated);
      return true;
    },
    [backend, readEntry, upsertLayout],
  );

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
