# react-klinecharts-ui — Example Application

A fully working trading terminal built with `react-klinecharts-ui` using live Binance data. The UI is implemented with [shadcn/ui](https://ui.shadcn.com/) and Tailwind CSS.

---

## File Structure

```
examples/src/
├── App.tsx                          # Root: provider + layout
├── datafeed.ts                      # Datafeed implementation via Binance API
├── hooks/
│   └── use-modal-state.ts           # Dialog state helper
└── components/
    ├── ChartView.tsx                # KLineChart init + dataLoader
    ├── Toolbar.tsx                  # Top toolbar: symbol, periods, actions
    ├── DrawingSidebar.tsx           # Vertical drawing tools sidebar
    ├── IndicatorDialog.tsx          # Indicator management dialog
    ├── SettingsDialog.tsx           # Chart appearance dialog
    ├── TimezoneDialog.tsx           # Timezone picker dialog
    ├── SymbolSearchDialog.tsx       # Symbol search dialog
    ├── ScreenshotDialog.tsx         # Screenshot preview/download dialog
    ├── OrderLineDialog.tsx          # Order line create/manage dialog
    ├── IndicatorPaneOverlays.tsx    # React overlay on each pane (indicator name controls)
    └── OrderLineOverlays.tsx        # React overlay on pane root (order line hover controls)
```

---

## App.tsx

Application entry point. Configures `KlinechartsUIProvider` and composes the layout.

```tsx
export default function App() {
  return (
    <KlinechartsUIProvider
      datafeed={binanceDatafeed}
      defaultSymbol={defaultSymbol}   // { ticker: 'BTCUSDT', pricePrecision: 2 }
      defaultTheme="dark"
      overlays={[orderLine]}           // Register the orderLine extension
      onStateChange={(action, nextState, prevState) => {
        console.log(action, nextState, prevState);
      }}
    >
      <TerminalLayout />
    </KlinechartsUIProvider>
  );
}
```

### TerminalLayout

Inner component that uses library hooks to synchronise the CSS theme and render the shell.

```tsx
function TerminalLayout() {
  const { containerRef } = useFullscreen();
  const { theme } = useKlinechartsUITheme();
  const { isLoading } = useKlinechartsUILoading();

  // Sync .dark with <html> for Radix UI portals (Dialog, Popover, Tooltip)
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <TooltipProvider delayDuration={0}>
      <div ref={containerRef} className="flex min-h-svh w-full bg-background">
        <DrawingSidebar />
        <div className="relative flex w-full flex-col">
          <header>
            <Toolbar />
          </header>
          <div className="flex-[1_0_0] grid relative">
            <ChartView className="absolute inset-0" />
            {isLoading && <LoadingSpinner />}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
```

**Why `theme` is synchronised with `<html>`:** Radix UI creates portals directly inside `document.body`. For dark-mode CSS variables to work in dialogs and tooltips, the `dark` class must be on `<html>`, not only on the chart container.

---

## datafeed.ts

`Datafeed` interface implementation using the public Binance REST API and WebSocket.

### Symbol list

A static list of 10 trading pairs:

```typescript
const SYMBOLS = [
  { ticker: 'BTCUSDT',  pricePrecision: 2, volumePrecision: 5 },
  { ticker: 'ETHUSDT',  pricePrecision: 2, volumePrecision: 4 },
  { ticker: 'SOLUSDT',  pricePrecision: 2, volumePrecision: 2 },
  { ticker: 'BNBUSDT',  pricePrecision: 2, volumePrecision: 3 },
  { ticker: 'XRPUSDT',  pricePrecision: 4, volumePrecision: 1 },
  { ticker: 'DOGEUSDT', pricePrecision: 5, volumePrecision: 0 },
  { ticker: 'ADAUSDT',  pricePrecision: 4, volumePrecision: 1 },
  { ticker: 'AVAXUSDT', pricePrecision: 2, volumePrecision: 2 },
  { ticker: 'DOTUSDT',  pricePrecision: 3, volumePrecision: 2 },
  { ticker: 'LINKUSDT', pricePrecision: 2, volumePrecision: 2 },
];
```

### searchSymbols

Synchronous in-memory filter (no network request):

```typescript
async searchSymbols(search: string) {
  return SYMBOLS.filter((s) => s.ticker.includes(search.toUpperCase()));
}
```

### getHistoryKLineData

Binance REST: `GET /api/v3/klines`:

```typescript
async getHistoryKLineData(symbol, period, _from, to) {
  const url = new URL('https://api.binance.com/api/v3/klines');
  url.searchParams.set('symbol', symbol.ticker);
  url.searchParams.set('interval', periodToInterval(period)); // "1m", "4h", "1d" ...
  url.searchParams.set('endTime', String(to));
  url.searchParams.set('limit', '1000');

  const data: unknown[][] = await fetch(url).then(r => r.json());
  return data.map((k) => ({
    timestamp: k[0],
    open:      parseFloat(k[1]),
    high:      parseFloat(k[2]),
    low:       parseFloat(k[3]),
    close:     parseFloat(k[4]),
    volume:    parseFloat(k[5]),
    turnover:  parseFloat(k[7]),  // quoteAssetVolume
  }));
}
```

### subscribe / unsubscribe

Binance WebSocket stream `{symbol}@kline_{interval}`:

```typescript
subscribe(symbol, period, callback) {
  ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`);
  ws.onmessage = (event) => {
    const { k } = JSON.parse(event.data);
    callback({ timestamp: k.t, open: k.o, high: k.h, low: k.l, close: k.c, volume: k.v, turnover: k.q });
  };
}

