import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useSyncExternalStore,
} from "react";
import { useKlinechartsUI, useKlinechartsUIDispatch } from "../provider/ChartTerminalContext";
import { DRAWING_CATEGORIES, type MagnetMode } from "../data/drawings";
import {
  DRAWING_GROUP_ID,
  type DrawingOverlayInfo,
} from "../provider/drawingOverlays";
import type { SharedState } from "../provider/types";

// `DrawingOverlayInfo` moved to the provider (the overlay snapshot is shared by
// every hook instance, so its type lives next to the store that owns it).
// Re-exported so existing `import { type DrawingOverlayInfo } from
// "react-klinecharts-ui"` keeps working.
export type { DrawingOverlayInfo };

export interface DrawingToolItem {
  name: string;
  localeKey: string;
}

export interface DrawingCategoryItem {
  key: string;
  tools: DrawingToolItem[];
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

export function useDrawingTools(): UseDrawingToolsReturn {
  const { state } = useKlinechartsUI();
  const {
    undoRedoListenerRef,
    drawingOverlaysStore,
    subscribeDrawingOverlays,
    refreshDrawingOverlays,
  } = useKlinechartsUIDispatch();
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
  // рисунков выкачивается из `chart.getOverlays({ groupId })`. Сам список
  // живёт в ПРОВАЙДЕРЕ (`drawingOverlaysStore`) и опрашивается ОДНИМ
  // интервалом на чарт, который работает пока смонтирован хотя бы один
  // потребитель — раньше каждый экземпляр хука держал свой setInterval и
  // N тулбаров означали N getOverlays() в секунду.
  //
  // Точечные обновления (после create/remove/override в любом хуке) делаются
  // через `refreshDrawingOverlays()` — тот же путь, что и polling.
  const overlaysStore = drawingOverlaysStore as unknown as SharedState<
    DrawingOverlayInfo[]
  >;
  const overlays = useSyncExternalStore(
    overlaysStore.subscribe,
    overlaysStore.get,
    overlaysStore.get,
  );

  // Indirection ref (тот же паттерн, что `createOverlayForToolRef`): позволяет
  // долгоживущим замыканиям (onDrawEnd) и batch-операциям дернуть актуальный
  // refresh без добавления его в их dep-массивы.
  const refreshOverlaysRef = useRef<() => void>(() => {});
  useEffect(() => {
    refreshOverlaysRef.current = refreshDrawingOverlays;
  }, [refreshDrawingOverlays]);

  // Держим провайдерский polling включённым, пока смонтирован этот хук
  // (refcount в провайдере: первый подписчик запускает интервал, последний
  // unsubscribe — останавливает).
  useEffect(() => subscribeDrawingOverlays(), [subscribeDrawingOverlays]);
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

  // Pending auto-retrigger frame. Tracked so it can be cancelled on unmount /
  // tool switch — an orphaned frame used to create an overlay after the hook
  // (or the chart) was already gone.
  const autoRetriggerRafRef = useRef<number | null>(null);
  const cancelAutoRetrigger = useCallback(() => {
    if (autoRetriggerRafRef.current !== null) {
      cancelAnimationFrame(autoRetriggerRafRef.current);
      autoRetriggerRafRef.current = null;
    }
  }, []);
  useEffect(() => cancelAutoRetrigger, [cancelAutoRetrigger]);

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
                // lock/visible/mode ride along so undo/redo re-creates the
                // overlay with the flags it had at draw time (a shape drawn
                // while the tool was locked came back unlocked otherwise).
                lock: o.lock,
                visible: o.visible,
                mode: o.mode,
              },
            },
          });
          // Новый overlay уже добавлен в chart синхронно до onDrawEnd —
          // обновляем snapshot, чтобы потребитель увидел его сразу.
          refreshOverlaysRef.current();
          // Auto-retrigger: immediately start another overlay of the same type
          if (autoRetriggerRef.current && activeToolRef.current === name) {
            cancelAutoRetrigger();
            autoRetriggerRafRef.current = requestAnimationFrame(() => {
              autoRetriggerRafRef.current = null;
              createOverlayForToolRef.current(name);
            });
          }
        },
      });
    },
    [state.chart, undoRedoListenerRef, cancelAutoRetrigger],
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
    // Drop a queued auto-retrigger: it would start a new overlay for a tool
    // the user just deselected.
    cancelAutoRetrigger();
  }, [cancelAutoRetrigger]);

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
        // Same trio as in onDrawEnd — undo restores the drawings with their
        // lock/visible/mode instead of silently resetting them.
        lock: o.lock,
        visible: o.visible,
        mode: o.mode,
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
      // groupId в filter — как в removeDrawing: при коллизии id с чужим
      // overlay (orderLine, alertLine) overrideOverlay без группы переключил
      // бы НЕ тот объект.
      state.chart?.overrideOverlay({ id, groupId: DRAWING_GROUP_ID, visible });
      refreshOverlaysRef.current();
    },
    [state.chart],
  );

  const setDrawingLocked = useCallback(
    (id: string, locked: boolean) => {
      state.chart?.overrideOverlay({ id, groupId: DRAWING_GROUP_ID, lock: locked });
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
