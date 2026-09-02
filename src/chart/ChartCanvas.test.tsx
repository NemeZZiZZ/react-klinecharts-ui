import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { createRef, type ReactNode, type Ref } from "react";
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
import { ChartCanvas, type ChartCanvasProps } from "./ChartCanvas";
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
  return renderCanvasWithProps();
}

/** Renders ChartCanvas with explicit props (style, ref, …) inside a provider. */
function renderCanvasWithProps(
  props: ChartCanvasProps & { ref?: Ref<Chart> } = {},
) {
  const chart: MockChart = createMockChart();
  let latest: ReturnType<typeof useKlinechartsUI> | null = null;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <KlinechartsUIProvider datafeed={fakeDatafeed()}>{children}</KlinechartsUIProvider>
  );
  const utils = render(
    <>
      <ChartCanvas {...props} />
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
    renderCanvas();
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

  it("forwards the style prop to <KLineChart> (container sizing passthrough)", () => {
    const style = { height: 500 };
    renderCanvasWithProps({ style });
    expect(lastProps.style).toBe(style);
  });

  it("forwards a ref to <KLineChart> (Chart instance ref forwarding)", () => {
    // Under React 19 the ref flows to the mocked function component as a
    // regular prop, so passthrough is observable via lastProps.
    const ref = createRef<Chart>();
    renderCanvasWithProps({ ref });
    expect(lastProps.ref).toBe(ref);
  });

  describe("dev-mode zero-height warning", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("warns when the chart container still has zero height after mount", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      // A real, attached div: happy-dom reports clientHeight 0 for it (no
      // layout engine), which is exactly the collapsed-container case.
      const div = document.createElement("div");
      document.body.appendChild(div);
      const chart = createMockChart();
      chart.getDom.mockReturnValue(div);

      renderCanvas();
      act(() => capturedOnReady!(chart as unknown as Chart));
      expect(warnSpy).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain("zero height");
      expect(warnSpy.mock.calls[0][0]).toContain("Chart sizing");

      warnSpy.mockRestore();
      div.remove();
    });

    it("does not warn while the container is deliberately hidden (display: none)", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const div = document.createElement("div");
      div.style.display = "none";
      document.body.appendChild(div);
      const chart = createMockChart();
      chart.getDom.mockReturnValue(div);

      renderCanvas();
      act(() => capturedOnReady!(chart as unknown as Chart));
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      div.remove();
    });

    it("does not warn when the container is detached or missing", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const detached = document.createElement("div");
      const chart = createMockChart();
      chart.getDom.mockReturnValue(detached); // never attached

      renderCanvas();
      act(() => capturedOnReady!(chart as unknown as Chart));
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });
});