unsubscribe() { ws?.close(); ws = null; }
```

Only one active subscription is maintained — each `subscribe` call closes the previous WebSocket.

### periodToInterval

Maps `TerminalPeriod` to a Binance interval string:

| TerminalPeriod | interval |
|---|---|
| `{ span: 1, type: 'minute' }` | `"1m"` |
| `{ span: 4, type: 'hour' }` | `"4h"` |
| `{ span: 1, type: 'day' }` | `"1d"` |
| `{ span: 1, type: 'week' }` | `"1w"` |
| `{ span: 1, type: 'month' }` | `"1M"` |
| `{ span: 1, type: 'year' }` | `"1d"` (no yearly interval in Binance) |

---

## ChartView.tsx

The chart component. Creates the `dataLoader`, initialises indicators in `onReady`, and renders child overlays inside `<KLineChart>`.

```tsx
function ChartView({ className }) {
  const { state, dispatch, datafeed } = useKlinechartsUI();

  const dataLoader = useMemo(
    () => createDataLoader(datafeed, dispatch),
    [datafeed, dispatch]
  );

  // Refs let onReady read the latest indicators without re-creating the callback
  const mainIndicatorsRef = useRef(state.mainIndicators);
  const subIndicatorsRef  = useRef(state.subIndicators);
  useEffect(() => { mainIndicatorsRef.current = state.mainIndicators; }, [state.mainIndicators]);
  useEffect(() => { subIndicatorsRef.current = state.subIndicators; }, [state.subIndicators]);

  const handleReady = useCallback((chart: Chart) => {
    dispatch({ type: 'SET_CHART', chart });

    // Create main indicators on candle_pane
    mainIndicatorsRef.current.forEach((name) => {
      chart.createIndicator(
        { name, id: `main_${name}`, paneId: 'candle_pane' },
        true,
        { id: 'candle_pane' }
      );
    });

    // Create sub-indicators and capture their paneIds
    const subUpdates: Record<string, string> = {};
    Object.keys(subIndicatorsRef.current).forEach((name) => {
      const id = `sub_${name}`;
      chart.createIndicator({ name, id });
      const ind = chart.getIndicators({ id })[0];
      if (ind?.paneId) subUpdates[name] = ind.paneId;
    });
    if (Object.keys(subUpdates).length > 0) {
      dispatch({ type: 'SET_SUB_INDICATORS', indicators: { ...subIndicatorsRef.current, ...subUpdates } });
    }
  }, [dispatch]);

  return (
    <KLineChart
      className={className}
      dataLoader={dataLoader}
      symbol={state.symbol ?? undefined}
      period={state.period}
      locale={state.locale}
      timezone={state.timezone}
      styles={state.theme}           // "light" | "dark" — built-in klinecharts themes
      onReady={handleReady}
    >
      <IndicatorPaneOverlays />      {/* Indicator name overlays */}
      <OrderLineOverlays />          {/* Order line Y-axis overlays */}
    </KLineChart>
  );
}
```

Children rendered inside `<KLineChart>` get access to `KLineChartContext` (the `useKLineChart()` hook from `react-klinecharts`) and are only mounted after the chart is initialised.

---

## Toolbar.tsx

Horizontal toolbar in the header. Uses 6 hooks and opens 6 dialogs.

### Hooks used

```typescript
const { periods, activePeriod, setPeriod } = usePeriods();
const { theme, toggleTheme }               = useKlinechartsUITheme();
const { isFullscreen, toggle }             = useFullscreen();
const { capture }                          = useScreenshot();
const { activeSymbol }                     = useSymbolSearch();
```

### Toolbar items (left to right)

1. **Symbol button** — shows `activeSymbol.ticker` or "Select Symbol", opens `SymbolSearchDialog`
2. **Period buttons** — one button per timeframe; active period highlighted with `variant="secondary"`
3. **Indicators** — opens `IndicatorDialog`
4. **Timezone** — opens `TimezoneDialog`
5. **Order Lines** — opens `OrderLineDialog`
6. **Settings** — opens `SettingsDialog`
7. **Spacer** (`flex-1`)
8. **Screenshot** — calls `capture()` then opens `ScreenshotDialog`
9. **Theme toggle** — `Sun` / `Moon` depending on the theme
10. **Fullscreen toggle** — `Maximize` / `Minimize`

### Dialog state pattern

All dialogs are controlled by the `useModalState` helper:

```typescript
// hooks/use-modal-state.ts
function useModalState() {
  const [isOpen, setIsOpen] = useState(false);
  return {
    isOpen,
    open:       () => setIsOpen(true),
    close:      () => setIsOpen(false),
    setIsOpen,
  };
}
```

---

## DrawingSidebar.tsx

Narrow vertical sidebar (`w-10`) for drawing tools. Uses only `useDrawingTools`.

```typescript
const {
  categories, activeTool, magnetMode, isLocked, isVisible,
  selectTool, setMagnetMode, toggleLock, toggleVisibility, removeAllDrawings,
} = useDrawingTools();
```

### Sidebar structure

**Drawing tool categories** — each category is a `Popover` with a `Tooltip`:
- Category icon from `CATEGORY_ICONS`: Lines→`Slash`, Channels→`Route`, Shapes→`Hexagon`, Fibonacci→`Activity`, Waves→`Waves`
- Clicking a tool → `selectTool(name)` → `chart.createOverlay({ name, groupId: 'drawing_tools', ... })`
- Active category is highlighted via `variant="secondary"` (`hasActive` = any tool in the category is `activeTool`)
- Popover uses `w-auto min-w-48` width and `max-h-[70vh]` scroll area

**Global drawing controls** (below a separator):

| Button | Icon | Action |
|--------|------|--------|
| Magnet | `Magnet` | Cycles `normal → weak → strong → normal`. Visual strength: `bg-primary/15` (weak), `bg-primary/30` (strong) |
| Lock | `Lock`/`Unlock` | `toggleLock()` — lock/unlock all drawings |
| Visibility | `Eye`/`EyeOff` | `toggleVisibility()` — show/hide all drawings |
| Remove | `Trash2` | `removeAllDrawings()` — delete all drawings |

---

## IndicatorDialog.tsx

Indicator management dialog. Divided into three sections: active, available for main chart, available for sub-panes.

### Hooks

```typescript
const {
  mainIndicators, subIndicators,
  addMainIndicator, addSubIndicator,
  removeMainIndicator, removeSubIndicator,
  setIndicatorVisible, updateIndicatorParams,
  getIndicatorParams, activeSubIndicators,
} = useIndicators();
```

### Active/inactive split

```typescript
const activeMainList   = mainIndicators.filter((i) => i.isActive);
const activeSubList    = subIndicators.filter((i) => i.isActive);
const inactiveMainList = mainIndicators.filter((i) => !i.isActive);
const inactiveSubList  = subIndicators.filter((i) => !i.isActive);
```

### ActiveIndicatorRow

Row component for an active indicator with:
- Expand toggle (show/hide parameters) — only visible when `getIndicatorParams(name).length > 0`
- Visibility toggle (`Eye`/`EyeOff`) → `setIndicatorVisible(name, isMain, visible)`
- Settings icon (`Settings2`) → expands `IndicatorParamsEditor`
- Remove (`X`) → `removeMainIndicator` or `removeSubIndicator`
- `"main"` / `"sub"` badge on the right

### IndicatorParamsEditor

Inline parameter editor. Local `useState` initialised from `params.map(p => p.defaultValue)`. Changes are applied immediately via `onUpdate(name, paneId, values)` → `updateIndicatorParams`.

---

## SettingsDialog.tsx

Chart appearance dialog. Uses the full `useKlinechartsUISettings` interface.

### Sections

| Section | Content |
|---------|---------|
| **Candle Type** | 2×3 button grid: `candle_solid`, `candle_stroke`, `candle_up_stroke`, `candle_down_stroke`, `ohlc`, `area` |
| **Candle Colors** | `<input type="color">` for bullish and bearish candles |
| **Price Axis** | 3 buttons: Normal / Percentage / Log |
| **Display** | Switches: Grid, Crosshair, Time axis, Reverse coordinate |
| **Tooltips** | Switches: Candle OHLCV tooltip, Indicator tooltip |
| **Price Marks** | Switches: Last price, High price, Low price, Indicator last value |

The reset button (`RotateCcw`) in the header → `resetToDefaults()` → restores defaults and applies the theme via `chart.setStyles(state.theme)`.

---

## TimezoneDialog.tsx

Timezone picker with a searchable, scrollable list.

```typescript
const { timezones, activeTimezone, setTimezone } = useTimezone();
```

**Search:** local filter by `tz.key.toLowerCase().includes(query)`. The active timezone is highlighted. Selecting a timezone calls `setTimezone(tz.key)` → `chart.setTimezone(timezone)` + `dispatch(SET_TIMEZONE)`.

---

## SymbolSearchDialog.tsx

Trading instrument search dialog.

```typescript
const { query, results, isSearching, activeSymbol, setQuery, selectSymbol, clearResults } =
  useSymbolSearch();
