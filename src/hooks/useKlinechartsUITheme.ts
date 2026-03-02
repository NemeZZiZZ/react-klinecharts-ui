import { useCallback } from "react";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";

export interface UseKlinechartsUIThemeReturn {
  theme: string;
  setTheme: (theme: string) => void;
  toggleTheme: () => void;
}

export function useKlinechartsUITheme(): UseKlinechartsUIThemeReturn {
  const { state, dispatch } = useKlinechartsUI();

  const setTheme = useCallback(
    (theme: string) => {
      state.chart?.setStyles(theme);
      dispatch({ type: "SET_THEME", theme });
    },
    [state.chart, dispatch]
  );

  const toggleTheme = useCallback(() => {
    const newTheme = state.theme === "light" ? "dark" : "light";
    setTheme(newTheme);
  }, [state.theme, setTheme]);

  return {
    theme: state.theme,
    setTheme,
    toggleTheme,
  };
}
