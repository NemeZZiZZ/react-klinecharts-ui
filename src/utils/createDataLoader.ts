import type { Dispatch, MutableRefObject } from "react";
import type { DataLoader, KLineData } from "klinecharts";
import type { Datafeed, KlinechartsUIAction } from "../provider/types";

/**
 * Replay context. While `active` is true, the loader serves the saved buffer
 * truncated to `[0, index)` instead of hitting the live datafeed, so calling
 * `chart.resetData()` re-renders the chart with exactly the replayed prefix.
 * klinecharts v10 removed the imperative `updateData` / `clearData` API, so
 * replay drives the chart purely through the DataLoader. All fields are refs so
 * a single loader instance (created once per chart) always reads the current
 * replay state without being recreated.
 */
export interface ReplayDataLoaderContext {
  active: MutableRefObject<boolean>;
  savedData: MutableRefObject<KLineData[]>;
  index: MutableRefObject<number>;
}

/**
 * Creates a klinecharts DataLoader from a Datafeed instance.
 * This bridges the react-klinecharts-ui Datafeed interface to the
 * klinecharts native DataLoader format used by KLineChart component.
 *
 * In klinecharts terminology:
 * - "init" = initial data load
 * - "forward" = load older data (user scrolled left into history)
 * - "backward" = load newer data (user scrolled right)
 *
 * When a `replay` context is provided, `getBars`/`subscribeBar` short-circuit
 * during an active replay session to serve the saved buffer (see
 * {@link ReplayDataLoaderContext}). The replay intercept is scoped to this
 * loader only — direct `datafeed` consumers (e.g. `useCompare`) are unaffected.
 */
export function createDataLoader(
  datafeed: Datafeed,
  dispatch: Dispatch<KlinechartsUIAction>,
  replay?: ReplayDataLoaderContext,
): DataLoader {
  let oldestTimestamp: number | null = null;
  // Incremented on every "init" request. Forward requests capture the value at
  // their start and bail out if a newer init has begun while they were in-flight.
  let currentGen = 0;

  const isReplaying = () => replay?.active.current === true;

  return {
    getBars: async (params) => {
      try {
        dispatch({ type: "SET_LOADING", isLoading: true });

        // Replay short-circuit: serve the saved buffer truncated to the replay
        // index, regardless of the requested type. Only the "init" type is
        // expected during a session (chart.resetData triggers an init), but we
        // handle every type uniformly so a forward/backward request can never
        // escape into the live datafeed mid-replay.
        if (isReplaying() && replay) {
          const slice = replay.savedData.current.slice(
            0,
            replay.index.current,
          );
          params.callback(slice, { forward: false, backward: false });
          return;
        }

        if (params.type === "init") {
          oldestTimestamp = null;
          const gen = ++currentGen;
          const data = await datafeed.getHistoryKLineData(
            params.symbol,
            { ...params.period, label: "" },
            0,
            Date.now(),
          );
          if (gen !== currentGen) return; // newer init started — discard stale result
          if (data.length > 0) {
            oldestTimestamp = data[0].timestamp;
          }
          params.callback(data as KLineData[], {
            forward: data.length > 0,
            backward: false,
          });
        } else if (params.type === "forward" && oldestTimestamp !== null) {
          const gen = currentGen;
          const data = await datafeed.getHistoryKLineData(
            params.symbol,
            { ...params.period, label: "" },
            0,
            oldestTimestamp - 1,
          );
          if (gen !== currentGen) return; // init for new period started — discard
          if (data.length > 0) {
            oldestTimestamp = data[0].timestamp;
          }
          params.callback(data as KLineData[], {
            forward: data.length > 0,
            backward: false,
          });
        } else if (params.type === "backward") {
          // Backward pagination (loading data newer than what we have) is generally
          // not needed in typical terminal usage because we subscribe via ws for real-time.
          params.callback([], { forward: false, backward: false });
        }
      } catch (error) {
        console.error("Failed to load chart data:", error);
        params.callback([], { forward: false, backward: false });
      } finally {
        dispatch({ type: "SET_LOADING", isLoading: false });
      }
    },
    subscribeBar: (params) => {
      // No realtime during a replay session — the chart replays history only.
      if (isReplaying()) return;
      datafeed.subscribe(
        params.symbol,
        { ...params.period, label: "" },
        (klineData) => params.callback(klineData as KLineData),
      );
    },
    unsubscribeBar: (params) => {
      if (isReplaying()) return;
      datafeed.unsubscribe(params.symbol, { ...params.period, label: "" });
    },
  };
}
