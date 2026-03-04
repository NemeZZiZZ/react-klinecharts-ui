import {
  usePeriods,
  useKlinechartsUITheme,
  useFullscreen,
  useScreenshot,
  useSymbolSearch,
  useUndoRedo,
} from "react-klinecharts-ui";
import { useModalState } from "../hooks/use-modal-state";
import {
  Sun,
  Moon,
  Maximize,
  Minimize,
  Camera,
  Settings,
  BarChart3,
  Globe,
  Search,
  ChevronDown,
  TrendingUp,
  Undo2,
  Redo2,
  Save,
  Code2,
  Clock,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IndicatorDialog } from "./IndicatorDialog";
import { SettingsDialog } from "./SettingsDialog";
import { TimezoneDialog } from "./TimezoneDialog";
import { SymbolSearchDialog } from "./SymbolSearchDialog";
import { ScreenshotDialog } from "./ScreenshotDialog";
import { OrderLineDialog } from "./OrderLineDialog";
import { LayoutManagerDialog } from "./LayoutManagerDialog";
import { ScriptEditorDialog } from "./ScriptEditorDialog";

export function Toolbar() {
  const { periods, activePeriod, setPeriod } = usePeriods();
  const { theme, toggleTheme } = useKlinechartsUITheme();
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const { capture } = useScreenshot();
  const { activeSymbol } = useSymbolSearch();
  const { canUndo, canRedo, undo, redo } = useUndoRedo();

  const indicatorModal = useModalState();
  const settingsModal = useModalState();
  const timezoneModal = useModalState();
  const symbolModal = useModalState();
  const screenshotModal = useModalState();
  const orderLineModal = useModalState();
  const layoutModal = useModalState();
  const scriptModal = useModalState();

  const handleScreenshot = () => {
    capture();
    screenshotModal.open();
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={symbolModal.open}
        className="gap-1.5 font-semibold"
      >
        <Search className="size-3.5 text-muted-foreground" />
        <span>{String(activeSymbol?.ticker ?? "Select Symbol")}</span>
        <ChevronDown className="size-3 text-muted-foreground" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Periods: dropdown on <md, buttons on md+ */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 xl:hidden">
            <Clock className="size-3.5 text-muted-foreground" />
            <span>{activePeriod.label}</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {periods.map((period) => (
            <DropdownMenuItem
              key={period.label}
              onClick={() => setPeriod(period)}
            >
              {activePeriod.span === period.span &&
                activePeriod.type === period.type && (
                  <Check className="size-3.5" />
                )}
              {period.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="hidden xl:flex items-center gap-0.5">
        {periods.map((period) => (
          <Button
            key={period.label}
            variant={
              activePeriod.span === period.span &&
              activePeriod.type === period.type
                ? "secondary"
                : "ghost"
            }
            size="sm"
            onClick={() => setPeriod(period)}
          >
            {period.label}
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" onClick={indicatorModal.open}>
            <BarChart3 className="size-4" />
            <span className="hidden lg:inline">Indicators</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Indicators</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="max-lg:hidden"
            variant="ghost"
            size="sm"
            onClick={timezoneModal.open}
          >
            <Globe className="size-4" />
            <span className="hidden lg:inline">Timezone</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Timezone</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" onClick={orderLineModal.open}>
            <TrendingUp className="size-4" />
            <span className="hidden lg:inline">Order Lines</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Order Lines</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="max-lg:hidden"
            variant="ghost"
            size="sm"
            onClick={scriptModal.open}
          >
            <Code2 className="size-4" />
            <span className="hidden lg:inline">Script</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Script Editor</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={settingsModal.open}>
            <Settings className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Settings</TooltipContent>
      </Tooltip>

      <div className="flex-1" />

      {/* Undo / Redo */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="max-lg:hidden"
            variant="ghost"
            size="icon-sm"
            onClick={undo}
            disabled={!canUndo}
          >
            <Undo2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="max-lg:hidden"
            variant="ghost"
            size="icon-sm"
            onClick={redo}
            disabled={!canRedo}
          >
            <Redo2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-5 max-lg:hidden" />

      {/* Layout Manager */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="max-lg:hidden"
            variant="ghost"
            size="icon-sm"
            onClick={layoutModal.open}
          >
            <Save className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Layouts</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="max-lg:hidden"
            variant="ghost"
            size="icon-sm"
            onClick={handleScreenshot}
          >
            <Camera className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Screenshot</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="max-lg:hidden"
            variant="ghost"
            size="icon-sm"
            onClick={toggleTheme}
          >
            {theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Toggle theme</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="max-lg:hidden"
            variant="ghost"
            size="icon-sm"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? (
              <Minimize className="size-4" />
            ) : (
              <Maximize className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Toggle fullscreen</TooltipContent>
      </Tooltip>

      <IndicatorDialog
        open={indicatorModal.isOpen}
        onOpenChange={indicatorModal.setIsOpen}
      />
      <SettingsDialog
        open={settingsModal.isOpen}
        onOpenChange={settingsModal.setIsOpen}
      />
      <TimezoneDialog
        open={timezoneModal.isOpen}
        onOpenChange={timezoneModal.setIsOpen}
      />
      <SymbolSearchDialog
        open={symbolModal.isOpen}
        onOpenChange={symbolModal.setIsOpen}
      />
      <ScreenshotDialog
        open={screenshotModal.isOpen}
        onOpenChange={screenshotModal.setIsOpen}
      />
      <OrderLineDialog
        open={orderLineModal.isOpen}
        onOpenChange={orderLineModal.setIsOpen}
      />
      <LayoutManagerDialog
        open={layoutModal.isOpen}
        onOpenChange={layoutModal.setIsOpen}
      />
      <ScriptEditorDialog
        open={scriptModal.isOpen}
        onOpenChange={scriptModal.setIsOpen}
      />
    </>
  );
}