```

**Behaviour:**
- Input → `setQuery` → debounced `datafeed.searchSymbols`
- Spinner (`Loader2`) while `isSearching === true`
- Empty `query` → "Type to search for symbols"
- `query` with no results → "No symbols found"
- Clicking a symbol → `selectSymbol(sym)` + `onOpenChange(false)`
- Closing the dialog → `clearResults()`

---

## ScreenshotDialog.tsx

Screenshot preview and download dialog.

```typescript
const { screenshotUrl, download, clear } = useScreenshot();
```

`capture()` is called externally (in Toolbar) before opening the dialog. Inside the dialog:
- Preview `<img src={screenshotUrl} />`
- "Download" button → `download('chart-screenshot.jpg')`
- Dialog close → `clear()`

---

## OrderLineDialog.tsx

Order line create and manage dialog. Reads order lines directly from the chart.

```typescript
const { state } = useKlinechartsUI();
const chart = state.chart;
const { createOrderLine, removeOrderLine } = useOrderLines();
```

### Data source

Lines are read from the chart via `useMemo`, recalculated when the dialog opens or after local mutations:

```typescript
const lines = useMemo(() => {
  if (!chart || !open) return [];
  void tick; // Force recalc after add/remove
  const overlays = chart.getOverlays({ name: "orderLine" }) ?? [];
  return overlays.map((overlay) => {
    const ext = (overlay.extendData ?? {}) as OrderLineExtendData;
    return {
      id: overlay.id,
      price: overlay.points[0]?.value ?? 0,
      color: ext.color ?? "rgba(255, 165, 0, 0.85)",
      text: ext.text ?? "",
      lineStyle: ext.line?.style ?? "dashed",
    };
  });
}, [chart, open, tick]);
```

### Create form

Local state: `price`, `color` (#f59e0b), `text`, `lineStyle` ("dashed").

```typescript
const handleAdd = () => {
  const id = createOrderLine({
    price: parseFloat(price),
    color,
    text: text.trim() || undefined,
    line: { style: lineStyle, width: 1 },
    draggable: true,
  });
  if (id) setTick((t) => t + 1); // Trigger list refresh
};
```

### Lines list

Each entry shows:
- A color swatch `background: line.color`
- Price (formatted via `toLocaleString()`)
- Optional label text
- Remove button → `removeOrderLine(id)` + increment tick

> **Note:** `OrderLineDialog` uses `useKlinechartsUI().state.chart` (not `useKLineChart()`) because it renders outside `<KLineChart>` — in the Toolbar as a Radix Dialog portal.

---

## IndicatorPaneOverlays.tsx

A reactive overlay that renders interactive controls on top of indicator names in the tooltip area of each pane. Uses `<Widget>` from `react-klinecharts` for portals into the klinecharts DOM.

### Architecture

```
KLineChart
  └── KLineChartContext (chart ref)
        ├── <Widget paneId="candle_pane" position="main">   ← portal into main layer
        │     └── PaneOverlay (indicators=activeMain)
        │           └── NameHoverZone × N
        └── <Widget paneId={subPaneId} position="main">     ← portal into sub-pane
              └── PaneOverlay (indicators=[indName])
                    └── NameHoverZone × 1
