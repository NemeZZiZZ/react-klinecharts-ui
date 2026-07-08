import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useKlinechartsUI, useKlinechartsUIDispatch } from "../provider/ChartTerminalContext";
import { DRAWING_CATEGORIES, type MagnetMode } from "../data/drawings";

const DRAWING_GROUP_ID = "drawing_tools";

export interface DrawingToolItem {
  name: string;
  localeKey: string;
}

export interface DrawingCategoryItem {
  key: string;
  tools: DrawingToolItem[];
}

/**
 * Реактивный snapshot одного рисунка из группы `drawing_tools`.
 * Поля соответствуют публичным свойствам `Overlay` в klinecharts v10.
 */
export interface DrawingOverlayInfo {
  /** Stable id из klinecharts (chart.getOverlays()[].id). */
  id: string;
  /** Имя overlay'я, напр. "segment", "fibonacciLine", "arrow". */
  name: string;
  /** Pane id, где нарисован. */
  paneId: string;
  /** Текущее состояние блокировки. */
  locked: boolean;
  /** Текущая видимость. */
  visible: boolean;
}

export interface UseDrawingToolsReturn {
  categories: DrawingCategoryItem[];
  activeTool: string | null;
  magnetMode: MagnetMode;
  isLocked: boolean;
  isVisible: boolean;
  /** Whether drawing tools auto-retrigger after completing a shape. Default: true. */
  autoRetrigger: boolean;
  /**
   * Реактивный список рисунков группы `drawing_tools`. Обновляется при
   * добавлении/удалении/изменении свойств как через сам хук, так и при
   * внешних изменениях (клавиша Delete, undo/redo) — см. polling-fallback.
   */
  overlays: DrawingOverlayInfo[];
  selectTool: (name: string) => void;
  clearActiveTool: () => void;
  setMagnetMode: (mode: MagnetMode) => void;
  toggleLock: () => void;
  toggleVisibility: () => void;
  removeAllDrawings: () => void;
  /** Enable/disable auto-retrigger mode. */
  setAutoRetrigger: (enabled: boolean) => void;
  /** Удалить один рисунок по id. No-op если id нет в группе drawing_tools. */
  removeDrawing: (id: string) => void;
  /** Скрыть/показать один рисунок. */
  setDrawingVisible: (id: string, visible: boolean) => void;
  /** Заблокировать/разблокировать один рисунок. */
  setDrawingLocked: (id: string, locked: boolean) => void;
}

/**
 * Lookup-таблица имя-инструмента → localeKey, построенная один раз из
 * `DRAWING_CATEGORIES`. Используется `drawingLabel()`.
 */
const DRAWING_NAME_TO_LOCALE_KEY: ReadonlyMap<string, string> = new Map(
  DRAWING_CATEGORIES.flatMap((cat) =>
    cat.tools.map((tool) => [tool.name, tool.localeKey] as const),
  ),
);

/**
 * Вернуть localeKey для имени инструмента (напр. "segment" → "segment",
 * "fibonacciLine" → "fibonacci_line"). Если имя не найдено в
 * `DRAWING_CATEGORIES` — вернуть само имя как fallback, чтобы потребитель
 * всегда получал человекочитаемую строку без дублирования таблицы категорий.
 */
export function drawingLabel(name: string): string {
  return DRAWING_NAME_TO_LOCALE_KEY.get(name) ?? name;
}

/**
 * Сравнить два snapshot'а `overlays` по полям, которые видит потребитель.
 * Если множество не изменилось — `refreshOverlays` не вызывает `setOverlays`,
 * чтобы избежать лишних ререндеров (включая ререндеры от polling-тикта).
 */
function overlaysEqual(
  a: DrawingOverlayInfo[],
  b: DrawingOverlayInfo[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.name !== y.name ||
      x.paneId !== y.paneId ||
      x.locked !== y.locked ||
      x.visible !== y.visible
    ) {
      return false;
    }
  }
  return true;
}

