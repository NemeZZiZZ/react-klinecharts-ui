---
title: useCompare
description: Overlay multiple symbols on the same chart.
sidebar:
  order: 17
---

Compare multiple symbols on the same chart with individual colors and a
visibility toggle.

```ts
import { useCompare } from "react-klinecharts-ui";

const { symbols, addSymbol, removeSymbol, toggleSymbol, clearAll } =
  useCompare();
```

| Property | Type | Description |
| -------- | ---- | ----------- |
| `symbols` | `CompareSymbol[]` | Comparison symbols with metadata |
| `addSymbol` | `(ticker: string, color?: string) => Promise<void>` | Add a symbol to compare (optional line color) |
| `removeSymbol` | `(ticker: string) => void` | Remove a comparison symbol |
| `toggleSymbol` | `(ticker: string) => void` | Toggle a symbol's visibility |
| `clearAll` | `() => void` | Remove all comparison symbols |

```ts
interface CompareSymbol {
  ticker: string;
  /** Base price (first aligned bar close) used for percentage normalization */
  basePrice: number | null;
  color: string; // hex color of the symbol's line
  visible: boolean;
}
```

## How the comparison is drawn

Each compared symbol is projected onto the **main symbol's price scale** so its
line overlays the candles and shares the candle y-axis (instead of adding a
separate percentage scale that would collapse the chart).

Given the first candle where both symbols have a quote (the **anchor**):

- `mainBase` — the main symbol's close at the anchor
- `compareBase` — the compare symbol's close at the anchor

each bar's drawn value is:

```
value = mainBase * (compareClose / compareBase)
```

So if ETH rises +10% from the anchor while BTC's anchor was 64000, the ETH line
draws at 64000 → 70400 — right on the BTC price axis.

The **real percentage change** of the compare symbol is surfaced in the
indicator tooltip (via `createTooltipDataSource`), e.g. `ETHUSDT %: +10.00%`.
It is never drawn on the axis.

> Note: `COMPARE_RULES` (`"current_open" | "previous_close"`) is a separate
> klinecharts candle-coloring setting (see `useKlinechartsUISettings`) and does
> **not** control this overlay.
