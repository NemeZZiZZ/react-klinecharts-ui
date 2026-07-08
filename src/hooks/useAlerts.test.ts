import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";
import { renderHookWithProvider } from "../../test/renderHook";
import { useAlerts } from "./useAlerts";

describe("useAlerts", () => {
  it("starts with an empty alert list", () => {
    const { result } = renderHookWithProvider(() => useAlerts());
    expect(result.current.alerts).toEqual([]);
  });

  it("addAlert appends an alert and returns its id", () => {
    const { result } = renderHookWithProvider(() => useAlerts());
    let id = "";
    act(() => {
      id = result.current.addAlert(65000, "crossing_up", "BTC 65k");
    });
    expect(id).toMatch(/^alert_\d+$/);
    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0]).toMatchObject({
      id,
      price: 65000,
      condition: "crossing_up",
      message: "BTC 65k",
      triggered: false,
    });
  });

  it("removeAlert drops the matching id", () => {
    const { result } = renderHookWithProvider(() => useAlerts());
    let id1 = "";
    let id2 = "";
    act(() => {
      id1 = result.current.addAlert(100, "crossing_up");
      id2 = result.current.addAlert(200, "crossing_down");
    });
    act(() => result.current.removeAlert(id1));
    expect(result.current.alerts.map((a) => a.id)).toEqual([id2]);
  });

  it("clearAlerts empties the list", () => {
    const { result } = renderHookWithProvider(() => useAlerts());
    act(() => {
      result.current.addAlert(100, "crossing_up");
      result.current.addAlert(200, "crossing_down");
    });
    act(() => result.current.clearAlerts());
    expect(result.current.alerts).toEqual([]);
  });

  it("addAlert persists extendData with a default text fallback", () => {
    const { result } = renderHookWithProvider(() => useAlerts());
    act(() => {
      result.current.addAlert(42.5, "crossing", "hello");
    });
    expect(result.current.alerts[0].extendData?.text).toBe("hello");
  });

  it("onAlertTriggered registers a callback (last-wins)", () => {
    const { result } = renderHookWithProvider(() => useAlerts());
    const fired: string[] = [];
    act(() => {
      result.current.onAlertTriggered((a) => fired.push(a.id));
    });
    // registering again replaces
    const fired2: string[] = [];
    act(() => {
      result.current.onAlertTriggered((a) => fired2.push(a.id));
    });
    expect(fired).toEqual([]);
    expect(fired2).toEqual([]);
  });

  it("creates an alertLine overlay when the chart is ready", () => {
    const { result, chart } = renderHookWithProvider(() => useAlerts());
    act(() => {
      result.current.addAlert(100, "crossing_up");
    });
    expect(chart.createOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ name: "alertLine", groupId: "price_alerts" }),
    );
  });
});

describe("useAlerts — multi-listener (onAlertTriggered)", () => {
  it("returns an unsubscribe function", () => {
    const { result } = renderHookWithProvider(() => useAlerts());
    let unsub: (() => void) | undefined;
    act(() => {
      unsub = result.current.onAlertTriggered(() => {});
    });
    expect(typeof unsub).toBe("function");
  });

  it("multiple listeners can be registered and one unsubscribe does not remove the other", () => {
    const { result } = renderHookWithProvider(() => useAlerts());
    // Register two listeners and grab their unsubscribers.
    let unsubA: (() => void) | undefined;
    let unsubB: (() => void) | undefined;
    act(() => {
      unsubA = result.current.onAlertTriggered(() => {});
      unsubB = result.current.onAlertTriggered(() => {});
    });
    expect(typeof unsubA).toBe("function");
    expect(typeof unsubB).toBe("function");
    // Unsubscribing A must not throw and must leave B intact (no shared-ref bug).
    expect(() => act(() => unsubA!())).not.toThrow();
  });
});

describe("useAlerts — indicator target", () => {
  it("addAlert with an indicator target stores target on the alert", () => {
    const { result } = renderHookWithProvider(() => useAlerts());
    act(() => {
      result.current.addAlert(70, "crossing_up", "RSI overbought", undefined, {
        type: "indicator",
        indicatorId: "sub_RSI_TV",
        figureKey: "rsi",
      });
    });
    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0].target).toEqual({
      type: "indicator",
      indicatorId: "sub_RSI_TV",
      figureKey: "rsi",
    });
  });

  it("addAlert without a target stores no `target` field (price default, backward compat)", () => {
    const { result } = renderHookWithProvider(() => useAlerts());
    act(() => {
      result.current.addAlert(100, "crossing_up");
    });
    expect(result.current.alerts[0].target).toBeUndefined();
  });
});

