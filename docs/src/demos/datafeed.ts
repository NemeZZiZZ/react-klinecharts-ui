import type { Datafeed, TerminalPeriod } from "react-klinecharts-ui";
import type { KLineData, SymbolInfo } from "react-klinecharts";

// Self-contained Binance public-API datafeed used by the live documentation
// demos. It runs entirely client-side (the demo components are hydrated with
// `client:only`), so no API key or backend is required.

const SYMBOLS = [
  { ticker: "BTCUSDT", pricePrecision: 2, volumePrecision: 5 },
  { ticker: "ETHUSDT", pricePrecision: 2, volumePrecision: 4 },
  { ticker: "SOLUSDT", pricePrecision: 2, volumePrecision: 2 },
  { ticker: "BNBUSDT", pricePrecision: 2, volumePrecision: 3 },
  { ticker: "XRPUSDT", pricePrecision: 4, volumePrecision: 1 },
];

function periodToInterval(period: TerminalPeriod): string {
  const { span, type } = period;
  switch (type) {
    case "minute":
      return `${span}m`;
    case "hour":
      return `${span}h`;
    case "day":
      return `${span}d`;
    case "week":
      return `${span}w`;
    case "month":
      return `${span}M`;
    default:
      return "1d";
  }
}

let ws: WebSocket | null = null;
let currentSubscription: {
  stream: string;
  callback: (data: KLineData) => void;
} | null = null;

export const binanceDatafeed: Datafeed = {
  async searchSymbols(search: string) {
    const q = search.toUpperCase();
    return SYMBOLS.filter((s) => s.ticker.includes(q));
  },

  async getHistoryKLineData(
    symbol: SymbolInfo,
    period: TerminalPeriod,
    _from: number,
    to: number,
  ) {
    const interval = periodToInterval(period);
    const url = new URL("https://api.binance.com/api/v3/klines");
    url.searchParams.set("symbol", symbol.ticker);
    url.searchParams.set("interval", interval);
    url.searchParams.set("endTime", String(to));
    url.searchParams.set("limit", "1000");

    const res = await fetch(url.toString());
    if (!res.ok) return [];

    const data: unknown[][] = await res.json();
    return data.map((k) => ({
      timestamp: k[0] as number,
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
      turnover: parseFloat(k[7] as string),
    }));
  },

  subscribe(
    symbol: SymbolInfo,
    period: TerminalPeriod,
    callback: (data: KLineData) => void,
  ) {
    const interval = periodToInterval(period);
    const stream = `${symbol.ticker.toLowerCase()}@kline_${interval}`;

    if (ws && currentSubscription?.stream !== stream) {
      ws.close();
      ws = null;
    }

    currentSubscription = { stream, callback };

    if (
      !ws ||
      ws.readyState === WebSocket.CLOSED ||
      ws.readyState === WebSocket.CLOSING
    ) {
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}`);
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.e !== "kline" || !currentSubscription) return;
      const k = msg.k;
      currentSubscription.callback({
        timestamp: k.t,
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
        turnover: parseFloat(k.q),
      });
    };

    ws.onerror = () => {};
  },

  unsubscribe(symbol: SymbolInfo, period: TerminalPeriod) {
    const interval = periodToInterval(period);
    const stream = `${symbol.ticker.toLowerCase()}@kline_${interval}`;
    if (currentSubscription?.stream === stream) {
      if (ws) {
        ws.close();
        ws = null;
      }
      currentSubscription = null;
    }
  },
};

export const defaultSymbol = SYMBOLS[0];
