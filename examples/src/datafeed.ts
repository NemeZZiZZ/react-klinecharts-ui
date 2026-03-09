import type { Datafeed, TerminalPeriod } from "react-klinecharts-ui";
import type { KLineData, SymbolInfo } from "react-klinecharts";

const SYMBOLS = [
  { ticker: "BTCUSDT", pricePrecision: 2, volumePrecision: 5 },
  { ticker: "ETHUSDT", pricePrecision: 2, volumePrecision: 4 },
  { ticker: "SOLUSDT", pricePrecision: 2, volumePrecision: 2 },
  { ticker: "BNBUSDT", pricePrecision: 2, volumePrecision: 3 },
  { ticker: "XRPUSDT", pricePrecision: 4, volumePrecision: 1 },
  { ticker: "DOGEUSDT", pricePrecision: 5, volumePrecision: 0 },
  { ticker: "ADAUSDT", pricePrecision: 4, volumePrecision: 1 },
  { ticker: "AVAXUSDT", pricePrecision: 2, volumePrecision: 2 },
  { ticker: "DOTUSDT", pricePrecision: 3, volumePrecision: 2 },
  { ticker: "LINKUSDT", pricePrecision: 2, volumePrecision: 2 },
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
  symbol: string;
  interval: string;
  callback: (data: KLineData) => void;
} | null = null;

export const binanceDatafeed: Datafeed = {
  // signal is provided when a newer query cancels this one; ignored here
  // because we filter a local array synchronously.
  async searchSymbols(search: string, _signal?: AbortSignal) {
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

    // Close previous connection if the stream differs
    if (ws && currentSubscription?.stream !== stream) {
      ws.close();
      ws = null;
    }

    currentSubscription = {
      stream,
      symbol: symbol.ticker,
      interval,
      callback,
    };

    // Open a new WS if none exists or the previous one is closed/closing
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

    // Suppress errors from intentional closes (e.g. StrictMode remount)
    ws.onerror = () => {};
  },

  unsubscribe(symbol: SymbolInfo, period: TerminalPeriod) {
    const interval = periodToInterval(period);
    const stream = `${symbol.ticker.toLowerCase()}@kline_${interval}`;

    // Only close if we are unsubscribing from what is currently active
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
