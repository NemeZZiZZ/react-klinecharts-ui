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
  visible: boolean;
  color: string; // hex color of the symbol's line
}
```

Baseline normalization is controlled by `COMPARE_RULES`
(`"current_open" | "prev_close"`) — see [Data & Constants](../../utilities/ta/)
for the exported constants.