export function useDrawingTools(): UseDrawingToolsReturn {
  const { state } = useKlinechartsUI();
  const { undoRedoListenerRef } = useKlinechartsUIDispatch();
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [magnetMode, setMagnetModeState] = useState<MagnetMode>("normal");
  const [isLocked, setIsLocked] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [autoRetrigger, setAutoRetrigger] = useState(true);

  // Refs to capture latest state for the onDrawEnd closure. Mutating a ref
  // during render is not allowed by React 19, so the sync happens in a
  // commit-phase effect below.
  const activeToolRef = useRef(activeTool);
  const autoRetriggerRef = useRef(autoRetrigger);
  const isLockedRef = useRef(isLocked);
  const isVisibleRef = useRef(isVisible);
  const magnetModeRef = useRef(magnetMode);

  useEffect(() => {
    activeToolRef.current = activeTool;
    autoRetriggerRef.current = autoRetrigger;
    isLockedRef.current = isLocked;
    isVisibleRef.current = isVisible;
    magnetModeRef.current = magnetMode;
  });

  // ─── Per-drawing API: реактивный snapshot overlays ───────────────────────
  //
  // В klinecharts v10 нет overlay-событий в ActionType, поэтому список
  // рисунков выкачивается из `chart.getOverlays({ groupId })` и хранится в
  // локальном state. Обновления триггерятся:
  //   1. Точечно — после каждой известной операции (onDrawEnd, 3 новых
  //      per-drawing операции, существующие batch-операции) через
  //      `refreshOverlaysRef.current()`.
  //   2. Polling-fallback раз в 1с — ловит внешние изменения (клавиша Delete,
  //      undo/redo, и т.п.), сделанные вне этого хука.
  const [overlays, setOverlays] = useState<DrawingOverlayInfo[]>([]);

  const refreshOverlays = useCallback(() => {
    if (!state.chart) {
      setOverlays((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const list = state.chart.getOverlays({ groupId: DRAWING_GROUP_ID }) as any[];
    const next: DrawingOverlayInfo[] = list.map((o) => ({
      id: o.id,
      name: o.name,
      paneId: o.paneId,
      locked: !!o.lock,
      visible: o.visible !== false, // klinecharts default = true
    }));
    setOverlays((prev) => (overlaysEqual(prev, next) ? prev : next));
  }, [state.chart]);

  // Indirection ref (тот же паттерн, что `createOverlayForToolRef`): позволяет
  // долгоживущим замыканиям (onDrawEnd) и существующим batch-операциям дернуть
  // актуальный refresh без добавления `refreshOverlays` в их dep-массивы.
  const refreshOverlaysRef = useRef<() => void>(() => {});
  useEffect(() => {
    refreshOverlaysRef.current = refreshOverlays;
  });

  // Начальный snapshot при появлении chart + polling-fallback.
  useEffect(() => {
    if (!state.chart) return;
    // Откладываем начальный snapshot на микрозадачу, чтобы не вызывать
    // setState синхронно внутри effect (lint rule react-hooks/no-cascade).
    queueMicrotask(() => refreshOverlaysRef.current());
    const interval = setInterval(() => refreshOverlaysRef.current(), 1000);
    return () => clearInterval(interval);
  }, [state.chart, refreshOverlays]);
  // ─────────────────────────────────────────────────────────────────────────

  const categories = useMemo(
    () =>
      DRAWING_CATEGORIES.map((cat) => ({
        key: cat.key,
        tools: cat.tools.map((tool) => ({
          name: tool.name,
          localeKey: tool.localeKey,
        })),
      })),
    []
  );

  // Indirection ref so `createOverlayForTool` can reference itself from inside
  // its own `onDrawEnd` closure (auto-retrigger) without referring to the
  // `const` before its declaration.
  const createOverlayForToolRef = useRef<(name: string) => void>(() => {});

  const createOverlayForTool = useCallback(
    (name: string) => {
      const mode =
        magnetModeRef.current === "strong"
          ? "strong_magnet"
          : magnetModeRef.current === "weak"
            ? "weak_magnet"
            : "normal";
      state.chart?.createOverlay({
        name,
        groupId: DRAWING_GROUP_ID,
        lock: isLockedRef.current,
        visible: isVisibleRef.current,
        mode: mode as any,
        onDrawEnd: (event: any) => {
          const o = event.overlay;
          undoRedoListenerRef.current?.({
            type: "overlay_added",
            data: {
              id: o.id,
              overlayData: {
                name: o.name,
                points: o.points,
                styles: o.styles,
                extendData: o.extendData,
              },
            },
          });
          // Новый overlay уже добавлен в chart синхронно до onDrawEnd —
          // обновляем snapshot, чтобы потребитель увидел его сразу.
          refreshOverlaysRef.current();
          // Auto-retrigger: immediately start another overlay of the same type
          if (autoRetriggerRef.current && activeToolRef.current === name) {
            requestAnimationFrame(() => {
              createOverlayForToolRef.current(name);
            });
          }
        },
      });
    },
    [state.chart, undoRedoListenerRef],
  );

  // Keep the indirection ref in sync in the commit phase (not during render).
  useEffect(() => {
    createOverlayForToolRef.current = createOverlayForTool;
  });

  const selectTool = useCallback(
    (name: string) => {
      setActiveTool(name);
      createOverlayForTool(name);
    },
    [createOverlayForTool],
  );

  const clearActiveTool = useCallback(() => {
    setActiveTool(null);
  }, []);

  const setMagnetMode = useCallback(
    (mode: MagnetMode) => {
      setMagnetModeState(mode);
      const overlays = state.chart?.getOverlays({ groupId: DRAWING_GROUP_ID });
      if (overlays) {
        const overlayMode =
          mode === "strong"
            ? "strong_magnet"
            : mode === "weak"
              ? "weak_magnet"
              : "normal";
        overlays.forEach((overlay: any) => {
          state.chart?.overrideOverlay({
            id: overlay.id,
            mode: overlayMode as any,
          });
        });
      }
      refreshOverlaysRef.current();
    },
    [state.chart]
  );

  const toggleLock = useCallback(() => {
    const newLocked = !isLocked;
    setIsLocked(newLocked);
    const overlays = state.chart?.getOverlays({ groupId: DRAWING_GROUP_ID });
    if (overlays) {
      overlays.forEach((overlay: any) => {
        state.chart?.overrideOverlay({
          id: overlay.id,
          lock: newLocked,
        });
      });
    }
    refreshOverlaysRef.current();
  }, [state.chart, isLocked]);

  const toggleVisibility = useCallback(() => {
    const newVisible = !isVisible;
    setIsVisible(newVisible);
    const overlays = state.chart?.getOverlays({ groupId: DRAWING_GROUP_ID });
    if (overlays) {
      overlays.forEach((overlay: any) => {
        state.chart?.overrideOverlay({
          id: overlay.id,
          visible: newVisible,
        });
      });
    }
    refreshOverlaysRef.current();
  }, [state.chart, isVisible]);

  const removeAllDrawings = useCallback(() => {
    const overlays = state.chart?.getOverlays({ groupId: DRAWING_GROUP_ID });
    if (overlays && overlays.length > 0) {
      const snapshot = overlays.map((o: any) => ({
        name: o.name,
        id: o.id,
        points: o.points,
        styles: o.styles,
        extendData: o.extendData,
      }));
      undoRedoListenerRef.current?.({
        type: "overlays_removed",
        data: { overlays: snapshot },
      });
    }
    state.chart?.removeOverlay({ groupId: DRAWING_GROUP_ID });
    setActiveTool(null);
    refreshOverlaysRef.current();
  }, [state.chart, undoRedoListenerRef]);

  // ─── Per-drawing операции ──────────────────────────────────────────────
  //
  // Все три: no-op при `state.chart === null` (не throw), идемпотентны,
  // ограничены группой `drawing_tools` (не трогают чужие overlays), после
  // успеха обновляют локальный snapshot через `refreshOverlaysRef`.

  const removeDrawing = useCallback(
    (id: string) => {
      // groupId в filter гарантирует, что при коллизии id с чужим overlay
      // (orderLine, alertLine и т.п.) последний не будет удалён.
      state.chart?.removeOverlay({ id, groupId: DRAWING_GROUP_ID });
      refreshOverlaysRef.current();
    },
    [state.chart],
  );

  const setDrawingVisible = useCallback(
    (id: string, visible: boolean) => {
      state.chart?.overrideOverlay({ id, visible });
      refreshOverlaysRef.current();
    },
    [state.chart],
  );

  const setDrawingLocked = useCallback(
    (id: string, locked: boolean) => {
      state.chart?.overrideOverlay({ id, lock: locked });
      refreshOverlaysRef.current();
    },
    [state.chart],
  );

  return {
    categories,
    activeTool,
    magnetMode,
    isLocked,
    isVisible,
    autoRetrigger,
    overlays,
    selectTool,
    clearActiveTool,
    setMagnetMode,
    toggleLock,
    toggleVisibility,
    removeAllDrawings,
    setAutoRetrigger,
    removeDrawing,
    setDrawingVisible,
    setDrawingLocked,
  };
}
