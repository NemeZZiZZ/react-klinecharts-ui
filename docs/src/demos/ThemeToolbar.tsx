import { useKlinechartsUITheme } from "react-klinecharts-ui";

/** Toggle between light and dark chart themes — showcases `useKlinechartsUITheme`. */
export function ThemeToolbar() {
  const { theme, toggleTheme } = useKlinechartsUITheme();
  return (
    <button onClick={toggleTheme}>
      Theme: <strong>{theme}</strong> — click to toggle
    </button>
  );
}
