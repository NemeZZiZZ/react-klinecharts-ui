import { useState, useCallback, useEffect, useRef } from "react";
import { useKlinechartsUI, useKlinechartsUIDispatch } from "../provider/ChartTerminalContext";

export type UndoRedoActionType =
  | "overlay_added"
  | "overlays_removed"
  | "indicator_toggled";

export interface UndoRedoAction {
  type: UndoRedoActionType;
  /** Snapshot data needed to undo/redo this action */
  data: any;
}

export interface UseUndoRedoReturn {
  /** Whether there are actions to undo */
  canUndo: boolean;
  /** Whether there are actions to redo */
  canRedo: boolean;
  /** Undo the last action */
  undo: () => void;
  /** Redo the last undone action */
  redo: () => void;
  /** Push a new action onto the undo stack (clears redo stack) */
  pushAction: (action: UndoRedoAction) => void;
  /** Clear all undo/redo history */
  clear: () => void;
}

const DRAWING_GROUP_ID = "drawing_tools";

/**
 * Headless hook for undo/redo of drawing overlays and indicator toggles.
 *
 * Supports keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y / Ctrl+Shift+Z (redo).
 */
export function useUndoRedo(): UseUndoRedoReturn {
  const { state, dispatch } = useKlinechartsUI();
  const { undoRedoListenerRef } = useKlinechartsUIDispatch();
  const [undoStack, setUndoStack] = useState<UndoRedoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoRedoAction[]>([]);
  const isProcessingRef = useRef(false);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  const pushAction = useCallback((action: UndoRedoAction) => {
    if (isProcessingRef.current) return; // skip actions triggered by undo/redo itself
    setUndoStack((prev) => [...prev, action]);
    setRedoStack([]);
  }, []);

  // Register pushAction so other hooks (useDrawingTools, useIndicators) can call it.
  useEffect(() => {
    undoRedoListenerRef.current = pushAction as any;
    return () => { undoRedoListenerRef.current = null; };
  }, [pushAction, undoRedoListenerRef]);

  const clear = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0 || !state.chart || isProcessingRef.current)
      return;
    isProcessingRef.current = true;

    const action = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    try {
      switch (action.type) {
        case "overlay_added": {
          // Remove the overlay that was added
          const { id, overlayData } = action.data;
          state.chart.removeOverlay({ id });
          setRedoStack((prev) => [
            ...prev,
            {
              type: "overlay_added",
              data: { id, overlayData },
            },
          ]);
          break;
        }
        case "overlays_removed": {
          // Restore all overlays that were removed
          const { overlays } = action.data;
          const restoredIds: string[] = [];
          for (const overlay of overlays) {
            const newId = state.chart.createOverlay({
              ...overlay,
              groupId: DRAWING_GROUP_ID,
            });
            if (typeof newId === "string") {
              restoredIds.push(newId);
            }
          }
          setRedoStack((prev) => [
            ...prev,
            {
              type: "overlays_removed",
              data: {
                overlays: overlays.map((o: any, i: number) => ({
                  ...o,
                  id: restoredIds[i],
                })),
              },
            },
          ]);
          break;
        }
        case "indicator_toggled": {
          const { name, wasActive, isMain, paneId } = action.data;
          if (wasActive) {
            // It was active before, so re-add it
            if (isMain) {
              state.chart.createIndicator(
                { name, id: `main_${name}`, paneId: "candle_pane" },
                true,
                { id: "candle_pane" },
              );
              dispatch({
                type: "SET_MAIN_INDICATORS",
                indicators: [...state.mainIndicators, name],
              });
            } else {
              state.chart.createIndicator({ name, id: `sub_${name}` });
              const newPaneId =
                state.chart.getIndicators({ id: `sub_${name}` })?.[0]
                  ?.paneId ?? "";
              dispatch({
                type: "SET_SUB_INDICATORS",
                indicators: {
                  ...state.subIndicators,
                  [name]: newPaneId,
                },
              });
            }
          } else {
            // It was not active before, so remove it
            if (isMain) {
              state.chart.removeIndicator({ id: `main_${name}` });
              dispatch({
                type: "SET_MAIN_INDICATORS",
                indicators: state.mainIndicators.filter(
                  (n) => n !== name,
                ),
              });
            } else {
              state.chart.removeIndicator({ id: `sub_${name}` });
              const newSub = { ...state.subIndicators };
              delete newSub[name];
              dispatch({
                type: "SET_SUB_INDICATORS",
                indicators: newSub,
              });
            }
          }
          setRedoStack((prev) => [
            ...prev,
            {
              type: "indicator_toggled",
              data: {
                name,
                wasActive: !wasActive,
                isMain,
                paneId,
              },
            },
          ]);
          break;
        }
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [undoStack, state.chart, state.mainIndicators, state.subIndicators, dispatch]);

  const redo = useCallback(() => {
    if (redoStack.length === 0 || !state.chart || isProcessingRef.current)
      return;
    isProcessingRef.current = true;

    const action = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));

    try {
      switch (action.type) {
        case "overlay_added": {
          // Re-create the overlay
          const { overlayData } = action.data;
          const newId = state.chart.createOverlay({
            ...overlayData,
            groupId: DRAWING_GROUP_ID,
          });
          setUndoStack((prev) => [
            ...prev,
            {
              type: "overlay_added",
              data: {
                id: typeof newId === "string" ? newId : action.data.id,
                overlayData,
              },
            },
          ]);
          break;
        }
        case "overlays_removed": {
          // Remove all the restored overlays
          const { overlays } = action.data;
          const snapshotOverlays = overlays.map((o: any) => {
            const allOverlays = state.chart?.getOverlays({ id: o.id });
            const actual = allOverlays?.[0];
            return actual
              ? {
                  name: actual.name,
                  points: actual.points,
                  styles: actual.styles,
                  extendData: actual.extendData,
                }
              : o;
          });
          for (const overlay of overlays) {
            state.chart.removeOverlay({ id: overlay.id });
          }
          setUndoStack((prev) => [
            ...prev,
            {
              type: "overlays_removed",
              data: { overlays: snapshotOverlays },
            },
          ]);
          break;
        }
        case "indicator_toggled": {
          const { name, wasActive, isMain } = action.data;
          if (wasActive) {
            if (isMain) {
              state.chart.createIndicator(
                { name, id: `main_${name}`, paneId: "candle_pane" },
                true,
                { id: "candle_pane" },
              );
              dispatch({
                type: "SET_MAIN_INDICATORS",
                indicators: [...state.mainIndicators, name],
              });
            } else {
              state.chart.createIndicator({ name, id: `sub_${name}` });
              const newPaneId =
                state.chart.getIndicators({ id: `sub_${name}` })?.[0]
                  ?.paneId ?? "";
              dispatch({
                type: "SET_SUB_INDICATORS",
                indicators: {
                  ...state.subIndicators,
                  [name]: newPaneId,
                },
              });
            }
          } else {
            if (isMain) {
              state.chart.removeIndicator({ id: `main_${name}` });
              dispatch({
                type: "SET_MAIN_INDICATORS",
                indicators: state.mainIndicators.filter(
                  (n) => n !== name,
                ),
              });
            } else {
              state.chart.removeIndicator({ id: `sub_${name}` });
              const newSub = { ...state.subIndicators };
              delete newSub[name];
              dispatch({
                type: "SET_SUB_INDICATORS",
                indicators: newSub,
              });
            }
          }
          setUndoStack((prev) => [
            ...prev,
            {
              type: "indicator_toggled",
              data: {
                name,
                wasActive: !wasActive,
                isMain,
              },
            },
          ]);
          break;
        }
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [redoStack, state.chart, state.mainIndicators, state.subIndicators, dispatch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      if (!isCtrlOrMeta) return;

      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        e.key === "y" ||
        (e.key === "z" && e.shiftKey)
      ) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    pushAction,
    clear,
  };
}
