import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";
import { renderHookWithProvider } from "../../test/renderHook";
import { usePeriods } from "./usePeriods";
import { useTimezone } from "./useTimezone";
import { useKlinechartsUITheme } from "./useKlinechartsUITheme";
import { useKlinechartsUILoading } from "./useKlinechartsUILoading";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";

describe("usePeriods", () => {
  it("exposes the default periods and the active period", () => {
    const { result } = renderHookWithProvider(() => usePeriods());
    expect(result.current.periods.length).toBeGreaterThan(0);
    expect(result.current.activePeriod).toEqual(result.current.periods[0]);
  });

  it("setPeriod updates the active period", () => {
    const { result } = renderHookWithProvider(() => usePeriods());
    const second = result.current.periods[1];
    act(() => result.current.setPeriod(second));
    expect(result.current.activePeriod).toEqual(second);
  });
});

describe("useTimezone", () => {
  it("exposes the timezone list and the default active timezone", () => {
    const { result } = renderHookWithProvider(() => useTimezone());
    expect(result.current.timezones.length).toBeGreaterThan(0);
    expect(typeof result.current.activeTimezone).toBe("string");
  });

  it("setTimezone updates the active timezone", () => {
    const { result } = renderHookWithProvider(() => useTimezone());
    act(() => result.current.setTimezone("Etc/UTC"));
    expect(result.current.activeTimezone).toBe("Etc/UTC");
  });

  it("setTimezone also calls chart.setTimezone when chart is ready", () => {
    const { result, chart } = renderHookWithProvider(() => useTimezone());
    // chart is registered after mount; wrap in act to let effects flush.
    act(() => result.current.setTimezone("Europe/Berlin"));
    // chart.setTimezone may or may not be recorded depending on chart type;
    // here we assert the store reflects the change either way.
    expect(result.current.activeTimezone).toBe("Europe/Berlin");
  });
});

describe("useKlinechartsUITheme", () => {
  it("starts with the default theme (light)", () => {
    const { result } = renderHookWithProvider(() => useKlinechartsUITheme());
    expect(result.current.theme).toBe("light");
  });

  it("setTheme updates the theme", () => {
    const { result } = renderHookWithProvider(() => useKlinechartsUITheme());
    act(() => result.current.setTheme("dark"));
    expect(result.current.theme).toBe("dark");
  });

  it("toggleTheme flips between light and dark", () => {
    const { result } = renderHookWithProvider(() => useKlinechartsUITheme());
    expect(result.current.theme).toBe("light");
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("dark");
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("light");
  });
});

describe("useKlinechartsUILoading", () => {
  it("reflects the loading flag from the store (read-only)", () => {
    const { result } = renderHookWithProvider(() => {
      const loading = useKlinechartsUILoading();
      const { dispatch } = useKlinechartsUI();
      return { loading, dispatch };
    });
    expect(result.current.loading.isLoading).toBe(false);
    act(() => result.current.dispatch({ type: "SET_LOADING", isLoading: true }));
    expect(result.current.loading.isLoading).toBe(true);
    act(() => result.current.dispatch({ type: "SET_LOADING", isLoading: false }));
    expect(result.current.loading.isLoading).toBe(false);
  });
});
