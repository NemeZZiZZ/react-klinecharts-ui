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

function getLayoutIds(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getEntry(id: string): LayoutEntry | null {
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
  const [layouts, setLayouts] = useState<LayoutEntry[]>([]);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveIdRef = useRef<string | null>(null);

  const refreshLayouts = useCallback(() => {
    const entries = getLayoutIds()
      .map((id) => getEntry(id))
      .filter((e): e is LayoutEntry => e !== null);
    setLayouts(entries);
  }, []);

  // Load layouts on mount
  useEffect(() => {
    refreshLayouts();
  }, [refreshLayouts]);

  const serializeState = useCallback((): ChartLayoutState | null => {
    const chart = state.chart;
    if (!chart) return null;

    const indicators: ChartLayoutState["indicators"] = [];
    const indicatorMap = (chart as any).getIndicatorByPaneId?.();
    if (indicatorMap) {
      indicatorMap.forEach((paneIndicators: any, paneId: string) => {
        paneIndicators.forEach((indicator: any) => {
          indicators.push({
            paneId,
            name: indicator.name,
            calcParams: indicator.calcParams,
            visible: indicator.visible,
          });
        });
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
  }, [state.chart, state.symbol, state.period]);

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

      // Clear existing indicators (except built-in)
      const indicatorMap = (chart as any).getIndicatorByPaneId?.();
      if (indicatorMap) {
        indicatorMap.forEach((_paneIndicators: any, paneId: string) => {
          _paneIndicators.forEach((_: any, indicatorName: string) => {
            chart.removeIndicator({ paneId, name: indicatorName });
          });
        });
      }

      // Restore indicators
      const newMainIndicators: string[] = [];
      const newSubIndicators: Record<string, string> = {};

      if (chartState.indicators) {
        for (const ind of chartState.indicators) {
          chart.createIndicator(
            {
              name: ind.name,
              calcParams: ind.calcParams,
              visible: ind.visible,
            },
            ind.paneId !== "candle_pane",
            { id: ind.paneId },
          );

          if (ind.paneId === "candle_pane") {
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
