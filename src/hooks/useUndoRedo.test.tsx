import { describe, it, expect } from "vitest";
import { act, render } from "@testing-library/react";
import { useEffect, type MutableRefObject, type ReactNode } from "react";
import { renderHookWithProvider } from "../../test/renderHook";
import { useUndoRedo } from "./useUndoRedo";
import { KlinechartsUIProvider } from "../provider/ChartTerminalProvider";
import { useKlinechartsUIDispatch } from "../provider/ChartTerminalContext";
import type { UndoRedoListener } from "../provider/types";
import type { Datafeed, KlinechartsUIAction } from "../provider/types";
import { createMockChart } from "../../test/mockChart";

const idleDatafeed: Datafeed = {
  searchSymbols: async () => [],
  getHistoryKLineData: async () => [],
  subscribe: () => {},
  unsubscribe: () => {},
};

/** Registers a mock chart with the provider (mirrors test/renderHook wiring). */
function ChartSlot() {
  const { dispatch } = useKlinechartsUIDispatch();
  useEffect(() => {
    dispatch({ type: "SET_CHART", chart: createMockChart([]) as never } as KlinechartsUIAction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** Child that mounts one useUndoRedo instance and mirrors its result into a ref. */
function UndoRedoSlot({ resultRef }: { resultRef: MutableRefObject<ReturnType<typeof useUndoRedo> | null> }) {
  const value = useUndoRedo();
  useEffect(() => {
    resultRef.current = value;
  });
  return null;
}

/** Child exposing the provider's current undo/redo listener slot into a ref. */
function ListenerProbe({ listenerRef }: { listenerRef: MutableRefObject<UndoRedoListener | null> }) {
  const { undoRedoListenerRef } = useKlinechartsUIDispatch();
  useEffect(() => {
    listenerRef.current = undoRedoListenerRef.current;
  });
  return null;
}

describe("useUndoRedo — multi-instance", () => {
  it("only the first mounted instance answers Ctrl+Z (no double undo)", () => {
    const aRef: MutableRefObject<ReturnType<typeof useUndoRedo> | null> = { current: null };
    const bRef: MutableRefObject<ReturnType<typeof useUndoRedo> | null> = { current: null };
    const feed = idleDatafeed;
    render(
      <KlinechartsUIProvider datafeed={feed}>
        <ChartSlot />
        <UndoRedoSlot resultRef={aRef} />
        <UndoRedoSlot resultRef={bRef} />
      </KlinechartsUIProvider>,
    );

    const action = { type: "overlay_added" as const, data: { id: "x" } };
    act(() => aRef.current!.pushAction(action));
    act(() => bRef.current!.pushAction(action));
    expect(aRef.current!.canUndo).toBe(true);
    expect(bRef.current!.canUndo).toBe(true);

    // One Ctrl+Z must drive exactly ONE stack.
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }),
      );
    });
    const undone = [aRef.current!.canUndo, bRef.current!.canUndo].filter(Boolean).length;
    expect(undone).toBe(1);
  });

  it("promotes the next instance to the listener slot when the owner unmounts", () => {
    const aRef: MutableRefObject<ReturnType<typeof useUndoRedo> | null> = { current: null };
    const bRef: MutableRefObject<ReturnType<typeof useUndoRedo> | null> = { current: null };
    const listenerRef: MutableRefObject<UndoRedoListener | null> = { current: null };
    const feed = idleDatafeed;

    const view = ({ showA }: { showA: boolean }): ReactNode => (
      <KlinechartsUIProvider datafeed={feed}>
        {showA ? <UndoRedoSlot resultRef={aRef} /> : null}
        <UndoRedoSlot resultRef={bRef} />
        <ListenerProbe listenerRef={listenerRef} />
      </KlinechartsUIProvider>
    );

    const { rerender } = render(view({ showA: true }));
    expect(bRef.current!.canUndo).toBe(false);

    // Unmount the owning instance — the survivor must take over the slot
    // instead of being left with recording silently dead.
    rerender(view({ showA: false }));
    act(() => {
      listenerRef.current?.({ type: "overlay_added", data: { id: "y" } });
    });
    expect(bRef.current!.canUndo).toBe(true);
  });
});

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
