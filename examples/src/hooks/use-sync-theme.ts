import { useEffect } from "react";

/**
 * Syncs the chart theme with the document root class,
 * so Radix portals inherit dark mode CSS variables.
 */
export function useSyncTheme(theme: string) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);
}
