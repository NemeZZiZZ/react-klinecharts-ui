---
title: Persisting user preferences
description: Save and restore symbol, period, theme, alerts, settings and layouts across sessions.
sidebar:
  order: 1
---

There are three layers of persistence in `react-klinecharts-ui`, each covering
a different kind of state. Pick the one that matches what you want to survive
a page reload.

## 1. `storage` adapter (alerts, settings, indicators)

The built-in way to persist the **reducer store** slices — price alerts, chart
settings (`useKlinechartsUISettings`), and the active indicator set. Pass a
`storage` option to the provider; it hydrates on mount and writes back on
every change. The adapter mirrors the Web Storage API, so `localStorage` works
with no extra wiring:

```tsx
<KlinechartsUIProvider datafeed={datafeed} storage={{}}>
  {/* alerts / settings / indicators now survive refresh */}
</KlinechartsUIProvider>
```

`storage={{}}` uses sane defaults (`localStorage`, the `alerts`/`settings`/
`indicators` namespaces, a `"rkui:"` key prefix). Override any of them — for
example to plug in a remote-backed adapter:

```tsx
import type { StorageAdapter } from "react-klinecharts-ui";

const remoteAdapter: StorageAdapter = {
  getItem: (k) => cache.get(k) ?? null,
  setItem: (k, v) => { cache.set(k, v); flushToServer(k, v); },
  removeItem: (k) => { cache.delete(k); deleteFromServer(k); },
};

<KlinechartsUIProvider datafeed={datafeed} storage={{ adapter: remoteAdapter }}>
```

The adapter contract is **synchronous** (matching `localStorage`). For async
backends (IndexedDB, REST), keep an in-memory cache and flush in the
background. [See the README "Persistence" section](../../../README) for the
full API.

## 2. `on*Change` callbacks (symbol, period, theme, timezone)

The `storage` adapter does **not** cover symbol/period/theme/timezone — those
are session-level choices that you usually wire yourself. The provider's
`on*Change` callbacks fire synchronously on every transition, which makes
persistence a one-liner; combine with the `default*` props to restore:

```tsx
function readJSON<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

<KlinechartsUIProvider
  datafeed={datafeed}
  storage={{}}                                  // alerts/settings/indicators
  defaultSymbol={readJSON("symbol", { ticker: "BTCUSDT", pricePrecision: 2 })}
  defaultTheme={localStorage.getItem("theme") ?? "dark"}
  defaultTimezone={localStorage.getItem("tz") ?? "Asia/Shanghai"}
  onSymbolChange={(s) => localStorage.setItem("symbol", JSON.stringify(s))}
  onPeriodChange={(p) => localStorage.setItem("period", JSON.stringify(p))}
  onThemeChange={(t) => localStorage.setItem("theme", t)}
  onTimezoneChange={(tz) => localStorage.setItem("tz", tz)}
>
  <App />
</KlinechartsUIProvider>
```

## 3. `useLayoutManager` (named full-chart snapshots)

For complete, named chart layouts (indicators + drawings + axes + symbol +
period, as a single snapshot the user can save/load/delete), use
[`useLayoutManager`](../../hooks/use-layout-manager/). It serializes the whole
chart on demand to its own keys — orthogonal to the live `storage` adapter.

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
