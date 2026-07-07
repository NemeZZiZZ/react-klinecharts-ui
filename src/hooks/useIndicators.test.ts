import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";
import { renderHookWithProvider } from "../../test/renderHook";
import { useIndicators } from "./useIndicators";

describe("useIndicators — catalog & state", () => {
  it("exposes the available indicator lists", () => {
    const { result } = renderHookWithProvider(() => useIndicators());
    expect(result.current.availableMainIndicators.length).toBeGreaterThan(0);
    expect(result.current.availableSubIndicators.length).toBeGreaterThan(0);
    expect(result.current.availableMainIndicators).toContain("MA");
    expect(result.current.availableSubIndicators).toContain("VOL");
  });

  it("MA is active by default (provider defaultMainIndicators), EMA is not", () => {
    const { result } = renderHookWithProvider(() => useIndicators());
    expect(result.current.isMainIndicatorActive("MA")).toBe(true);
    expect(result.current.isMainIndicatorActive("EMA")).toBe(false);
  });

  it("mainIndicators list marks the default MA as active", () => {
    const { result } = renderHookWithProvider(() => useIndicators());
    const ma = result.current.mainIndicators.find((i) => i.name === "MA");
    expect(ma?.isActive).toBe(true);
  });

  it("getIndicatorParams returns the configured params for MACD", () => {
    const { result } = renderHookWithProvider(() => useIndicators());
    const params = result.current.getIndicatorParams("MACD");
    expect(params.map((p) => p.defaultValue)).toEqual([12, 26, 9]);
  });

  it("getIndicatorParams returns [] for an unknown indicator", () => {
    const { result } = renderHookWithProvider(() => useIndicators());
    expect(result.current.getIndicatorParams("NOPE")).toEqual([]);
  });

  it("isIndicatorVisible defaults to true", () => {
    const { result } = renderHookWithProvider(() => useIndicators());
    expect(result.current.isIndicatorVisible("MA", true)).toBe(true);
    expect(result.current.isIndicatorVisible("VOL", false)).toBe(true);
  });

  it("addMainIndicator creates the chart indicator and tracks it", () => {
    const { result, chart } = renderHookWithProvider(() => useIndicators());
    act(() => result.current.addMainIndicator("EMA"));
    expect(chart.createIndicator).toHaveBeenCalled();
    expect(result.current.isMainIndicatorActive("EMA")).toBe(true);
    expect(result.current.activeMainIndicators).toContain("EMA");
  });

  it("removeMainIndicator clears it", () => {
    const { result } = renderHookWithProvider(() => useIndicators());
    // MA is active by default; remove it.
    act(() => result.current.removeMainIndicator("MA"));
    expect(result.current.isMainIndicatorActive("MA")).toBe(false);
  });

  it("addMainIndicator twice is idempotent (no duplicate)", () => {
    const { result } = renderHookWithProvider(() => useIndicators());
    act(() => result.current.addMainIndicator("EMA"));
    act(() => result.current.addMainIndicator("EMA"));
    expect(result.current.activeMainIndicators.filter((n) => n === "EMA")).toHaveLength(1);
  });

  it("toggleMainIndicator flips state", () => {
    const { result } = renderHookWithProvider(() => useIndicators());
    // MA is on by default → toggle off → on
    act(() => result.current.toggleMainIndicator("MA"));
    expect(result.current.isMainIndicatorActive("MA")).toBe(false);
    act(() => result.current.toggleMainIndicator("MA"));
    expect(result.current.isMainIndicatorActive("MA")).toBe(true);
  });
});
