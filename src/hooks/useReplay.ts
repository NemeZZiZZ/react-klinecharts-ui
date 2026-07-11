import { useCallback, useEffect } from "react";
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
  const { replayIntervalRef, replaySavedDataRef, replayIndexRef, replayActiveRef } =
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

    // klinecharts v10 owns data through the DataLoader; the imperative
    // updateData/clearData API was removed. The replay-aware DataLoader
    // (createDataLoader, wired by ChartCanvas) serves the saved buffer truncated
    // to [0, replayIndexRef.current), so advancing the index and asking the chart
    // to reload renders the next bar.
    replayIndexRef.current = idx + 1;
    state.chart.resetData();
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
    // Guard against double-start: calling startReplay while a session is
    // already running would overwrite replaySavedDataRef with the truncated
    // (partially-played) chart data, permanently losing the unplayed tail.
    if (isReplaying) return;

    const dataList = state.chart.getDataList();
    if (!dataList || dataList.length === 0) return;

    // Save a copy of the original data
    replaySavedDataRef.current = [...dataList];
    replayIndexRef.current = 0;

    // Activate the replay-aware DataLoader intercept synchronously (before
    // resetData) so it serves the saved buffer instead of hitting the live
    // datafeed. With index 0 the slice is empty, rendering a cleared chart.
    replayActiveRef.current = true;
    dispatch({
      type: "SET_REPLAY",
      replay: {
        totalBars: dataList.length,
        barIndex: 0,
        isReplaying: true,
        isPaused: false,
      },
    });

    state.chart.resetData();

    // Start the playback interval
    startInterval(speed);
  }, [state.chart, state.symbol, state.period, speed, startInterval, isReplaying, replaySavedDataRef, replayIndexRef, replayActiveRef, dispatch]);

  // Stop the replay session automatically when the symbol or period changes.
  // The dataLoader reloads the chart with the new symbol's bars, but without
  // this guard the playback interval keeps replaying the OLD symbol's saved
  // data on top of it, silently mixing two symbols' candles.
  useEffect(() => {
    if (isReplaying) {
      stopReplay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.symbol, state.period]);

  const stopReplay = useCallback(() => {
    if (!state.chart) return;

    clearInterval_();

    // Restore original data. Flip the replay flag BEFORE resetData() so the
    // replay-aware DataLoader delegates to the live datafeed, which reloads the
    // original bars. (replayActiveRef is synced from state via an effect, which
    // runs too late here, so we set it synchronously.)
    replayActiveRef.current = false;
    if (replaySavedDataRef.current.length > 0) {
      state.chart.resetData();
    }

    replaySavedDataRef.current = [];
    replayIndexRef.current = 0;

    dispatch({
      type: "SET_REPLAY",
      replay: { isReplaying: false, isPaused: false, barIndex: 0, totalBars: 0 },
    });
  }, [state.chart, clearInterval_, replaySavedDataRef, replayIndexRef, replayActiveRef, dispatch]);

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

    // Shrink the replay window by one and reload — the replay-aware DataLoader
    // serves [0, idx - 1) from the saved buffer.
    replayIndexRef.current = idx - 1;
    state.chart.resetData();
    dispatch({ type: "SET_REPLAY", replay: { barIndex: idx - 1 } });
  }, [isReplaying, isPaused, state.chart, replaySavedDataRef, replayIndexRef, dispatch]);

  const seekTo = useCallback(
    (targetIndex: number) => {
      if (!isReplaying || !state.chart) return;
      const data = replaySavedDataRef.current;
      const clamped = Math.max(0, Math.min(targetIndex, data.length));

      // Pause if playing
      clearInterval_();

      // Jump the replay window to the target index and reload.
      replayIndexRef.current = clamped;
      state.chart.resetData();
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
