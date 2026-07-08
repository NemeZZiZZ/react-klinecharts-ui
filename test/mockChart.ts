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
  clearData: ReturnType<typeof vi.fn>;
  updateData: ReturnType<typeof vi.fn>;
  applyNewData: ReturnType<typeof vi.fn>;
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
  scrollToTimestamp: ReturnType<typeof vi.fn>;
  scrollToRealTime: ReturnType<typeof vi.fn>;
  scrollToPosition: ReturnType<typeof vi.fn>;
  setPriceVolumePrecision: ReturnType<typeof vi.fn>;
  setSymbol: ReturnType<typeof vi.fn>;
  __data: KLineData[];
  __setActions: (actions: Record<string, ((...args: unknown[]) => void) | undefined>) => void;
}

export function createMockChart(initialData: KLineData[] = []): MockChart {
  let data: KLineData[] = [...initialData];
  let actions: Record<string, ((...args: unknown[]) => void) | undefined> = {};
  let overlaySeq = 0;
  const overlays: Map<string, Record<string, unknown>> = new Map();

  return {
    __data: data,
    __setActions: (a) => {
      actions = a;
    },
    getDataList: vi.fn(() => data),
    getSymbol: vi.fn(() => ({ ticker: "TESTUSDT", pricePrecision: 2, volumePrecision: 8 })),
    clearData: vi.fn(() => {
      data = [];
    }),
    updateData: vi.fn((bar: KLineData) => {
      // klinecharts updateData: replace the last bar if same timestamp, else push.
      const last = data[data.length - 1];
      if (last && last.timestamp === bar.timestamp) {
        data[data.length - 1] = bar;
      } else {
        data.push(bar);
      }
    }),
    applyNewData: vi.fn((bars: KLineData[]) => {
      data = [...bars];
    }),
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
    createIndicator: vi.fn((_cfg: unknown, opts?: Record<string, unknown>) => {
      return opts?.pane ? (opts.pane as { id?: string }).id ?? "pane_x" : "pane_x";
    }),
    removeIndicator: vi.fn(() => {}),
    getIndicators: vi.fn(() => [] as unknown[]),
    overrideIndicator: vi.fn(() => {}),
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
    scrollToTimestamp: vi.fn(() => {}),
    scrollToRealTime: vi.fn(() => {}),
    scrollToPosition: vi.fn(() => {}),
    setPriceVolumePrecision: vi.fn(() => {}),
    setSymbol: vi.fn(() => {}),
  };
}

/** Helper to emit a klinecharts action (crosshair change, etc.) into the mock. */
export function emitAction(chart: MockChart, type: string, ...args: unknown[]) {
  // reach into the recorded subscribeAction calls to fire the last registered cb
  const calls = chart.subscribeAction.mock.calls as [string, (...a: unknown[]) => void][];
  const last = [...calls].reverse().find(([t]) => t === type);
  if (last) last[1](...args);
}
