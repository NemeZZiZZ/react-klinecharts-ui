import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Chart } from "klinecharts";

// Capture the onReady callback passed to the mocked <KLineChart> so tests can
// fire it with a fake Chart and assert on the resulting provider state.
let capturedOnReady: ((chart: Chart) => void) | null = null;
let lastProps: Record<string, unknown> = {};

vi.mock("react-klinecharts", () => ({
  KLineChart: (props: Record<string, unknown> & { children?: ReactNode }) => {
    capturedOnReady = props.onReady as (chart: Chart) => void;
    lastProps = props;
    return props.children ?? null;
  },
}));

// Import AFTER the mock is registered.
import { ChartCanvas } from "./ChartCanvas";
import { KlinechartsUIProvider } from "../provider/ChartTerminalProvider";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";
import type { Datafeed } from "../provider/types";
import { createMockChart, type MockChart } from "../../test/mockChart";

function fakeDatafeed(): Datafeed {
  return {
    searchSymbols: async () => [],
    getHistoryKLineData: async () => [],
    subscribe: () => {},
    unsubscribe: () => {},
  };
}

/** Probe that exposes the live provider state for assertions. */
function StateProbe({ onState }: { onState: (s: ReturnType<typeof useKlinechartsUI>) => void }) {
  const ctx = useKlinechartsUI();
  onState(ctx);
  return null;
}

function renderCanvas() {
  const chart: MockChart = createMockChart();
  let latest: ReturnType<typeof useKlinechartsUI> | null = null;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <KlinechartsUIProvider datafeed={fakeDatafeed()}>{children}</KlinechartsUIProvider>
  );
  const utils = render(
    <>
      <ChartCanvas />
      <StateProbe onState={(s) => (latest = s)} />
    </>,
    { wrapper },
  );
  return { ...utils, chart, getCtx: () => latest };
}

describe("ChartCanvas", () => {
  beforeEach(() => {
    capturedOnReady = null;
    lastProps = {};
  });

  it("renders without crashing inside a provider", () => {
    const { container } = renderCanvas();
    expect(container).toBeDefined();
  });

  it("passes provider state through to <KLineChart> as props", () => {
    renderCanvas();
    expect(lastProps).toHaveProperty("dataLoader");
    expect(lastProps).toHaveProperty("symbol");
    expect(lastProps).toHaveProperty("period");
    expect(lastProps).toHaveProperty("onReady");
    expect(typeof lastProps.onReady).toBe("function");
  });

  it("onReady dispatches SET_CHART with the chart instance (the renderer bridge)", () => {
    const { getCtx } = renderCanvas();
    expect(capturedOnReady).not.toBeNull();
    const fakeChart = createMockChart() as unknown as Chart;
    act(() => capturedOnReady!(fakeChart));
    // After onReady, the provider's state.chart should be the fake chart.
    expect(getCtx()?.state.chart).toBe(fakeChart);
  });

  it("onReady bootstraps the provider's default indicators onto the chart", () => {
    const { chart } = renderCanvas();
    const fakeChart = createMockChart();
    act(() => capturedOnReady!(fakeChart as unknown as Chart));
    // The provider defaults to mainIndicators ["MA"] and subIndicators {VOL:""}.
    expect(fakeChart.createIndicator).toHaveBeenCalled();
    // MA (main) + VOL (sub) → at least 2 createIndicator calls.
    expect(fakeChart.createIndicator.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("onReady bootstraps main indicators with the v10 createIndicator(value, isStack) signature", () => {
    renderCanvas();
    const fakeChart = createMockChart();
    act(() => capturedOnReady!(fakeChart as unknown as Chart));
    // The first createIndicator call bootstraps MA on the candle pane. v10
    // passes paneId on the IndicatorCreate value and a boolean isStack as the
    // 2nd argument (the old options-object form was removed in 10.0.0).
    const firstCall = fakeChart.createIndicator.mock.calls[0] as [
      Record<string, unknown>,
      boolean,
    ];
    expect(firstCall[0].name).toBe("MA");
    expect(firstCall[0].paneId).toBe("candle_pane");
    expect(firstCall[1]).toBe(true);
  });
});
