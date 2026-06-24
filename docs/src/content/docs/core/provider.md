---
title: KlinechartsUIProvider
description: The root provider that owns chart state and supplies the context.
---

The root provider. Wrap your application (or chart subtree) in it and supply the
context that every hook reads from.

```tsx
import { KlinechartsUIProvider } from "react-klinecharts-ui";

<KlinechartsUIProvider
  datafeed={myDatafeed}
  defaultSymbol={{ ticker: "BTCUSDT", pricePrecision: 2 }}
  defaultTheme="dark"
  onSymbolChange={(symbol) => saveToStorage("symbol", symbol)}
>
  <App />
</KlinechartsUIProvider>;
```

## Props

| Prop                     | Type                                           | Default            | Description                                                      |
| ------------------------ | ---------------------------------------------- | ------------------ | ---------------------------------------------------------------- |
| `datafeed`               | `Datafeed`                                     | —                  | **Required.** Datafeed interface implementation                  |
| `defaultSymbol`          | `PartialSymbolInfo`                            | `null`             | Initial trading instrument                                       |
| `defaultPeriod`          | `TerminalPeriod`                               | First in `periods` | Initial timeframe                                                |
| `defaultTheme`           | `string`                                       | `"light"`          | Initial theme (`"light"` or `"dark"`)                            |
| `defaultTimezone`        | `string`                                       | `"Asia/Shanghai"`  | Initial timezone (IANA)                                          |
| `defaultMainIndicators`  | `string[]`                                     | `["MA"]`           | Indicators on the main chart at startup                          |
| `defaultSubIndicators`   | `string[]`                                     | `["VOL"]`          | Indicators on sub-panels at startup                              |
| `defaultLocale`          | `string`                                       | `"en-US"`          | Locale passed to klinecharts                                     |
| `periods`                | `TerminalPeriod[]`                             | `DEFAULT_PERIODS`  | List of available timeframes                                     |
| `styles`                 | `DeepPartial<Styles>`                          | —                  | Custom klinecharts styles (applied when the chart is ready)      |
| `registerExtensions`     | `boolean`                                      | `true`             | Whether to register built-in drawing overlays + feature overlays (`orderLine`, `alertLine`, `depthOverlay`) |
| `overlays`               | `OverlayTemplate[]`                            | —                  | Extra custom overlay templates. The built-in feature overlays are already auto-registered |
| `onStateChange`          | `(action, nextState, prevState) => void`       | —                  | Called synchronously on every dispatched action                  |
| `onSymbolChange`         | `(symbol) => void`                             | —                  | Called when the symbol changes                                   |
| `onPeriodChange`         | `(period) => void`                             | —                  | Called when the period changes                                   |
| `onThemeChange`          | `(theme) => void`                              | —                  | Called when the theme changes                                    |
| `onTimezoneChange`       | `(timezone) => void`                           | —                  | Called when the timezone changes                                 |
| `onMainIndicatorsChange` | `(indicators: string[]) => void`               | —                  | Called when main indicators change                               |
| `onSubIndicatorsChange`  | `(indicators: Record<string, string>) => void` | —                  | Called when sub-indicators change                                |
| `onSettingsChange`       | `(settings: Record<string, unknown>) => void`  | —                  | Called when settings change via `useKlinechartsUISettings`       |

## Overlay registration

The provider registers overlays once on mount via `useRef` — passing an inline
array is safe and does **not** cause re-registration:

```tsx
// Safe — does not re-register on every render
<KlinechartsUIProvider overlays={[orderLine, myCustomOverlay]}>
```

## State callbacks

The `on*Change` callbacks make it easy to persist user preferences. They fire
after the corresponding state transition:

```tsx
<KlinechartsUIProvider
  datafeed={datafeed}
  onSymbolChange={(s) => localStorage.setItem("symbol", JSON.stringify(s))}
  onPeriodChange={(p) => localStorage.setItem("period", JSON.stringify(p))}
  onThemeChange={(t) => localStorage.setItem("theme", t)}
>
```

`onStateChange` is the catch-all: it runs synchronously on every dispatched
action with `(action, nextState, prevState)`, which is ideal for analytics or
debugging.

See also: [Datafeed](../datafeed/) · [State & Actions](../state-actions/).
