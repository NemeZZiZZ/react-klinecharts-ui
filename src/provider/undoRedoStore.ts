import type { UndoRedoAction, UndoRedoStore } from "./types";

const EMPTY: UndoRedoAction[] = [];

/**
 * Provider-owned undo/redo history.
 *
 * The stacks used to live in `useUndoRedo`'s own `useState`, which meant every
 * mounted instance had a private history — but the provider's recording slot
 * (`undoRedoListenerRef`) and the hotkeys are single-slot, so only the owning
 * instance ever received actions and every other consumer permanently reported
 * `canUndo === false` (and its `undo()` popped an empty stack). The history is
 * a property of the chart, not of a hook instance, so it belongs to the
 * provider: one store, subscribed to by every instance through
 * `useSyncExternalStore`.
 */
export function createUndoRedoStore(): UndoRedoStore {
  let undo: UndoRedoAction[] = EMPTY;
  let redo: UndoRedoAction[] = EMPTY;
  // Re-entrancy guard: undo/redo mutate the chart, which can synchronously
  // push follow-up actions (and rapid key auto-repeat can re-enter within one
  // frame). Shared (not per-instance) so a stack owned by the provider cannot
  // be recorded into by a different instance mid-undo.
  let processing = false;
  const listeners = new Set<() => void>();

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getUndoStack: () => undo,
    getRedoStack: () => redo,
    pushAction(action) {
      if (processing) return; // ignore actions caused by undo/redo itself
      undo = [...undo, action];
      redo = EMPTY;
      emit();
    },
    // The mutators below deliberately do NOT notify: undo()/redo() apply a
    // batch of them and call `notify()` once at the end, so subscribers see a
    // single consistent update instead of intermediate states.
    popUndo() {
      if (undo.length === 0) return undefined;
      const action = undo[undo.length - 1];
      undo = undo.slice(0, -1);
      return action;
    },
    popRedo() {
      if (redo.length === 0) return undefined;
      const action = redo[redo.length - 1];
      redo = redo.slice(0, -1);
      return action;
    },
    appendUndo(action) {
      undo = [...undo, action];
    },
    appendRedo(action) {
      redo = [...redo, action];
    },
    clear() {
      if (undo.length === 0 && redo.length === 0) return;
      undo = EMPTY;
      redo = EMPTY;
      emit();
    },
    notify: emit,
    beginProcessing() {
      if (processing) return false;
      processing = true;
      return true;
    },
    endProcessing() {
      processing = false;
    },
  };
}
