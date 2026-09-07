import { describe, it, expect, vi } from "vitest";
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
  it("shares ONE history: a non-owner instance sees the owner's actions", () => {
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
    act(() => bRef.current!.pushAction(action));
    // Regression: every instance used to own a private stack, so only the
    // instance that recorded the action could see it — B reported
    // canUndo === false and its undo() popped nothing.
    expect(aRef.current!.canUndo).toBe(true);
    expect(bRef.current!.canUndo).toBe(true);
    act(() => aRef.current!.clear());
    expect(bRef.current!.canUndo).toBe(false);
  });

  it("one Ctrl+Z pops exactly ONE action from the shared history", () => {
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

    act(() => {
      aRef.current!.pushAction({ type: "overlay_added", data: { id: "1" } });
      aRef.current!.pushAction({ type: "overlay_added", data: { id: "2" } });
    });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }),
      );
    });
    // Two entries in, one out — a single keystroke must never drain two.
    expect(aRef.current!.canUndo).toBe(true);
    expect(bRef.current!.canUndo).toBe(true);
    expect(aRef.current!.canRedo).toBe(true);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }),
      );
    });
    expect(aRef.current!.canUndo).toBe(false);
    expect(bRef.current!.canUndo).toBe(false);
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

  it("clears the history when the symbol changes (#20)", () => {
    const { result } = renderHookWithProvider(() => {
      const undoRedo = useUndoRedo();
      const { dispatch } = useKlinechartsUIDispatch();
      return { ...undoRedo, dispatch };
    });
    act(() => {
      result.current.pushAction({
        type: "overlay_added",
        data: { id: "x", overlayData: { name: "segment", points: [] } },
      });
    });
    expect(result.current.canUndo).toBe(true);

    // A symbol switch invalidates every recorded entry: the overlays they
    // reference are gone with the reloaded data, so undo would remove nothing
    // (or, worse, a same-id overlay of the new symbol).
    act(() => {
      result.current.dispatch({
        type: "SET_SYMBOL",
        symbol: { ticker: "BTCUSDT" },
      } as unknown as KlinechartsUIAction);
    });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("redo of overlay_added restores lock/visible/mode (#21)", () => {
    const { result, chart } = renderHookWithProvider(() => useUndoRedo());
    act(() => {
      result.current.pushAction({
        type: "overlay_added",
        data: {
          id: "x",
          overlayData: {
            name: "segment",
            points: [],
            lock: true,
            visible: false,
            mode: "strong_magnet",
          },
        },
      });
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });

    // Regression: only name/points/styles survived, so the recreated drawing
    // came back unlocked and visible even though the user had locked/hidden it.
    const payload = (chart.createOverlay as ReturnType<typeof vi.fn>).mock
      .calls.at(-1)![0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      lock: true,
      visible: false,
      mode: "strong_magnet",
    });
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
