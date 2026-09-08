import type { Chart } from "klinecharts";

/**
 * Group id shared by `useDrawingTools`, `useUndoRedo` and layout
 * serialization. Only overlays in this group are user drawings — alert lines
 * ("price_alerts"), order lines, annotations and the depth overlay live in
 * their own subsystems and must never be listed, overridden or wiped as
 * drawings.
 */
export const DRAWING_GROUP_ID = "drawing_tools";

/**
 * Reactive snapshot of one drawing from the `drawing_tools` group.
 * Fields mirror the public properties of klinecharts v10 `Overlay`.
 */
export interface DrawingOverlayInfo {
  /** Stable id from klinecharts (chart.getOverlays()[].id). */
  id: string;
  /** Overlay name, e.g. "segment", "fibonacciLine", "arrow". */
  name: string;
  /** Pane id the drawing lives on. */
  paneId: string;
  /** Current lock state. */
  locked: boolean;
  /** Current visibility. */
  visible: boolean;
}

/**
 * Read the current list of drawings in the `drawing_tools` group.
 * Returns `[]` when there is no chart — callers (provider polling, refresh
 * after mutation) should not have to branch on null.
 */
export function readDrawingOverlays(
  chart: Chart | null | undefined,
): DrawingOverlayInfo[] {
  if (!chart) return [];
  const list = chart.getOverlays({ groupId: DRAWING_GROUP_ID }) as any[];
  if (!list) return [];
  return list.map((o) => ({
    id: o.id,
    name: o.name,
    paneId: o.paneId,
    locked: !!o.lock,
    visible: o.visible !== false, // klinecharts default = true
  }));
}

/**
 * Compare two snapshots over the fields a consumer can see.
 * Polling ticks once per second: without this comparison every tick would
 * swap in a new array and re-render the tree even when nothing changed.
 */
export function drawingOverlaysEqual(
  a: DrawingOverlayInfo[],
  b: DrawingOverlayInfo[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.name !== y.name ||
      x.paneId !== y.paneId ||
      x.locked !== y.locked ||
      x.visible !== y.visible
    ) {
      return false;
    }
  }
  return true;
}
