import { useCallback, useEffect, useRef, useState } from "react";
import { useKlinechartsUI } from "react-klinecharts-ui";

interface DepthRow {
  price: string;
  qty: string;
  total: number;
}

interface DepthData {
  bids: DepthRow[];
  asks: DepthRow[];
  spread: string;
  maxTotal: number;
}

function parseDepth(raw: {
  bids: [string, string][];
  asks: [string, string][];
}): DepthData {
  const sortedAsks = [...raw.asks].sort(
    (a, b) => parseFloat(b[0]) - parseFloat(a[0]),
  );
  const sortedBids = [...raw.bids].sort(
    (a, b) => parseFloat(b[0]) - parseFloat(a[0]),
  );

  let cumAsk = 0;
  const asks: DepthRow[] = sortedAsks.map(([price, qty]) => {
    cumAsk += parseFloat(qty);
    return { price, qty, total: cumAsk };
  });
  asks.reverse();
  let runAsk = 0;
  for (let i = asks.length - 1; i >= 0; i--) {
    runAsk += parseFloat(asks[i].qty);
    asks[i].total = runAsk;
  }

  let cumBid = 0;
  const bids: DepthRow[] = sortedBids.map(([price, qty]) => {
    cumBid += parseFloat(qty);
    return { price, qty, total: cumBid };
  });

  const bestAsk = sortedAsks.length
    ? parseFloat(sortedAsks[sortedAsks.length - 1][0])
    : 0;
  const bestBid = sortedBids.length ? parseFloat(sortedBids[0][0]) : 0;
  const spread = bestAsk && bestBid ? (bestAsk - bestBid).toFixed(2) : "—";

  const maxTotal = Math.max(
    ...asks.map((r) => r.total),
    ...bids.map((r) => r.total),
  );

  return { asks, bids, spread, maxTotal };
}

export function OrderBookPanel() {
  const { state } = useKlinechartsUI();
  const ticker = state.symbol?.ticker ?? "BTCUSDT";
  const [depth, setDepth] = useState<DepthData | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDepth = useCallback(async () => {
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/depth?symbol=${ticker}&limit=20`,
      );
      if (!res.ok) return;
      const raw = await res.json();
      setDepth(parseDepth(raw));
    } catch {
      // silently ignore transient network errors
    }
  }, [ticker]);

  useEffect(() => {
    fetchDepth();
    intervalRef.current = setInterval(fetchDepth, 250);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchDepth]);

  return (
    <div className="w-70 shrink-0 flex flex-col border-l bg-card text-card-foreground overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <strong className="text-sm font-semibold">Order Book</strong>
        <span className="text-xs text-muted-foreground">{ticker}</span>
      </div>

      {depth === null ? (
        <div className="flex-1 flex flex-col gap-1 p-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="h-5 rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col text-xs font-mono tabular-nums overflow-auto">
          <div className="grid grid-cols-3 px-3 py-1 text-muted-foreground border-b sticky top-0 bg-card z-10">
            <span>Price</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Total</span>
          </div>

          <div className="flex flex-col">
            {depth.asks.map((row) => (
              <div key={`a-${row.price}`} className="relative">
                <div
                  className="absolute inset-y-0 right-0 bg-red-500/10"
                  style={{
                    width: `${(row.total / depth.maxTotal) * 100}%`,
                  }}
                />
                <div className="grid grid-cols-3 px-3 py-0.5 relative z-1">
                  <span className="text-red-500">{row.price}</span>
                  <span className="text-right">{row.qty}</span>
                  <span className="text-right text-muted-foreground">
                    {row.total.toFixed(5)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 px-3 py-1.5 border-y bg-muted/30 text-muted-foreground">
            <span>Spread</span>
            <span className="font-semibold text-foreground">
              {depth.spread}
            </span>
          </div>

          <div className="flex flex-col">
            {depth.bids.map((row) => (
              <div key={`b-${row.price}`} className="relative">
                <div
                  className="absolute inset-y-0 right-0 bg-green-500/10"
                  style={{
                    width: `${(row.total / depth.maxTotal) * 100}%`,
                  }}
                />
                <div className="grid grid-cols-3 px-3 py-0.5 relative z-1">
                  <span className="text-green-500">{row.price}</span>
                  <span className="text-right">{row.qty}</span>
                  <span className="text-right text-muted-foreground">
                    {row.total.toFixed(5)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
