import { useState } from "react";
import {
  KlinechartsUIProvider,
  useFullscreen,
  useKlinechartsUITheme,
  useKlinechartsUILoading,
  orderLine,
  depthOverlay,
} from "react-klinecharts-ui";
import { Menu, BookOpen, BarChart3, List } from "lucide-react";
import { binanceDatafeed, defaultSymbol } from "../../datafeed";
import { DrawingSidebar } from "../../components/DrawingSidebar";
import { Toolbar } from "../../components/Toolbar";
import { ChartView } from "../../components/ChartView";
import { StatusBar } from "../../components/StatusBar";
import { KeyboardShortcuts } from "../../components/KeyboardShortcuts";
import { OrderLineAlertSound } from "../../components/OrderLineAlertSound";
import { OrderBookPanel } from "../../components/OrderBookPanel";
import { DepthOverlayManager } from "../../components/DepthOverlayToggle";
import { ReplayControls } from "../../components/ReplayControls";
import { CompareDialog } from "../../components/CompareDialog";
import { MeasureButton } from "../../components/MeasureButton";
import { AnnotationsButton } from "../../components/AnnotationsButton";
import { WatchlistPanel } from "../../components/WatchlistPanel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "../../lib/utils";
import { useSyncTheme } from "../../hooks/use-sync-theme";

function TerminalLayout() {
  const { containerRef } = useFullscreen();
  const { theme } = useKlinechartsUITheme();
  const { isLoading } = useKlinechartsUILoading();
  const [showDrawingSidebar, setShowDrawingSidebar] = useState(true);
  const [showOrderBook, setShowOrderBook] = useState(false);
  const [showDepthOverlay, setShowDepthOverlay] = useState(false);
  const [showWatchlist, setShowWatchlist] = useState(false);

  useSyncTheme(theme);

  return (
    <TooltipProvider delayDuration={0}>
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        className="flex flex-col h-svh bg-background"
      >
        <header className="flex h-10 shrink-0 items-center border-b px-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showDrawingSidebar ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setShowDrawingSidebar((v) => !v)}
              >
                <Menu className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Drawing tools</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showOrderBook ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setShowOrderBook((v) => !v)}
              >
                <BookOpen className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Order Book</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showDepthOverlay ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setShowDepthOverlay((v) => !v)}
              >
                <BarChart3 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Depth Overlay</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showWatchlist ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setShowWatchlist((v) => !v)}
              >
                <List className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Watchlist</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <MeasureButton />
          <AnnotationsButton />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <CompareDialog />
          <ReplayControls />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Toolbar />
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div
            className={cn("flex-1 grid", {
              "grid-cols-[auto_1fr]": showDrawingSidebar,
              "": !showDrawingSidebar,
            })}
          >
            {showDrawingSidebar && <DrawingSidebar />}

            <div className="flex-[1_0_0] grid relative">
              <ChartView className="row-start-1 col-start-1 z-1" />

              {isLoading && (
                <span className="row-start-1 col-start-1 z-2 self-center justify-self-center h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
              )}
            </div>
          </div>

          {showOrderBook && <OrderBookPanel />}
          {showWatchlist && <WatchlistPanel />}
        </div>

        <StatusBar />
        <KeyboardShortcuts />
        <OrderLineAlertSound />
        <DepthOverlayManager isActive={showDepthOverlay} />
      </div>
    </TooltipProvider>
  );
}

export default function TerminalExample() {
  return (
    <KlinechartsUIProvider
      datafeed={binanceDatafeed}
      defaultSymbol={defaultSymbol}
      defaultTheme="dark"
      overlays={[orderLine, depthOverlay]}
      onStateChange={(action, nextState, prevState) => {
        console.log(action, nextState, prevState);
      }}
    >
      <TerminalLayout />
    </KlinechartsUIProvider>
  );
}
