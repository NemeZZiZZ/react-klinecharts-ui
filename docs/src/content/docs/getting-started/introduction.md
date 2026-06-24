---
title: Introduction
description: What react-klinecharts-ui is and when to reach for it.
---

**react-klinecharts-ui** is a headless React library for building financial
trading terminals on top of [klinecharts](https://github.com/liihuu/KLineChart).
It provides a state provider, a set of hooks, and overlay templates. **No UI
components are included** — use any UI framework you prefer (Tailwind, shadcn,
Radix, MUI, plain CSS).

:::tip[See it in action]
Explore the full **[live example terminal ↗](https://nemezzizz.github.io/react-klinecharts-ui/examples/)** — a complete trading UI (symbol search, indicators, drawing tools, order book, replay) built with these hooks. Its source lives in the [`examples/`](https://github.com/NemeZZiZZ/react-klinecharts-ui/tree/main/examples) directory.
:::

## What you get

- A **state provider** (`KlinechartsUIProvider`) that owns the chart instance,
  the current symbol, period, theme, timezone and indicator configuration.
- **25+ composable hooks** for periods, symbol search, indicators, drawing
  tools, order lines, alerts, replay, layouts, undo/redo, screenshots, data
  export and more.
- **Drawing-tool overlay templates** — Fibonacci, Elliott waves, Gann boxes,
  harmonic patterns, position tools.
- **Custom indicator templates** in TradingView style (Ichimoku, SuperTrend,
  VWAP, HMA, MA Ribbon, TV MACD/RSI/BOLL, …) plus a `TA` math library.

## What you write

Everything visual: toolbars, dialogs, watchlists, context menus. The hooks give
you reactive state and imperative actions; you decide how they look.

## When to use it

Reach for react-klinecharts-ui when you want a **TradingView-like terminal**
with your own design system, rather than a pre-styled widget. If you only need a
chart with a couple of indicators, plain [react-klinecharts](https://github.com/NemeZZiZZ/react-klinecharts)
may be enough.

## Acknowledgments

Many features — 11 TradingView-style indicators, 9 drawing overlays, the TA math
library, undo/redo, layout manager and script editor — were ported from the
[QUANTIX Extended Edition](https://github.com/dsavenk0/KLineChart-Pro) fork of
KLineChart-Pro by [@dsavenk0](https://github.com/dsavenk0). The original fork
implements these as a tightly-coupled Vue 3 application; this library
re-implements them as headless React hooks.

Continue to [Installation](../installation/).
