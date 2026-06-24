---
title: Backend signals & notifications
description: Wire front-end indicators to a backend for buy/sell signals and push notifications.
sidebar:
  order: 2
---

A common question: **how do front-end indicators connect to a backend for
buy/sell signals or push notifications?**

This library is **headless by design** — it owns chart state, datafeed wiring and
overlay management, but it deliberately does **not** generate trading signals,
execute orders or send notifications. Those belong to your application/backend
layer. What the library provides is the full set of extension points to connect
the two. There are two directions to wire up.

## Backend → chart (display server signals)

Push signals computed on your backend into the chart through the `Datafeed` and
overlay hooks:

- **[`Datafeed.subscribe`](../../core/datafeed/)** — your real-time channel
  (WebSocket/SSE). Stream live candles, and alongside them any backend-computed
  signal payloads.
- **[`useOrderLines`](../../hooks/use-order-lines/)** — render entry/SL/TP levels
  as draggable horizontal lines; `onPriceChange` reports the new price when a
  user drags one.
- **[`useAnnotations`](../../hooks/use-annotations/)** — drop markers/notes on the
  chart at the bars where signals fired.

```tsx
// A WebSocket carrying both candles and backend signals
const datafeed: Datafeed = {
  // …searchSymbols / getHistoryKLineData
  subscribe(symbol, period, callback) {
    const ws = new WebSocket(`wss://api.example.com/stream/${symbol.ticker}`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "kline") callback(msg.candle);
      if (msg.type === "signal") signalBus.emit(msg); // hand off to your UI
    };
    sockets.set(symbol.ticker, ws);
  },
  unsubscribe(symbol) {
    sockets.get(symbol.ticker)?.close();
    sockets.delete(symbol.ticker);
  },
};
```

```tsx
// Render a backend signal as an order line + annotation
function SignalLayer() {
  const { createOrderLine } = useOrderLines();
  const { addAnnotation } = useAnnotations();

  useEffect(() => {
    return signalBus.on("signal", (s) => {
      createOrderLine({ price: s.entry, text: `${s.side} @ ${s.entry}` });
      addAnnotation(s.side === "buy" ? "▲" : "▼", s.entry, s.timestamp);
    });
  }, [createOrderLine, addAnnotation]);

  return null;
}
```

## Chart → backend (react to price events)

Detect a price event on the client and forward it to your backend (webhook, order
placement) or fire a push notification — all inside the
[`useAlerts`](../../hooks/use-alerts/) callback:

```tsx
function PriceAlertBridge() {
  const { addAlert, onAlertTriggered } = useAlerts();

  useEffect(() => {
    addAlert(65000, "crossing_up", "BTC > 65k");

    onAlertTriggered(async (alert) => {
      // 1. Notify your backend (e.g. to place/adjust an order)
      await fetch("https://api.example.com/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: alert.price, condition: alert.condition }),
      });

      // 2. Browser push notification
      if (Notification.permission === "granted") {
        new Notification("Price alert", { body: alert.message });
      }
    });
  }, [addAlert, onAlertTriggered]);

  return null;
}
```

:::caution[Not authoritative]
The chart-side `useAlerts` detection is a convenience based on the latest candle
close (polled once per second) — it is **not** a substitute for server-side
alerting. For guaranteed delivery, run the alert/signal logic on your backend and
use the **Backend → chart** path above to visualize it.
:::

## Observing state

Use the provider's state callbacks (`onStateChange`, `onSymbolChange`,
`onSubIndicatorsChange`, …) to forward symbol/period/indicator changes to your
backend — for example, to subscribe the right server-side signal stream for
whatever the user is currently viewing. See
[Persisting user preferences](../persisting-preferences/) for the callback
patterns.
