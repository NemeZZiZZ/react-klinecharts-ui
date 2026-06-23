import { useCallback } from "react";
import {
  useKlinechartsUI,
  useKlinechartsUIDispatch,
} from "../provider/ChartTerminalContext";
import type { ReplaySpeed } from "../provider/featureTypes";

export type { ReplaySpeed } from "../provider/featureTypes";

export interface UseReplayReturn {
  /** Whether a replay session is active */
  isReplaying: boolean;
  /** Whether the replay is currently paused */
  isPaused: boolean;
  /** Current playback speed multiplier */
  speed: ReplaySpeed;
  /** Current bar index in the replay */
  barIndex: number;
  /** Total number of bars in the saved data */
  totalBars: number;
  /** Start replaying from the beginning */
  startReplay: () => void;
  /** Stop replay and restore original data */
  stopReplay: () => void;
  /** Toggle play/pause */
  togglePause: () => void;
  /** Advance one bar while paused */
  stepForward: () => void;
  /** Go back one bar while paused */
  stepBackward: () => void;
  /** Seek to a specific bar index (0-based). Pauses playback. */
  seekTo: (index: number) => void;
  /** Change the playback speed */
  setSpeed: (speed: ReplaySpeed) => void;
}

/**
 * Headless hook for historical data replay (bar-by-bar playback).
 *
 * Loads the current chart data, clears the chart, then progressively adds
 * bars back one at a time at the configured speed.
 *
 * Replay control state lives in the shared provider store and the playback
 * interval + data buffers are owned by the provider (accessed through stable
 * refs). This guarantees a single playback session even when `useReplay()` is
 * mounted in several components (e.g. toolbar + bottom controls + status bar):
 * starting in one and stepping in another drives the same timer and buffer.
 */
export function useReplay(): UseReplayReturn {
  const { state, dispatch } = useKlinechartsUI();
  const { replayIntervalRef, replaySavedDataRef, replayIndexRef } =
    useKlinechartsUIDispatch();

  const { isReplaying, isPaused, speed, barIndex, totalBars } = state.replay;

  const clearInterval_ = useCallback(() => {
    if (replayIntervalRef.current !== null) {
      clearInterval(replayIntervalRef.current);
      replayIntervalRef.current = null;
    }
  }, [replayIntervalRef]);

  const addNextBar = useCallback(() => {
    if (!state.chart) return;

    const data = replaySavedDataRef.current;
    const idx = replayIndexRef.current;

    if (idx >= data.length) {
      // Replay finished — stop the interval but keep replay state
      clearInterval_();
      dispatch({ type: "SET_REPLAY", replay: { isPaused: true } });
      return;
    }

    const bar = data[idx];
    (state.chart as any).updateData?.(bar);
    replayIndexRef.current = idx + 1;
    dispatch({ type: "SET_REPLAY", replay: { barIndex: idx + 1 } });
  }, [state.chart, clearInterval_, replaySavedDataRef, replayIndexRef, dispatch]);

  const startInterval = useCallback(
    (currentSpeed: ReplaySpeed) => {
      clearInterval_();
      replayIntervalRef.current = setInterval(addNextBar, 1000 / currentSpeed);
    },
    [addNextBar, clearInterval_, replayIntervalRef],
  );

  const startReplay = useCallback(() => {
    if (!state.chart) return;

    const dataList = state.chart.getDataList();
    if (!dataList || dataList.length === 0) return;

    // Save a copy of the original data
    replaySavedDataRef.current = [...dataList];
    replayIndexRef.current = 0;

    dispatch({
      type: "SET_REPLAY",
      replay: {
        totalBars: dataList.length,
        barIndex: 0,
        isReplaying: true,
        isPaused: false,
      },
    });

    // Clear chart data
    (state.chart as any).clearData?.();

    // Start the playback interval
    startInterval(speed);
  }, [state.chart, speed, startInterval, replaySavedDataRef, replayIndexRef, dispatch]);

  const stopReplay = useCallback(() => {
    if (!state.chart) return;

    clearInterval_();

    // Restore original data
    const data = replaySavedDataRef.current;
    if (data.length > 0) {
      (state.chart as any).clearData?.();
      for (const bar of data) {
        (state.chart as any).updateData?.(bar);
      }
    }

    replaySavedDataRef.current = [];
    replayIndexRef.current = 0;

    dispatch({
      type: "SET_REPLAY",
      replay: { isReplaying: false, isPaused: false, barIndex: 0, totalBars: 0 },
    });
  }, [state.chart, clearInterval_, replaySavedDataRef, replayIndexRef, dispatch]);

  const togglePause = useCallback(() => {
    if (!isReplaying) return;

    if (isPaused) {
      // Resume
      startInterval(speed);
      dispatch({ type: "SET_REPLAY", replay: { isPaused: false } });
    } else {
      // Pause
      clearInterval_();
      dispatch({ type: "SET_REPLAY", replay: { isPaused: true } });
    }
  }, [isReplaying, isPaused, speed, startInterval, clearInterval_, dispatch]);

  const stepForward = useCallback(() => {
    if (!isReplaying || !isPaused) return;
    addNextBar();
  }, [isReplaying, isPaused, addNextBar]);

  const stepBackward = useCallback(() => {
    if (!isReplaying || !isPaused || !state.chart) return;
    const idx = replayIndexRef.current;
    if (idx <= 1) return;

    // Remove the last bar by rebuilding data up to idx-1
    const data = replaySavedDataRef.current;
    (state.chart as any).clearData?.();
    for (let i = 0; i < idx - 1; i++) {
      (state.chart as any).updateData?.(data[i]);
    }
    replayIndexRef.current = idx - 1;
    dispatch({ type: "SET_REPLAY", replay: { barIndex: idx - 1 } });
  }, [isReplaying, isPaused, state.chart, replaySavedDataRef, replayIndexRef, dispatch]);

  const seekTo = useCallback(
    (targetIndex: number) => {
      if (!isReplaying || !state.chart) return;
      const data = replaySavedDataRef.current;
      const clamped = Math.max(0, Math.min(targetIndex, data.length));

      // Pause if playing
      clearInterval_();

      // Rebuild chart data up to the target index
      (state.chart as any).clearData?.();
      for (let i = 0; i < clamped; i++) {
        (state.chart as any).updateData?.(data[i]);
      }
      replayIndexRef.current = clamped;
      dispatch({
        type: "SET_REPLAY",
        replay: { isPaused: true, barIndex: clamped },
      });
    },
    [isReplaying, state.chart, clearInterval_, replaySavedDataRef, replayIndexRef, dispatch],
  );

  const setSpeed = useCallback(
    (newSpeed: ReplaySpeed) => {
      dispatch({ type: "SET_REPLAY", replay: { speed: newSpeed } });

      // If currently playing, restart the interval with the new speed
      if (isReplaying && !isPaused) {
        startInterval(newSpeed);
      }
    },
    [isReplaying, isPaused, startInterval, dispatch],
  );

  return {
    isReplaying,
    isPaused,
    speed,
    barIndex,
    totalBars,
    startReplay,
    stopReplay,
    togglePause,
    stepForward,
    stepBackward,
    seekTo,
    setSpeed,
  };
}
