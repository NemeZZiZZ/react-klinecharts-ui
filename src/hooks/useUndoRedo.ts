import { useState, useCallback, useEffect, useRef } from "react";
import { useKlinechartsUI, useKlinechartsUIDispatch } from "../provider/ChartTerminalContext";
import type { UndoRedoInstance, UndoRedoListener } from "../provider/types";

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
  const { undoRedoListenerRef, undoRedoInstancesRef } = useKlinechartsUIDispatch();
  const [undoStack, setUndoStack] = useState<UndoRedoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoRedoAction[]>([]);
  const isProcessingRef = useRef(false);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  // Ref mirrors of the stacks so undo()/redo() read the CURRENT top element at
  // call time. Without these, rapid key auto-repeat could invoke a stale
  // closure twice in one frame and apply the SAME action's side effects twice.
  const undoStackRef = useRef<UndoRedoAction[]>([]);
  const redoStackRef = useRef<UndoRedoAction[]>([]);
  useEffect(() => {
    undoStackRef.current = undoStack;
  }, [undoStack]);
  useEffect(() => {
    redoStackRef.current = redoStack;
  }, [redoStack]);

  const pushAction = useCallback((action: UndoRedoAction) => {
    if (isProcessingRef.current) return; // skip actions triggered by undo/redo itself
    setUndoStack((prev) => [...prev, action]);
    setRedoStack([]);
  }, []);

  // NOTE: provider-listener registration and hotkey ownership live further
  // down, next to the keyboard effect — they need undo/redo to exist first.

  const clear = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    // Read the CURRENT stack via the ref mirror and guard re-entry so rapid
    // key auto-repeat within one frame cannot pop the same action twice.
    const stack = undoStackRef.current;
    if (stack.length === 0 || !state.chart || isProcessingRef.current)
      return;
    isProcessingRef.current = true;

    const action = stack[stack.length - 1];
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
          // Zip in the loop: createOverlay returns null when the overlay
          // template is not registered, and the previous map-by-index put
          // undefined ids into the redo payload — redo then called
          // removeOverlay({ id: undefined }), an empty filter that matches
          // EVERY overlay in the chart (including alert/order lines).
          const restored: Array<Record<string, unknown> & { id: string }> = [];
          for (const overlay of overlays) {
            const newId = state.chart.createOverlay({
              ...overlay,
              groupId: DRAWING_GROUP_ID,
            });
            if (typeof newId === "string") {
              restored.push({ ...overlay, id: newId });
            }
          }
          setRedoStack((prev) => [
            ...prev,
            {
              type: "overlays_removed",
              data: { overlays: restored },
            },
          ]);
          break;
        }
        case "indicator_toggled": {
          const { name, wasActive, isMain, paneId, yAxisId, calcParams, visible, styles } = action.data;
          const id = isMain ? `main_${name}` : `sub_${name}`;
          if (wasActive) {
            // It was active before, so re-add it (preserving its axis binding).
            if (isMain) {
              state.chart.createIndicator(
                {
                  name,
                  id,
                  paneId: "candle_pane",
                  ...(yAxisId ? { yAxisId } : {}),
                  ...(calcParams ? { calcParams } : {}),
                  ...(styles ? { styles } : {}),
                  ...(visible === false ? { visible: false } : {}),
                },
                true,
              );
              dispatch({
                type: "SET_MAIN_INDICATORS",
                indicators: [...state.mainIndicators, name],
              });
            } else {
              state.chart.createIndicator(
                {
                  name,
                  id,
                  ...(yAxisId ? { yAxisId } : {}),
                  ...(calcParams ? { calcParams } : {}),
                  ...(styles ? { styles } : {}),
                  ...(visible === false ? { visible: false } : {}),
                },
                false,
              );
              const newPaneId =
                state.chart.getIndicators({ id })?.[0]?.paneId ?? "";
              dispatch({
                type: "SET_SUB_INDICATORS",
                indicators: {
                  ...state.subIndicators,
                  [name]: newPaneId,
                },
              });
            }
            if (yAxisId) {
              dispatch({
                type: "SET_INDICATOR_AXES",
                axes: { ...state.indicatorAxes, [id]: yAxisId },
              });
            }
            if (visible === false) {
              // Mirror the restored hidden state into the sparse visibility
              // map so isIndicatorVisible agrees with the chart.
              dispatch({
                type: "SET_INDICATOR_VISIBILITY",
                visibility: { ...state.indicatorVisibility, [id]: false },
              });
            }
          } else {
            // It was not active before, so remove it
            state.chart.removeIndicator({ id });
            if (isMain) {
              dispatch({
                type: "SET_MAIN_INDICATORS",
                indicators: state.mainIndicators.filter(
                  (n) => n !== name,
                ),
              });
            } else {
              const newSub = { ...state.subIndicators };
              delete newSub[name];
              dispatch({
                type: "SET_SUB_INDICATORS",
                indicators: newSub,
              });
            }
            if (state.indicatorAxes[id]) {
              const nextAxes = { ...state.indicatorAxes };
              delete nextAxes[id];
              dispatch({ type: "SET_INDICATOR_AXES", axes: nextAxes });
            }
            if (id in state.indicatorVisibility) {
              // Mirror removeMain/removeSubIndicator: the re-add path above
              // can write [id]: false into the sparse map; drop it on remove
              // so a later fresh add starts clean.
              const nextVisibility = { ...state.indicatorVisibility };
              delete nextVisibility[id];
              dispatch({
                type: "SET_INDICATOR_VISIBILITY",
                visibility: nextVisibility,
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
                yAxisId,
                calcParams,
                visible,
                styles,
              },
            },
          ]);
          break;
        }
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [state.chart, state.mainIndicators, state.subIndicators, state.indicatorAxes, state.indicatorVisibility, dispatch]);

  const redo = useCallback(() => {
    // Read the CURRENT stack via the ref mirror (see undo for rationale).
    const stack = redoStackRef.current;
    if (stack.length === 0 || !state.chart || isProcessingRef.current)
      return;
    isProcessingRef.current = true;

    const action = stack[stack.length - 1];
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
            // Defense in depth: a payload entry without a valid id must never
            // reach removeOverlay — an empty filter matches every overlay.
            if (typeof (overlay as { id?: unknown }).id !== "string") continue;
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
          const { name, wasActive, isMain, paneId, yAxisId, calcParams, visible, styles } = action.data;
          const id = isMain ? `main_${name}` : `sub_${name}`;
          if (wasActive) {
            if (isMain) {
              state.chart.createIndicator(
                {
                  name,
                  id,
                  paneId: "candle_pane",
                  ...(yAxisId ? { yAxisId } : {}),
                  ...(calcParams ? { calcParams } : {}),
                  ...(styles ? { styles } : {}),
                  ...(visible === false ? { visible: false } : {}),
                },
                true,
              );
              dispatch({
                type: "SET_MAIN_INDICATORS",
                indicators: [...state.mainIndicators, name],
              });
            } else {
              state.chart.createIndicator(
                {
                  name,
                  id,
                  ...(yAxisId ? { yAxisId } : {}),
                  ...(calcParams ? { calcParams } : {}),
                  ...(styles ? { styles } : {}),
                  ...(visible === false ? { visible: false } : {}),
                },
                false,
              );
              const newPaneId =
                state.chart.getIndicators({ id })?.[0]?.paneId ?? "";
              dispatch({
                type: "SET_SUB_INDICATORS",
                indicators: {
                  ...state.subIndicators,
                  [name]: newPaneId,
                },
              });
            }
            if (yAxisId) {
              dispatch({
                type: "SET_INDICATOR_AXES",
                axes: { ...state.indicatorAxes, [id]: yAxisId },
              });
            }
            if (visible === false) {
              // Mirror the restored hidden state into the sparse visibility
              // map so isIndicatorVisible agrees with the chart.
              dispatch({
                type: "SET_INDICATOR_VISIBILITY",
                visibility: { ...state.indicatorVisibility, [id]: false },
              });
            }
          } else {
            state.chart.removeIndicator({ id });
            if (isMain) {
              dispatch({
                type: "SET_MAIN_INDICATORS",
                indicators: state.mainIndicators.filter(
                  (n) => n !== name,
                ),
              });
            } else {
              const newSub = { ...state.subIndicators };
              delete newSub[name];
              dispatch({
                type: "SET_SUB_INDICATORS",
                indicators: newSub,
              });
            }
            if (state.indicatorAxes[id]) {
              const nextAxes = { ...state.indicatorAxes };
              delete nextAxes[id];
              dispatch({ type: "SET_INDICATOR_AXES", axes: nextAxes });
            }
            if (id in state.indicatorVisibility) {
              // Mirror removeMain/removeSubIndicator: the re-add path above
              // can write [id]: false into the sparse map; drop it on remove
              // so a later fresh add starts clean.
              const nextVisibility = { ...state.indicatorVisibility };
              delete nextVisibility[id];
              dispatch({
                type: "SET_INDICATOR_VISIBILITY",
                visibility: nextVisibility,
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
                paneId,
                yAxisId,
                calcParams,
                visible,
                styles,
              },
            },
          ]);
          break;
        }
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [state.chart, state.mainIndicators, state.subIndicators, state.indicatorAxes, state.indicatorVisibility, dispatch]);

  // Stable per-instance handle in the provider's registry. Fields are kept
  // current on every render so the registry always calls fresh closures.
  const instanceHandleRef = useRef<UndoRedoInstance | null>(null);
  if (instanceHandleRef.current === null) {
    instanceHandleRef.current = {
      pushAction: pushAction as unknown as UndoRedoListener,
      undo,
      redo,
    };
  }
  useEffect(() => {
    instanceHandleRef.current!.pushAction = pushAction as unknown as UndoRedoListener;
    instanceHandleRef.current!.undo = undo;
    instanceHandleRef.current!.redo = redo;
  });

  // Multi-instance ownership: only the FIRST mounted instance claims the
  // single-slot provider listener and answers the global hotkeys. The old
  // registration was last-writer-wins — with two instances mounted, one stack
  // recorded actions while BOTH instances hijacked Ctrl+Z (each driving its
  // own stack: one keystroke, two undos), and any instance unmounting nulled
  // the shared ref, silently stopping recording for the survivor. When the
  // owner unmounts, the next instance in the registry is promoted
  // automatically. The registry is per-provider, so independent charts each
  // get their own owner.
  useEffect(() => {
    const handle = instanceHandleRef.current!;
    const registry = undoRedoInstancesRef.current;
    registry.push(handle);
    const syncOwner = () => {
      undoRedoListenerRef.current = registry[0]?.pushAction ?? null;
    };
    syncOwner();
    return () => {
      const idx = registry.indexOf(handle);
      if (idx !== -1) registry.splice(idx, 1);
      syncOwner();
    };
  }, [undoRedoListenerRef, undoRedoInstancesRef]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only the owning instance answers — with several instances mounted a
      // single Ctrl+Z would otherwise drive every stack at once.
      if (undoRedoInstancesRef.current[0] !== instanceHandleRef.current) return;

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      if (!isCtrlOrMeta) return;

      // Don't hijack native text undo/redo: typing in a symbol search, layout
      // rename, indicator params or the script editor must keep the browser's
      // own Ctrl+Z/Ctrl+Y instead of removing drawings from the chart.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

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
  }, [undo, redo, undoRedoInstancesRef]);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    pushAction,
    clear,
  };
}
