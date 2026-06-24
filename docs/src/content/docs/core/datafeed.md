---
title: Datafeed
description: The data interface you implement to feed market data into the chart.
---

The `Datafeed` is the contract between your data source and the chart. You
implement four methods; the library calls them as the user searches symbols,
scrolls history, and watches live updates.

```ts
interface Datafeed {
  /**
   * Search symbols by a query string.
   * signal — AbortSignal to cancel the request when a newer query is typed.
   */
  searchSymbols(
    search: string,
    signal?: AbortSignal,
  ): Promise<PartialSymbolInfo[]>;

  /**
   * Load historical bars.
   * from/to — timestamps in milliseconds.
   * When from=0, load the most recent available data.
   */
  getHistoryKLineData(
    symbol: SymbolInfo,
    period: TerminalPeriod,
    from: number,
    to: number,
  ): Promise<KLineData[]>;

  /**
   * Subscribe to real-time updates.
   * callback is called for every new bar.
   */
  subscribe(
    symbol: SymbolInfo,
    period: TerminalPeriod,
    callback: (data: KLineData) => void,
  ): void;

  /** Unsubscribe from real-time updates. */
  unsubscribe(symbol: SymbolInfo, period: TerminalPeriod): void;
}
```

## PartialSymbolInfo

Minimal description of a trading instrument:

```ts
interface PartialSymbolInfo {
  ticker: string; // e.g. "BTCUSDT", "AAPL", "EUR/USD"
  pricePrecision?: number; // decimal places for price display
  volumePrecision?: number; // decimal places for volume display
  [key: string]: unknown; // any additional fields
}
```

## KLineData

Each bar returned from `getHistoryKLineData` / pushed to `subscribe` is a
klinecharts `KLineData`:

```ts
interface KLineData {
  timestamp: number; // ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  turnover?: number;
}
```

## Example: Binance public API

A complete, self-contained datafeed (the same one powering the live demos on
this site):

```ts
import type { Datafeed, TerminalPeriod } from "react-klinecharts-ui";
import type { KLineData, SymbolInfo } from "react-klinecharts";

function periodToInterval(p: TerminalPeriod): string {
  const map: Record<string, string> = {
    minute: "m",
    hour: "h",
    day: "d",
    week: "w",
    month: "M",
  };
  return `${p.span}${map[p.type] ?? "d"}`;
}

export const binanceDatafeed: Datafeed = {
  async searchSymbols(q) {
    const list = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
    return list
      .filter((t) => t.includes(q.toUpperCase()))
      .map((ticker) => ({ ticker, pricePrecision: 2 }));
  },

  async getHistoryKLineData(symbol, period, _from, to) {
    const url = new URL("https://api.binance.com/api/v3/klines");
    url.searchParams.set("symbol", symbol.ticker);
    url.searchParams.set("interval", periodToInterval(period));
    url.searchParams.set("endTime", String(to));
    url.searchParams.set("limit", "1000");
    const res = await fetch(url);
    if (!res.ok) return [];
    const rows: unknown[][] = await res.json();
    return rows.map((k) => ({
      timestamp: k[0] as number,
      open: +(k[1] as string),
      high: +(k[2] as string),
      low: +(k[3] as string),
      close: +(k[4] as string),
      volume: +(k[5] as string),
    }));
  },

  subscribe(symbol, period, callback) {
    const stream = `${symbol.ticker.toLowerCase()}@kline_${periodToInterval(period)}`;
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}`);
    ws.onmessage = (ev) => {
      const k = JSON.parse(ev.data).k;
      callback({
        timestamp: k.t,
        open: +k.o,
        high: +k.h,
        low: +k.l,
        close: +k.c,
        volume: +k.v,
      });
    };
  },

  unsubscribe() {
    /* close the socket you opened in subscribe */
  },
};
```

:::tip[Cancellation]
`searchSymbols` receives an `AbortSignal` that is aborted when the user types a
newer query. Forward it to `fetch(url, { signal })` to cancel stale requests.
:::

The chart consumes this datafeed through
[`createDataLoader`](../../utilities/create-data-loader/).
