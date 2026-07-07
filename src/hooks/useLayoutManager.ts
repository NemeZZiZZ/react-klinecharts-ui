import { useState, useCallback, useRef, useEffect } from "react";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";

const STORAGE_KEY_PREFIX = "klinecharts_layout:";
const INDEX_KEY = "klinecharts_layout_index";
const STATE_VERSION = "1.0";

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

// Guard against non-browser environments (SSR/Next.js/Astro). The lazy
// useState initializer in useLayoutManager calls these during render, so they
// must not throw when localStorage is undefined.
function getLayoutIds(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getEntry(id: string): LayoutEntry | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Headless hook for saving, loading, and managing named chart layouts
 * via localStorage. Supports auto-save with 5-second debounce.
 */
export function useLayoutManager(): UseLayoutManagerReturn {
  const { state, dispatch } = useKlinechartsUI();
  // Read saved layouts synchronously during the first render so there is no
  // mount effect that triggers a cascading re-render.
  const [layouts, setLayouts] = useState<LayoutEntry[]>(() =>
    getLayoutIds()
      .map((id) => getEntry(id))
      .filter((e): e is LayoutEntry => e !== null),
  );
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveIdRef = useRef<string | null>(null);

  const refreshLayouts = useCallback(() => {
    setLayouts(
      getLayoutIds()
        .map((id) => getEntry(id))
        .filter((e): e is LayoutEntry => e !== null),
    );
  }, []);

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
    const allOverlays = chart.getOverlays({});
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

      localStorage.setItem(
        STORAGE_KEY_PREFIX + id,
        JSON.stringify(entry),
      );
      const ids = getLayoutIds();
      if (!ids.includes(id)) {
        ids.push(id);
        localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
      }

      refreshLayouts();
      return id;
    },
    [serializeState, refreshLayouts],
  );

  const loadLayout = useCallback(
    (id: string): boolean => {
      const entry = getEntry(id);
      if (!entry || !state.chart) return false;

      const chartState = entry.state;
      if (chartState.version !== STATE_VERSION) return false;

      const chart = state.chart;

      // Clear existing overlays
      chart.removeOverlay();

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
            },
            {
              // Main indicators stack OVER the candle series on the candle
              // pane (isStack: true), exactly as useIndicators does on the
              // add path. The previous `ind.paneId !== "candle_pane"` inverted
              // this, so loading a layout with main indicators replaced the
              // candles instead of overlaying them.
              isStack: isMain,
              pane: { id: ind.paneId },
              ...(ind.yAxisId ? { yAxis: { id: ind.yAxisId } } : {}),
            },
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
          chart.createOverlay({
            name: drawing.name,
            points: drawing.points,
            styles: drawing.styles,
            extendData: drawing.extendData,
          });
        }
      }

      return true;
    },
    [state.chart, dispatch],
  );

  const deleteLayout = useCallback(
    (id: string) => {
      localStorage.removeItem(STORAGE_KEY_PREFIX + id);
      const ids = getLayoutIds().filter((i) => i !== id);
      localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
      refreshLayouts();
    },
    [refreshLayouts],
  );

  const renameLayout = useCallback(
    (id: string, name: string): boolean => {
      const entry = getEntry(id);
      if (!entry) return false;
      const updated = {
        ...entry,
        name: name.trim(),
        lastModified: Date.now(),
      };
      localStorage.setItem(
        STORAGE_KEY_PREFIX + id,
        JSON.stringify(updated),
      );
      refreshLayouts();
      return true;
    },
    [refreshLayouts],
  );

  // Auto-save with 5-second debounce
  useEffect(() => {
    if (!autoSaveEnabled || !state.chart) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      const chartState = serializeState();
      if (!chartState) return;

      if (autoSaveIdRef.current) {
        // Update existing auto-save slot
        const entry = getEntry(autoSaveIdRef.current);
        if (entry) {
          const updated = {
            ...entry,
            lastModified: Date.now(),
            state: chartState,
          };
          localStorage.setItem(
            STORAGE_KEY_PREFIX + autoSaveIdRef.current,
            JSON.stringify(updated),
          );
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
        localStorage.setItem(
          STORAGE_KEY_PREFIX + id,
          JSON.stringify(entry),
        );
        const ids = getLayoutIds();
        ids.push(id);
        localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
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
    serializeState,
    refreshLayouts,
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
