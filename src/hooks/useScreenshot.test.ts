import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";
import { renderHookWithProvider } from "../../test/renderHook";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";
import { createMockChart } from "../../test/mockChart";
import { useScreenshot } from "./useScreenshot";

function useScreenshotWithDispatch() {
  const shot = useScreenshot();
  const { dispatch } = useKlinechartsUI();
  return { ...shot, dispatch };
}

describe("useScreenshot", () => {
  it("capture stores the chart picture URL", () => {
    const { result, chart } = renderHookWithProvider(() => useScreenshot());
    expect(result.current.screenshotUrl).toBeNull();
    act(() => result.current.capture());
    expect(chart.getConvertPictureUrl).toHaveBeenCalled();
    expect(result.current.screenshotUrl).toBe("data:image/jpeg;base64,");
  });

  it("a symbol change clears a previously captured screenshot", () => {
    const { result } = renderHookWithProvider(() => useScreenshotWithDispatch());
    act(() => result.current.capture());
    expect(result.current.screenshotUrl).not.toBeNull();
    act(() =>
      result.current.dispatch({
        type: "SET_SYMBOL",
        symbol: { ticker: "ETHUSDT" },
      }),
    );
    // Without the reset the hook keeps serving the old symbol's picture.
    expect(result.current.screenshotUrl).toBeNull();
  });

  it("a chart swap clears a previously captured screenshot", () => {
    const { result } = renderHookWithProvider(() => useScreenshotWithDispatch());
    act(() => result.current.capture());
    expect(result.current.screenshotUrl).not.toBeNull();
    act(() =>
      result.current.dispatch({
        type: "SET_CHART",
        chart: createMockChart() as never,
      } as never),
    );
    expect(result.current.screenshotUrl).toBeNull();
  });

  it("clear resets the URL", () => {
    const { result } = renderHookWithProvider(() => useScreenshot());
    act(() => result.current.capture());
    act(() => result.current.clear());
    expect(result.current.screenshotUrl).toBeNull();
  });
});
