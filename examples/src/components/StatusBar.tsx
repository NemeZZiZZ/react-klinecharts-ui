import { useKlinechartsUI, useDrawingTools } from "react-klinecharts-ui";
import { CrosshairDataPanel } from "./CrosshairDataPanel";

/**
 * Bottom status bar showing current symbol, period, active tool, and crosshair data.
 */
export function StatusBar() {
  const { state } = useKlinechartsUI();
  const { activeTool, autoRetrigger } = useDrawingTools();

  return (
    <footer className="flex h-6 shrink-0 items-center gap-2 border-t border-border bg-card px-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">
        {state.symbol?.ticker ?? "—"}
      </span>
      <span>{state.period?.label ?? ""}</span>

      <div className="mx-1 h-3 w-px bg-border" />

      <CrosshairDataPanel />

      <div className="flex-1" />

      {activeTool && (
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
          {activeTool}
          {autoRetrigger && " (auto)"}
        </span>
      )}
      {!activeTool && (
        <span className="text-muted-foreground/60">
          Esc to exit drawing · Ctrl+Z/Y undo/redo
        </span>
      )}
    </footer>
  );
}
