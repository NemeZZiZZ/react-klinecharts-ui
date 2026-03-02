import { useDrawingTools } from "react-klinecharts-ui";
import {
  Slash,
  Route,
  Hexagon,
  Activity,
  Waves,
  Magnet,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  singleLine: Slash,
  moreLine: Route,
  polygon: Hexagon,
  fibonacci: Activity,
  wave: Waves,
};

const CATEGORY_LABELS: Record<string, string> = {
  singleLine: "Lines",
  moreLine: "Channels",
  polygon: "Shapes",
  fibonacci: "Fibonacci",
  wave: "Waves",
};

export function DrawingSidebar() {
  const {
    categories,
    activeTool,
    magnetMode,
    isLocked,
    isVisible,
    selectTool,
    setMagnetMode,
    toggleLock,
    toggleVisibility,
    removeAllDrawings,
  } = useDrawingTools();

  return (
    <div className="flex w-10 flex-col items-center gap-0.5 border-r border-border bg-card py-1">
      {categories.map((category) => {
        const Icon = CATEGORY_ICONS[category.key] ?? Slash;
        const label = CATEGORY_LABELS[category.key] ?? category.key;
        const hasActive = category.tools.some((t) => t.name === activeTool);

        return (
        <Popover key={category.key}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant={hasActive ? "secondary" : "ghost"} size="icon-sm">
                  <Icon className="size-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>

          <PopoverContent side="right" align="start" className="w-auto min-w-48 p-1">
            <ScrollArea className="max-h-[70vh]">
              {category.tools.map((tool) => (
                <button
                  key={tool.name}
                  onClick={() => selectTool(tool.name)}
                  className={cn(
                    "flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors",
                    "hover:bg-accent",
                    activeTool === tool.name && "bg-primary/10 text-primary",
                  )}
                >
                  {tool.name}
                </button>
              ))}
            </ScrollArea>
          </PopoverContent>
        </Popover>
        );
      })}

      <Separator className="my-1 w-5" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={
              magnetMode === "strong"
                ? "bg-primary/30"
                : magnetMode === "weak"
                  ? "bg-primary/15"
                  : ""
            }
            onClick={() =>
              setMagnetMode(
                magnetMode === "normal"
                  ? "weak"
                  : magnetMode === "weak"
                    ? "strong"
                    : "normal",
              )
            }
          >
            <Magnet className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Magnet: {magnetMode}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isLocked ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={toggleLock}
          >
            {isLocked ? (
              <Lock className="size-4" />
            ) : (
              <Unlock className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {isLocked ? "Unlock drawings" : "Lock drawings"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={toggleVisibility}>
            {isVisible ? (
              <Eye className="size-4" />
            ) : (
              <EyeOff className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {isVisible ? "Hide drawings" : "Show drawings"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={removeAllDrawings}>
            <Trash2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Remove all drawings</TooltipContent>
      </Tooltip>
    </div>
  );
}
