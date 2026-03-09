import { useEffect, useRef, useState } from "react";
import { useWatchlist } from "react-klinecharts-ui";

const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];

interface TickerData {
  lastPrice: number;
  changePercent: number;
}

/**
 * Subscribes to Binance's combined mini-ticker WS for multiple symbols at once.
 * Debounces connection by a tick so rapid addSymbol() calls don't each open a WS.
 */
function useBinanceTickers(tickers: string[]) {
  const [prices, setPrices] = useState<Map<string, TickerData>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const key = tickers.join(",");

  useEffect(() => {
    if (tickers.length === 0) return;

    // Debounce: wait a tick so batch addSymbol calls settle
    const timer = setTimeout(() => {
      const streams = tickers
        .map((t) => `${t.toLowerCase()}@miniTicker`)
        .join("/");
      const ws = new WebSocket(
        `wss://stream.binance.com:9443/stream?streams=${streams}`,
      );
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        const d = msg.data;
        if (!d || !d.s) return;
        const ticker = d.s as string;
        const lastPrice = parseFloat(d.c);
        const open = parseFloat(d.o);
        const changePercent =
          open !== 0 ? ((lastPrice - open) / open) * 100 : 0;
        setPrices((prev) => {
          const next = new Map(prev);
          next.set(ticker, { lastPrice, changePercent });
          return next;
        });
      };
    }, 50);

    return () => {
      clearTimeout(timer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [key]);

  return prices;
}

export function WatchlistPanel() {
  const { items, addSymbol, switchSymbol, activeSymbol } = useWatchlist();
  const tickers = items.map((i) => i.ticker);
  const prices = useBinanceTickers(tickers);

  useEffect(() => {
    for (const ticker of DEFAULT_SYMBOLS) {
      addSymbol(ticker);
    }
  }, []);

  return (
    <div className="w-52 shrink-0 flex flex-col border-l bg-card text-card-foreground overflow-hidden">
      <div className="px-3 py-2 border-b">
        <span className="text-sm font-semibold">Watchlist</span>
      </div>
      <div className="flex-1 overflow-auto">
        {items.map((item) => {
          const data = prices.get(item.ticker);
          return (
            <button
              key={item.ticker}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/50 transition ${
                item.ticker === activeSymbol ? "bg-muted/30" : ""
              }`}
              onClick={() => switchSymbol(item.ticker)}
            >
              <span className="font-mono font-medium">{item.ticker}</span>
              <div className="text-right tabular-nums">
                {data ? (
                  <>
                    <div>{data.lastPrice.toFixed(2)}</div>
                    <div
                      className={
                        data.changePercent >= 0
                          ? "text-green-500"
                          : "text-red-500"
                      }
                    >
                      {data.changePercent >= 0 ? "+" : ""}
                      {data.changePercent.toFixed(2)}%
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground">-</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
