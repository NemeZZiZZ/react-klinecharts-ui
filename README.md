# react-klinecharts-ui — Library Reference

**react-klinecharts-ui** is a headless React library for building financial trading terminals on top of [klinecharts](https://github.com/liihuu/KLineChart). It provides a state provider, a set of hooks, and overlay templates. No UI components are included — use any UI framework you prefer.

**[Live Demo](https://nemezzizz.github.io/react-klinecharts-ui/)**

### Acknowledgments

Many features in this library — including 11 TradingView-style indicators, 9 drawing overlays, the TA math library, undo/redo, layout manager, and script editor — were ported from the [QUANTIX Extended Edition](https://github.com/dsavenk0/KLineChart-Pro) fork of KLineChart-Pro by [@dsavenk0](https://github.com/dsavenk0). The original fork implements these as a tightly-coupled Vue 3 application; this library re-implements them as headless React hooks following the composable, framework-agnostic architecture.

---

## Table of Contents

1. [Installation](#installation)
2. [Concept](#concept)
3. [KlinechartsUIProvider](#klinechartsui-provider)
4. [Types](#types)
   - [Datafeed](#datafeed)
   - [PartialSymbolInfo](#partialsymbolinfo)
   - [KlinechartsUIState](#klinechartsuistate)
   - [KlinechartsUIAction](#klinechartsuiaction)
5. [Hooks](#hooks)
   - [useKlinechartsUI](#useklinechartsui)
   - [useKlinechartsUITheme](#useklinechartsui-theme)
   - [useKlinechartsUILoading](#useklinechartsui-loading)
   - [usePeriods](#useperiods)
   - [useTimezone](#usetimezone)
   - [useSymbolSearch](#usesymbolsearch)
   - [useIndicators](#useindicators)
   - [useDrawingTools](#usedrawingtools)
   - [useKlinechartsUISettings](#useklinechartsuisettings)
   - [useScreenshot](#usescreenshot)
   - [useFullscreen](#usefullscreen)
   - [useOrderLines](#useorderlines)
   - [useUndoRedo](#useundoredo)
   - [useLayoutManager](#uselayoutmanager)
   - [useScriptEditor](#usescripteditor)
6. [Utilities](#utilities)
   - [createDataLoader](#createdataloader)
   - [TA (Technical Analysis)](#ta-technical-analysis)
7. [Data & Constants](#data--constants)
8. [Custom Indicator Templates](#custom-indicator-templates)
9. [Drawing Overlays](#drawing-overlays)
10. [Extensions](#extensions)
11. [State Callbacks](#state-callbacks)
12. [Full Export List](#full-export-list)

---

## Installation

```bash
npm install react-klinecharts-ui react-klinecharts
# or with pnpm
pnpm add react-klinecharts-ui react-klinecharts
# or with yarn
yarn add react-klinecharts-ui react-klinecharts
```

---

## Concept

The library follows a **headless** pattern — all UI is written by the consumer. The library is responsible for:

- **State management** — current symbol, period, theme, indicators, timezone, screenshots
- **Datafeed integration** — abstract interface for loading historical data and subscribing to real-time updates
- **klinecharts overlay management** — indicators, drawing tools, order lines
- **Utilities** — `createDataLoader`, overlay templates

All hooks must be called inside `<KlinechartsUIProvider>`.

---

## KlinechartsUIProvider

The root provider. Wraps the application and supplies the context.

```tsx
import { KlinechartsUIProvider } from "react-klinecharts-ui";

<KlinechartsUIProvider
  datafeed={myDatafeed}
  defaultSymbol={{ ticker: "BTCUSDT", pricePrecision: 2 }}
  defaultTheme="dark"
  overlays={[orderLine]}
  onSymbolChange={(symbol) => saveToStorage("symbol", symbol)}
>
  <App />
</KlinechartsUIProvider>;
```

### Props

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
| `registerExtensions`     | `boolean`                                      | `true`             | Whether to register built-in drawing overlays                    |
| `overlays`               | `OverlayTemplate[]`                            | —                  | Additional overlay templates (e.g. `orderLine`, custom overlays) |
| `onStateChange`          | `(action, nextState, prevState) => void`       | —                  | Called synchronously on every dispatched action                  |
| `onSymbolChange`         | `(symbol) => void`                             | —                  | Called when the symbol changes                                   |
| `onPeriodChange`         | `(period) => void`                             | —                  | Called when the period changes                                   |
| `onThemeChange`          | `(theme) => void`                              | —                  | Called when the theme changes                                    |
| `onTimezoneChange`       | `(timezone) => void`                           | —                  | Called when the timezone changes                                 |
| `onMainIndicatorsChange` | `(indicators: string[]) => void`               | —                  | Called when main indicators change                               |
| `onSubIndicatorsChange`  | `(indicators: Record<string, string>) => void` | —                  | Called when sub-indicators change                                |
| `onSettingsChange`       | `(settings: Record<string, unknown>) => void`  | —                  | Called when settings change via `useKlinechartsUISettings`       |

### Overlay registration

The provider registers overlays once on mount via `useRef` — passing an inline array is safe and does not cause re-registration:

```tsx
// Safe — does not re-register on every render
<KlinechartsUIProvider overlays={[orderLine, myCustomOverlay]}>
```

---

## Types

### Datafeed

Data interface implemented by the consumer.

```typescript
interface Datafeed {
  /**
   * Search symbols by a query string.
   * signal — AbortSignal to cancel the request when a newer query is typed.
   */
  searchSymbols(
    search: string,
    signal?: AbortSignal,
  ): Promise<PartialSymbolInfo[]>;

  /**
   * Load historical bars.
   * from/to — timestamps in milliseconds.
   * When from=0, load the most recent available data.
   */
  getHistoryKLineData(
    symbol: SymbolInfo,
    period: TerminalPeriod,
    from: number,
    to: number,
  ): Promise<KLineData[]>;

  /**
   * Subscribe to real-time updates.
   * callback is called for every new bar.
   */
  subscribe(
    symbol: SymbolInfo,
    period: TerminalPeriod,
    callback: (data: KLineData) => void,
  ): void;

  /** Unsubscribe from real-time updates. */
  unsubscribe(symbol: SymbolInfo, period: TerminalPeriod): void;
}
```

### PartialSymbolInfo

Minimal description of a trading instrument.

```typescript
interface PartialSymbolInfo {
  ticker: string; // e.g. "BTCUSDT", "AAPL", "EUR/USD"
  pricePrecision?: number; // Decimal places for price display
  volumePrecision?: number; // Decimal places for volume display
  [key: string]: unknown; // Any additional fields
}
```

### KlinechartsUIState

Complete provider state. Accessible via `useKlinechartsUI().state`.

```typescript
interface KlinechartsUIState {
  chart: Chart | null; // klinecharts Chart instance (null before onReady)
  datafeed: Datafeed; // The datafeed passed to the provider
  symbol: PartialSymbolInfo | null; // Current symbol
  period: TerminalPeriod; // Current timeframe
  theme: string; // Current theme: "light" | "dark"
  timezone: string; // Current timezone (IANA)
  isLoading: boolean; // true while data is loading
  locale: string; // klinecharts locale ("en-US")
  periods: TerminalPeriod[]; // List of available timeframes
  mainIndicators: string[]; // Active main chart indicators
  subIndicators: Record<string, string>; // Active sub-indicators: { name → paneId }
  styles: DeepPartial<Styles> | undefined; // Custom klinecharts styles
  screenshotUrl: string | null; // URL of the last screenshot
}
```

### KlinechartsUIAction

Union type of all possible actions for `dispatch`.

```typescript
type KlinechartsUIAction =
  | { type: "SET_CHART"; chart: Chart }
  | { type: "SET_SYMBOL"; symbol: PartialSymbolInfo }
  | { type: "SET_PERIOD"; period: TerminalPeriod }
  | { type: "SET_THEME"; theme: string }
  | { type: "SET_TIMEZONE"; timezone: string }
  | { type: "SET_LOADING"; isLoading: boolean }
  | { type: "SET_MAIN_INDICATORS"; indicators: string[] }
  | { type: "SET_SUB_INDICATORS"; indicators: Record<string, string> }
  | { type: "SET_STYLES"; styles: DeepPartial<Styles> | undefined }
  | { type: "SET_LOCALE"; locale: string }
  | { type: "SET_SCREENSHOT_URL"; url: string | null };
```

---

## Hooks

### useKlinechartsUI

The primary hook — returns the full context: state, dispatch, datafeed, and fullscreen ref.

```typescript
const { state, dispatch, datafeed, onSettingsChange, fullscreenContainerRef } =
  useKlinechartsUI();
```

Return value:

```typescript
interface KlinechartsUIContextValue {
  state: KlinechartsUIState;
  dispatch: Dispatch<KlinechartsUIAction>; // enhancedDispatch with synchronous callbacks
  datafeed: Datafeed;
  onSettingsChange?: (settings: Record<string, unknown>) => void;
  fullscreenContainerRef: RefObject<HTMLElement | null>;
}
```

> **Note:** `dispatch` is `enhancedDispatch`. It synchronously computes the new state by calling the pure reducer directly and immediately invokes `onStateChange` / individual callbacks — without waiting for a React re-render.

---

### useKlinechartsUITheme

Manage the chart theme.

```typescript
const { theme, setTheme, toggleTheme } = useKlinechartsUITheme();
```

| Field         | Type                      | Description                           |
| ------------- | ------------------------- | ------------------------------------- |
| `theme`       | `string`                  | Current theme: `"light"` or `"dark"`  |
| `setTheme`    | `(theme: string) => void` | Set a specific theme                  |
| `toggleTheme` | `() => void`              | Toggle between `"light"` and `"dark"` |

```tsx
const { theme, toggleTheme } = useKlinechartsUITheme();

<button onClick={toggleTheme}>
  {theme === "dark" ? <SunIcon /> : <MoonIcon />}
</button>;
```

---

### useKlinechartsUILoading

Loading state of chart data.

```typescript
const { isLoading } = useKlinechartsUILoading();
```

| Field       | Type      | Description                                      |
| ----------- | --------- | ------------------------------------------------ |
| `isLoading` | `boolean` | `true` while `createDataLoader` is fetching bars |

```tsx
const { isLoading } = useKlinechartsUILoading();

{
  isLoading && <div className="spinner" />;
}
```

---

### usePeriods

Manage timeframes.

```typescript
const { periods, activePeriod, setPeriod } = usePeriods();
```

| Field          | Type                               | Description                       |
| -------------- | ---------------------------------- | --------------------------------- |
| `periods`      | `TerminalPeriod[]`                 | Full list of available timeframes |
| `activePeriod` | `TerminalPeriod`                   | Currently selected timeframe      |
| `setPeriod`    | `(period: TerminalPeriod) => void` | Change the timeframe              |

`TerminalPeriod` extends `KlinechartsPeriod` with a `label: string` field.

**Default timeframes:** 1m, 5m, 15m, 1H, 2H, 4H, D, W, M, Y

```tsx
const { periods, activePeriod, setPeriod } = usePeriods();

<div className="flex gap-1">
  {periods.map((p) => (
    <button
      key={p.label}
      onClick={() => setPeriod(p)}
      className={activePeriod.label === p.label ? "active" : ""}
    >
      {p.label}
    </button>
  ))}
</div>;
```

---

### useTimezone

Manage the chart timezone.

```typescript
const { timezones, activeTimezone, setTimezone } = useTimezone();
```

| Field            | Type                         | Description               |
| ---------------- | ---------------------------- | ------------------------- |
| `timezones`      | `TimezoneItem[]`             | Full list of timezones    |
| `activeTimezone` | `string`                     | Current IANA timezone key |
| `setTimezone`    | `(timezone: string) => void` | Change the timezone       |

```typescript
interface TimezoneItem {
  key: string; // IANA: "Europe/London", "America/New_York", "UTC"
  localeKey: string; // Short name: "london", "new_york", "utc"
}
```

**Available timezones:**
`UTC`, `Pacific/Honolulu`, `America/Juneau`, `America/Los_Angeles`, `America/Chicago`, `America/Toronto`, `America/Sao_Paulo`, `Europe/London`, `Europe/Berlin`, `Asia/Bahrain`, `Asia/Dubai`, `Asia/Ashkhabad`, `Asia/Almaty`, `Asia/Bangkok`, `Asia/Shanghai`, `Asia/Tokyo`, `Australia/Sydney`, `Pacific/Norfolk`

```tsx
const { timezones, activeTimezone, setTimezone } = useTimezone();

<select value={activeTimezone} onChange={(e) => setTimezone(e.target.value)}>
  {timezones.map((tz) => (
    <option key={tz.key} value={tz.key}>
      {tz.key}
    </option>
  ))}
</select>;
```

---

### useSymbolSearch

Search and select a trading instrument.

```typescript
const {
  query,
  results,
  isSearching,
  activeSymbol,
  setQuery,
  selectSymbol,
  clearResults,
} = useSymbolSearch(debounceMs);
```

| Parameter    | Type     | Default | Description                                   |
| ------------ | -------- | ------- | --------------------------------------------- |
| `debounceMs` | `number` | `300`   | Delay before calling `datafeed.searchSymbols` |

| Field          | Type                                  | Description                                   |
| -------------- | ------------------------------------- | --------------------------------------------- |
| `query`        | `string`                              | Current search query                          |
| `results`      | `PartialSymbolInfo[]`                 | Results from the last search                  |
| `isSearching`  | `boolean`                             | `true` while the request is in flight         |
| `activeSymbol` | `PartialSymbolInfo \| null`           | Currently selected symbol from `state.symbol` |
| `setQuery`     | `(q: string) => void`                 | Update the query (triggers debounced search)  |
| `selectSymbol` | `(symbol: PartialSymbolInfo) => void` | Select a symbol — dispatches `SET_SYMBOL`     |
| `clearResults` | `() => void`                          | Clear search results                          |

The hook automatically cancels in-flight requests via `AbortController` on every new keystroke and on unmount.

```tsx
const { query, results, isSearching, selectSymbol, setQuery } =
  useSymbolSearch(300);

<input
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  placeholder="Search..."
/>;
{
  isSearching && <Spinner />;
}
{
  results.map((sym) => (
    <button key={sym.ticker} onClick={() => selectSymbol(sym)}>
      {sym.ticker}
    </button>
  ));
}
```

---

### useIndicators

Full indicator management: add/remove, visibility, parameters, move between panes.

```typescript
const {
  mainIndicators,
  subIndicators,
  activeMainIndicators,
  activeSubIndicators,
  availableMainIndicators,
  availableSubIndicators,
  addMainIndicator,
  removeMainIndicator,
  addSubIndicator,
  removeSubIndicator,
  toggleMainIndicator,
  toggleSubIndicator,
  moveToMain,
  moveToSub,
  setIndicatorVisible,
  updateIndicatorParams,
  getIndicatorParams,
  isMainIndicatorActive,
  isSubIndicatorActive,
} = useIndicators();
```

#### Fields

| Field                     | Type                     | Description                                |
| ------------------------- | ------------------------ | ------------------------------------------ |
| `mainIndicators`          | `IndicatorInfo[]`        | All main indicators with `isActive` flag   |
| `subIndicators`           | `IndicatorInfo[]`        | All sub-indicators with `isActive` flag    |
| `activeMainIndicators`    | `string[]`               | Active main indicator names only           |
| `activeSubIndicators`     | `Record<string, string>` | Active sub-indicators: `{ name → paneId }` |
| `availableMainIndicators` | `string[]`               | Full list from `MAIN_INDICATORS`           |
| `availableSubIndicators`  | `string[]`               | Full list from `SUB_INDICATORS`            |

```typescript
interface IndicatorInfo {
  name: string; // "MA", "MACD", "RSI", etc.
  isActive: boolean; // Whether it is currently on the chart
}
```

#### Methods

| Method                                        | Description                                                   |
| --------------------------------------------- | ------------------------------------------------------------- |
| `addMainIndicator(name)`                      | Creates the indicator on `candle_pane` with id `main_${name}` |
| `removeMainIndicator(name)`                   | Removes the indicator and updates state                       |
| `addSubIndicator(name)`                       | Creates the indicator on a new sub-pane with id `sub_${name}` |
| `removeSubIndicator(name)`                    | Removes the sub-indicator and its pane                        |
| `toggleMainIndicator(name)`                   | `add` if inactive, `remove` if active                         |
| `toggleSubIndicator(name)`                    | Same for sub-indicators                                       |
| `moveToMain(name)`                            | Moves from sub-pane to `candle_pane`                          |
| `moveToSub(name)`                             | Moves from `candle_pane` to a new sub-pane                    |
| `setIndicatorVisible(name, isMain, visible)`  | Show/hide indicator via `chart.overrideIndicator`             |
| `updateIndicatorParams(name, paneId, params)` | Update `calcParams` via `chart.overrideIndicator`             |
| `getIndicatorParams(name)`                    | Returns `[{ label, defaultValue }]` or `[]` if no parameters  |
| `isMainIndicatorActive(name)`                 | Quick active check                                            |
| `isSubIndicatorActive(name)`                  | Quick active check                                            |

#### Available indicators

**Main chart (`MAIN_INDICATORS`):** MA, EMA, SMA, BOLL, SAR, BBI

**Sub-panes (`SUB_INDICATORS`):** MA, EMA, VOL, MACD, BOLL, KDJ, RSI, BIAS, BRAR, CCI, DMI, CR, PSY, DMA, TRIX, OBV, VR, WR, MTM, EMV, SAR, SMA, ROC, PVT, BBI, AO

**Indicators with configurable parameters:** SMA, BOLL, SAR, BBI, MACD, KDJ, BRAR, CCI, DMI, CR, PSY, DMA, TRIX, OBV, VR, MTM, EMV, ROC, AO and others.

---

### useDrawingTools

Manage drawing tools (chart overlays).

```typescript
const {
  categories,
  activeTool,
  magnetMode,
  isLocked,
  isVisible,
  selectTool,
  clearActiveTool,
  setMagnetMode,
  toggleLock,
  toggleVisibility,
  removeAllDrawings,
} = useDrawingTools();
```

| Field/Method          | Type                             | Description                                             |
| --------------------- | -------------------------------- | ------------------------------------------------------- |
| `categories`          | `DrawingCategoryItem[]`          | Tool categories with nested tools                       |
| `activeTool`          | `string \| null`                 | Name of the last selected tool                          |
| `magnetMode`          | `"normal" \| "weak" \| "strong"` | Snap-to-OHLC mode                                       |
| `isLocked`            | `boolean`                        | Whether all drawings are locked                         |
| `isVisible`           | `boolean`                        | Whether all drawings are visible                        |
| `selectTool(name)`    | —                                | Start drawing via `chart.createOverlay`                 |
| `clearActiveTool()`   | —                                | Deselect tool (local state only)                        |
| `setMagnetMode(mode)` | —                                | Change magnet mode for all existing and future drawings |
| `toggleLock()`        | —                                | Toggle lock on all drawings                             |
| `toggleVisibility()`  | —                                | Show/hide all drawings                                  |
| `removeAllDrawings()` | —                                | Remove all drawings in the `drawing_tools` group        |

```typescript
interface DrawingToolItem {
  name: string; // klinecharts overlay name, e.g. "arrow", "fibonacciLine"
  localeKey: string; // Localization key
}

interface DrawingCategoryItem {
  key: string; // "singleLine" | "moreLine" | "polygon" | "fibonacci" | "wave"
  tools: DrawingToolItem[];
}
```

**Categories and tools:**

| Category (`key`) | Tools                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `singleLine`     | horizontalStraightLine, horizontalRayLine, horizontalSegment, verticalStraightLine, verticalRayLine, verticalSegment, straightLine, rayLine, segment, arrow, priceLine |
| `moreLine`       | priceChannelLine, parallelStraightLine                                                                                                                                 |
| `polygon`        | circle, rect, parallelogram, triangle                                                                                                                                  |
| `fibonacci`      | fibonacciLine, fibonacciSegment, fibonacciCircle, fibonacciSpiral, fibonacciSpeedResistanceFan, fibonacciExtension, gannBox                                            |
| `wave`           | xabcd, abcd, threeWaves, fiveWaves, eightWaves, anyWaves                                                                                                               |

---

### useKlinechartsUISettings

Manage chart appearance: candle type, colors, price marks, axes, grid, crosshair, tooltips.

```typescript
const settings = useKlinechartsUISettings();
```

#### State

| Field                    | Type            | Default          | Description               |
| ------------------------ | --------------- | ---------------- | ------------------------- |
| `candleType`             | `string`        | `"candle_solid"` | Candle display type       |
| `candleUpColor`          | `string`        | `"#2DC08E"`      | Bullish candle color      |
| `candleDownColor`        | `string`        | `"#F92855"`      | Bearish candle color      |
| `showLastPrice`          | `boolean`       | `true`           | Last price mark on Y-axis |
| `showHighPrice`          | `boolean`       | `true`           | High price mark           |
| `showLowPrice`           | `boolean`       | `true`           | Low price mark            |
| `showIndicatorLastValue` | `boolean`       | `true`           | Indicator last value mark |
| `priceAxisType`          | `PriceAxisType` | `"normal"`       | Y-axis scale type         |
| `reverseCoordinate`      | `boolean`       | `false`          | Invert Y-axis             |
| `showTimeAxis`           | `boolean`       | `true`           | Show X-axis               |
| `showGrid`               | `boolean`       | `true`           | Show grid                 |
| `showCrosshair`          | `boolean`       | `true`           | Show crosshair            |
| `showCandleTooltip`      | `boolean`       | `true`           | OHLCV tooltip             |
| `showIndicatorTooltip`   | `boolean`       | `true`           | Indicator tooltip         |

**Candle types:** `candle_solid`, `candle_stroke`, `candle_up_stroke`, `candle_down_stroke`, `ohlc`, `area`

**Price axis types:** `"normal"`, `"percentage"`, `"log"`

#### Extra fields

| Field            | Type                                          | Description                                           |
| ---------------- | --------------------------------------------- | ----------------------------------------------------- |
| `candleTypes`    | `CandleTypeItem[]`                            | List of `{ key, localeKey }` for rendering a selector |
| `priceAxisTypes` | `{ key: PriceAxisType; localeKey: string }[]` | List for rendering a selector                         |

#### Setters

Each field has a corresponding setter: `setCandleType`, `setCandleUpColor`, `setCandleDownColor`, `setShowLastPrice`, `setShowHighPrice`, `setShowLowPrice`, `setShowIndicatorLastValue`, `setPriceAxisType`, `setReverseCoordinate`, `setShowTimeAxis`, `setShowGrid`, `setShowCrosshair`, `setShowCandleTooltip`, `setShowIndicatorTooltip`.

All setters immediately apply changes via `chart.setStyles(...)`.

| Method              | Description                                                 |
| ------------------- | ----------------------------------------------------------- |
| `resetToDefaults()` | Reset all settings to defaults via `chart.setStyles(theme)` |

> **Important:** Settings are stored in local `useState` inside the hook — they are not part of the provider's reducer state. The hook must be called unconditionally (not only when a dialog is open) to preserve settings across dialog open/close cycles. Changes trigger `onSettingsChange` from the provider.

---

### useScreenshot

Capture and download a chart screenshot.

```typescript
const { screenshotUrl, capture, download, clear } = useScreenshot();
```

| Field/Method          | Type                          | Description                                            |
| --------------------- | ----------------------------- | ------------------------------------------------------ |
| `screenshotUrl`       | `string \| null`              | JPEG data URL of the last screenshot                   |
| `capture()`           | `() => void`                  | Capture the current chart state                        |
| `download(filename?)` | `(filename?: string) => void` | Download as a file (default: `"chart-screenshot.jpg"`) |
| `clear()`             | `() => void`                  | Clear `screenshotUrl` from state                       |

Screenshot is created via `chart.getConvertPictureUrl(true, "jpeg", bgColor)`. Background depends on the current theme: `#151517` for dark, `#ffffff` for light.

```tsx
const { screenshotUrl, capture, download, clear } = useScreenshot();

<button onClick={capture}>Capture</button>;
{
  screenshotUrl && (
    <>
      <img src={screenshotUrl} alt="chart" />
      <button onClick={() => download()}>Download</button>
      <button onClick={clear}>Close</button>
    </>
  );
}
```

---

### useFullscreen

Toggle fullscreen mode. Uses `fullscreenContainerRef` from the provider.

```typescript
const { isFullscreen, toggle, enter, exit, containerRef } = useFullscreen();
```

| Field/Method   | Type                             | Description                    |
| -------------- | -------------------------------- | ------------------------------ |
| `isFullscreen` | `boolean`                        | Current fullscreen state       |
| `toggle()`     | `() => void`                     | Toggle                         |
| `enter()`      | `() => void`                     | Enter fullscreen               |
| `exit()`       | `() => void`                     | Exit fullscreen                |
| `containerRef` | `RefObject<HTMLElement \| null>` | The same ref from the provider |

Supports cross-browser vendor prefixes (`webkit`, `ms`).

**Important:** `containerRef` must be assigned to the container element that should occupy the full screen (typically the root layout element):

```tsx
const { containerRef, toggle, isFullscreen } = useFullscreen();

<div ref={containerRef as React.RefObject<HTMLDivElement>}>
  <button onClick={toggle}>{isFullscreen ? "Exit" : "Fullscreen"}</button>
  <ChartView />
</div>;
```

---

### useOrderLines

Create and manage horizontal price level lines (order lines).

> **Requirement:** The `orderLine` overlay must be registered via `overlays={[orderLine]}` on the provider.

```typescript
const {
  createOrderLine,
  updateOrderLine,
  removeOrderLine,
  removeAllOrderLines,
} = useOrderLines();
```

#### createOrderLine

```typescript
createOrderLine(options: OrderLineOptions): string | null
```

Returns the `id` of the created line, or `null` if the chart is not ready.

```typescript
interface OrderLineOptions extends OrderLineExtendData {
  id?: string; // Auto-generated if omitted
  price: number; // Price level
  draggable?: boolean; // Allow drag to change price. Default: false
  onPriceChange?: (price: number) => void; // Called when drag ends
}
```

All `OrderLineExtendData` fields (see [orderLine extension](#orderline)) are accepted directly — they flow through as overlay `extendData`.

#### updateOrderLine

```typescript
updateOrderLine(id: string, options: Partial<Omit<OrderLineOptions, "id">>): void
```

Updates an existing line. Only pass the fields you want to change.

#### removeOrderLine / removeAllOrderLines

```typescript
removeOrderLine(id: string): void
removeAllOrderLines(): void // Removes all overlays with name="orderLine"
```

```tsx
const { createOrderLine, updateOrderLine, removeOrderLine } = useOrderLines();

const id = createOrderLine({
  price: 45000,
  color: "#ff9900",
  text: "Target",
  line: { style: "dashed" },
  mark: { bg: "#ff9900", color: "#fff" },
  draggable: true,
  onPriceChange: (newPrice) => console.log("Moved to:", newPrice),
});

updateOrderLine(id!, { color: "#00ff00" });
removeOrderLine(id!);
```

---

### useUndoRedo

Undo/redo history for drawing overlays and indicator toggles. Automatically connected to `useDrawingTools` and `useIndicators` via a shared context ref — actions are recorded without manual wiring.

**Keyboard shortcuts:** `Ctrl+Z` (undo), `Ctrl+Y` / `Ctrl+Shift+Z` (redo).

```typescript
import { useUndoRedo } from "react-klinecharts-ui";

const { canUndo, canRedo, undo, redo, pushAction, clear } = useUndoRedo();
```

#### Return type: `UseUndoRedoReturn`

| Property | Type | Description |
|----------|------|-------------|
| `canUndo` | `boolean` | Whether there are actions to undo |
| `canRedo` | `boolean` | Whether there are actions to redo |
| `undo` | `() => void` | Undo the last action |
| `redo` | `() => void` | Redo the last undone action |
| `pushAction` | `(action: UndoRedoAction) => void` | Push a new action onto the undo stack (clears redo) |
| `clear` | `() => void` | Clear all undo/redo history |

#### Action types

| Type | Trigger | Undo behaviour | Redo behaviour |
|------|---------|----------------|----------------|
| `overlay_added` | User completes a drawing | Removes the overlay | Re-creates the overlay |
| `overlays_removed` | `removeAllDrawings()` | Restores all removed overlays | Re-removes them |
| `indicator_toggled` | Add/remove indicator | Reverses the toggle | Re-applies the toggle |

#### Cross-hook communication

`useUndoRedo` registers a `pushAction` callback on `undoRedoListenerRef` (shared via provider context). When `useDrawingTools` finishes a drawing or `useIndicators` toggles an indicator, they call the ref to record the action — no prop drilling required.

---

### useLayoutManager

Save, load, rename, and delete named chart layouts via `localStorage`. Captures indicators, drawings, symbol, and period. Optional auto-save with 5-second debounce.

```typescript
import { useLayoutManager } from "react-klinecharts-ui";

const {
  layouts,
  saveLayout,
  loadLayout,
  deleteLayout,
  renameLayout,
  refreshLayouts,
  autoSaveEnabled,
  setAutoSaveEnabled,
} = useLayoutManager();
```

#### Return type: `UseLayoutManagerReturn`

| Property | Type | Description |
|----------|------|-------------|
| `layouts` | `LayoutEntry[]` | List of saved layout entries |
| `saveLayout` | `(name: string) => string \| null` | Save current chart state; returns layout ID |
| `loadLayout` | `(id: string) => boolean` | Load and apply a layout by ID |
| `deleteLayout` | `(id: string) => void` | Delete a layout |
| `renameLayout` | `(id: string, name: string) => boolean` | Rename a layout |
| `refreshLayouts` | `() => void` | Refresh the list from localStorage |
| `autoSaveEnabled` | `boolean` | Whether auto-save is enabled |
| `setAutoSaveEnabled` | `(enabled: boolean) => void` | Toggle auto-save |

#### LayoutEntry

```typescript
interface LayoutEntry {
  id: string;
  name: string;
  symbol: string;
  period: string;
  timestamp: number;
  lastModified: number;
  state: ChartLayoutState;
}
```

#### ChartLayoutState

```typescript
interface ChartLayoutState {
  version: string;
  meta: { symbol: string; period: string; timestamp: number; lastModified: number };
  indicators: Array<{ paneId: string; name: string; calcParams: any[]; visible: boolean }>;
  drawings: Array<{ name: string; points: any[]; styles?: any; extendData?: any }>;
}
```

---

### useScriptEditor

Pine Script-style custom indicator editor. Users write plain JavaScript function bodies that receive `TA`, `dataList` (array of `KLineData`), and `params` (parsed from a comma-separated string). The script must return an array of objects — one per candle, each key becomes a chart series.

Scripts execute inside a sandboxed `new Function()` with dangerous globals shadowed: `fetch`, `XMLHttpRequest`, `WebSocket`, `Worker`, `SharedWorker`, `importScripts`, `self`, `caches`, `indexedDB`.

```typescript
import { useScriptEditor } from "react-klinecharts-ui";

const {
  code, setCode,
  scriptName, setScriptName,
  params, setParams,
  placement, setPlacement,
  error, status, isRunning, hasActiveScript,
  runScript, removeScript, resetCode,
  exportScript, importScript,
  defaultScript,
} = useScriptEditor();
```

#### Return type: `UseScriptEditorReturn`

| Property | Type | Description |
|----------|------|-------------|
| `code` | `string` | Current script source code |
| `setCode` | `(code: string) => void` | Update the source code |
| `scriptName` | `string` | Display name of the script |
| `setScriptName` | `(name: string) => void` | Update the name |
| `params` | `string` | Comma-separated numeric params (e.g. `"14, 26, 9"`) |
| `setParams` | `(params: string) => void` | Update params |
| `placement` | `ScriptPlacement` | `"main"` or `"sub"` |
| `setPlacement` | `(p: ScriptPlacement) => void` | Set placement |
| `error` | `string` | Last error message (empty = no error) |
| `status` | `string` | Last status message |
| `isRunning` | `boolean` | Whether the script is currently executing |
| `hasActiveScript` | `boolean` | Whether a script indicator is on the chart |
| `runScript` | `() => void` | Execute the script and register the indicator |
| `removeScript` | `() => void` | Remove the current script indicator from the chart |
| `resetCode` | `() => void` | Reset code to the default template |
| `exportScript` | `() => void` | Download the code as a `.js` file |
| `importScript` | `(file: File) => void` | Load a script from a file |
| `defaultScript` | `string` | The default template code |

#### Example script

```javascript
// Available: TA, dataList, params
const period = params[0] ?? 14;
const closes = dataList.map(d => d.close);
const highs  = dataList.map(d => d.high);
const lows   = dataList.map(d => d.low);

const rsi  = TA.rsi(closes, period);
const boll = TA.bollinger(closes, period, 2);

// Return one object per candle — each key = one line on the chart
return rsi.map((v, i) => ({
  rsi:   v,
  upper: boll.upper[i],
  mid:   boll.mid[i],
  lower: boll.lower[i],
}));
```

---

## Utilities

### createDataLoader

Creates a klinecharts `DataLoader` from a `Datafeed` instance.

```typescript
function createDataLoader(
  datafeed: Datafeed,
  dispatch: Dispatch<KlinechartsUIAction>,
): DataLoader;
```

This bridges the `Datafeed` interface to the klinecharts native `DataLoader` format.

**Behavior:**

| klinecharts request type | Action                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `"init"`                 | Loads the latest ~1000 bars (`to=Date.now(), from=0`), saves `oldestTimestamp`, increments `currentGen` |
| `"forward"`              | Loads bars older than `oldestTimestamp - 1` for left-scroll pagination                                  |
| `"backward"`             | Ignored (real-time handled via `subscribeBar`)                                                          |

**Race condition protection:** each `"init"` increments `currentGen`. If a `"forward"` request completes after a new `"init"` has started, the result is discarded.

```tsx
function ChartView() {
  const { state, dispatch, datafeed } = useKlinechartsUI();

  const dataLoader = useMemo(
    () => createDataLoader(datafeed, dispatch),
    [datafeed, dispatch],
  );

  return (
    <KLineChart
      dataLoader={dataLoader}
      symbol={state.symbol ?? undefined}
      period={state.period}
      locale={state.locale}
      timezone={state.timezone}
      styles={state.theme}
      onReady={(chart) => dispatch({ type: "SET_CHART", chart })}
    />
  );
}
```

---

### TA (Technical Analysis)

A standalone math library for computing common technical indicators. Used internally by indicator templates and available to custom scripts via `useScriptEditor`.

```typescript
import { TA } from "react-klinecharts-ui";
```

| Function | Signature | Returns |
|----------|-----------|---------|
| `TA.sma` | `(data: number[], period: number)` | `number[]` — Simple Moving Average |
| `TA.ema` | `(data: number[], period: number)` | `number[]` — Exponential Moving Average |
| `TA.rma` | `(data: number[], period: number)` | `number[]` — Running (Wilder's) Moving Average |
| `TA.wma` | `(data: number[], period: number)` | `number[]` — Weighted Moving Average |
| `TA.hma` | `(data: number[], period: number)` | `number[]` — Hull Moving Average |
| `TA.stdev` | `(data: number[], period: number)` | `number[]` — Standard Deviation |
| `TA.rsi` | `(data: number[], period: number)` | `(number \| null)[]` — Relative Strength Index |
| `TA.macd` | `(data: number[], fast?: number, slow?: number, signal?: number)` | `{ dif, dea, macd }` — each `(number \| null)[]` |
| `TA.bollinger` | `(data: number[], period?: number, mult?: number)` | `{ upper, mid, lower }` — each `(number \| null)[]` |
| `TA.tr` | `(highs: number[], lows: number[], closes: number[])` | `number[]` — True Range |
| `TA.atr` | `(highs: number[], lows: number[], closes: number[], period: number)` | `number[]` — Average True Range |
| `TA.vwap` | `(highs: number[], lows: number[], closes: number[], volumes: number[])` | `number[]` — Volume Weighted Average Price |
| `TA.cci` | `(highs: number[], lows: number[], closes: number[], period: number)` | `number[]` — Commodity Channel Index |
| `TA.stoch` | `(highs: number[], lows: number[], closes: number[], kPeriod?, kSmooth?, dPeriod?)` | `{ k, d }` — each `(number \| null)[]` |

---

## Data & Constants

All constants are exported from the root `index.ts`:

### DEFAULT_PERIODS

```typescript
const DEFAULT_PERIODS: TerminalPeriod[] = [
  { span: 1, type: "minute", label: "1m" },
  { span: 5, type: "minute", label: "5m" },
  { span: 15, type: "minute", label: "15m" },
  { span: 1, type: "hour", label: "1H" },
  { span: 2, type: "hour", label: "2H" },
  { span: 4, type: "hour", label: "4H" },
  { span: 1, type: "day", label: "D" },
  { span: 1, type: "week", label: "W" },
  { span: 1, type: "month", label: "M" },
  { span: 1, type: "year", label: "Y" },
];
```

### TIMEZONES

Array of `TimezoneOption[]` — 18 timezones. Fields: `key` (IANA) and `localeKey` (short name).

### MAIN_INDICATORS / SUB_INDICATORS

String arrays of indicator names used as the available-for-selection list.

### INDICATOR_PARAMS

```typescript
const INDICATOR_PARAMS: Record<string, IndicatorDefinition>;

interface IndicatorDefinition {
  name: string;
  localeKey: string;
  params: { label: string; defaultValue: number }[];
}
```

Used internally by `getIndicatorParams` inside `useIndicators`.

### DRAWING_CATEGORIES

Array of drawing tool categories. Used by `useDrawingTools`.

### CANDLE_TYPES

```typescript
const CANDLE_TYPES: CandleTypeOption[] = [
  { key: "candle_solid", localeKey: "candle_solid" },
  { key: "candle_stroke", localeKey: "candle_stroke" },
  { key: "candle_up_stroke", localeKey: "candle_up_stroke" },
  { key: "candle_down_stroke", localeKey: "candle_down_stroke" },
  { key: "ohlc", localeKey: "ohlc" },
  { key: "area", localeKey: "area" },
];
```

### PRICE_AXIS_TYPES

```typescript
const PRICE_AXIS_TYPES = ["normal", "percentage", "log"] as const;
type PriceAxisType = "normal" | "percentage" | "log";
```

---

## Custom Indicator Templates

11 TradingView-style indicator templates ported from [QUANTIX Extended Edition](https://github.com/dsavenk0/KLineChart-Pro). All are registered automatically via `registerExtensions`. Each template uses the `TA` library for calculations and includes custom `draw` functions for TradingView-like visual styling (gradient fills, dashed level lines, multi-color histograms).

```typescript
import { indicators } from "react-klinecharts-ui";
// indicators === [bollTv, cci, hma, ichimoku, maRibbon, macdTv, pivotPoints, rsiTv, stochastic, superTrend, vwap]
```

### Main chart indicators

| Template | Name | Default params | Description |
|----------|------|----------------|-------------|
| `bollTv` | `BOLL_TV` | `[20, 2]` | Bollinger Bands — TradingView style with filled band area, SMA midline, and upper/lower bands |
| `hma` | `HMA` | `[9]` | Hull Moving Average — high smoothing with minimal lag via `TA.hma()` |
| `ichimoku` | `ICHIMOKU` | `[9, 26, 52, 26]` | Ichimoku Cloud — Tenkan-sen, Kijun-sen, Senkou Span A/B (filled cloud), Chikou Span |
| `maRibbon` | `MA_RIBBON` | `[5, 10, 20, 30, 50, 100]` | Moving Average Ribbon — 6 EMAs with distinct colors for trend visualization |
| `pivotPoints` | `PIVOT_POINTS` | `[1]` | Standard pivot with Pivot, R1, R2, S1, S2 levels as dashed horizontal lines |
| `superTrend` | `SUPERTREND` | `[10, 3]` | ATR-based trend — dynamic green (up) / red (down) line coloring |
| `vwap` | `VWAP` | `[]` | Volume Weighted Average Price — single blue line via `TA.vwap()` |

### Sub-pane indicators

| Template | Name | Default params | Description |
|----------|------|----------------|-------------|
| `macdTv` | `MACD_TV` | `[12, 26, 9]` | 4-color histogram: growing-positive (#26A69A), shrinking-positive (#B2DFDB), growing-negative (#FFCDD2), shrinking-negative (#EF5350). MACD line (#2962FF), Signal line (#FF6D00) |
| `rsiTv` | `RSI_TV` | `[14, 14]` | RSI + MA line. Dashed levels at 70/50/30. Gradient fills in overbought (>70, red) and oversold (<30, green) zones |
| `cci` | `CCI` | `[20]` | Commodity Channel Index via `TA.cci()` with dashed +100/0/-100 reference lines |
| `stochastic` | `STOCHASTIC` | `[14, 1, 3]` | %K (#2962FF) and %D (#FF6D00) lines. Dashed 80/50/20 levels. Gradient fills in overbought/oversold zones |

---

## Drawing Overlays

`OverlayTemplate` instances for drawing tools. Automatically registered when `registerExtensions: true` (default).

**Named exports:**

| Export                        | Overlay name                    | Description         |
| ----------------------------- | ------------------------------- | ------------------- |
| `arrow`                       | `"arrow"`                       | Arrow               |
| `circle`                      | `"circle"`                      | Circle              |
| `rect`                        | `"rect"`                        | Rectangle           |
| `triangle`                    | `"triangle"`                    | Triangle            |
| `parallelogram`               | `"parallelogram"`               | Parallelogram       |
| `fibonacciCircle`             | `"fibonacciCircle"`             | Fibonacci circle    |
| `fibonacciSegment`            | `"fibonacciSegment"`            | Fibonacci segment   |
| `fibonacciSpiral`             | `"fibonacciSpiral"`             | Fibonacci spiral    |
| `fibonacciSpeedResistanceFan` | `"fibonacciSpeedResistanceFan"` | Fibonacci fan       |
| `fibonacciExtension`          | `"fibonacciExtension"`          | Fibonacci extension |
| `gannBox`                     | `"gannBox"`                     | Gann box            |
| `threeWaves`                  | `"threeWaves"`                  | 3-wave pattern      |
| `fiveWaves`                   | `"fiveWaves"`                   | 5-wave pattern      |
| `eightWaves`                  | `"eightWaves"`                  | 8-wave pattern      |
| `anyWaves`                    | `"anyWaves"`                    | Custom wave pattern |
| `abcd`                        | `"abcd"`                        | ABCD pattern        |
| `xabcd`                       | `"xabcd"`                       | XABCD pattern       |
| `elliottWave`                 | `"elliottWave"`                 | Elliott Wave (5-wave cycle with numbered vertices) |
| `gannFan`                     | `"gannFan"`                     | Gann Fan (1x1, 1x2, etc.) |
| `fibRetracement`              | `"fibRetracement"`              | Fibonacci retracement levels |
| `parallelChannel`             | `"parallelChannel"`             | Parallel channel (two parallel lines) |
| `longPosition`                | `"longPosition"`                | Long position risk/reward (TP/SL with % labels) |
| `shortPosition`               | `"shortPosition"`               | Short position risk/reward (TP/SL with % labels) |
| `measure`                     | `"measure"`                     | Measure tool (price %, bar count, time delta) |
| `brush`                       | `"brush"`                       | Freehand brush drawing (Bezier smoothing) |
| `ray`                         | `"ray"`                         | Infinite ray from a point |

---

## Extensions

### registerExtensions

Registers all built-in drawing overlays via `registerOverlay`. Called automatically by the provider when `registerExtensions: true`.

```typescript
import { registerExtensions } from "react-klinecharts-ui";
registerExtensions(); // Idempotent — repeated calls are ignored
```

### orderLine

Overlay template for horizontal price level lines. **Not registered automatically** — must be passed explicitly to the provider.

```typescript
import { orderLine, KlinechartsUIProvider } from "react-klinecharts-ui";

<KlinechartsUIProvider overlays={[orderLine]}>...</KlinechartsUIProvider>;
```

**Implementation details:**

- `needDefaultYAxisFigure: false` — custom rendering of the Y-axis mark
- `createYAxisFigures` — draws a colored price mark on the right axis
- `createPointFigures` — draws a horizontal line with an optional text label
- `performEventPressedMove` — updates `points[0].value` during drag
- Uses `chart.getSymbol()?.pricePrecision ?? 2` for price formatting

#### OrderLineExtendData

All fields are optional. Defaults produce an orange dashed line with a white-on-orange price mark.

```typescript
interface OrderLineExtendData {
  /** Primary color for line, mark bg, and label fallback. Default: "rgba(255, 165, 0, 0.85)" */
  color?: string;
  /** Optional text label displayed above the line. */
  text?: string;
  /** Line style overrides. */
  line?: OrderLineLineStyle;
  /** Y-axis price mark style overrides. */
  mark?: OrderLineMarkStyle;
  /** Text label style overrides. */
  label?: OrderLineLabelStyle;
}

interface OrderLineLineStyle {
  style?: "solid" | "dashed" | "dotted"; // Default: "dashed"
  width?: number; // Default: 1
  dashedValue?: [number, number]; // Default: [4, 2]
}

interface OrderLineMarkStyle {
  color?: string; // Text color. Default: "#ffffff"
  bg?: string; // Background (falls back to top-level color)
  borderRadius?: number; // Default: 2
  font?: OrderLineFontStyle;
  padding?: OrderLinePadding;
}

interface OrderLineLabelStyle {
  color?: string; // Text color (falls back to top-level color)
  bg?: string; // Background. Default: "transparent"
  borderRadius?: number; // Default: 0
  font?: OrderLineFontStyle;
  padding?: OrderLinePadding;
  offset?: OrderLinePadding; // Position offset. Defaults: x=8, y=3
}

interface OrderLineFontStyle {
  size?: number; // Default: 11
  family?: string; // Default: "Helvetica Neue, Arial, sans-serif"
  weight?: string; // Default: "bold" (mark) / "normal" (label)
}

interface OrderLinePadding {
  x?: number;
  y?: number;
}
```

All sub-interfaces (`OrderLineLineStyle`, `OrderLineMarkStyle`, `OrderLineLabelStyle`, `OrderLineFontStyle`, `OrderLinePadding`) are exported as named types from both the main and `extensions` entry points.

### overlays (array)

Array of all built-in drawing overlays — for direct access to the list:

```typescript
import { overlays } from "react-klinecharts-ui";
// overlays === [arrow, circle, rect, triangle, ...] (26 items)
```

---

## State Callbacks

Callbacks are invoked **synchronously** inside `enhancedDispatch`, before the React re-render — enabling immediate state persistence.

```tsx
<KlinechartsUIProvider
  datafeed={datafeed}
  onStateChange={(action, nextState, prevState) => {
    // Called for every dispatched action
    console.log(action.type, nextState);
  }}
  onSymbolChange={(symbol) => {
    localStorage.setItem('symbol', JSON.stringify(symbol));
  }}
  onPeriodChange={(period) => {
    localStorage.setItem('period', JSON.stringify(period));
  }}
  onThemeChange={(theme) => {
    localStorage.setItem('theme', theme);
  }}
  onTimezoneChange={(timezone) => {
    localStorage.setItem('timezone', timezone);
  }}
  onMainIndicatorsChange={(indicators) => {
    localStorage.setItem('mainIndicators', JSON.stringify(indicators));
  }}
  onSubIndicatorsChange={(indicators) => {
    localStorage.setItem('subIndicators', JSON.stringify(indicators));
  }}
  onSettingsChange={(settings) => {
    // Called from useKlinechartsUISettings on every change
    localStorage.setItem('settings', JSON.stringify(settings));
  }}
>
```

**Restoring persisted state:**

```tsx
const savedSymbol = JSON.parse(localStorage.getItem('symbol') ?? 'null');
const savedTheme = localStorage.getItem('theme') ?? 'dark';

<KlinechartsUIProvider
  defaultSymbol={savedSymbol ?? { ticker: 'BTCUSDT' }}
  defaultTheme={savedTheme}
>
```

---

## Full Export List

```typescript
// Provider & context
export { KlinechartsUIProvider };
export {
  useKlinechartsUI,
  KlinechartsUIStateContext,
  KlinechartsUIDispatchContext,
};
export type {
  KlinechartsUIOptions,
  KlinechartsUIState,
  KlinechartsUIAction,
  KlinechartsUIContextValue,
  KlinechartsUIDispatchValue,
  Datafeed,
  PartialSymbolInfo,
};

// Hooks
export { useKlinechartsUITheme, type UseKlinechartsUIThemeReturn };
export { useKlinechartsUILoading, type UseKlinechartsUILoadingReturn };
export { usePeriods, type UsePeriodsReturn };
export { useTimezone, type UseTimezoneReturn, type TimezoneItem };
export { useSymbolSearch, type UseSymbolSearchReturn };
export { useIndicators, type UseIndicatorsReturn, type IndicatorInfo };
export {
  useDrawingTools,
  type UseDrawingToolsReturn,
  type DrawingToolItem,
  type DrawingCategoryItem,
};
export {
  useKlinechartsUISettings,
  type UseKlinechartsUISettingsReturn,
  type KlinechartsUISettingsState,
  type CandleTypeItem,
};
export { useScreenshot, type UseScreenshotReturn };
export { useFullscreen, type UseFullscreenReturn };
export { useOrderLines, type UseOrderLinesReturn, type OrderLineOptions };
export {
  useUndoRedo,
  type UseUndoRedoReturn,
  type UndoRedoAction,
  type UndoRedoActionType,
};
export {
  useLayoutManager,
  type UseLayoutManagerReturn,
  type LayoutEntry,
  type ChartLayoutState,
};
export {
  useScriptEditor,
  type UseScriptEditorReturn,
  type ScriptPlacement,
};

// Data
export { DEFAULT_PERIODS, type TerminalPeriod };
export { TIMEZONES, type TimezoneOption };
export {
  MAIN_INDICATORS,
  SUB_INDICATORS,
  INDICATOR_PARAMS,
  type IndicatorParamConfig,
  type IndicatorDefinition,
};
export {
  DRAWING_CATEGORIES,
  type DrawingTool,
  type DrawingToolCategory,
  type MagnetMode,
};
export {
  CANDLE_TYPES,
  PRICE_AXIS_TYPES,
  YAXIS_POSITIONS,
  COMPARE_RULES,
  TOOLTIP_SHOW_RULES,
  type CandleTypeOption,
  type PriceAxisType,
  type YAxisPosition,
  type CompareRule,
  type TooltipShowRule,
};

// Utilities
export { createDataLoader };
export { default as TA } from "./utils/TA";

// Drawing overlays (all 26)
export {
  arrow, circle, rect, triangle, parallelogram,
  fibonacciCircle, fibonacciSegment, fibonacciSpiral,
  fibonacciSpeedResistanceFan, fibonacciExtension,
  fibRetracement,
  gannBox, gannFan,
  threeWaves, fiveWaves, eightWaves, anyWaves, elliottWave,
  abcd, xabcd,
  parallelChannel, ray,
  longPosition, shortPosition,
  measure, brush,
};

// Custom indicator templates (all 11)
export * from "./indicators";

// Extensions
export { registerExtensions, overlays, indicators, orderLine };
export type {
  OrderLineExtendData,
  OrderLineLineStyle,
  OrderLineMarkStyle,
  OrderLineLabelStyle,
  OrderLineFontStyle,
  OrderLinePadding,
};
```
