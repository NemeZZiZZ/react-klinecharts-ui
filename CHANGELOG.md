# Changelog

All notable changes to **react-klinecharts-ui** are documented in this file.

---

## 0.6.0 — 2026-06-24

### New Features

- **Labelled price alerts (`useAlerts`).** Alerts previously drew a bare `horizontalStraightLine` with no text — the `message` was stored on the `Alert` but never rendered, and there was no way to style the line. Alerts now draw a dedicated **`alertLine`** overlay (modelled on `orderLine`) that shows a Y-axis price mark plus a bell-marked caption above the line, and they accept a style object:

  - `addAlert(price, condition, message?, extendData?)` — new optional 4th argument typed `AlertLineExtendData` (`color`, `text`, `line`, `mark`, `label`, `showBell`). The `line` / `mark` / `label` sub-types are reused from `orderLine`. When `extendData.text` is omitted, the caption falls back to `message ?? formatted price` using the symbol's `pricePrecision`. Older positional calls (`addAlert(price, condition)` / `addAlert(price, condition, message)`) are unchanged.
  - `Alert` gained an optional `extendData?: AlertLineExtendData` field, persisted in `state.alerts` so the alert's look survives undo/redo and layout presets.
  - New `alertLine` overlay template + `AlertLineExtendData` type are exported from the package root and the `extensions` entry point.

- **Automatic feature-overlay registration.** `registerExtensions()` now also registers the feature overlays `orderLine`, `alertLine` and `depthOverlay`, not just the drawing tools. Previously these had to be passed manually via the provider's `overlays` prop — an easy-to-miss step that silently caused `createOrderLine` to draw nothing. `useAlerts` additionally registers `alertLine` lazily (idempotently) before creating its first overlay, so it works even when provider registration is disabled. Passing the overlays through `overlays={[...]}` still works and is harmless.

- **Keyboard shortcuts (`useHotkeys`).** New headless hook wrapping klinecharts 10.0.0-beta3's hotkey system. `registerHotkey(template)` registers a custom shortcut globally (its `action` receives `{ chart, event, key, hotkey }`), `getHotkey(name)` / `supportedHotkeys` introspect the registry, and `setHotkeysEnabled(enabled, exclude?)` / `getHotkeysConfig()` toggle hotkey handling per chart (with an optional name exclude-list). Exports `HotkeyTemplate`, `Hotkey`, `HotkeyActionParams`.

- **Freehand drawing / `brush` tool.** klinecharts beta3 adds a built-in `brush` overlay with continuous (freehand) drawing mode. It is already listed in the drawing-tool menu (`useDrawingTools`, `annotation` category), so it now works end-to-end — select it and draw freehand. No API change required.

- **Axis overrides (`useChartAxes`).** New headless hook exposing klinecharts' `overrideXAxis` / `overrideYAxis` instance methods (added in beta2) — flip the price scale (`reverse`), draw labels inside the pane (`inside`), toggle `scrollZoomEnabled`, or supply a custom `createRange` / `createTicks`. Exports `XAxisOverride`, `YAxisOverride`. (klinecharts beta3 ships these two methods with their parameter types swapped in its published typings; the hook shields consumers behind semantically-correct signatures.)

### Internal / API

- Added `featureOverlays` and `ensureAlertLineRegistered()` to `src/extensions`. `Alert.extendData` is additive — no breaking changes.

### Dependencies & upstream notes

- Tested against **react-klinecharts 0.2.1** (which bumps **klinecharts** to `10.0.0-beta3`). The `react-klinecharts` peer range stays `>=0.2.0` — beta3 is **not** required to keep existing features working, and consumers on `0.2.0` / beta2 keep running. The dev/example/docs pins moved to `0.2.1`; alert/order-line overlays were verified rendering on beta3. (`useHotkeys`, `useChartAxes` and the `brush` tool require beta3 / beta2 respectively.)
- **Locked overlays no longer block chart scrolling** (klinecharts beta3 fix). The cursor can now sit on a locked `alertLine` / `orderLine` (or any locked drawing) without freezing the chart's scroll — a free UX win on beta3.
- **Built-in `RSI` recalculated** (klinecharts beta3). klinecharts adjusted the calculation of its built-in `RSI` indicator, so values for the menu's `RSI` entry shift slightly on beta3. The bundled custom `RSI_TV` indicator (computed via `TA`) is unaffected.

