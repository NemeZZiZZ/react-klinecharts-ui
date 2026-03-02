import { useCallback } from "react";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";

export interface UseScreenshotReturn {
  screenshotUrl: string | null;
  capture: () => void;
  download: (filename?: string) => void;
  clear: () => void;
}

export function useScreenshot(): UseScreenshotReturn {
  const { state, dispatch } = useKlinechartsUI();

  const capture = useCallback(() => {
    if (!state.chart) return;
    const url = state.chart.getConvertPictureUrl(true, "jpeg", state.theme === "dark" ? "#151517" : "#ffffff");
    dispatch({ type: "SET_SCREENSHOT_URL", url });
  }, [state.chart, state.theme, dispatch]);

  const download = useCallback(
    (filename = "chart-screenshot.jpg") => {
      if (!state.screenshotUrl) return;
      const link = document.createElement("a");
      link.href = state.screenshotUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [state.screenshotUrl]
  );

  const clear = useCallback(() => {
    dispatch({ type: "SET_SCREENSHOT_URL", url: null });
  }, [dispatch]);

  return {
    screenshotUrl: state.screenshotUrl,
    capture,
    download,
    clear,
  };
}
