# Changelog

All notable changes to **react-klinecharts-ui** are documented in this file.

---

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