```

### Hooks used

```typescript
const { state } = useKlinechartsUI();
const { mainIndicators, subIndicators, activeSubIndicators, removeMainIndicator, removeSubIndicator,
        moveToMain, moveToSub, setIndicatorVisible, getIndicatorParams, updateIndicatorParams } = useIndicators();
const chart = useKLineChart();  // From react-klinecharts — direct Chart instance access
```

### Name positioning

`calcNamePositions` reads tooltip styles from `chart.getStyles()` and computes the Y-coordinate of each indicator name, mirroring klinecharts internal layout logic:

- **candle_pane:** `y = offsetTop + candleTooltipHeight + (rowIndex × rowHeight)`
- **sub-panes:** `y = offsetTop + (rowIndex × rowHeight)`
- Text width is measured via an offscreen `<canvas>` with the same font (reused through a singleton `getMeasureCtx`)

### NameHoverZone

A transparent hit-area of size `(width+4) × (fontSize+2)` placed over the indicator name:

- **No hover:** fully transparent, shows text only (with strikethrough if the indicator is hidden)
- **Hover:** background `overlayBg` + 4 buttons:
  - `Eye`/`EyeOff` → `setIndicatorVisible`
  - `Settings2` → opens `IndicatorSettingsDialog` (only if the indicator has parameters)
  - `PanelBottom`/`PanelTop` → `moveToSub` / `moveToMain`
  - `X` (red) → `removeMainIndicator` / `removeSubIndicator`

### IndicatorSettingsDialog

An inline settings dialog (an alternative to `IndicatorParamsEditor` from `IndicatorDialog`). Rendered at the root via a React portal (outside `<Widget>` — it is a regular shadcn `<Dialog>`).

### Forced re-renders

Positions are recomputed via `useMemo` when `indicators` or `layout` change. To stay in sync with asynchronous chart changes:
- `ResizeObserver` on `chart.getDom()` — window resize
- `MutationObserver` on `chart.getDom()` — DOM changes (new panes added/removed)
- `requestAnimationFrame` when `state.mainIndicators` / `state.subIndicators` change

---

## OrderLineOverlays.tsx

Reactive overlay for order line management. Shows a remove button when hovering over the price mark area. Uses `position="root"` to avoid Y-axis `overflow:hidden` clipping.

### Architecture

```
KLineChart
  └── <Widget paneId="candle_pane" position="root">  ← portal into pane root (spans main + yAxis)
        └── div × N (hover zone + delete button per order line)
