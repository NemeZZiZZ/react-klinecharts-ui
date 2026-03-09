import { useState } from "react";
import {
  KlinechartsUIProvider,
  useKlinechartsUITheme,
  usePeriods,
  useIndicators,
  useFullscreen,
  orderLine,
  DEFAULT_PERIODS,
} from "react-klinecharts-ui";
import { Sun, Moon, Maximize, Minimize, BarChart3 } from "lucide-react";
import { binanceDatafeed, defaultSymbol } from "../../datafeed";
import { ChartView } from "../../components/ChartView";
import { useSyncTheme } from "../../hooks/use-sync-theme";

// -- Period Selector (horizontal scroll) --

function PeriodSelector() {
  const { activePeriod, setPeriod } = usePeriods();

  return (
    <div className="flex gap-1 overflow-x-auto no-scrollbar px-2 py-1">
      {DEFAULT_PERIODS.map((p) => {
        const isActive =
          activePeriod.span === p.span && activePeriod.type === p.type;
        return (
          <button
            key={p.label}
            onClick={() => setPeriod(p)}
            className={`shrink-0 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// -- Indicator Panel (simple toggle buttons) --

const MAIN_IND = ["MA", "EMA", "BOLL"] as const;
const SUB_IND = ["VOL", "MACD", "RSI"] as const;

function IndicatorPanel({ onClose }: { onClose: () => void }) {
  const { toggleMainIndicator, toggleSubIndicator, mainIndicators, subIndicators } =
    useIndicators();

  return (
    <div className="absolute bottom-12 left-0 right-0 z-50 bg-background border-t p-3 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Indicators
        </span>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>

      <div className="mb-2">
        <span className="text-xs text-muted-foreground mb-1 block">Main</span>
        <div className="flex gap-1.5">
          {MAIN_IND.map((name) => {
            const isActive = mainIndicators.some(
              (i) => i.name === name && i.isActive
            );
            return (
              <button
                key={name}
                onClick={() => toggleMainIndicator(name)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="text-xs text-muted-foreground mb-1 block">Sub</span>
        <div className="flex gap-1.5">
          {SUB_IND.map((name) => {
            const isActive = subIndicators.some(
              (i) => i.name === name && i.isActive
            );
            return (
              <button
                key={name}
                onClick={() => toggleSubIndicator(name)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// -- Bottom Toolbar --

function BottomToolbar() {
  const { theme, toggleTheme } = useKlinechartsUITheme();
  const { isFullscreen, toggle: toggleFullscreen, containerRef } = useFullscreen();
  const [showIndicators, setShowIndicators] = useState(false);

  // containerRef is used by the provider for fullscreen targeting
  void containerRef;

  return (
    <>
      {showIndicators && (
        <IndicatorPanel onClose={() => setShowIndicators(false)} />
      )}
      <div className="flex items-center justify-around border-t bg-background px-2 py-1.5 shrink-0">
        <button
          onClick={toggleTheme}
          className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors p-1"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="size-5" />
          ) : (
            <Moon className="size-5" />
          )}
          <span className="text-[10px]">Theme</span>
        </button>

        <button
          onClick={() => setShowIndicators((v) => !v)}
          className={`flex flex-col items-center gap-0.5 transition-colors p-1 ${
            showIndicators
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Indicators"
        >
          <BarChart3 className="size-5" />
          <span className="text-[10px]">Indicators</span>
        </button>

        <button
          onClick={toggleFullscreen}
          className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors p-1"
          aria-label="Toggle fullscreen"
        >
          {isFullscreen ? (
            <Minimize className="size-5" />
          ) : (
            <Maximize className="size-5" />
          )}
          <span className="text-[10px]">Fullscreen</span>
        </button>
      </div>
    </>
  );
}

// -- Main Layout --

function MobileLayout() {
  const { containerRef } = useFullscreen();
  const { theme } = useKlinechartsUITheme();

  useSyncTheme(theme);

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className="flex flex-col h-svh bg-background text-foreground"
    >
      {/* Header */}
      <header className="flex items-center gap-2 border-b px-3 py-1.5 shrink-0">
        <span className="text-sm font-semibold whitespace-nowrap">
          {defaultSymbol.ticker}
        </span>
        <div className="flex-1 min-w-0">
          <PeriodSelector />
        </div>
      </header>

      {/* Chart */}
      <div className="flex-1 relative min-h-0">
        <ChartView className="absolute inset-0" />
      </div>

      {/* Bottom Toolbar */}
      <BottomToolbar />
    </div>
  );
}

// -- Page Entry --
// Note: The viewport meta tag should already be present in index.html:
//   <meta name="viewport" content="width=device-width, initial-scale=1" />

export default function MobileExample() {
  return (
    <KlinechartsUIProvider
      datafeed={binanceDatafeed}
      defaultSymbol={defaultSymbol}
      defaultTheme="dark"
      overlays={[orderLine]}
    >
      <MobileLayout />
    </KlinechartsUIProvider>
  );
}
