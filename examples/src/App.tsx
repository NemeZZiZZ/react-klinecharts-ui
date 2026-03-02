import { useEffect } from "react";
import {
  KlinechartsUIProvider,
  useFullscreen,
  useKlinechartsUITheme,
  useKlinechartsUILoading,
  orderLine,
} from "react-klinecharts-ui";
import { binanceDatafeed, defaultSymbol } from "./datafeed";
import { DrawingSidebar } from "./components/DrawingSidebar";
import { Toolbar } from "./components/Toolbar";
import { ChartView } from "./components/ChartView";
import { TooltipProvider } from "@/components/ui/tooltip";

function TerminalLayout() {
  const { containerRef } = useFullscreen();
  const { theme } = useKlinechartsUITheme();
  const { isLoading } = useKlinechartsUILoading();

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
        className="flex min-h-svh w-full bg-background"
      >
        <DrawingSidebar />
        <div className="relative flex w-full flex-col">
          <header className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
            <Toolbar />
          </header>
          <div className="flex-[1_0_0] grid relative">
            <ChartView className="absolute inset-0" />

            {isLoading && (
              <span className="row-start-1 col-start-1 z-2 self-center justify-self-center h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            )}
          </div>
        </div>
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
