import { renderHook, type RenderHookOptions } from "@testing-library/react";
import { type ReactNode, useEffect, act } from "react";
import { KlinechartsUIProvider } from "../src/provider/ChartTerminalProvider";
import type { Datafeed, KlinechartsUIAction } from "../src/provider/types";
import { useKlinechartsUIDispatch } from "../src/provider/ChartTerminalContext";
import { createMockChart, type MockChart } from "./mockChart";
import type { KLineData } from "klinecharts";
import type { StorageOptions } from "../src/storage";

/** A minimal but real datafeed used by hook tests (returns canned data). */
export function fakeDatafeed(history: KLineData[] = []): Datafeed {
  return {
    searchSymbols: async () => [],
    getHistoryKLineData: async () => history,
    subscribe: () => {},
    unsubscribe: () => {},
  };
}

export interface ProviderRenderOptions extends RenderHookOptions<unknown> {
  initialData?: KLineData[];
  /** Optional storage config forwarded to the provider. */
  storage?: StorageOptions;
  /** Forwarded to the provider as defaultMainIndicators. */
  defaultMainIndicators?: string[];
  /** Forwarded to the provider as defaultSubIndicators. */
  defaultSubIndicators?: string[];
}

/**
 * Internal helper hook: registers a mock chart with the provider on mount,
 * then renders the consumer hook.
 */
function useChartAndHook<T>(chart: MockChart, hook: () => T) {
  const { dispatch } = useKlinechartsUIDispatch();
  useEffect(() => {
    dispatch({ type: "SET_CHART", chart: chart as never } as KlinechartsUIAction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return hook();
}

/**
 * Render a hook inside a KlinechartsUIProvider that has been wired to a mock
 * chart. Returns the hook result plus a handle to the mock chart so tests can
 * drive chart-side state and assert on hook behavior.
 */
export function renderHookWithProvider<T>(
  hook: () => T,
  opts: ProviderRenderOptions = {},
) {
  const chart = createMockChart(opts.initialData ?? []);
  const datafeed = fakeDatafeed(opts.initialData ?? []);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <KlinechartsUIProvider
      datafeed={datafeed}
      storage={opts.storage}
      defaultMainIndicators={opts.defaultMainIndicators}
      defaultSubIndicators={opts.defaultSubIndicators}
    >
      {children}
    </KlinechartsUIProvider>
  );

  const result = renderHook(() => useChartAndHook(chart, hook), {
    wrapper,
    ...opts,
  });

  return { ...result, chart, datafeed, act };
}
