---
title: Concept
description: The headless architecture behind react-klinecharts-ui.
---

The library follows a **headless** pattern — all UI is written by the consumer.
The library owns the non-visual concerns; you own everything you can see.

## Responsibilities

The library is responsible for:

- **State management** — current symbol, period, theme, indicators, timezone,
  screenshots, alerts, replay and measure state.
- **Datafeed integration** — an abstract interface for loading historical data
  and subscribing to real-time updates.
- **klinecharts overlay management** — indicators, drawing tools, order lines.
- **Utilities** — `createDataLoader`, overlay templates, a `TA` math library.

You are responsible for:

- **All UI** — toolbars, dialogs, watchlists, context menus, status bars.
- **Wiring** — rendering `<KLineChart>` and feeding it the data loader.

## The mental model

```
┌─────────────────────────────────────────────┐
│            KlinechartsUIProvider             │
│  owns: chart instance, symbol, period,       │
│        theme, indicators, alerts, replay…    │
│                                              │
│   ┌───────────┐      ┌────────────────────┐  │
│   │  <KLineChart> │  │   your UI (hooks)   │  │
│   │  (the canvas) │  │  useIndicators()    │  │
│   │               │  │  useDrawingTools()  │  │
│   │               │  │  usePeriods() …     │  │
│   └───────────┘      └────────────────────┘  │
└─────────────────────────────────────────────┘
```

- The **provider** holds a `useReducer` store and the klinecharts `Chart`
  instance (available after `onReady`).
- **Hooks** read reactive slices of that store and return imperative actions
  that mutate the chart and dispatch state updates.
- Your **UI** calls hooks and renders whatever it likes.

## The one rule

> All hooks must be called inside `<KlinechartsUIProvider>`.

State is shared across every consumer of the same provider, so two components
calling `useIndicators()` see the same indicator list and stay in sync
automatically.

Next: the [KlinechartsUIProvider reference](../../core/provider/).