```

### Data source

```typescript
const overlays = chart.getOverlays({ name: "orderLine" });
```

For each overlay the Y pixel position is computed via `chart.convertToPixel`. The hover zone width is `yAxisWidth + 20` (measured from `chart.getDom("candle_pane", "yAxis").clientWidth`).

### Hover & delete

A shared `hoveredId` state manages which line's button is visible:

- **No hover:** transparent hit-area positioned at `right: 0` over the Y-axis mark
- **Hover:** destructive `Button` with `X` icon appears at the left edge of the hover zone (to the left of the mark)

### Event subscriptions

Y-coordinates are refreshed on:
- `useChartEvent("onScroll", refresh)` — scroll
- `useChartEvent("onZoom", refresh)` — zoom
- `useChartEvent("onCrosshairChange", rafRefresh)` — mouse move (including drag), RAF-throttled
- `ResizeObserver` on `chart.getDom()` — window resize

### Creating an order line via double-click

```typescript
const handleDblClick = (e: MouseEvent) => {
  const rect = canvasEl.getBoundingClientRect();
  const result = chart.convertFromPixel(
    [{ x: 0, y: e.clientY - rect.top }],
    { paneId: "candle_pane" },
  );
  const price = Array.isArray(result) ? result[0]?.value : result?.value;
  if (price != null) {
    createOrderLine({ price, color: DEFAULT_COLOR, draggable: true });
  }
};
```

The listener is attached to `chart.getDom("candle_pane", "main")`.

---

## Component Interaction Diagram

```
App.tsx
  KlinechartsUIProvider (state, dispatch, datafeed)
  │
  TerminalLayout (TooltipProvider)
  ├── DrawingSidebar ──────── useDrawingTools
  └── Main area
      ├── Toolbar
      │   ├── usePeriods
      │   ├── useKlinechartsUITheme
      │   ├── useFullscreen
      │   ├── useScreenshot
      │   ├── useSymbolSearch
      │   ├── IndicatorDialog ─────── useIndicators
      │   ├── SettingsDialog ──────── useKlinechartsUISettings
      │   ├── TimezoneDialog ──────── useTimezone
      │   ├── SymbolSearchDialog ──── useSymbolSearch
      │   ├── ScreenshotDialog ────── useScreenshot
      │   └── OrderLineDialog ─────── useOrderLines + useKlinechartsUI
      │
      └── ChartView
          ├── createDataLoader(datafeed, dispatch)
          ├── <KLineChart onReady={→ SET_CHART}>
          │     ├── IndicatorPaneOverlays ── useIndicators + useKLineChart
          │     └── OrderLineOverlays ────── useOrderLines + useKLineChart
          └── (loads data via dataLoader)
