import { useEffect } from "react";
import { useDrawingTools, useUndoRedo } from "react-klinecharts-ui";

/**
 * Global keyboard shortcuts handler.
 * - Escape: exit drawing mode
 * - Ctrl+Z: undo
 * - Ctrl+Y / Ctrl+Shift+Z: redo
 */
export function KeyboardShortcuts() {
  const { activeTool, clearActiveTool } = useDrawingTools();
  const { canUndo, canRedo, undo, redo } = useUndoRedo();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape" && activeTool) {
        e.preventDefault();
        clearActiveTool();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === "z" && !e.shiftKey && canUndo) {
          e.preventDefault();
          undo();
        } else if (
          (e.key === "y" || (e.key === "z" && e.shiftKey)) &&
          canRedo
        ) {
          e.preventDefault();
          redo();
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activeTool, clearActiveTool, canUndo, canRedo, undo, redo]);

  return null;
}
