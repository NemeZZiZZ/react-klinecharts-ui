import { useMeasure } from "react-klinecharts-ui";
import { Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export function MeasureButton() {
  const { isActive, startMeasure, cancelMeasure, result } = useMeasure();

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isActive ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={isActive ? cancelMeasure : startMeasure}
          >
            <Ruler className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isActive ? "Cancel measure" : "Measure tool"}
        </TooltipContent>
      </Tooltip>

      {result && (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {result.priceDiff > 0 ? "+" : ""}
          {result.priceDiff.toFixed(2)} ({result.pricePercent > 0 ? "+" : ""}
          {result.pricePercent.toFixed(2)}%) · {result.bars} bars ·{" "}
          {formatTime(result.timeDiff)}
        </span>
      )}
    </div>
  );
}
