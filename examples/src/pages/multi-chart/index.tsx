import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type MutableRefObject,
} from "react";
import {
  KlinechartsUIProvider,
  useKlinechartsUITheme,
  useKlinechartsUI,
  orderLine,
} from "react-klinecharts-ui";
import { binanceDatafeed } from "../../datafeed";
import { ChartView } from "../../components/ChartView";
import { useSyncTheme } from "../../hooks/use-sync-theme";

// NOTE: The Binance datafeed uses a global WebSocket singleton that only
// supports one subscription at a time. Each chart will load historical data
// correctly, but only the last-mounted chart will receive real-time updates.
// This is acceptable for a demo — a production setup would need per-chart
// WebSocket instances.

const SYMBOLS = [
  { ticker: "BTCUSDT", pricePrecision: 2, volumePrecision: 5 },
  { ticker: "ETHUSDT", pricePrecision: 2, volumePrecision: 4 },
  { ticker: "SOLUSDT", pricePrecision: 2, volumePrecision: 2 },
  { ticker: "BNBUSDT", pricePrecision: 2, volumePrecision: 3 },
] as const;

// ---------------------------------------------------------------------------
// Sync context — lives OUTSIDE the individual KlinechartsUIProviders so all
// four charts can share a single coordination channel.
// ---------------------------------------------------------------------------

type ChartInstance = any; // klinecharts Chart type

interface SyncChannel {
  /** All registered chart instances */
  charts: MutableRefObject<Set<ChartInstance>>;
  /** Flag to prevent re-entrant broadcasts */
  broadcasting: MutableRefObject<boolean>;
}

const SyncContext = createContext<SyncChannel | null>(null);

function SyncProvider({ children }: { children: React.ReactNode }) {
  const charts = useRef(new Set<ChartInstance>());
  const broadcasting = useRef(false);

  return (
    <SyncContext.Provider value={{ charts, broadcasting }}>
      {children}
    </SyncContext.Provider>
  );
}

function useSyncChannel() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSyncChannel must be inside <SyncProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Hook: register chart and subscribe to crosshair + scroll events
// ---------------------------------------------------------------------------

function useChartSync() {
  // useKlinechartsUI gives us the chart from the provider context,
  // unlike useKLineChart which requires being inside <KLineChart>.
  const { state } = useKlinechartsUI();
  const chart = state.chart;
  const { charts, broadcasting } = useSyncChannel();

  // Register / unregister this chart instance
  useEffect(() => {
    if (!chart) return;
    charts.current.add(chart);
    return () => {
      charts.current.delete(chart);
    };
  }, [chart, charts]);

  // ---- Crosshair sync ----
  useEffect(() => {
    if (!chart) return;

    const crosshairHandler = (event: any) => {
      if (broadcasting.current) return;

      const dataIndex = event?.dataIndex;
      if (dataIndex == null || dataIndex < 0) return;

      broadcasting.current = true;
      try {
        for (const other of charts.current) {
          if (other === chart) continue;
          try {
            (other as any).crosshairChange?.({ dataIndex });
          } catch {
            // silently ignore
          }
        }
      } finally {
        broadcasting.current = false;
      }
    };

    chart.subscribeAction("onCrosshairChange", crosshairHandler);
    return () => {
      chart.unsubscribeAction("onCrosshairChange", crosshairHandler);
    };
  }, [chart, charts, broadcasting]);

  // ---- Scroll sync via onScroll (delta-based) ----
  useEffect(() => {
    if (!chart) return;

    const scrollHandler = (event: any) => {
      if (broadcasting.current) return;

      const distance = event?.distance;
      if (distance == null || distance === 0) return;

      broadcasting.current = true;
      try {
        for (const other of charts.current) {
          if (other === chart) continue;
          try {
            // Apply the same pixel delta — startScroll + scroll mirrors the
            // user gesture without needing absolute positioning.
            const store = (other as any)._chartStore;
            if (store) {
              store.startScroll();
              store.scroll(distance);
            }
          } catch {
            // silently ignore
          }
        }
      } finally {
        // Delay clearing the flag so that the onScroll events fired by
        // store.scroll() on the receiving charts are still suppressed.
        requestAnimationFrame(() => {
          broadcasting.current = false;
        });
      }
    };

    chart.subscribeAction("onScroll", scrollHandler);
    return () => {
      chart.unsubscribeAction("onScroll", scrollHandler);
    };
  }, [chart, charts, broadcasting]);

  // ---- Zoom sync via onZoom ----
  useEffect(() => {
    if (!chart) return;

    const zoomHandler = () => {
      if (broadcasting.current) return;

      const barSpace = (chart as any).getBarSpace?.()?.bar;
      if (barSpace == null) return;

      broadcasting.current = true;
      try {
        for (const other of charts.current) {
          if (other === chart) continue;
          try {
            (other as any).setBarSpace?.(barSpace);
          } catch {
            // silently ignore
          }
        }
      } finally {
        requestAnimationFrame(() => {
          broadcasting.current = false;
        });
      }
    };

    chart.subscribeAction("onZoom", zoomHandler);
    return () => {
      chart.unsubscribeAction("onZoom", zoomHandler);
    };
  }, [chart, charts, broadcasting]);
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/** Inner component that syncs the document theme from the first provider. */
function ThemeSync() {
  const { theme } = useKlinechartsUITheme();
  useSyncTheme(theme);
  return null;
}

/** A single chart cell with a symbol label and sync behaviour. */
function ChartCell({ symbol }: { symbol: (typeof SYMBOLS)[number] }) {
  return (
    <div className="relative border border-border overflow-hidden">
      <span className="absolute top-2 left-3 z-10 text-xs font-mono text-muted-foreground select-none">
        {symbol.ticker}
      </span>
      <ChartView className="absolute inset-0" />
      <ChartSyncBridge />
    </div>
  );
}

/**
 * Invisible component that hooks into the chart instance from
 * KlinechartsUIProvider context and wires up sync.
 */
function ChartSyncBridge() {
  useChartSync();
  return null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MultiChartExample() {
  return (
    <SyncProvider>
      <div className="grid grid-cols-2 grid-rows-2 h-svh bg-background">
        {SYMBOLS.map((symbol, index) => (
          <KlinechartsUIProvider
            key={symbol.ticker}
            datafeed={binanceDatafeed}
            defaultSymbol={symbol}
            defaultTheme="dark"
            overlays={[orderLine]}
          >
            {/* Sync document theme class from the first chart only */}
            {index === 0 && <ThemeSync />}
            <ChartCell symbol={symbol} />
          </KlinechartsUIProvider>
        ))}
      </div>
    </SyncProvider>
  );
}
