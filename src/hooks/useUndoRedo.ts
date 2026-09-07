import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useKlinechartsUI, useKlinechartsUIDispatch } from "../provider/ChartTerminalContext";
import type {
  UndoRedoAction,
  UndoRedoInstance,
  UndoRedoListener,
} from "../provider/types";

// The action types live in provider/types.ts (the provider-owned undo/redo
// store is typed in terms of them) and are re-exported here for the public API.
export type { UndoRedoAction, UndoRedoActionType } from "../provider/types";

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
 * The history is owned by the provider (`undoRedoStoreRef`), so every instance
 * mounted under one provider shares the same stacks — instance #2 used to keep
 * its own empty copy forever, because only the owning instance receives
 * recorded actions and the hotkeys.
 *
 * Keyboard shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z) are wired once by the
 * provider and drive the owning instance.
 */
export function useUndoRedo(): UseUndoRedoReturn {
  const { state, dispatch } = useKlinechartsUI();
  const { undoRedoListenerRef, undoRedoInstancesRef, undoRedoStoreRef } =
    useKlinechartsUIDispatch();
  const store = undoRedoStoreRef.current;
  const undoStack = useSyncExternalStore(
    store.subscribe,
    store.getUndoStack,
    store.getUndoStack,
  );
  const redoStack = useSyncExternalStore(
    store.subscribe,
    store.getRedoStack,
    store.getRedoStack,
  );

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  const pushAction = useCallback(
    (action: UndoRedoAction) => {
      store.pushAction(action);
    },
    [store],
  );

  // NOTE: provider-listener registration lives further down — it needs
  // undo/redo to exist first.

  const clear = useCallback(() => {
    store.clear();
  }, [store]);

  const undo = useCallback(() => {
    if (!state.chart) return;
    // Guard re-entry (shared with every instance) so rapid key auto-repeat
    // within one frame cannot pop the same action twice.
    if (!store.beginProcessing()) return;
    const action = store.popUndo();
    if (!action) {
      store.endProcessing();
      return;
    }

    try {
      switch (action.type) {
        case "overlay_added": {
          // Remove the overlay that was added
          const { id, overlayData } = action.data;
          state.chart.removeOverlay({ id });
          store.appendRedo({
            type: "overlay_added",
            data: { id, overlayData },
          });
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
          store.appendRedo({
            type: "overlays_removed",
            data: { overlays: restored },
          });
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
          store.appendRedo({
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
          });
          break;
        }
      }
    } finally {
      // One notification for the whole batch (pop + push), so subscribers
      // never render an intermediate state.
      store.endProcessing();
      store.notify();
    }
  }, [state.chart, state.mainIndicators, state.subIndicators, state.indicatorAxes, state.indicatorVisibility, dispatch, store]);

  const redo = useCallback(() => {
    if (!state.chart) return;
    // Guard re-entry (see undo for rationale).
    if (!store.beginProcessing()) return;
    const action = store.popRedo();
    if (!action) {
      store.endProcessing();
      return;
    }

    try {
      switch (action.type) {
        case "overlay_added": {
          // Re-create the overlay
          const { overlayData } = action.data;
          const newId = state.chart.createOverlay({
            ...overlayData,
            groupId: DRAWING_GROUP_ID,
          });
          store.appendUndo({
            type: "overlay_added",
            data: {
              id: typeof newId === "string" ? newId : action.data.id,
              overlayData,
            },
          });
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
                  // Re-snapshot the flags too, so a second undo/redo cycle does
                  // not silently unlock/unhide the restored drawings.
                  lock: actual.lock,
                  visible: actual.visible,
                  mode: actual.mode,
                }
              : o;
          });
          for (const overlay of overlays) {
            // Defense in depth: a payload entry without a valid id must never
            // reach removeOverlay — an empty filter matches every overlay.
            if (typeof (overlay as { id?: unknown }).id !== "string") continue;
            state.chart.removeOverlay({ id: overlay.id });
          }
          store.appendUndo({
            type: "overlays_removed",
            data: { overlays: snapshotOverlays },
          });
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
          store.appendUndo({
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
          });
          break;
        }
      }
    } finally {
      // One notification for the whole batch (see undo).
      store.endProcessing();
      store.notify();
    }
  }, [state.chart, state.mainIndicators, state.subIndicators, state.indicatorAxes, state.indicatorVisibility, dispatch, store]);

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

  // Multi-instance ownership: the FIRST mounted instance claims the single-slot
  // provider listener (`undoRedoListenerRef`) and is the one the provider's
  // global hotkeys drive. The old registration was last-writer-wins — with two
  // instances mounted, one stack recorded actions while BOTH instances hijacked
  // Ctrl+Z (each driving its own stack: one keystroke, two undos), and any
  // instance unmounting nulled the shared ref, silently stopping recording for
  // the survivor. When the owner unmounts, the next instance in the registry is
  // promoted automatically. The registry is per-provider, so independent charts
  // each get their own owner.
  //
  // Ownership now only decides WHO answers; the history they all read and write
  // is the provider's shared store, so a non-owner instance still reports the
  // real canUndo/canRedo and undoes the real last action.
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

  // NOTE: the Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z shortcuts are wired once by the
  // provider (one window listener per chart, driving registry[0]). Per-instance
  // listeners used to mean N handlers of which N-1 immediately bailed out.

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    pushAction,
    clear,
  };
}
