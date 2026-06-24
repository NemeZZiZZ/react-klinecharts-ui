---
title: Persisting user preferences
description: Save and restore symbol, period, theme and layouts across sessions.
sidebar:
  order: 1
---

The provider's `on*Change` callbacks fire synchronously on every state
transition, which makes persistence a one-liner. Combine them with the
`default*` props to restore state on load.

## Save on change

```tsx
<KlinechartsUIProvider
  datafeed={datafeed}
  onSymbolChange={(s) => localStorage.setItem("symbol", JSON.stringify(s))}
  onPeriodChange={(p) => localStorage.setItem("period", JSON.stringify(p))}
  onThemeChange={(t) => localStorage.setItem("theme", t)}
  onTimezoneChange={(tz) => localStorage.setItem("tz", tz)}
>
  <App />
</KlinechartsUIProvider>
```

## Restore on load

```tsx
function readJSON<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

<KlinechartsUIProvider
  datafeed={datafeed}
  defaultSymbol={readJSON("symbol", { ticker: "BTCUSDT", pricePrecision: 2 })}
  defaultTheme={localStorage.getItem("theme") ?? "dark"}
  defaultTimezone={localStorage.getItem("tz") ?? "Asia/Shanghai"}
>
  <App />
</KlinechartsUIProvider>
```

## Catch-all with onStateChange

For analytics or syncing a backend, `onStateChange` runs on **every** action:

```tsx
<KlinechartsUIProvider
  datafeed={datafeed}
  onStateChange={(action, next, prev) => {
    analytics.track("chart_action", { type: action.type });
  }}
>
```

For full chart layouts (indicators, drawings, axes), use
[`useLayoutManager`](../../hooks/use-layout-manager/), which serializes and
restores the entire chart configuration.
