---
title: useWatchlist
description: Track symbols with live price updates from your datafeed.
sidebar:
  order: 16
---

Manage a list of tracked symbols with live price updates from your datafeed.

```ts
import { useWatchlist } from "react-klinecharts-ui";

const { items, addSymbol, removeSymbol, switchSymbol, activeSymbol } =
  useWatchlist();
```

| Property | Type | Description |
| -------- | ---- | ----------- |
| `items` | `WatchlistItem[]` | Tracked symbols with price data |
| `addSymbol` | `(ticker: string) => void` | Add a symbol |
| `removeSymbol` | `(ticker: string) => void` | Remove a symbol |
| `switchSymbol` | `(ticker: string) => void` | Display a symbol on the chart |
| `activeSymbol` | `string \| null` | Currently displayed ticker |

```ts
interface WatchlistItem {
  ticker: string;
  lastPrice: number | null;
  change: number | null;
  changePercent: number | null;
}
```

Price data comes from your [`Datafeed`](../../core/datafeed/) — the hook
subscribes per tracked symbol and surfaces the latest values for rendering a
watchlist panel.
