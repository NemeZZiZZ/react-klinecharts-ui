import { useAnnotations, useKlinechartsUI } from "react-klinecharts-ui";
import { StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AnnotationsButton() {
  const { state } = useKlinechartsUI();
  const { annotations, addAnnotation, clearAnnotations } = useAnnotations();

  const handleAdd = () => {
    const dataList = state.chart?.getDataList();
    if (!dataList || dataList.length === 0) return;
    const lastBar = dataList[dataList.length - 1];
    const text = prompt("Annotation text:");
    if (!text) return;
    addAnnotation(text, lastBar.close, lastBar.timestamp);
  };

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={handleAdd}>
            <StickyNote className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Add annotation</TooltipContent>
      </Tooltip>

      {annotations.length > 0 && (
        <button
          className="text-[10px] text-muted-foreground hover:text-foreground"
          onClick={clearAnnotations}
        >
          Clear ({annotations.length})
        </button>
      )}
    </div>
  );
}
