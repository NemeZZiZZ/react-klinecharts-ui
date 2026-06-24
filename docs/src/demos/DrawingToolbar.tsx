import { useDrawingTools } from "react-klinecharts-ui";

const TOOLS: { id: string; label: string }[] = [
  { id: "horizontalStraightLine", label: "H-Line" },
  { id: "straightLine", label: "Line" },
  { id: "rayLine", label: "Ray" },
  { id: "priceLine", label: "Price" },
  { id: "fibRetracement", label: "Fib" },
  { id: "rect", label: "Rect" },
];

/** Select a drawing tool and clear the canvas — showcases `useDrawingTools`. */
export function DrawingToolbar() {
  const { activeTool, selectTool, clearActiveTool, removeAllDrawings } =
    useDrawingTools();

  return (
    <>
      {TOOLS.map((t) => (
        <button
          key={t.id}
          data-active={activeTool === t.id}
          onClick={() =>
            activeTool === t.id ? clearActiveTool() : selectTool(t.id)
          }
        >
          {t.label}
        </button>
      ))}
      <button onClick={() => removeAllDrawings()}>Clear all</button>
    </>
  );
}
