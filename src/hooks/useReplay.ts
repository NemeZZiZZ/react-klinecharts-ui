import { useState, useCallback, useEffect, useRef } from "react";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";

export type ReplaySpeed = 1 | 2 | 5 | 10;

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
 * bars back one at a time at the configured speed. Useful for backtesting
 * and reviewing price action.
 */
export function useReplay(): UseReplayReturn {
  const { state } = useKlinechartsUI();

  const [isReplaying, setIsReplaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeedState] = useState<ReplaySpeed>(1);
  const [barIndex, setBarIndex] = useState(0);
  const [totalBars, setTotalBars] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedDataRef = useRef<any[]>([]);
  const currentIndexRef = useRef(0);

  const clearInterval_ = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const addNextBar = useCallback(() => {
    if (!state.chart) return;

    const data = savedDataRef.current;
    const idx = currentIndexRef.current;

    if (idx >= data.length) {
      // Replay finished — stop the interval but keep replay state
      clearInterval_();
      setIsPaused(true);
      return;
    }

    const bar = data[idx];
    (state.chart as any).updateData?.(bar);
    currentIndexRef.current = idx + 1;
    setBarIndex(idx + 1);
  }, [state.chart, clearInterval_]);

  const startInterval = useCallback(
    (currentSpeed: ReplaySpeed) => {
      clearInterval_();
      intervalRef.current = setInterval(addNextBar, 1000 / currentSpeed);
    },
    [addNextBar, clearInterval_]
  );

  const startReplay = useCallback(() => {
    if (!state.chart) return;

    const dataList = state.chart.getDataList();
    if (!dataList || dataList.length === 0) return;

    // Save a copy of the original data
    savedDataRef.current = [...dataList];
    currentIndexRef.current = 0;

    setTotalBars(dataList.length);
    setBarIndex(0);
    setIsReplaying(true);
    setIsPaused(false);

    // Clear chart data
    (state.chart as any).clearData?.();

    // Start the playback interval
    startInterval(speed);
  }, [state.chart, speed, startInterval]);

  const stopReplay = useCallback(() => {
    if (!state.chart) return;

    clearInterval_();

    // Restore original data
    const data = savedDataRef.current;
    if (data.length > 0) {
      (state.chart as any).clearData?.();
      for (const bar of data) {
        (state.chart as any).updateData?.(bar);
      }
    }

    savedDataRef.current = [];
    currentIndexRef.current = 0;

    setIsReplaying(false);
    setIsPaused(false);
    setBarIndex(0);
    setTotalBars(0);
  }, [state.chart, clearInterval_]);

  const togglePause = useCallback(() => {
    if (!isReplaying) return;

    if (isPaused) {
      // Resume
      startInterval(speed);
      setIsPaused(false);
    } else {
      // Pause
      clearInterval_();
      setIsPaused(true);
    }
  }, [isReplaying, isPaused, speed, startInterval, clearInterval_]);

  const stepForward = useCallback(() => {
    if (!isReplaying || !isPaused) return;
    addNextBar();
  }, [isReplaying, isPaused, addNextBar]);

  const stepBackward = useCallback(() => {
    if (!isReplaying || !isPaused || !state.chart) return;
    const idx = currentIndexRef.current;
    if (idx <= 1) return;

    // Remove the last bar by rebuilding data up to idx-1
    const data = savedDataRef.current;
    (state.chart as any).clearData?.();
    for (let i = 0; i < idx - 1; i++) {
      (state.chart as any).updateData?.(data[i]);
    }
    currentIndexRef.current = idx - 1;
    setBarIndex(idx - 1);
  }, [isReplaying, isPaused, state.chart]);

  const seekTo = useCallback(
    (targetIndex: number) => {
      if (!isReplaying || !state.chart) return;
      const data = savedDataRef.current;
      const clamped = Math.max(0, Math.min(targetIndex, data.length));

      // Pause if playing
      clearInterval_();
      setIsPaused(true);

      // Rebuild chart data up to the target index
      (state.chart as any).clearData?.();
      for (let i = 0; i < clamped; i++) {
        (state.chart as any).updateData?.(data[i]);
      }
      currentIndexRef.current = clamped;
      setBarIndex(clamped);
    },
    [isReplaying, state.chart, clearInterval_],
  );

  const setSpeed = useCallback(
    (newSpeed: ReplaySpeed) => {
      setSpeedState(newSpeed);

      // If currently playing, restart the interval with the new speed
      if (isReplaying && !isPaused) {
        startInterval(newSpeed);
      }
    },
    [isReplaying, isPaused, startInterval]
  );

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      clearInterval_();
    };
  }, [clearInterval_]);

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
