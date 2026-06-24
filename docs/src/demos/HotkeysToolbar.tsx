import { useEffect, useState } from "react";
import { useHotkeys } from "react-klinecharts-ui";

/** Registers a custom hotkey and toggles handling — showcases `useHotkeys`. */
export function HotkeysToolbar() {
  const { registerHotkey, setHotkeysEnabled } = useHotkeys();
  const [enabled, setEnabled] = useState(true);
  const [fired, setFired] = useState<string | null>(null);

  // Register once: Alt+C clears all overlays. (Avoids Cmd/Ctrl+K, which is the
  // Starlight docs search shortcut.)
  useEffect(() => {
    registerHotkey({
      name: "demo-clear-overlays",
      keys: ["alt+c"],
      preventDefault: true,
      action: ({ chart }) => {
        chart.removeOverlay();
        setFired(`cleared @ ${new Date().toLocaleTimeString()}`);
      },
    });
  }, [registerHotkey]);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setHotkeysEnabled(next);
  }

  return (
    <>
      <button onClick={toggle}>
        Hotkeys: {enabled ? "on" : "off"}
      </button>
      <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>
        Press Alt+C to clear overlays{fired ? ` · ${fired}` : ""}
      </span>
    </>
  );
}
