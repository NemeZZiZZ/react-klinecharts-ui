import { useCallback, useEffect, useRef } from "react";
import {
  useKlinechartsUI,
  useKlinechartsUIDispatch,
} from "../provider/ChartTerminalContext";
import type { ReplaySpeed } from "../provider/featureTypes";

export type { ReplaySpeed } from "../provider/featureTypes";

/**
 * Upper bound on `chart.resetData()` calls per second during playback.
 *
 * klinecharts v10 exposes no incremental data API (only `setDataLoader` +
 * `resetData`), so every replayed bar costs a full O(n) reload: slice the
 * buffer, rebuild the data list, recalculate every indicator, redraw. A
 * session therefore does O(n²) work. Playback above this rate advances several
 * bars per tick instead, which cuts the total proportionally while keeping the
 * wall-clock pace (and, at these speeds, the visible result) the same.
 */
const MAX_RELOADS_PER_SECOND = 6;

export interface UseReplayOptions {
  /**
   * Replay at most the last N bars of the loaded history (opt-in).
   *
   * Per-bar cost grows with the buffer size, so capping it is the only way to
   * keep very long histories smooth. The bars before the window never appear —
   * they are not skipped, they are outside the replayed range.
   */
  maxBars?: number;
}

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
export function useReplay(options?: UseReplayOptions): UseReplayReturn {
  const maxBars = options?.maxBars;
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

  // Продвинуть окно реплея на `count` баров (по умолчанию 1).
  //
  // klinecharts v10 owns data through the DataLoader; the imperative
  // updateData/clearData API was removed. The replay-aware DataLoader
  // (createDataLoader, wired by ChartCanvas) serves the saved buffer truncated
  // to [0, replayIndexRef.current), so advancing the index and asking the chart
  // to reload renders the next bar(s). One reload costs O(n) (slice + full
  // indicator recalc), so advancing several bars per tick is what keeps fast
  // playback affordable — see MAX_RELOADS_PER_SECOND.
  const advanceBars = useCallback(
    (count: number) => {
      if (!state.chart) return;

      const data = replaySavedDataRef.current;
      const idx = replayIndexRef.current;

      if (idx >= data.length) {
        // Replay finished — stop the interval but keep replay state
        clearInterval_();
        dispatch({ type: "SET_REPLAY", replay: { isPaused: true } });
        return;
      }

      const next = Math.min(idx + Math.max(1, count), data.length);
      // Nothing to render — skip the reload (a no-op resetData still rebuilds
      // the whole dataList and recalculates every indicator).
      if (next === idx) return;

      replayIndexRef.current = next;
      state.chart.resetData();
      dispatch({ type: "SET_REPLAY", replay: { barIndex: next } });
    },
    [state.chart, clearInterval_, replaySavedDataRef, replayIndexRef, dispatch],
  );

  const addNextBar = useCallback(() => {
    advanceBars(1);
  }, [advanceBars]);

  // Indirection ref so the interval closure always calls the current
  // `advanceBars` without restarting playback when its deps change.
  const advanceBarsRef = useRef(advanceBars);
  useEffect(() => {
    advanceBarsRef.current = advanceBars;
  });

  const startInterval = useCallback(
    (currentSpeed: ReplaySpeed) => {
      clearInterval_();
      // Cap the reload rate: each tick costs O(n) (DataLoader slice + full
      // indicator recalculation), and a session performs n / barsPerTick ticks —
      // i.e. O(n²) work with barsPerTick = 1. Above MAX_RELOADS_PER_SECOND the
      // eye cannot resolve single bars anyway, so advance in groups and keep
      // the wall-clock pace (interval = barsPerTick / speed) identical.
      const barsPerTick = Math.max(
        1,
        Math.ceil(currentSpeed / MAX_RELOADS_PER_SECOND),
      );
      replayIntervalRef.current = setInterval(
        () => advanceBarsRef.current(barsPerTick),
        (1000 * barsPerTick) / currentSpeed,
      );
    },
    [clearInterval_, replayIntervalRef],
  );

  const startReplay = useCallback(() => {
    if (!state.chart) return;
    // Guard against double-start: calling startReplay while a session is
    // still playing would overwrite replaySavedDataRef with the truncated
    // (partially-played) chart data, permanently losing the unplayed tail.
    // A replay that ran to completion is safe to restart: the chart currently
    // shows the full buffer (index reached the end), so re-saving it loses
    // nothing.
    const finishedNaturally =
      isReplaying &&
      replaySavedDataRef.current.length > 0 &&
      replayIndexRef.current >= replaySavedDataRef.current.length;
    if (isReplaying && !finishedNaturally) return;

    const dataList = state.chart.getDataList();
    if (!dataList || dataList.length === 0) return;

    // Save a copy of the original data, optionally trimmed to the last
    // `maxBars` (see UseReplayOptions.maxBars).
    replaySavedDataRef.current =
      maxBars !== undefined && maxBars > 0 && dataList.length > maxBars
        ? dataList.slice(-maxBars)
        : [...dataList];
    replayIndexRef.current = 0;

    // Activate the replay-aware DataLoader intercept synchronously (before
    // resetData) so it serves the saved buffer instead of hitting the live
    // datafeed. With index 0 the slice is empty, rendering a cleared chart.
    replayActiveRef.current = true;
    dispatch({
      type: "SET_REPLAY",
      replay: {
        totalBars: replaySavedDataRef.current.length,
        barIndex: 0,
        isReplaying: true,
        isPaused: false,
      },
    });

    state.chart.resetData();

    // Start the playback interval
    startInterval(speed);
  }, [state.chart, state.symbol, state.period, speed, startInterval, isReplaying, replaySavedDataRef, replayIndexRef, replayActiveRef, maxBars, dispatch]);

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
