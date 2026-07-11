import { vi } from "vitest";
import type { KLineData } from "klinecharts";

/**
 * A minimal in-memory mock of the klinecharts `Chart` instance surface used by
 * the hooks. Each method records calls and returns configurable data so tests
 * can drive the hooks (replay, alerts, indicators, overlays) without a canvas.
 *
 * Only the methods the hooks actually call are implemented; extend as needed.
 */
export interface MockChart {
  getDataList: ReturnType<typeof vi.fn>;
  getSymbol: ReturnType<typeof vi.fn>;
  resetData: ReturnType<typeof vi.fn>;
  createOverlay: ReturnType<typeof vi.fn>;
  removeOverlay: ReturnType<typeof vi.fn>;
  getOverlays: ReturnType<typeof vi.fn>;
  overrideOverlay: ReturnType<typeof vi.fn>;
  createIndicator: ReturnType<typeof vi.fn>;
  removeIndicator: ReturnType<typeof vi.fn>;
  getIndicators: ReturnType<typeof vi.fn>;
  overrideIndicator: ReturnType<typeof vi.fn>;
  getSize: ReturnType<typeof vi.fn>;
  setPaneOptions: ReturnType<typeof vi.fn>;
  subscribeAction: ReturnType<typeof vi.fn>;
  unsubscribeAction: ReturnType<typeof vi.fn>;
  setStyles: ReturnType<typeof vi.fn>;
  setTimezone: ReturnType<typeof vi.fn>;
  getTimezone: ReturnType<typeof vi.fn>;
  setLocale: ReturnType<typeof vi.fn>;
  getLocale: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  getVisibleRange: ReturnType<typeof vi.fn>;
  getBarSpace: ReturnType<typeof vi.fn>;
  overrideXAxis: ReturnType<typeof vi.fn>;
  overrideYAxis: ReturnType<typeof vi.fn>;
  createYAxis: ReturnType<typeof vi.fn>;
  removeYAxis: ReturnType<typeof vi.fn>;
  getYAxes: ReturnType<typeof vi.fn>;
  scrollToTimestamp: ReturnType<typeof vi.fn>;
  scrollToRealTime: ReturnType<typeof vi.fn>;
  setSymbol: ReturnType<typeof vi.fn>;
  __data: KLineData[];
  /** Replace the mock's underlying data list (e.g. to simulate a reload). */
  __setData: (next: KLineData[]) => void;
  __setActions: (actions: Record<string, ((...args: unknown[]) => void) | undefined>) => void;
}