## 0.5.0 — 2026-06-23

### New Features

- **Reactive indicator visibility** (`useIndicators`). Visibility was previously write-only: `setIndicatorVisible` pushed the flag into klinecharts via `overrideIndicator`, but there was no way to read it back through the hook — a UI building an indicator dialog had to mirror the state locally or reach into the chart instance, and that copy silently drifted whenever `collapseSubIndicator` / `expandSubIndicator` changed visibility behind its back. Visibility is now mirrored in provider state and exposed for reading:

  - `isIndicatorVisible(name, isMain)` — the reactive read counterpart to `setIndicatorVisible`. Returns `true` for the default (un-toggled) state and for inactive indicators.
  - `IndicatorInfo.visible` — the `mainIndicators` / `subIndicators` arrays now carry a `visible` field alongside `isActive`, so a dialog can render the eye/checkbox state directly from the hook.
  - `indicatorVisibility` — the raw map (keyed by indicator id `main_<name>` / `sub_<name>`), exposed as the live source of truth for layout/rendering.

  A new additive `indicatorVisibility` field (keyed by indicator id) was added to the provider state, following the existing `indicatorAxes` pattern. The map is kept **sparse** — only indicators hidden away from the default are stored; an absent key means visible. `setIndicatorVisible`, `collapseSubIndicator` and `expandSubIndicator` all update it through the new `SET_INDICATOR_VISIBILITY` action (so collapse/expand no longer desync from the dialog), `removeMainIndicator` / `removeSubIndicator` drop the key to avoid stale entries, and `useLayoutManager` rebuilds the map when a preset is restored so the mirror never drifts from the chart.

- **Shared state for `useAlerts` / `useMeasure` / `useReplay`.** These hooks previously kept their state in per-instance `useState` / `useRef` and only read `state.chart` from the shared store. Mounting a hook in more than one component (e.g. a toolbar control + a bottom panel + a status bar) therefore created **independent copies** that silently diverged — replay "wouldn't start" when the controlling component and the displaying component were different instances, and each `useAlerts` / `useReplay` spawned its own polling/playback interval. The observable state now lives in the provider store, and the imperative machinery has a single owner:

  - **`useAlerts`** — the alert list moved to `state.alerts`. The 1s crossing poller and the `onAlertTriggered` listener are now owned by the provider; the poller runs only while there is a chart and at least one alert. Any number of `useAlerts()` instances observe one list and share one poller.
  - **`useMeasure`** — `isActive` / `fromPoint` / `result` moved to `state.measure`. The toolbar toggle and a separate result-readout panel now stay in sync wherever each is mounted. (Dropped a dead `clickCountRef` that was assigned but never read.)
  - **`useReplay`** — control state (`isReplaying`, `isPaused`, `speed`, `barIndex`, `totalBars`) moved to `state.replay`. The playback `setInterval` and the saved-data / current-index buffers are owned by the provider (shared via stable refs), so there is exactly one playback session regardless of how many instances are mounted — starting in one component and stepping in another drives the same timer.

  This makes the app-level workaround of instantiating each hook once in a shared context **optional rather than required**: the hooks are now safe to call from multiple components directly. Public hook APIs and exported types (`Alert`, `AlertCondition`, `MeasurePoint`, `MeasureResult`, `ReplaySpeed`) are unchanged; the shared domain types moved to a neutral `src/provider/featureTypes.ts` and are re-exported from the hooks.

### Internal / API

- Added `SET_INDICATOR_VISIBILITY` reducer action and the `indicatorVisibility: Record<string, boolean>` field to `KlinechartsUIState` (defaults to `{}`). Purely additive — no breaking changes.
- Added `alerts: Alert[]`, `measure: MeasureState`, and `replay: ReplayState` fields to `KlinechartsUIState`, with `SET_ALERTS` / `SET_MEASURE` / `SET_REPLAY` reducer actions (the latter two merge a partial). The `KlinechartsUIDispatchValue` (dispatch context) gained provider-owned refs: `alertTriggeredListenerRef`, `replayIntervalRef`, `replaySavedDataRef`, `replayIndexRef`. Purely additive — no breaking changes.

## 0.4.0 — 2026-06-01

Compatibility release for **react-klinecharts 0.2.0** / **klinecharts 10.0.0-beta2**. Adopts the new klinecharts v10 chart-instance API and exposes the new **multiple Y-axes** feature through `useIndicators`.

### New Features

