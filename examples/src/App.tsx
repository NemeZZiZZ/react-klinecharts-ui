import { useEffect, useState } from "react";
import {
  KlinechartsUIProvider,
  useFullscreen,
  useKlinechartsUITheme,
  useKlinechartsUILoading,
  orderLine,
} from "react-klinecharts-ui";
import { Menu } from "lucide-react";
import { binanceDatafeed, defaultSymbol } from "./datafeed";
import { DrawingSidebar } from "./components/DrawingSidebar";
import { Toolbar } from "./components/Toolbar";
import { ChartView } from "./components/ChartView";
import { StatusBar } from "./components/StatusBar";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "./lib/utils";

function TerminalLayout() {
  const { containerRef } = useFullscreen();
  const { theme } = useKlinechartsUITheme();
  const { isLoading } = useKlinechartsUILoading();
  const [showDrawingSidebar, setShowDrawingSidebar] = useState(true);

  // Set .dark on <html> so Radix portals (Dialog, Popover, Tooltip)
  // also inherit dark mode CSS variables
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

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
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Toolbar />
        </header>

        <div
          className={cn("flex-1 grid", {
            "grid-cols-[auto_1fr]": showDrawingSidebar,
            "": !showDrawingSidebar,
          })}
        >
          {showDrawingSidebar && <DrawingSidebar />}

          <div className="flex-[1_0_0] grid relative">
            <ChartView className="absolute inset-0" />

            {isLoading && (
              <span className="row-start-1 col-start-1 z-2 self-center justify-self-center h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            )}
          </div>
        </div>

        <StatusBar />
        <KeyboardShortcuts />
      </div>
    </TooltipProvider>
  );
}

export default function App() {
  return (
    <KlinechartsUIProvider
      datafeed={binanceDatafeed}
      defaultSymbol={defaultSymbol}
      defaultTheme="dark"
      overlays={[orderLine]}
      onStateChange={(action, nextState, prevState) => {
        console.log(action, nextState, prevState);
      }}
    >
      <TerminalLayout />
    </KlinechartsUIProvider>
  );
}
