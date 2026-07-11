# react-klinecharts-ui — Example Application

A collection of working examples built with `react-klinecharts-ui` using live Binance data. The UI is implemented with [shadcn/ui](https://ui.shadcn.com/) and Tailwind CSS.

`App.tsx` is a tiny hash-router that lazy-loads one page per example. The
**Trading Terminal** page is the flagship demo and wires up nearly every hook;
the other pages are focused, minimal demonstrations of a single capability.

---

## File Structure

```
examples/src/
├── App.tsx                          # Hash-router: lazy-loads example pages + index
├── main.tsx                         # React entry point
├── datafeed.ts                      # Datafeed implementation via Binance API
├── pages/
│   ├── quick-start/                 # Minimal provider + chart
│   ├── terminal/                    # Full trading terminal (flagship demo)
│   ├── multi-chart/                 # Two synced charts (crosshair + scroll)
│   ├── secondary-axis/              # Multiple y-axes / bindIndicatorToNewAxis
│   ├── depth/                       # Live order book / depth overlay
│   ├── indicator-builder/           # Custom indicator script editor
│   └── mobile/                      # Compact mobile layout
├── hooks/
│   ├── use-modal-state.ts           # Dialog open/close state helper
│   ├── use-sync-theme.ts            # Mirrors chart theme onto <html class="dark">
│   └── use-mobile.ts                # Viewport breakpoint helper
├── lib/
│   └── utils.ts                     # cn() class-name helper
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
    ├── LayoutManagerDialog.tsx      # Save/load/manage chart layouts dialog
    ├── ScriptEditorDialog.tsx       # Custom indicator script editor dialog
    ├── CompareDialog.tsx            # Compare/overlay a second symbol
    ├── ReplayControls.tsx           # Bar-replay playback controls
    ├── MeasureButton.tsx            # Measure tool toggle + result readout
    ├── AnnotationsButton.tsx        # Quick text annotations on the chart
    ├── AlertsButton.tsx             # Price-crossing alerts (useAlerts)
    ├── WatchlistPanel.tsx           # Symbol watchlist side panel
    ├── OrderBookPanel.tsx           # Live order book side panel
    ├── DepthOverlayToggle.tsx       # Depth overlay manager
    ├── StatusBar.tsx                # Bottom status bar (crosshair OHLC)
    ├── CrosshairDataPanel.tsx       # Floating crosshair OHLCV readout
    ├── ChartContextMenu.tsx         # Right-click context menu
    ├── KeyboardShortcuts.tsx        # Global keyboard shortcut handler
    ├── Watermark.tsx                # Symbol watermark behind the chart
    ├── OrderLineAlertSound.tsx      # Beeps when price crosses an order line
    ├── IndicatorPaneOverlays.tsx    # React overlay on each pane (indicator name controls)
    └── OrderLineOverlays.tsx        # React overlay on pane root (order line hover controls)
```

---

## App.tsx

A minimal hash-router. Each example is a lazily-imported page; the current
route is read from `window.location.hash`, and an index screen lists every
example with the features it demonstrates. No routing library is used.

```tsx
const TerminalExample = lazy(() => import("./pages/terminal"));
const QuickStartExample = lazy(() => import("./pages/quick-start"));
// …one lazy import per page

export default function App() {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const handler = () => setRoute(getRoute());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const example = EXAMPLES.find((e) => e.id === route);
  if (!example) return <IndexPage onNavigate={(id) => (location.hash = id)} />;

  const Component = example.component;
  return (
    <Suspense fallback={<Loader />}>
      <Component />
    </Suspense>
  );
}
```

The rest of this document focuses on the **Trading Terminal** page
(`pages/terminal`), which composes nearly every component below.

---

## pages/terminal

The flagship example. The page module wires the provider; `TerminalLayout`
composes the shell.

```tsx
export default function TerminalExample() {
  return (
    <KlinechartsUIProvider
      datafeed={binanceDatafeed}
      defaultSymbol={defaultSymbol}   // { ticker: 'BTCUSDT', pricePrecision: 2 }
      defaultTheme="dark"
      overlays={[orderLine, depthOverlay]}  // Register overlay extensions
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

Inner component that uses library hooks to render the shell and synchronise the
CSS theme via the `useSyncTheme` helper. The header hosts panel toggles, the
measure/annotation/alert tools, compare/replay controls and the main `Toolbar`.

```tsx
function TerminalLayout() {
  const { containerRef } = useFullscreen();
  const { theme } = useKlinechartsUITheme();
  const { isLoading } = useKlinechartsUILoading();
  const [showDrawingSidebar, setShowDrawingSidebar] = useState(true);

  useSyncTheme(theme); // mirrors theme onto <html class="dark">

  return (
    <TooltipProvider delayDuration={0}>
      <div ref={containerRef} className="flex flex-col h-svh bg-background">
        <header className="flex h-10 shrink-0 items-center border-b px-1">
          {/* panel toggles + MeasureButton + AnnotationsButton + AlertsButton */}
          {/* CompareDialog + ReplayControls + <Toolbar /> */}
        </header>

        <div className="flex-1 flex overflow-hidden">
          {showDrawingSidebar && <DrawingSidebar />}
          <ChartView className="…" />
        </div>

        <StatusBar />
        <KeyboardShortcuts />
        <OrderLineAlertSound />
      </div>
    </TooltipProvider>
  );
}
```

**Why `theme` is synchronised with `<html>`:** Radix UI creates portals directly inside `document.body`. For dark-mode CSS variables to work in dialogs and tooltips, the `dark` class must be on `<html>`, not only on the chart container. `useSyncTheme` (in `hooks/use-sync-theme.ts`) encapsulates this.

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

    // Create main indicators on candle_pane (klinecharts v10 signature)
    mainIndicatorsRef.current.forEach((name) => {
      chart.createIndicator(
        { name, id: `main_${name}`, paneId: 'candle_pane' },
        true
      );
    });

    // Create sub-indicators and capture their paneIds
    const subUpdates: Record<string, string> = {};
    Object.keys(subIndicatorsRef.current).forEach((name) => {
      const id = `sub_${name}`;
      chart.createIndicator({ name, id }, false);
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

Horizontal toolbar in the header. Uses 8 hooks and opens 8 dialogs.

### Hooks used

```typescript
const { periods, activePeriod, setPeriod } = usePeriods();
const { theme, toggleTheme }               = useKlinechartsUITheme();
const { isFullscreen, toggle }             = useFullscreen();
const { capture }                          = useScreenshot();
const { activeSymbol }                     = useSymbolSearch();
const { canUndo, canRedo, undo, redo }     = useUndoRedo();
```

### Toolbar items (left to right)

1. **Symbol button** — shows `activeSymbol.ticker` or "Select Symbol", opens `SymbolSearchDialog`
2. **Period selector** — responsive: `DropdownMenu` on screens < `xl`, row of `Button`s on `xl`+. Active period shown with `variant="secondary"` or `Check` icon in dropdown
3. **Indicators** — opens `IndicatorDialog`
4. **Timezone** — opens `TimezoneDialog` (hidden below `lg`)
5. **Order Lines** — opens `OrderLineDialog`
6. **Script** — opens `ScriptEditorDialog` (hidden below `lg`)
7. **Settings** — opens `SettingsDialog`
8. **Spacer** (`flex-1`)
9. **Undo / Redo** — `useUndoRedo` buttons, disabled when stack is empty (hidden below `lg`)
10. **Layouts** — opens `LayoutManagerDialog` (hidden below `lg`)
11. **Screenshot** — calls `capture()` then opens `ScreenshotDialog` (hidden below `lg`)
12. **Theme toggle** — `Sun` / `Moon` depending on the theme (hidden below `lg`)
13. **Fullscreen toggle** — `Maximize` / `Minimize` (hidden below `lg`)

### Responsive behaviour

- **< xl:** Period buttons collapse into a `DropdownMenu` with a `Clock` icon showing the active period label
- **< lg:** Text labels on Indicators/Timezone/Order Lines/Script buttons are hidden (icon-only). Undo/Redo, Layouts, Screenshot, Theme, and Fullscreen buttons are hidden entirely

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

Narrow vertical sidebar (`w-10`) for drawing tools. Toggled via the `Menu` button in `App.tsx`. Uses only `useDrawingTools`.

```typescript
const {
  categories, activeTool, magnetMode, isLocked, isVisible,
  selectTool, setMagnetMode, toggleLock, toggleVisibility, removeAllDrawings,
} = useDrawingTools();
```

### Sidebar structure

**Drawing tool categories** — each category renders differently based on tool count:
- **Single tool:** `Tooltip` + `Button` — clicking directly activates the tool (no popover)
- **Multiple tools:** `Popover` with `Tooltip` — opens a scrollable list of tools
- Category icons from `CATEGORY_ICONS`: Lines→`Slash`, Channels→`Route`, Shapes→`Hexagon`, Fibonacci→`Activity`, Waves→`Waves`, Measure→`Ruler`, Positions→`TrendingUp`, Annotation→`Paintbrush`
- Clicking a tool → `selectTool(name)` → `chart.createOverlay({ name, groupId: 'drawing_tools', ... })`
- Active category is highlighted via `variant="secondary"` (`hasActive` = any tool in the category is `activeTool`)

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

## AlertsButton.tsx

A self-contained Bell button + dialog demonstrating `useAlerts`. Lives in the
terminal header next to the measure/annotation tools.

```typescript
const { alerts, addAlert, removeAlert, clearAlerts, onAlertTriggered } =
  useAlerts();
```

### Creating alerts

The form prefills `price` with the latest close (read from
`state.chart.getDataList()`) when the dialog opens, picks one of three
conditions, and creates the alert. The hook draws a locked dashed horizontal
line on the chart for each alert.

```typescript
addAlert(parseFloat(price), condition, message.trim() || undefined);
// condition: "crossing_up" | "crossing_down" | "crossing"
```

### Reacting to triggers

The crossing poller lives in the provider; the component only registers a
listener. Here it plays a beep and raises a browser notification (after
requesting permission on first alert):

```typescript
useEffect(() => {
  onAlertTriggered((alert) => {
    playBeep();
    if (Notification.permission === "granted")
      new Notification("Price alert", { body: alert.message ?? "" });
  });
}, [onAlertTriggered]);
```

The Bell button shows a destructive badge with the count of not-yet-triggered
alerts; the list marks fired alerts with a `triggered` badge.

> **Difference from `OrderLineAlertSound`:** that component manually polls order
> line overlays for a beep-only effect, whereas `useAlerts` owns a shared alert
> list, the crossing poller, and the chart lines for you.

---

## LayoutManagerDialog.tsx

Save, load, rename, and delete named chart layouts. Uses `useLayoutManager`.

```typescript
const {
  layouts, saveLayout, loadLayout, deleteLayout,
  renameLayout, refreshLayouts, autoSaveEnabled, setAutoSaveEnabled,
} = useLayoutManager();
```

### Features

- **Save:** Name input + Save button. Calls `saveLayout(name)` which serializes current indicators, drawings, symbol, and period to `localStorage`
- **Layout list:** Each entry shows name, symbol, period, and timestamp. Actions: Load, Rename (inline edit), Delete
- **Auto-save toggle:** Switch to enable/disable 5-second debounced auto-save
- **Empty state:** "No saved layouts" message when the list is empty

### Storage

Layouts are stored in `localStorage` under keys `klinecharts_layout:{id}` with an index at `klinecharts_layout_index`.

---

## ScriptEditorDialog.tsx

Custom indicator editor with a dark-themed code editor. Uses `useScriptEditor`.

```typescript
const {
  code, setCode, scriptName, setScriptName,
  params, setParams, placement, setPlacement,
  error, status, isRunning, hasActiveScript,
  runScript, removeScript, resetCode, exportScript, importScript,
} = useScriptEditor();
```

### Dialog sections

1. **Header** — "Script Indicator Editor" title with JS badge
2. **Settings row** — Name input, Params input (comma-separated), Placement radio (Sub/Main), Remove button (when active)
3. **Code editor** — Dark-themed (`#0d1117`) textarea with line number gutter. Tab inserts 2 spaces, `Ctrl+Enter` runs the script
4. **Error/Status bar** — Red bar with error message, or green bar with success status
5. **Footer** — Import/Export buttons, Reset button, Run button. Keyboard hint: `Kbd` styled `Ctrl` + `Enter` to run

### Script sandbox

Scripts execute as `new Function("TA", "dataList", "params", code)` with dangerous globals (`fetch`, `XMLHttpRequest`, `WebSocket`, `Worker`, etc.) shadowed as `undefined`. The script must return an `Array` of objects — each key becomes a chart series with auto-assigned colors from a 6-color palette.

### Import/Export

- **Import:** Hidden `<input type="file">` accepting `.js`, `.ts`, `.txt`. Sets code and auto-fills script name from filename
- **Export:** Downloads current code as `{scriptName}.js` via `Blob` + `URL.createObjectURL`

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
  ├── [Toggle] DrawingSidebar ── useDrawingTools
  │     └── Categories: single-tool → direct click, multi-tool → Popover
  │
  ├── Header
  │   ├── Sidebar toggle button (Menu icon)
  │   └── Toolbar
  │       ├── usePeriods (dropdown < xl, buttons >= xl)
  │       ├── useKlinechartsUITheme
  │       ├── useFullscreen
  │       ├── useScreenshot
  │       ├── useSymbolSearch
  │       ├── useUndoRedo
  │       ├── IndicatorDialog ─────── useIndicators
  │       ├── SettingsDialog ──────── useKlinechartsUISettings
  │       ├── TimezoneDialog ──────── useTimezone
  │       ├── SymbolSearchDialog ──── useSymbolSearch
  │       ├── ScreenshotDialog ────── useScreenshot
  │       ├── OrderLineDialog ─────── useOrderLines + useKlinechartsUI
  │       ├── LayoutManagerDialog ─── useLayoutManager
  │       └── ScriptEditorDialog ──── useScriptEditor
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
