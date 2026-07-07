import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";
import { renderHookWithProvider } from "../../test/renderHook";
import { useReplay } from "./useReplay";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";
import type { KLineData } from "klinecharts";

const data: KLineData[] = Array.from({ length: 10 }, (_, i) => ({
  timestamp: 1_700_000_000_000 + i * 60_000,
  open: 100 + i,
  high: 101 + i,
  low: 99 + i,
  close: 100.5 + i,
  volume: 1000,
}));

describe("useReplay", () => {
  it("is idle initially", () => {
    const { result } = renderHookWithProvider(() => useReplay(), { initialData: data });
    expect(result.current.isReplaying).toBe(false);
    expect(result.current.barIndex).toBe(0);
    expect(result.current.totalBars).toBe(0);
  });

  it("startReplay captures totalBars and switches to replaying", () => {
    const { result } = renderHookWithProvider(() => useReplay(), { initialData: data });
    act(() => result.current.startReplay());
    expect(result.current.isReplaying).toBe(true);
    expect(result.current.totalBars).toBe(10);
  });

  it("startReplay is a no-op when already replaying (regression: data truncation)", () => {
    const { result, chart } = renderHookWithProvider(() => useReplay(), {
      initialData: data,
    });
    act(() => result.current.startReplay());
    // simulate a few bars replayed → chart data shorter now
    chart.__data.length = 3;
    // calling startReplay again must NOT overwrite the saved buffer with the
    // truncated data; it should bail out.
    act(() => result.current.startReplay());
    // totalBars stays at the original 10, not the truncated 3
    expect(result.current.totalBars).toBe(10);
  });

  it("stopReplay restores the original data and resets state", () => {
    const { result } = renderHookWithProvider(() => useReplay(), { initialData: data });
    act(() => result.current.startReplay());
    act(() => result.current.stopReplay());
    expect(result.current.isReplaying).toBe(false);
    expect(result.current.barIndex).toBe(0);
    expect(result.current.totalBars).toBe(0);
  });

  it("changing symbol mid-replay auto-stops the session (regression: data corruption)", () => {
    // Combine useReplay with the dispatch to change symbol in one hook.
    const { result } = renderHookWithProvider(() => {
      const replay = useReplay();
      const { dispatch } = useKlinechartsUI();
      return { replay, dispatch };
    }, { initialData: data });

    act(() => result.current.replay.startReplay());
    expect(result.current.replay.isReplaying).toBe(true);

    // Change the symbol — the auto-stop effect should fire.
    act(() => {
      result.current.dispatch({
        type: "SET_SYMBOL",
        symbol: { ticker: "ETHUSDT", pricePrecision: 2, volumePrecision: 8 },
      });
    });
    expect(result.current.replay.isReplaying).toBe(false);
  });

  it("seekTo pauses and jumps to the target bar", () => {
    const { result } = renderHookWithProvider(() => useReplay(), { initialData: data });
    act(() => result.current.startReplay());
    act(() => result.current.seekTo(5));
    expect(result.current.isPaused).toBe(true);
    expect(result.current.barIndex).toBe(5);
  });
});