- **Secondary Y-axis binding for indicators** (`useIndicators`). klinecharts v10 allows several independent Y-axes on a single pane, so an indicator with a value range very different from price (e.g. RSI 0–100, volume) can get its own scale instead of distorting the shared price axis or being pushed into a separate sub-pane.

  - `addMainIndicator(name, { yAxis })` and `addSubIndicator(name, { yAxis })` — accept an optional `yAxis: YAxisOverride`. Provide a stable `yAxis.id` to create/share a secondary axis (e.g. `{ id: "rsi_axis", position: "left" }`); omit it for the pane's default (shared) axis.
  - `bindIndicatorToNewAxis(name, isMain, yAxis?)` — moves an existing indicator to a different axis. Because v10 `overrideIndicator` cannot rebind an axis, this removes and recreates the indicator while preserving its calc params, styles and visibility. Omitting `yAxis` returns it to the default axis. This lets a UI offer "move to a separate axis / back to price / left-right" with a single call instead of duplicating the remove-and-recreate logic in every component.
  - `indicatorAxes` / `getIndicatorAxis(name, isMain)` — read which indicators are bound to a custom axis (the live source of truth a UI can render against).

  The binding is a **persistent property**, not a one-shot action: it is preserved across **undo/redo** (`useUndoRedo`) and **layout presets** (`useLayoutManager`). A new additive `indicatorAxes` field (keyed by indicator id) was added to the provider state to track custom bindings; it defaults to `{}` and indicators on the shared default axis are absent from it. As part of this, `useLayoutManager` now restores indicators with the canonical `main_<name>` / `sub_<name>` ids so restored presets stay in sync with `useIndicators`.

### Examples

- **Secondary Y-axis** example page (`#secondary-axis`) demonstrating an RSI oscillator on the price pane — shared axis (squished) vs its own left axis — with Undo/Redo to show the binding persists. The indicator dialog also gained a per-main-indicator "separate axis" toggle.



### Breaking Changes

- **Peer dependency** `react-klinecharts` raised from `>=0.1.0` to `>=0.2.0` (which depends on `klinecharts ^10.0.0-beta2`). Consumers must upgrade `react-klinecharts` to `0.2.0`.

### Internal / API Migration

- **`createIndicator`** — migrated to the new v10 signature `createIndicator(value, { isStack, pane, yAxis })`. Previously the library used the positional form `createIndicator(value, isStack, paneOptions)`, which no longer exists. Affects `useIndicators`, `useCompare`, `useScriptEditor`, `useLayoutManager` and `useUndoRedo`.

- **`IndicatorCreate`** — `paneId` (and `yAxisId`) were removed from the indicator-create object in v10. Pane placement now goes through the `pane` option of `createIndicator`; `overrideIndicator` targets indicators by `id` / `name`. Updated all `createIndicator` / `overrideIndicator` calls accordingly.

- **Axis configuration** — `setPaneOptions` no longer accepts an `axis` field in v10. Price-axis settings (reverse coordinate, price-axis type, y-axis position, inside) now use the new `overrideYAxis()` instance method in `useKlinechartsUISettings`.

> Note: klinecharts `10.0.0-beta2` ships swapped parameter typings for `overrideYAxis` / `overrideXAxis` in its `.d.ts` (the runtime is correct). The library casts around this until the upstream typings are fixed.

## 0.3.0 — 2026-03-09

Major feature release with 5 new hooks for real-time trading terminal functionality, depth visualization overlay, multi-chart synchronization, and comprehensive examples demonstrating all library features.

### New Hooks

- **`useWatchlist`** — Manage a list of tracked symbols with live price updates. Tracks last price and 24h change percentage.

- **`useCompare`** — Compare multiple symbols on the same chart. Add/remove symbols with toggle visibility and custom colors.

- **`useMeasure`** — Measure price changes, percentage swings, bar count, and time intervals between chart points.

- **`useAnnotations`** — Add text annotations at specific price levels and timestamps with color customization.

- **`useReplay`** — Replay historical candles at various speeds (0.25x–4x) with play/pause/step/stop controls and progress tracking.

### New Extensions

- **`depthOverlay`** — Horizontal liquidity bars overlay showing buy/sell order book depth at each price level, with customizable styling and real-time data updates.

### Example Components