export function createMockChart(initialData: KLineData[] = []): MockChart {
  let data: KLineData[] = [...initialData];
  let actions: Record<string, ((...args: unknown[]) => void) | undefined> = {};
  let overlaySeq = 0;
  const overlays: Map<string, Record<string, unknown>> = new Map();
  // Indicator bookkeeping. klinecharts v10 `createIndicator` returns the
  // indicator id; `getIndicators({ id })` then exposes the stored record (incl.
  // paneId) so hooks can map indicator id → pane id.
  let indicatorSeq = 0;
  let paneSeq = 0;
  const indicators: Map<string, Record<string, unknown>> = new Map();
  const yAxes: Map<string, Record<string, unknown>> = new Map();
  let yAxisSeq = 0;

  const chart = {
    // `__data` is defined as a getter below (after the object literal) so it
    // always reflects the current `data` closure variable — including after
    // `__setData` reassigns it. A plain property would snapshot the original
    // array and silently diverge.
    __setData: (next) => {
      data = [...next];
    },
    __setActions: (a) => {
      actions = a;
    },
    getDataList: vi.fn(() => data),
    getSymbol: vi.fn(() => ({ ticker: "TESTUSDT", pricePrecision: 2, volumePrecision: 8 })),
    // klinecharts v10: resetData() triggers a DataLoader reload. The mock
    // records the call; tests that need to observe the reloaded data set it
    // via __setData (or the replay-aware DataLoader intercept).
    resetData: vi.fn(() => {}),
    createOverlay: vi.fn((cfg: Record<string, unknown>) => {
      const id =
        (cfg.id as string | undefined) ?? `ovl_${++overlaySeq}`;
      overlays.set(id, { ...cfg, id });
      return id;
    }),
    removeOverlay: vi.fn((filter: Record<string, unknown>) => {
      if (!filter || Object.keys(filter).length === 0) {
        overlays.clear();
        return;
      }
      for (const key of Object.keys(filter)) {
        // simplistic: drop overlays whose stored field matches the filter value
        for (const [id, cfg] of overlays) {
          if (cfg[key] === filter[key]) overlays.delete(id);
        }
      }
    }),
    getOverlays: vi.fn((filter?: Record<string, unknown>) => {
      let list = [...overlays.values()];
      if (filter && "id" in filter) list = list.filter((o) => o.id === filter.id);
      if (filter && "groupId" in filter)
        list = list.filter((o) => o.groupId === filter.groupId);
      return list;
    }),
    overrideOverlay: vi.fn((cfg: Record<string, unknown>) => {
      if (cfg.id && overlays.has(cfg.id as string)) {
        overlays.set(cfg.id as string, { ...overlays.get(cfg.id as string), ...cfg });
      }
    }),
    createIndicator: vi.fn((cfg: Record<string, unknown>, _isStack?: boolean) => {
      const id = (cfg.id as string | undefined) ?? `ind_${++indicatorSeq}`;
      // Resolve the pane: an explicit paneId wins, else allocate a new pane.
      const paneId = (cfg.paneId as string | undefined) ?? `pane_${++paneSeq}`;
      indicators.set(id, { ...cfg, id, paneId });
      return id;
    }),
    removeIndicator: vi.fn((filter?: Record<string, unknown>) => {
      if (!filter || Object.keys(filter).length === 0) {
        indicators.clear();
        return;
      }
      for (const [key, value] of Object.entries(filter)) {
        for (const [id, cfg] of indicators) {
          if (cfg[key] === value) indicators.delete(id);
        }
      }
    }),
    getIndicators: vi.fn((filter?: Record<string, unknown>) => {
      let list = [...indicators.values()];
      if (filter && "id" in filter) list = list.filter((o) => o.id === filter.id);
      if (filter && "name" in filter)
        list = list.filter((o) => o.name === filter.name);
      return list;
    }),
    overrideIndicator: vi.fn((cfg: Record<string, unknown>) => {
      if (cfg.id && indicators.has(cfg.id as string)) {
        indicators.set(cfg.id as string, { ...indicators.get(cfg.id as string), ...cfg });
      }
    }),
    getSize: vi.fn((_paneId?: string) => ({ width: 800, height: 200 })),
    setPaneOptions: vi.fn(() => {}),
    subscribeAction: vi.fn((type: string, cb: (...args: unknown[]) => void) => {
      actions[type] = cb;
    }),
    unsubscribeAction: vi.fn(() => {}),
    setStyles: vi.fn(() => {}),
    setTimezone: vi.fn(() => {}),
    getTimezone: vi.fn(() => "UTC"),
    setLocale: vi.fn(() => {}),
    getLocale: vi.fn(() => "en-US"),
    resize: vi.fn(() => {}),
    getVisibleRange: vi.fn(() => ({ from: 0, to: 100, realFrom: 0, realTo: 100 })),
    getBarSpace: vi.fn(() => ({ bar: 8, halfBar: 4, gapBar: 0 })),
    overrideXAxis: vi.fn(() => {}),
    overrideYAxis: vi.fn(() => {}),
    createYAxis: vi.fn((override: Record<string, unknown>) => {
      const id = (override.id as string | undefined) ?? `yaxis_${++yAxisSeq}`;
      // createYAxis is idempotent per id in klinecharts v10.
      if (!yAxes.has(id)) yAxes.set(id, { ...override, id });
      return id;
    }),
    removeYAxis: vi.fn((filter: Record<string, unknown>) => {
      const before = yAxes.size;
      for (const [key, value] of Object.entries(filter)) {
        for (const [id, cfg] of yAxes) {
          if (cfg[key] === value) yAxes.delete(id);
        }
      }
      return yAxes.size < before;
    }),
    getYAxes: vi.fn((filter?: Record<string, unknown>) => {
      let list = [...yAxes.values()];
      if (filter && "id" in filter) list = list.filter((o) => o.id === filter.id);
      if (filter && "paneId" in filter)
        list = list.filter((o) => o.paneId === filter.paneId);
      if (filter && "name" in filter)
        list = list.filter((o) => o.name === filter.name);
      return list;
    }),
    scrollToTimestamp: vi.fn(() => {}),
    scrollToRealTime: vi.fn(() => {}),
    setSymbol: vi.fn(() => {}),
  } as MockChart;

  // `__data` is a live view of the `data` closure variable so it never diverges
  // from getDataList() / __setData. Defined post-construction via a getter.
  Object.defineProperty(chart, "__data", {
    get: () => data,
  });

  return chart;
}

/** Helper to emit a klinecharts action (crosshair change, etc.) into the mock. */
export function emitAction(chart: MockChart, type: string, ...args: unknown[]) {
  // reach into the recorded subscribeAction calls to fire the last registered cb
  const calls = chart.subscribeAction.mock.calls as [string, (...a: unknown[]) => void][];
  const last = [...calls].reverse().find(([t]) => t === type);
  if (last) last[1](...args);
}
