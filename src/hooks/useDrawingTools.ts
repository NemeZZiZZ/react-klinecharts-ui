import { useState, useCallback, useMemo, useRef } from "react";
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

export interface UseDrawingToolsReturn {
  categories: DrawingCategoryItem[];
  activeTool: string | null;
  magnetMode: MagnetMode;
  isLocked: boolean;
  isVisible: boolean;
  /** Whether drawing tools auto-retrigger after completing a shape. Default: true. */
  autoRetrigger: boolean;
  selectTool: (name: string) => void;
  clearActiveTool: () => void;
  setMagnetMode: (mode: MagnetMode) => void;
  toggleLock: () => void;
  toggleVisibility: () => void;
  removeAllDrawings: () => void;
  /** Enable/disable auto-retrigger mode. */
  setAutoRetrigger: (enabled: boolean) => void;
}

export function useDrawingTools(): UseDrawingToolsReturn {
  const { state } = useKlinechartsUI();
  const { undoRedoListenerRef } = useKlinechartsUIDispatch();
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [magnetMode, setMagnetModeState] = useState<MagnetMode>("normal");
  const [isLocked, setIsLocked] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [autoRetrigger, setAutoRetrigger] = useState(true);

  // Refs to capture latest state for the onDrawEnd closure
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  const autoRetriggerRef = useRef(autoRetrigger);
  autoRetriggerRef.current = autoRetrigger;
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;
  const isVisibleRef = useRef(isVisible);
  isVisibleRef.current = isVisible;
  const magnetModeRef = useRef(magnetMode);
  magnetModeRef.current = magnetMode;

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
          // Auto-retrigger: immediately start another overlay of the same type
          if (autoRetriggerRef.current && activeToolRef.current === name) {
            requestAnimationFrame(() => {
              createOverlayForTool(name);
            });
          }
        },
      });
    },
    [state.chart, undoRedoListenerRef],
  );

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
  }, [state.chart, undoRedoListenerRef]);

  return {
    categories,
    activeTool,
    magnetMode,
    isLocked,
    isVisible,
    autoRetrigger,
    selectTool,
    clearActiveTool,
    setMagnetMode,
    toggleLock,
    toggleVisibility,
    removeAllDrawings,
    setAutoRetrigger,
  };
}