Added 8 comprehensive example UI components demonstrating each new hook and feature:
- `WatchlistPanel` — Symbol list with live prices and 24h % change
- `CompareDialog` — Multi-symbol comparison with quick-add buttons
- `MeasureButton` — Measurement tool with price/time/bar count display
- `AnnotationsButton` — Add/manage/clear price-level text annotations
- `ReplayControls` — Historical candle replay with speed control
- `OrderBookPanel` — Live order book depth (Binance integration)
- `DepthOverlayToggle` — Toggle depth overlay on chart
- `OrderLineAlertSound` — Sound alerts for order line touches

### New Example Pages

- **Terminal** (`#terminal`) — Full-featured trading terminal with 15+ features including drawing tools, indicators, order book, depth overlay, watchlist, annotations, replay, compare, and measure tools.
- **Multi-Chart Synced** (`#multi-chart`) — Synchronized scroll, zoom, and crosshair across multiple independent charts.
- **Depth/Order Book** (`#depth`) — Dedicated depth chart with live Binance order book updates.

### Improvements

- Multi-chart scroll/zoom sync — Delta-based synchronization using klinecharts internal scroll state (`store.startScroll()`, `store.scroll(distance)`), preventing feedback loops and inconsistent viewport positions.
- Improved annotation visibility — Switched from `simpleTag` (Y-axis label only) to `simpleAnnotation` (chart arrow + text popup).
- WebSocket stability — Added `WebSocket.CLOSING` state check and suppressed harmless errors from React StrictMode remounts in datafeed.
- Watchlist live data — Dedicated Binance mini-ticker WebSocket stream with 50ms debounce, avoiding conflicts with chart's kline subscription.

---

## 0.2.0 — 2026-03-04

