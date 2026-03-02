import { useState, useEffect, useCallback } from "react";
import { useKLineChart, useChartEvent, Widget } from "react-klinecharts";
import { useOrderLines } from "react-klinecharts-ui";
import { X } from "lucide-react";
import { Button } from "./ui/button";

const DEFAULT_COLOR = "rgba(255, 165, 0, 0.5)";

// --- Main component ---

export function OrderLineOverlays() {
  const { createOrderLine, removeOrderLine } = useOrderLines();
  const chart = useKLineChart();

  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Chart event subscriptions via useChartEvent (handles sub/unsub automatically)
  useChartEvent("onScroll", refresh);
  useChartEvent("onZoom", refresh);

  // ResizeObserver — not a chart action, needs manual setup
  useEffect(() => {
    if (!chart) return;
    const el = chart.getDom();
    if (!el) return;
    const ro = new ResizeObserver(refresh);
    ro.observe(el);
    return () => ro.disconnect();
  }, [chart, refresh]);

  // Double-click on candle_pane → create order line at clicked price
  useEffect(() => {
    if (!chart) return;
    const canvasEl = chart.getDom("candle_pane", "main");
    if (!canvasEl) return;

    const handleDblClick = (e: MouseEvent) => {
      const rect = canvasEl.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const result = chart.convertFromPixel([{ x: 0, y }], {
        paneId: "candle_pane",
      });
      const arr = Array.isArray(result) ? result : [result];
      const price = arr[0]?.value;
      if (price != null) {
        createOrderLine({
          price,
          color: DEFAULT_COLOR,
          draggable: true,
          label: {
            bg: "rgba(59, 130, 246, 0.85)",
            color: "#ffffff",
            borderRadius: 2,
            padding: { x: 4, y: 2 },
          },
        });
        requestAnimationFrame(refresh);
      }
    };

    canvasEl.addEventListener("dblclick", handleDblClick);
    return () => canvasEl.removeEventListener("dblclick", handleDblClick);
  }, [chart, createOrderLine, refresh]);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Get yAxis width from its DOM element
  const yAxisDom = chart?.getDom("candle_pane", "yAxis");
  const yAxisWidth = yAxisDom?.clientWidth ?? 0;

  if (!chart) return null;

  const overlays = chart.getOverlays({ name: "orderLine" });
  if (!overlays?.length) return null;

  const lines: { id: string; y: number }[] = [];

  for (const overlay of overlays) {
    const price = overlay.points[0]?.value;
    if (price == null) continue;

    const raw = chart.convertToPixel(
      [{ value: price, dataIndex: overlay.points[0]?.dataIndex ?? 0 }],
      { paneId: "candle_pane" },
    );
    const coordArr = Array.isArray(raw) ? raw : [raw];
    const y = coordArr[0]?.y;
    if (y == null) continue;

    lines.push({ id: overlay.id, y });
  }

  return (
    <Widget paneId="candle_pane" position="root">
      {lines.map((line) => (
        <div
          key={line.id}
          onMouseEnter={() => setHoveredId(line.id)}
          onMouseLeave={() => setHoveredId(null)}
          className="absolute right-0 pointer-events-auto z-100"
          style={{ top: line.y - 10, height: 20, width: yAxisWidth + 20 }}
        >
          {hoveredId === line.id && (
            <Button
              className="flex bg-destructive/75 hover:bg-destructive text-destructive-foreground w-auto h-full top-0 aspect-square cursor-pointer rounded-xs"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                removeOrderLine(line.id);
                requestAnimationFrame(refresh);
              }}
              title="Remove order line"
            >
              <X className="size-3" />
            </Button>
          )}
        </div>
      ))}
    </Widget>
  );
}
