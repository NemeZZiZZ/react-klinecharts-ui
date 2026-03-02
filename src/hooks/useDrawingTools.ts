import { useState, useCallback, useMemo } from "react";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";
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
  selectTool: (name: string) => void;
  clearActiveTool: () => void;
  setMagnetMode: (mode: MagnetMode) => void;
  toggleLock: () => void;
  toggleVisibility: () => void;
  removeAllDrawings: () => void;
}

export function useDrawingTools(): UseDrawingToolsReturn {
  const { state } = useKlinechartsUI();
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [magnetMode, setMagnetModeState] = useState<MagnetMode>("normal");
  const [isLocked, setIsLocked] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

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

  const selectTool = useCallback(
    (name: string) => {
      setActiveTool(name);
      state.chart?.createOverlay({
        name,
        groupId: DRAWING_GROUP_ID,
        lock: isLocked,
        visible: isVisible,
        mode:
          magnetMode === "strong"
            ? "strong_magnet"
            : magnetMode === "weak"
              ? "weak_magnet"
              : "normal" as any,
      });
    },
    [state.chart, isLocked, isVisible, magnetMode]
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
    state.chart?.removeOverlay({ groupId: DRAWING_GROUP_ID });
    setActiveTool(null);
  }, [state.chart]);

  return {
    categories,
    activeTool,
    magnetMode,
    isLocked,
    isVisible,
    selectTool,
    clearActiveTool,
    setMagnetMode,
    toggleLock,
    toggleVisibility,
    removeAllDrawings,
  };
}
