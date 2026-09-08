---
title: TA (Technical Analysis)
description: A standalone math library for computing technical indicators.
---

A standalone math library for computing common technical indicators. Used
internally by the indicator templates and available to custom scripts via
[`useScriptEditor`](../../hooks/use-script-editor/).

```ts
import { TA } from "react-klinecharts-ui";
```

## Functions

| Function | Signature | Returns |
| -------- | --------- | ------- |
| `TA.sma`       | `(data: number[], period: number)` | `(number \| null)[]` — Simple Moving Average |
| `TA.ema`       | `(data: number[], period: number)` | `(number \| null)[]` — Exponential Moving Average |
| `TA.rma`       | `(data: number[], period: number)` | `(number \| null)[]` — Running (Wilder's) Moving Average |
| `TA.wma`       | `(data: number[], period: number)` | `(number \| null)[]` — Weighted Moving Average |
| `TA.hma`       | `(data: number[], period: number)` | `(number \| null)[]` — Hull Moving Average |
| `TA.stdev`     | `(data: number[], period: number)` | `(number \| null)[]` — Standard Deviation |
| `TA.rsi`       | `(data: number[], period: number)` | `(number \| null)[]` — Relative Strength Index |
| `TA.macd`      | `(data: number[], fast?, slow?, signal?)` | `{ dif, dea, macd }` — each `(number \| null)[]` |
| `TA.bollinger` | `(data: number[], period?, mult?)` | `{ upper, mid, lower }` — each `(number \| null)[]` |
| `TA.tr`        | `(highs, lows, closes)` | `number[]` — True Range |
| `TA.atr`       | `(highs, lows, closes, period)` | `(number \| null)[]` — Average True Range |
| `TA.vwap`      | `(highs, lows, closes, volumes, timestamps?, session?)` | `(number \| null)[]` — Volume Weighted Average Price, reset per session (`"utc-day"` by default, or a custom `(ts) => key` function). Without `timestamps` it accumulates cumulatively (legacy behavior) |
| `TA.cci`       | `(highs, lows, closes, period)` | `(number \| null)[]` — Commodity Channel Index |

## Example

```ts
import { TA } from "react-klinecharts-ui";

const closes = bars.map((b) => b.close);

const ema21 = TA.ema(closes, 21);
const { dif, dea, macd } = TA.macd(closes); // 12/26/9 defaults
const { upper, mid, lower } = TA.bollinger(closes, 20, 2);
```

:::note
Functions that can produce undefined values during their warm-up window return
`(number | null)[]` — guard for `null` before plotting.
:::

:::note[Non-finite input and edge cases]
`sma` / `ema` / `rma` / `wma` restart their window on a non-finite input (a single `NaN`
no longer poisons the rest of the series) and emit `null` until a fresh window
accumulates; degenerate periods (`< 1`) emit all-`null`. `rsi` yields `null`
(not `100`) when there is neither up nor down movement over the window (flat
market, 0/0 case).
:::
