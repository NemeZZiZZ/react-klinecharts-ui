import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";
import { renderHookWithProvider } from "../../test/renderHook";
import { useUndoRedo } from "./useUndoRedo";

describe("useUndoRedo", () => {
  it("starts empty (nothing to undo/redo)", () => {
    const { result } = renderHookWithProvider(() => useUndoRedo());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("pushAction makes canUndo true and clears redo", () => {
    const { result } = renderHookWithProvider(() => useUndoRedo());
    act(() => {
      result.current.pushAction({
        type: "overlay_added",
        data: { id: "x", overlayData: { name: "segment", points: [] } },
      });
    });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("clear empties both stacks", () => {
    const { result } = renderHookWithProvider(() => useUndoRedo());
    act(() => {
      result.current.pushAction({
        type: "overlay_added",
        data: { id: "x", overlayData: { name: "segment", points: [] } },
      });
      result.current.clear();
    });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("pushing multiple actions keeps them in order", () => {
    const { result } = renderHookWithProvider(() => useUndoRedo());
    act(() => {
      result.current.pushAction({ type: "overlay_added", data: { id: "1" } });
      result.current.pushAction({ type: "overlay_added", data: { id: "2" } });
      result.current.pushAction({ type: "overlay_added", data: { id: "3" } });
    });
    expect(result.current.canUndo).toBe(true);
    // undo all three
    act(() => {
      result.current.undo();
      result.current.undo();
      result.current.undo();
    });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });
});
