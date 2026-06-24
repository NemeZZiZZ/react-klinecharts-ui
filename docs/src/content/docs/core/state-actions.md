---
title: State & Actions
description: The provider's reducer state and the action union for dispatch.
---

The provider holds a `useReducer` store. Read it via `useKlinechartsUI().state`
and mutate it via `dispatch`. Most apps never dispatch directly — the feature
hooks wrap these actions — but the raw shapes are documented here for advanced
use and persistence.

## KlinechartsUIState

```ts
interface KlinechartsUIState {
  chart: Chart | null; // klinecharts Chart instance (null before onReady)
  datafeed: Datafeed; // the datafeed passed to the provider
  symbol: PartialSymbolInfo | null; // current symbol
  period: TerminalPeriod; // current timeframe
  theme: string; // current theme: "light" | "dark"
  timezone: string; // current timezone (IANA)
  isLoading: boolean; // true while data is loading
  locale: string; // klinecharts locale ("en-US")
  periods: TerminalPeriod[]; // list of available timeframes
  mainIndicators: string[]; // active main chart indicators
  subIndicators: Record<string, string>; // active sub-indicators: { name → paneId }
  indicatorAxes: Record<string, string>; // custom Y-axis bindings: { indicatorId → yAxisId }
  indicatorVisibility: Record<string, boolean>; // visibility overrides (sparse)
  alerts: Alert[]; // price alerts (useAlerts) — shared across consumers
  measure: MeasureState; // measure-tool state (useMeasure)
  replay: ReplayState; // replay control state (useReplay)
  styles: DeepPartial<Styles> | undefined; // custom klinecharts styles
  screenshotUrl: string | null; // URL of the last screenshot
}
```

## KlinechartsUIAction

The union accepted by `dispatch`:

```ts
type KlinechartsUIAction =
  | { type: "SET_CHART"; chart: Chart }
  | { type: "SET_SYMBOL"; symbol: PartialSymbolInfo }
  | { type: "SET_PERIOD"; period: TerminalPeriod }
  | { type: "SET_THEME"; theme: string }
  | { type: "SET_TIMEZONE"; timezone: string }
  | { type: "SET_LOADING"; isLoading: boolean }
  | { type: "SET_MAIN_INDICATORS"; indicators: string[] }
  | { type: "SET_SUB_INDICATORS"; indicators: Record<string, string> }
  | { type: "SET_INDICATOR_AXES"; axes: Record<string, string> }
  | { type: "SET_INDICATOR_VISIBILITY"; visibility: Record<string, boolean> }
  | { type: "SET_ALERTS"; alerts: Alert[] }
  | { type: "SET_MEASURE"; measure: Partial<MeasureState> }
  | { type: "SET_REPLAY"; replay: Partial<ReplayState> }
  | { type: "SET_STYLES"; styles: DeepPartial<Styles> | undefined }
  | { type: "SET_LOCALE"; locale: string }
  | { type: "SET_SCREENSHOT_URL"; url: string | null };
```

## Observing state

Use `onStateChange` on the provider to react to every transition — handy for
persistence, analytics, or syncing a backend:

```tsx
<KlinechartsUIProvider
  datafeed={datafeed}
  onStateChange={(action, next, prev) => {
    if (action.type === "SET_SYMBOL") {
      console.log("symbol changed", prev.symbol, "→", next.symbol);
    }
  }}
>
```

The first action you almost always handle is `SET_CHART`, dispatched from
`<KLineChart onReady>` — it stores the chart instance so hooks can drive it.
