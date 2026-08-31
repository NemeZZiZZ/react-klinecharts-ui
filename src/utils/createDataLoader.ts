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
 *
 * `genRef` optionally shares the init-generation counter across loader
 * instances of the SAME chart (ChartCanvas passes one ref per chart, kept
 * across datafeed swaps). Without it, an init still in flight on an OLD loader
 * (e.g. the datafeed was swapped mid-load) passes its per-closure generation
 * check and delivers stale bars onto the freshly reset chart. Never share one
 * ref between different charts — every new init would wrongly invalidate the
 * other chart's in-flight requests.
 */
export function createDataLoader(
  datafeed: Datafeed,
  dispatch: Dispatch<KlinechartsUIAction>,
  replay?: ReplayDataLoaderContext,
  genRef?: MutableRefObject<number>,
): DataLoader {
  let oldestTimestamp: number | null = null;
  // Incremented on every "init" request. Forward requests capture the value at
  // their start and bail out if a newer init has begun while they were
  // in-flight. Falls back to a per-loader counter when no shared ref is given.
  const genCounter = genRef ?? { current: 0 };
  // Concurrent init+forward requests share a single boolean in provider state;
  // a naive finally-dispatch(false) lets whichever request settles first clear
  // the flag while the other is still loading. Count in-flight requests and
  // clear the flag only when the last one settles.
  let pendingRequests = 0;
  const setLoading = (isLoading: boolean) => {
    pendingRequests = Math.max(0, pendingRequests + (isLoading ? 1 : -1));
    dispatch({ type: "SET_LOADING", isLoading: pendingRequests > 0 });
  };

  const isReplaying = () => replay?.active.current === true;

  return {
    getBars: async (params) => {
      // Generation captured by the init/forward branches; read by the catch
      // path so a STALE request that rejects after a newer init delivered does
      // not invoke its callback: an empty init response would wipe the freshly
      // loaded chart, and an empty forward response would permanently disable
      // forward pagination until the next resetData.
      let gen: number | null = null;
      try {
        setLoading(true);

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
          gen = ++genCounter.current;
          const data = await datafeed.getHistoryKLineData(
            params.symbol,
            { ...params.period, label: "" },
            0,
            Date.now(),
          );
          if (gen !== genCounter.current) return; // newer init started — discard stale result
          if (data.length > 0) {
            oldestTimestamp = data[0].timestamp;
          }
          params.callback(data as KLineData[], {
            forward: data.length > 0,
            backward: false,
          });
        } else if (params.type === "forward" && oldestTimestamp !== null) {
          gen = genCounter.current;
          const data = await datafeed.getHistoryKLineData(
            params.symbol,
            { ...params.period, label: "" },
            0,
            oldestTimestamp - 1,
          );
          if (gen !== genCounter.current) return; // init for new period started — discard
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
        } else {
          // Terminal fallback — a "forward" request that arrives before any
          // init delivered (oldestTimestamp === null) must still invoke the
          // callback: klinecharts sets its internal loading flag before
          // getBars and only clears it inside the callback, so resolving bare
          // would wedge every future load until the next resetData.
          params.callback([], { forward: false, backward: false });
        }
      } catch (error) {
        if (gen !== null && gen !== genCounter.current) return; // stale request — the newer init owns the pipeline
        console.error("Failed to load chart data:", error);
        params.callback([], { forward: false, backward: false });
      } finally {
        setLoading(false);
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
      // Always forwarded — even during replay. startReplay flips the replay
      // flag BEFORE chart.resetData(), and resetData() routes the teardown of
      // the live subscription through here; swallowing it kept the live
      // datafeed subscription alive for the whole replay session (live ticks
      // streaming into the replayed prefix) and leaked the old symbol's
      // channel on a mid-replay symbol change. Only getBars/subscribeBar are
      // replay-gated.
      datafeed.unsubscribe(params.symbol, { ...params.period, label: "" });
    },
  };
}
