/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { useEffect } from "react";
import {
  WorkspaceProvider,
  useWorkspace,
  DEFAULT_SYNC_CONFIG,
  type ChartCell,
} from "./index";
import { createMockChart, type MockChart } from "../../test/mockChart";

const cell = (id: string): ChartCell => ({
  id,
  symbol: { ticker: id, pricePrecision: 2 },
  period: { span: 1, type: "minute", label: "1m" },
});

/**
 * Probe that hands the workspace context up to the test via an onReady
 * callback (invoked in the commit phase — no render-time mutation).
 */
function Probe({
  onReady,
}: {
  onReady: (ws: ReturnType<typeof useWorkspace>) => void;
}) {
  const ws = useWorkspace();
  useEffect(() => {
    onReady(ws);
  });
  return null;
}

describe("WorkspaceProvider", () => {
  it("initializes with the default cells and picks the first as active", () => {
    let ws: ReturnType<typeof useWorkspace> | null = null;
    render(
      <WorkspaceProvider defaultCells={[cell("a"), cell("b")]}>
        <Probe onReady={(w) => (ws = w)} />
      </WorkspaceProvider>,
    );
    expect(ws!.state.cells.map((c) => c.id)).toEqual(["a", "b"]);
    expect(ws!.state.activeCellId).toBe("a");
  });

  it("throws when useWorkspace is used outside a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe onReady={() => {}} />)).toThrow(
      /used within a <WorkspaceProvider>/,
    );
    spy.mockRestore();
  });

  it("exposes the resolved sync config (defaults when omitted)", () => {
    let ws: ReturnType<typeof useWorkspace> | null = null;
    render(
      <WorkspaceProvider defaultCells={[cell("a")]}>
        <Probe onReady={(w) => (ws = w)} />
      </WorkspaceProvider>,
    );
    expect(ws!.sync).toEqual(DEFAULT_SYNC_CONFIG);
  });

  it("merges partial sync config over the defaults", () => {
    let ws: ReturnType<typeof useWorkspace> | null = null;
    render(
      <WorkspaceProvider defaultCells={[cell("a")]} sync={{ scroll: false }}>
        <Probe onReady={(w) => (ws = w)} />
      </WorkspaceProvider>,
    );
    expect(ws!.sync.scroll).toBe(false);
    expect(ws!.sync.crosshair).toBe(true);
  });

  it("chart registry starts empty and broadcast guard starts false", () => {
    let ws: ReturnType<typeof useWorkspace> | null = null;
    render(
      <WorkspaceProvider defaultCells={[cell("a")]}>
        <Probe onReady={(w) => (ws = w)} />
      </WorkspaceProvider>,
    );
    expect(ws!.chartsRef.current.size).toBe(0);
    expect(ws!.broadcastingRef.current).toBe(false);
  });

  it("dispatch SET_ACTIVE_CELL updates the active cell id", () => {
    let ws: ReturnType<typeof useWorkspace> | null = null;
    const { rerender } = render(
      <WorkspaceProvider defaultCells={[cell("a"), cell("b")]}>
        <Probe onReady={(w) => (ws = w)} />
      </WorkspaceProvider>,
    );
    expect(ws!.state.activeCellId).toBe("a");
    ws!.dispatch({ type: "SET_ACTIVE_CELL", id: "b" });
    rerender(
      <WorkspaceProvider defaultCells={[cell("a"), cell("b")]}>
        <Probe onReady={(w) => (ws = w)} />
      </WorkspaceProvider>,
    );
    expect(ws!.state.activeCellId).toBe("b");
  });
});

describe("workspace chart registry (useChartSync contract)", () => {
  it("a chart registered into the registry is retrievable by cell id", () => {
    let ws: ReturnType<typeof useWorkspace> | null = null;
    const fakeChart: MockChart = createMockChart();
    const Bridge = () => {
      const w = useWorkspace();
      useEffect(() => {
        w.chartsRef.current.set("a", fakeChart as never);
      });
      return null;
    };
    render(
      <WorkspaceProvider defaultCells={[cell("a")]}>
        <Probe onReady={(w) => (ws = w)} />
        <Bridge />
      </WorkspaceProvider>,
    );
    expect(ws!.chartsRef.current.get("a")).toBe(fakeChart);
  });

  it("broadcasting guard is mutable from outside (test contract)", () => {
    let ws: ReturnType<typeof useWorkspace> | null = null;
    render(
      <WorkspaceProvider defaultCells={[cell("a")]}>
        <Probe onReady={(w) => (ws = w)} />
      </WorkspaceProvider>,
    );
    expect(ws!.broadcastingRef.current).toBe(false);
    ws!.broadcastingRef.current = true;
    expect(ws!.broadcastingRef.current).toBe(true);
  });
});
