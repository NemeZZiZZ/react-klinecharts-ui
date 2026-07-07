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
