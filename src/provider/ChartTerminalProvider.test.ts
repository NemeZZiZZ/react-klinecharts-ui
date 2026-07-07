import { describe, it, expect } from "vitest";
import { reducer } from "./ChartTerminalProvider";
import type { KlinechartsUIState, KlinechartsUIAction } from "./types";
import type { Alert } from "./featureTypes";

/** Minimal valid state for testing — only the fields the reducer touches. */
function makeState(overrides: Partial<KlinechartsUIState> = {}): KlinechartsUIState {
  return {
    chart: null,
    datafeed: {} as KlinechartsUIState["datafeed"],
    symbol: null,
    period: { span: 1, type: "minute", label: "1m" },
    theme: "light",
    timezone: "UTC",
    isLoading: false,
    locale: "en-US",
    periods: [],
    mainIndicators: [],
    subIndicators: {},
    indicatorAxes: {},
    indicatorVisibility: {},
    alerts: [],
    measure: { isActive: false, fromPoint: null, result: null },
    replay: { isReplaying: false, isPaused: false, speed: 1, barIndex: 0, totalBars: 0 },
    styles: undefined,
    screenshotUrl: null,
    ...overrides,
  };
}

const alert = (id: string, price = 100, triggered = false): Alert => ({
  id,
  price,
  condition: "crossing_up",
  triggered,
});

describe("reducer — SET_ALERTS (full replace, kept for preset restore)", () => {
  it("replaces the whole list", () => {
    const s = makeState({ alerts: [alert("a"), alert("b")] });
    const next = reducer(s, { type: "SET_ALERTS", alerts: [alert("c")] });
    expect(next.alerts.map((a) => a.id)).toEqual(["c"]);
  });
});

describe("reducer — ADD_ALERT (composes, does not clobber)", () => {
  it("appends to the existing list", () => {
    const s = makeState({ alerts: [alert("a")] });
    const next = reducer(s, { type: "ADD_ALERT", alert: alert("b") });
    expect(next.alerts.map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the original state", () => {
    const s = makeState({ alerts: [alert("a")] });
    reducer(s, { type: "ADD_ALERT", alert: alert("b") });
    expect(s.alerts.map((a) => a.id)).toEqual(["a"]);
  });
});

describe("reducer — REMOVE_ALERT / CLEAR_ALERTS", () => {
  it("REMOVE_ALERT drops only the matching id", () => {
    const s = makeState({ alerts: [alert("a"), alert("b"), alert("c")] });
    const next = reducer(s, { type: "REMOVE_ALERT", id: "b" });
    expect(next.alerts.map((a) => a.id)).toEqual(["a", "c"]);
  });

  it("CLEAR_ALERTS empties the list", () => {
    const s = makeState({ alerts: [alert("a"), alert("b")] });
    const next = reducer(s, { type: "CLEAR_ALERTS" });
    expect(next.alerts).toEqual([]);
  });
});

describe("reducer — MARK_ALERT_TRIGGERED (the race fix)", () => {
  it("flips triggered=true only on the listed ids", () => {
    const s = makeState({ alerts: [alert("a"), alert("b"), alert("c")] });
    const next = reducer(s, { type: "MARK_ALERT_TRIGGERED", ids: ["a", "c"] });
    expect(next.alerts.map((a) => [a.id, a.triggered])).toEqual([
      ["a", true],
      ["b", false],
      ["c", true],
    ]);
  });

  it("returns the SAME state reference when ids is empty (no re-render)", () => {
    const s = makeState({ alerts: [alert("a")] });
    const next = reducer(s, { type: "MARK_ALERT_TRIGGERED", ids: [] });
    expect(next).toBe(s);
  });

  it("does not reset an already-triggered alert back to false", () => {
    const s = makeState({ alerts: [alert("a", 100, true), alert("b")] });
    // Re-marking with an unrelated id must not touch `a`
    const next = reducer(s, { type: "MARK_ALERT_TRIGGERED", ids: ["b"] });
    const a = next.alerts.find((x) => x.id === "a")!;
    expect(a.triggered).toBe(true);
  });
});

describe("reducer — alert race: ADD composes with MARK_TRIGGERED", () => {
  it("add then trigger does not revert the trigger", () => {
    let s = makeState({ alerts: [alert("a")] });
    s = reducer(s, { type: "MARK_ALERT_TRIGGERED", ids: ["a"] });
    s = reducer(s, { type: "ADD_ALERT", alert: alert("b") });
    expect(s.alerts.map((a) => [a.id, a.triggered])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });

  it("trigger then add does not revert the trigger (order independence)", () => {
    let s = makeState({ alerts: [alert("a")] });
    s = reducer(s, { type: "ADD_ALERT", alert: alert("b") });
    s = reducer(s, { type: "MARK_ALERT_TRIGGERED", ids: ["a"] });
    expect(s.alerts.map((a) => [a.id, a.triggered])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });
});

describe("reducer — SET_MEASURE merges shallowly", () => {
  it("merges partial measure into existing state", () => {
    const s = makeState({ measure: { isActive: true, fromPoint: null, result: null } });
    const next = reducer(s, { type: "SET_MEASURE", measure: { isActive: false } });
    expect(next.measure).toEqual({ isActive: false, fromPoint: null, result: null });
  });
});

describe("reducer — SET_REPLAY merges shallowly", () => {
  it("partial replay patch keeps the other fields", () => {
    const s = makeState({
      replay: { isReplaying: true, isPaused: false, speed: 2, barIndex: 5, totalBars: 100 },
    });
    const next = reducer(s, { type: "SET_REPLAY", replay: { isPaused: true } });
    expect(next.replay).toEqual({ isReplaying: true, isPaused: true, speed: 2, barIndex: 5, totalBars: 100 });
  });
});

describe("reducer — unknown action returns state unchanged", () => {
  it("returns the same reference for an unknown action", () => {
    const s = makeState();
    const next = reducer(s, { type: "NOPE" } as unknown as KlinechartsUIAction);
    expect(next).toBe(s);
  });
});