```

---

## Key Patterns

### 1. Stable onReady via ref

`onReady` is called once. To read the latest indicators without re-creating the callback, refs are updated in `useEffect` (not during render, to satisfy React lint rules):

```typescript
const mainIndicatorsRef = useRef(state.mainIndicators);
useEffect(() => { mainIndicatorsRef.current = state.mainIndicators; }, [state.mainIndicators]);

const handleReady = useCallback((chart: Chart) => {
  // Reads from ref, not closure
  mainIndicatorsRef.current.forEach(...);
}, [dispatch]);  // Does not depend on state.mainIndicators
```

### 2. Dark class sync for UI frameworks

When using Radix UI, headlessui, or any library with portals into `body`:

```typescript
useEffect(() => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}, [theme]);
```

### 3. Widget instead of createPortal

`react-klinecharts` provides a declarative `<Widget>` for rendering into chart DOM layers:

```tsx
// Instead of: createPortal(<Component />, chart.getDom(paneId, "main"))
<Widget paneId={paneId} position="main">
  <Component />
</Widget>
```

### 4. RAF throttle for onCrosshairChange

`onCrosshairChange` is a high-frequency event (every mouse move). RAF throttling prevents excessive re-renders:

```typescript
const rafIdRef = useRef<number | null>(null);
const rafRefresh = useCallback(() => {
  if (rafIdRef.current !== null) return;
  rafIdRef.current = requestAnimationFrame(() => {
    rafIdRef.current = null;
    refresh();
  });
}, [refresh]);
useChartEvent('onCrosshairChange', rafRefresh);
```

### 5. Reading overlays from chart in dialogs

`OrderLineDialog` reads order lines directly from `chart.getOverlays({ name: "orderLine" })` via `useMemo`. A local `tick` counter forces recalculation after add/remove operations. This avoids maintaining a parallel local list and ensures all lines (including those created via double-click) are visible.
