import type { Dispatch } from "react";
import type { DataLoader, KLineData } from "react-klinecharts";
import type { Datafeed, KlinechartsUIAction } from "../provider/types";

/**
 * Creates a klinecharts DataLoader from a Datafeed instance.
 * This bridges the react-klinecharts-ui Datafeed interface to the
 * klinecharts native DataLoader format used by KLineChart component.
 *
 * In klinecharts terminology:
 * - "init" = initial data load
 * - "forward" = load older data (user scrolled left into history)
 * - "backward" = load newer data (user scrolled right)
 */
export function createDataLoader(
  datafeed: Datafeed,
  dispatch: Dispatch<KlinechartsUIAction>,
): DataLoader {
  let oldestTimestamp: number | null = null;
  // Incremented on every "init" request. Forward requests capture the value at
  // their start and bail out if a newer init has begun while they were in-flight.
  let currentGen = 0;

  return {
    getBars: async (params) => {
      try {
        dispatch({ type: "SET_LOADING", isLoading: true });

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
      datafeed.subscribe(
        params.symbol,
        { ...params.period, label: "" },
        (klineData) => params.callback(klineData as KLineData),
      );
    },
    unsubscribeBar: (params) => {
      datafeed.unsubscribe(params.symbol, { ...params.period, label: "" });
    },
  };
}
