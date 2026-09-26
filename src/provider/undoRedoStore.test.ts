import { describe, it, expect } from "vitest";
import { createUndoRedoStore } from "./undoRedoStore";
import type { UndoRedoAction } from "./types";

const action = (id: string): UndoRedoAction => ({
  type: "overlay_added",
  data: { id, overlayData: { name: "segment" } },
});

describe("undoRedoStore — depth cap", () => {
  it("caps the undo stack at 100 entries, dropping the oldest", () => {
    const store = createUndoRedoStore();
    for (let i = 0; i < 120; i++) {
      store.pushAction(action(`a${i}`));
    }
    const stack = store.getUndoStack();
    expect(stack).toHaveLength(100);
    // Oldest 20 dropped; the surviving window is the newest 100.
    expect(stack[0]).toEqual(action("a20"));
    expect(stack[99]).toEqual(action("a119"));
  });

  it("caps appendUndo/appendRedo the same way", () => {
    const store = createUndoRedoStore();
    for (let i = 0; i < 130; i++) {
      store.appendRedo(action(`r${i}`));
    }
    expect(store.getRedoStack()).toHaveLength(100);
    expect(store.getRedoStack()[0]).toEqual(action("r30"));
  });
});
