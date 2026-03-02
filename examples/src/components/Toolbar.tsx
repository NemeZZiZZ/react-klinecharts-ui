import {
  usePeriods,
  useKlinechartsUITheme,
  useFullscreen,
  useScreenshot,
  useSymbolSearch,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IndicatorDialog } from "./IndicatorDialog";
import { SettingsDialog } from "./SettingsDialog";
import { TimezoneDialog } from "./TimezoneDialog";
import { SymbolSearchDialog } from "./SymbolSearchDialog";
import { ScreenshotDialog } from "./ScreenshotDialog";
import { OrderLineDialog } from "./OrderLineDialog";

export function Toolbar() {
  const { periods, activePeriod, setPeriod } = usePeriods();
  const { theme, toggleTheme } = useKlinechartsUITheme();
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const { capture } = useScreenshot();
  const { activeSymbol } = useSymbolSearch();

  const indicatorModal = useModalState();
  const settingsModal = useModalState();
  const timezoneModal = useModalState();
  const symbolModal = useModalState();
  const screenshotModal = useModalState();
  const orderLineModal = useModalState();

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

      <div className="flex items-center gap-0.5">
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
            <span className="hidden sm:inline">Indicators</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Indicators</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" onClick={timezoneModal.open}>
            <Globe className="size-4" />
            <span className="hidden sm:inline">Timezone</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Timezone</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" onClick={orderLineModal.open}>
            <TrendingUp className="size-4" />
            <span className="hidden sm:inline">Order Lines</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Order Lines</TooltipContent>
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

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={handleScreenshot}>
            <Camera className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Screenshot</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={toggleTheme}>
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
          <Button variant="ghost" size="icon-sm" onClick={toggleFullscreen}>
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
    </>
  );
}