Extended the library with features ported from the [QUANTIX Extended Edition](https://github.com/dsavenk0/KLineChart-Pro) fork of KLineChart-Pro. The original fork implements these features as a tightly-coupled Vue 3 application; this release re-implements them as headless React hooks and overlay/indicator templates, following the library's headless architecture.

### New Hooks

- **`useUndoRedo`** — Undo/redo history for drawing overlays and indicator toggles. Supports keyboard shortcuts (`Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`). Connected to `useDrawingTools` and `useIndicators` via a shared context ref (`undoRedoListenerRef`) so that actions are automatically recorded.

- **`useLayoutManager`** — Save, load, rename, and delete named chart layouts via `localStorage`. Captures indicators, drawings, symbol, and period. Optional auto-save with 5-second debounce.

- **`useScriptEditor`** — Pine Script-style custom indicator editor. Users write plain JavaScript function bodies receiving `TA`, `dataList`, and `params`. Scripts execute in a sandboxed `new Function()` with dangerous globals shadowed (`fetch`, `XMLHttpRequest`, `WebSocket`, `Worker`, etc.). Supports import/export of `.js`/`.ts`/`.txt` files, placement on main chart or sub-pane, and dynamic series detection.

### New Indicator Templates (11)

| Indicator | Template name | Placement | Description |
|-----------|---------------|-----------|-------------|
| Bollinger Bands (TV) | `BOLL_TV` | main | TradingView-style with fill between upper/lower bands |
| CCI | `CCI` | sub | Commodity Channel Index with +100/-100 reference lines |
| HMA | `HMA` | main | Hull Moving Average — low-lag smoothing |
| Ichimoku Cloud | `ICHIMOKU` | main | Tenkan-sen, Kijun-sen, Senkou Span A/B, Chikou Span with cloud fill |
| MA Ribbon | `MA_RIBBON` | main | 6-period moving average ribbon for trend visualization |
| MACD (TV) | `MACD_TV` | sub | 4-color histogram (growing/shrinking x positive/negative), TradingView style |
| Pivot Points | `PIVOT_POINTS` | main | Standard pivot with R1, R2, S1, S2 levels |
| RSI (TV) | `RSI_TV` | sub | RMA-based RSI + MA line, dashed 70/50/30 levels, gradient overbought/oversold fills |
| Stochastic | `STOCHASTIC` | sub | %K and %D lines, TradingView-style calculation |
| SuperTrend | `SUPERTREND` | main | ATR-based trend indicator with dynamic up/down coloring |
| VWAP | `VWAP` | main | Volume-weighted average price |

### New Overlay Templates (9)

| Overlay | Template name | Category | Description |
|---------|---------------|----------|-------------|
| Elliott Wave | `elliottWave` | wave | Five-wave cycle markup with numbered vertices |
| Gann Fan | `gannFan` | fibonacci | Gann angle fans (1x1, 1x2, etc.) |
| Fibonacci Retracement | `fibRetracement` | fibonacci | Standard retracement levels |
| Parallel Channel | `parallelChannel` | moreLine | Two-point channel with parallel lines |
| Long Position | `longPosition` | position | Risk/reward calculator with TP/SL levels and % labels |
| Short Position | `shortPosition` | position | Risk/reward calculator for short trades |
| Measure | `measure` | measure | Price change %, bar count, and time interval between two points |
| Brush | `brush` | annotation | Freehand drawing with Bezier smoothing |
| Ray | `ray` | singleLine | Infinite ray from a point |

### New TA (Technical Analysis) Library

A standalone math library (`TA`) exported for use in custom scripts and indicator templates:

| Function | Signature | Description |
|----------|-----------|-------------|
| `sma` | `(data, period) => number[]` | Simple Moving Average |
| `ema` | `(data, period) => number[]` | Exponential Moving Average |
| `rma` | `(data, period) => number[]` | Running (Wilder's) Moving Average |
| `wma` | `(data, period) => number[]` | Weighted Moving Average |
| `hma` | `(data, period) => number[]` | Hull Moving Average |
| `rsi` | `(data, period) => (number \| null)[]` | Relative Strength Index |
| `macd` | `(data, fast, slow, signal) => { dif, dea, macd }` | MACD |
| `bollinger` | `(data, period, mult) => { upper, mid, lower }` | Bollinger Bands |
| `stdev` | `(data, period) => number[]` | Standard Deviation |
| `tr` | `(highs, lows, closes) => number[]` | True Range |
| `atr` | `(highs, lows, closes, period) => number[]` | Average True Range |
| `vwap` | `(highs, lows, closes, volumes) => number[]` | Volume Weighted Average Price |
| `cci` | `(highs, lows, closes, period) => number[]` | Commodity Channel Index |
| `stoch` | `(highs, lows, closes, kPeriod, kSmooth, dPeriod) => { k, d }` | Stochastic Oscillator |

### New Drawing Tool Categories

Extended `DRAWING_CATEGORIES` with 3 additional categories:
- **measure** — Measurement tools
- **position** — Long/Short position calculators
- **annotation** — Freehand brush drawing

### New Data Constants

- `YAXIS_POSITIONS` — Y-axis position options
- `COMPARE_RULES` — Comparison mode rules
- `TOOLTIP_SHOW_RULES` — Tooltip display rules

### Bug Fixes

- Fixed RSI_TV indicator crash (`Cannot destructure 'from' of 'visibleRange'`) — klinecharts v10 moved `visibleRange` and `barSpace` from `IndicatorDrawParams` to `chart.getVisibleRange()` and `chart.getBarSpace()`.
- Fixed undo/redo duplicate key warnings (SAR, EMA) — corrected inverted `wasActive` semantics in `useIndicators`.

---

## 0.1.0 — Initial Release

Core headless library with 12 hooks, 17 overlay templates, and `orderLine` extension.

### Hooks

- `useKlinechartsUI` — Primary context hook
- `useKlinechartsUITheme` — Theme management (light/dark)
- `useKlinechartsUILoading` — Loading state
- `usePeriods` — Timeframe management
- `useTimezone` — 18 IANA timezones
- `useSymbolSearch` — Symbol search with debouncing
- `useIndicators` — Indicator add/remove/configure
- `useDrawingTools` — Drawing tools with magnet, lock, visibility
- `useKlinechartsUISettings` — Chart appearance (candle type, colors, axes, grid, tooltips)
- `useScreenshot` — Chart screenshot capture and download
- `useFullscreen` — Fullscreen toggle
- `useOrderLines` — Horizontal price level lines

### Drawing Overlays (17)

`arrow`, `circle`, `rect`, `triangle`, `parallelogram`, `fibonacciCircle`, `fibonacciSegment`, `fibonacciSpiral`, `fibonacciSpeedResistanceFan`, `fibonacciExtension`, `gannBox`, `threeWaves`, `fiveWaves`, `eightWaves`, `anyWaves`, `abcd`, `xabcd`

### Extensions

- `orderLine` — Horizontal price level overlay with full styling customization
- `registerExtensions` — Bulk overlay registration utility

### Utilities

- `createDataLoader` — Data loader factory for `<KLineChart>`
