import { useState, useMemo } from "react";
import { useKlinechartsUI, useOrderLines } from "react-klinecharts-ui";
import type { OrderLineExtendData } from "react-klinecharts-ui";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OrderLineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LINE_STYLES = ["solid", "dashed", "dotted"] as const;

export function OrderLineDialog({ open, onOpenChange }: OrderLineDialogProps) {
  const { state } = useKlinechartsUI();
  const chart = state.chart;
  const { createOrderLine, removeOrderLine } = useOrderLines();

  // Counter to force recalc after local add/remove
  const [tick, setTick] = useState(0);

  // Read order lines directly from the chart — includes lines from any source.
  // Recalculates when dialog opens, after local mutations, or when chart changes.
  const lines = useMemo(() => {
    if (!chart || !open) return [];
    void tick;
    const overlays = chart.getOverlays({ name: "orderLine" }) ?? [];
    return overlays.map((overlay) => {
      const ext = (overlay.extendData ?? {}) as OrderLineExtendData;
      return {
        id: overlay.id,
        price: overlay.points[0]?.value ?? 0,
        color: ext.color ?? "rgba(255, 165, 0, 0.85)",
        text: ext.text ?? "",
        lineStyle: ext.line?.style ?? "dashed",
      };
    });
  }, [chart, open, tick]);

  // Form state
  const [price, setPrice] = useState("");
  const [color, setColor] = useState("#f59e0b");
  const [text, setText] = useState("");
  const [lineStyle, setLineStyle] =
    useState<"solid" | "dashed" | "dotted">("dashed");

  const handleAdd = () => {
    const priceNum = parseFloat(price);
    if (isNaN(priceNum)) return;

    const id = createOrderLine({
      price: priceNum,
      color,
      text: text.trim() || undefined,
      line: { style: lineStyle, width: 1 },
      draggable: true,
    });

    if (id) {
      setTick((t) => t + 1);
      setPrice("");
      setText("");
    }
  };

  const handleRemove = (id: string) => {
    removeOrderLine(id);
    setTick((t) => t + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Order Lines</DialogTitle>
          <DialogDescription>
            Add horizontal price levels to the chart.
          </DialogDescription>
        </DialogHeader>

        {/* Create form */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1"
            />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="size-9 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
              title="Line color"
            />
          </div>

          <Input
            placeholder="Label (optional)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />

          <div className="flex gap-1">
            {LINE_STYLES.map((style) => (
              <Button
                key={style}
                variant={lineStyle === style ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setLineStyle(style)}
                className="flex-1 capitalize"
              >
                {style}
              </Button>
            ))}
          </div>

          <Button
            onClick={handleAdd}
            disabled={!price || isNaN(parseFloat(price))}
            className="w-full"
            size="sm"
          >
            <Plus className="size-4" />
            Add Line
          </Button>
        </div>

        {lines.length > 0 && (
          <>
            <Separator />
            <ScrollArea className="max-h-48">
              <div className="space-y-1 pr-2">
                {lines.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                  >
                    {/* Color swatch */}
                    <div
                      className="size-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: line.color }}
                    />
                    <span className="flex-1 text-sm font-mono">
                      {line.price.toLocaleString()}
                    </span>
                    {line.text && (
                      <span className="text-xs text-muted-foreground truncate max-w-20">
                        {line.text}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemove(line.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
