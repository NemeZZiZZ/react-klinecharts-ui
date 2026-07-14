# Changelog

All notable changes to **react-klinecharts-ui** are documented in this file.

---

## 2.0.2 — 2026-07-14

Patch release with a bug fix for the multi-symbol comparison overlay. No new
features; no public API changes (the hook's exported types and method signatures
are unchanged). Backwards compatible.

### Fixed

- **Comparison overlay no longer collapses the chart.** `useCompare` drew each
  compared symbol as a line of **raw percentages** (`{ pct }`, e.g. ±5) stacked
  on the candle pane, whose Y-axis is in price units (e.g. ~60000). klinecharts
  v10 folds indicator figure values into the pane's auto Y-axis range
  (`YAxisImp.createRangeImp`), so a small-range series blended with the candle
  price range and flattened the candles. The indicator now projects each
  compare close onto the **main symbol's price scale** relative to a shared
  anchor bar (the first candle where both symbols have a quote):

  ```
  value = mainBase * (compareClose / compareBase)
  ```

  The drawn `value` lives in the main price domain and shares the candle Y-axis,
  so the line overlays the candles without rescaling them. The **real**
  percentage change is no longer drawn — it is surfaced in the indicator tooltip
  via a new `createTooltipDataSource` (e.g. `ETHUSDT %: +10.00%`). The indicator
  template now declares `series: "price"` so klinecharts syncs its precision to
  the main symbol's `pricePrecision`, matching the built-in `MA` / `AVP`
  indicators. Placement on the candle pane (`paneId: "candle_pane"`,
  `isStack: true`) was already correct and is unchanged.

## 2.0.1 — 2026-07-14

Patch release with bug fixes. No new features; no runtime breakage for consumers
using the library's UI helpers (`compareRules` / `setCompareRule(cr.key)`).

### Fixed

- **`CompareRule` value corrected from `"prev_close"` to `"previous_close"`.**
  klinecharts 10.0.0 defines `CandleColorCompareRule = "current_open" | "previous_close"`,
  so the previous `"prev_close"` literal was an invalid enum value that klinecharts
  silently ignored — selecting the "previous close" comparison rule did nothing. This
  was surfaced by a CI lint failure (`prefer-const`) that blocked the initial 2.0.0
  deploy. Consumers using `compareRules` / `setCompareRule(cr.key)` are unaffected;
  if you held the literal `"prev_close"` in your code, update it to `"previous_close"`
  (it never worked at runtime anyway).

- **Stale `datafeed` / `onSettingsChange` in the dispatch context.** The context
  value memoized these through refs that were never re-read, so when a consumer
  swapped the `datafeed` prop at runtime (e.g. switching to an authenticated feed
  after login), `useCompare`, `useSymbolSearch`, `useWatchlist`, `ChartCanvas`, and
  `useKlinechartsUISettings`'s `onSettingsChange` kept operating on the original
  value. Both props are now included in the memo dependency array. Note: if you
  pass an inline `datafeed` object or arrow-function `onSettingsChange` on every
  render, wrap them in `useMemo` / `useCallback` to avoid re-rendering context
  consumers each render.

- **CI: `prefer-const` lint error** in `useChartAxes.test.ts` (`let all` → `const all`).

## 2.0.0 — 2026-07-11

This is a **breaking release**: it targets the klinecharts `10.0.0` stable release and `react-klinecharts@1.0.0`. Because `react-klinecharts-ui` exposes the underlying klinecharts `Chart` instance on its store (`state.chart`) and many consumers call klinecharts instance methods directly, the upstream v10 API changes are breaking for this library's public surface too. See the **Migration Guide** below.

### Migration Guide (1.x → 2.0.0)

1. **Update peer dependencies.** Bump `klinecharts` to `>=10.0.0` and `react-klinecharts` to `>=1.0.0` in your app:

   ```sh
   npm install klinecharts@^10.0.0 react-klinecharts@^1.0.0
   ```

2. **`createIndicator` signature changed** (klinecharts 10.0.0). The 2nd-argument options object `{ isStack, pane, yAxis }` was removed; the 2nd argument is now a plain `isStack: boolean`, and `paneId` / `yAxisId` are properties of the `IndicatorCreate` value itself. If you call `state.chart?.createIndicator(...)` directly, migrate:

   ```diff
   -chart.createIndicator(
   -  { name, id: `main_${name}` },
   -  { isStack: true, pane: { id: "candle_pane" }, yAxis },
   -);
   +chart.createIndicator(
   +  { name, id: `main_${name}`, paneId: "candle_pane", yAxisId: yAxis?.id },
   +  true,
   +);
   ```

3. **`createIndicator` now returns the indicator id, not the pane id.** If you relied on the return value to address a pane, read the pane id back via the canonical v10 pattern: `chart.getIndicators({ id })[0].paneId`. The library's own hooks (`useIndicators`, …) already do this internally, so this only affects code that calls `createIndicator` directly.

4. **Removed v9 imperative data API.** `applyNewData`, `updateData`, `setPriceVolumePrecision`, and the v9 `subscribeAction('onTooltipIconClick', …)` event no longer exist on the klinecharts `Chart`. Data flows through the `DataLoader` (`setDataLoader` / the `data` or `dataLoader` prop on `<KLineChart>`); precision is set via `chart.setSymbol({ pricePrecision, volumePrecision })`. The library's hooks handle this for you — only direct `state.chart` consumers are affected.

5. **Replay was rewritten** (`useReplay`). It now drives the chart through a replay-aware intercept inside `createDataLoader` + `chart.resetData()`. The hook's public return type is unchanged, so UI code using `useReplay()` needs no changes — but if you have custom code that manipulated replay data directly via `updateData`/`clearData`, it must be removed (those methods are gone).

### Breaking

- **Upgraded to the klinecharts `10.0.0` stable release** (`peerDependencies.klinecharts` is now `>=10.0.0`, up from `>=10.0.0-beta3`) and **`react-klinecharts@1.0.0`** (up from `0.3.0`). The `klinecharts` 10.0.0 stable release changed the `createIndicator` instance API and removed the imperative data API the replay hook relied on; the codebase was migrated accordingly.

- **`createIndicator` now uses the v10 `(value, isStack)` signature.** klinecharts 10.0.0 removed the 2nd-argument `CreateIndicatorOptions` object — `paneId` and `yAxisId` are now properties of the `IndicatorCreate` value, and the 2nd argument is a plain `isStack: boolean`. Every internal call site (`ChartCanvas`, `useIndicators`, `useScriptEditor`, `useLayoutManager`, `useCompare`, `useUndoRedo`, and the `examples/ChartView`) was migrated. `createIndicator` returns the **indicator id** in v10; code that previously treated the return value as a pane id now reads the pane id back via `chart.getIndicators({ id })[0].paneId` (the canonical v10 pattern).

- **`useReplay` was rewritten onto the v10 DataLoader data model.** The hook previously called the v9-era `updateData` / `clearData` instance methods (via `as any?.()`), which **do not exist in klinecharts v10** — replay silently rendered nothing. Replay now drives the chart through a replay-aware DataLoader intercept inside `createDataLoader`: when active, `getBars` serves the saved buffer truncated to `[0, replayIndexRef.current)` and `subscribeBar`/`unsubscribeBar` become no-ops, so `chart.resetData()` re-renders the chart with exactly the replayed prefix. The intercept is scoped to the loader path only — direct `datafeed` consumers (`useCompare`, `useSymbolSearch`) are unaffected. A new `replayActiveRef` (exported on the dispatch context) lets the hook flip the intercept's mode synchronously in `startReplay` / `stopReplay`, before the state-sync effect runs.

- The `MockChart` test double dropped the obsolete `clearData` / `updateData` / `applyNewData` / `setPriceVolumePrecision` / `scrollToPosition` stubs (none of them exist on the v10 `Chart`). It gained `resetData`, `createYAxis` / `removeYAxis` / `getYAxes`, and a realistic `createIndicator` / `getIndicators` bookkeeping implementation so indicator-id → pane-id resolution can be exercised in tests.

### Added

- **Multi-YAxis management API on `useChartAxes`.** klinecharts 10.0.0 introduced explicit multi-YAxis support (`createYAxis` / `removeYAxis` / `getYAxes` on the `Chart` instance). `useChartAxes` now exposes thin, headless wrappers around them — `createYAxis(override)` (returns the axis id, idempotent per `id`), `removeYAxis(filter)`, and `getYAxes(filter?)` — alongside the existing `overrideXAxis` / `overrideYAxis`. The new types `YAxisFilter` and `YAxis` are re-exported from the package entry.

### Changed

- `KlinechartsUIDispatchValue` gained a `replayActiveRef: RefObject<boolean>` field so `useReplay` can toggle the replay-aware DataLoader intercept synchronously. Consumers that destructure the full dispatch value are unaffected (it is purely additive).

- `createIndicator` in the test mock now allocates a per-call pane id (when none is requested) and stores the indicator record, so `getIndicators({ id })[0].paneId` resolves the same way the real v10 chart does — the previous stub returned a hard-coded pane id and ignored the value.

- `createDataLoader` gained an optional 3rd argument `replay?: ReplayDataLoaderContext` that wires the replay-aware intercept (`{ active, savedData, index }` refs). `ChartCanvas`, `examples/ChartView`, and `docs/demos/ChartView` pass the provider's replay refs; callers that omit it get the previous (non-replay) behaviour.

### Documentation

- README and docs updated to reference the klinecharts **10.0.0** stable release (previously `10.0.0-beta3`) and `react-klinecharts@1.0.0`.

---

## 1.2.0 — 2026-07-10

### New Features

- **Per-drawing API in `useDrawingTools` + reactive overlays.** `useDrawingTools` now exposes per-drawing management — create, select, remove, and configure individual drawings by id — and overlay state is reactive so UI mirrors chart-side changes. (See commit `b562b43`.)

---

## 1.1.0 — 2026-07-08

### New Features

- **Optional `ChartCanvas` renderer wrapper (`react-klinecharts-ui/chart`).** A thin component that wires the `<KLineChart>` renderer from `react-klinecharts` to the provider for you — building the data loader, forwarding `symbol` / `period` / `locale` / `timezone` / `theme` from provider state, bootstrapping the default indicators, and dispatching `SET_CHART` on ready. This removes the ~30-line `onReady → dispatch SET_CHART + createDataLoader` boilerplate that every consumer previously had to copy from `examples/ChartView.tsx`.

  - New entry point: `import { ChartCanvas } from "react-klinecharts-ui/chart"`.
  - `react-klinecharts` is now declared as an **optional** peer dependency (`peerDependenciesMeta.react-klinecharts.optional = true`). It is only required when importing the `./chart` entry; the core library and the `./extensions` entry remain renderer-agnostic and do not pull it in. Install it explicitly when you use `ChartCanvas`: `npm install react-klinecharts-ui klinecharts react-klinecharts`.
  - `tsup.config.ts` `external` array now includes `react-klinecharts` so it is never bundled.
  - The library remains fully headless: `ChartCanvas` is opt-in convenience, not a requirement. The three ways to put a `Chart` into the store (`ChartCanvas`, `<KLineChart>` + manual `onReady` bridge, or direct `klinecharts.init()`) are all documented in the README "Renderer-agnostic" section.

- **Pluggable storage adapter (`storage` provider option).** User-facing state in the reducer store — price alerts, chart settings (`useKlinechartsUISettings`), and the active indicator set (main/sub lists, pane ids, axis bindings, visibility) — is now hydratable on mount and auto-persisted on change through a pluggable adapter. Before this, all of it lived only in memory and was lost on every page reload.

  - New provider option `storage?: StorageOptions`. Omit it entirely to disable persistence (the default). `storage={{}}` enables defaults: the `localStorage` adapter, the `alerts` / `settings` / `indicators` namespaces, and a `"rkui:"` key prefix.
  - The adapter mirrors the **Web Storage API** (`getItem` / `setItem` / `removeItem`), so `localStorage`, `sessionStorage`, or a custom wrapper can be passed directly. New public exports: `StorageAdapter`, `StorageNamespace`, `StorageOptions`, `ResolvedStorage`, `createDefaultStorage`, `resolveStorage`, plus the `DEFAULT_STORAGE_NAMESPACES` / `DEFAULT_STORAGE_KEY_PREFIX` constants.
  - Override the adapter to plug in IndexedDB or a remote backend (keep a synchronous cache and flush in the background — the contract is sync). Override `keyPrefix` / `namespaces` for fine-grained control.
  - **SSR-safe**: the default adapter is a no-op when `localStorage` is undefined; hydrate reads are guarded and never crash server rendering. **Backward compatible**: with no `storage` prop the provider behaves exactly like 1.0.0. Adapter failures (quota / serialization) are swallowed so a failing backend never breaks the chart; corrupt stored JSON falls back to defaults.

- **Indicator-value alerts.** `addAlert` now accepts an optional 5th argument `target?: AlertTarget`. With `{ type: "indicator", indicatorId, figureKey }` the alert watches a specific indicator figure series (e.g. RSI crossing 70, MACD signal crossover) instead of the main symbol's price. The provider poller reads `chart.getIndicators()` for indicator targets and `getDataList()` for price targets, tracking a per-alert value baseline so the first observation never fires a spurious crossing. Default (`type: "price"`, or omitting `target`) is unchanged — existing alerts and serialized state stay compatible. New public type export: `AlertTarget`.

- **Multi-listener `onAlertTriggered`.** Previously the firing callback was a single ref (last writer wins), so a second component registering a listener silently disabled the first. `onAlertTriggered` now adds to a listener `Set`, invokes **every** registered callback on each firing, and returns an unsubscribe function — so a toolbar, a status bar, and a sound trigger can all observe crossings simultaneously.

- **Workspace & multi-chart foundation.** New `WorkspaceProvider` + `useWorkspace` + `useChartSync` exports let you render a grid of `<KlinechartsUIProvider>` trees whose charts mirror crosshair / scroll / zoom (and keep the workspace's notion of each cell's symbol / period in sync). Previously the library assumed a single chart per provider, so grid layouts, linked charts, and synced viewports required ad-hoc consumer code (the `examples/multi-chart` page shipped a local version of this; it is now a published primitive).

  - **`<WorkspaceProvider defaultCells={...} sync={...}>`** holds the layout state (`WorkspaceState`: cells + active cell id), a chart-instance registry, a re-entrancy broadcast guard, and the resolved per-channel sync config.
  - **`useChartSync({ cellId })`** is the bridge hook — call it inside each `KlinechartsUIProvider` (via a `<ChartSyncBridge cellId={...} />` component). It registers that provider's chart with the workspace and subscribes to `onCrosshairChange` / `onScroll` / `onZoom`, mirroring to siblings.
  - Mirroring uses only the **public** klinecharts API (`executeAction`, `scrollToTimestamp`, `setBarSpace`) — no internal `_chartStore`, so it survives klinecharts version upgrades. A `broadcastingRef` guard prevents feedback loops. Per-channel enable/disable via the `sync` prop (e.g. `{ scroll: false }`); defaults to every channel on.
  - New public exports: `WorkspaceProvider`, `WorkspaceProviderProps`, `useWorkspace`, `useChartSync`, `UseChartSyncOptions`, `ChartCell`, `WorkspaceState`, `WorkspaceAction`, `WorkspaceContextValue`, `SyncChannel`, `SyncConfig`, `DEFAULT_SYNC_CONFIG`.

  This is the **first of three planned workspace stages**. Stage 1 (this release) covers layout state + viewport/crosshair mirroring. Stage 2 will hoist shared alerts/replay/drawings to the workspace; stage 3 will add tabbed layouts and server-side persistence. Each `KlinechartsUIProvider` still owns its own alert poller and replay timer — correct for independent cells, to be revisited when shared state lands.

### Documentation

- README and docs now explicitly explain that the library is **renderer-agnostic**: the only bridge between a renderer and the provider is `dispatch({ type: "SET_CHART", chart })`. The README "Installation" section, a new "Renderer-agnostic" subsection, `installation.mdx` (peer-dependency table marks `react-klinecharts` as optional), `quick-start.mdx` (adds the `ChartCanvas` shortcut and a renderer-agnostic callout), `concept.md`, `state-actions.md`, and the landing page were all updated.
- README: new **"Persistence"** section (after "Renderer-agnostic") covering scope, defaults, custom adapters, the sync-contract caveat, and the boundary vs `useLayoutManager`. `docs/guides/persisting-preferences.md` rewritten as a three-layer guide.
- `docs/hooks/use-alerts.mdx` updated: removed the "single listener / last registration wins" note; documented the indicator-target overload with an RSI example; the API table reflects the new `onAlertTriggered` signature (`() => () => void`).
- README: new **"Workspace & multi-chart"** section with a runnable 2×2 grid example and an explicit scope note.

### Internal / API

- `KlinechartsUIDispatchValue` gained a `storage: ResolvedStorage | null` field so hooks (and tests) read/write through the same adapter the provider resolved. `useKlinechartsUISettings` now hydrates from and writes back to the `"settings"` namespace when configured.
- `KlinechartsUIDispatchValue.alertTriggeredListenerRef` (single) → `alertTriggeredListenersRef` (`Set`). The public hook surface changed only additively (the new `target` arg is optional, `onAlertTriggered`'s new return value is backward-compatible for callers that ignore it).
- New tests (+31): `src/storage/index.test.ts` (adapter round-trip, resolveStorage), `src/provider/storage.test.tsx` (hydrate/write-back/namespace-filter/failure-resilience), `src/hooks/useAlerts.test.ts` (multi-listener, indicator-target, backward-compat), `src/chart/ChartCanvas.test.tsx` (render, prop forwarding, SET_CHART bridge, indicator bootstrap), `src/workspace/index.test.tsx` (provider init, sync-config merge, registry, broadcast guard). Total suite: 165 tests.

---

## 1.0.0 — 2026-07-07

### Breaking Changes

- **Peer dependency switched from `react-klinecharts` to `klinecharts`.** The library never used any React export of `react-klinecharts` (the `KLineChart` component, `useIndicator` / `useOverlay` hooks, `Widget`, `KLineChartContext`, etc.) — every type and function it consumed (`OverlayTemplate`, `IndicatorTemplate`, `Chart`, `registerOverlay`, `registerIndicator`, `registerFigure`, `utils`, `registerHotkey`, `getHotkey`, `getSupportedHotkeys`, and the supporting types) originates in `klinecharts` and only reached the code through `react-klinecharts`'s blanket `export * from "klinecharts"`. All imports now come directly from `klinecharts`, so `react-klinecharts` is no longer required to use this library.

  - `peerDependencies`: `react-klinecharts >= 0.3.0` → `klinecharts >= 10.0.0-beta3`. `react-klinecharts` is removed from both `peerDependencies` and `devDependencies`.
  - **Migration for consumers:** install `klinecharts` directly. Drop `react-klinecharts` unless you render the chart with its `<KLineChart>` component (which this library does not — it is headless). A typical install becomes `npm install react-klinecharts-ui klinecharts`.
  - The library's public API (exported hooks, types, overlays, indicators, extensions, utils) is **unchanged** — no symbol was added, removed, or renamed. This is purely a dependency-graph correction that makes the package's actual dependency explicit.

### Internal / API

- `tsup.config.ts` `external` array: `"react-klinecharts"` → `"klinecharts"`. This keeps `klinecharts` out of the published bundle (treated as external, like `react` / `react-dom`) instead of inlining a duplicate copy into consumers' apps.
- All ~60 imports across `src/overlays/**`, `src/indicators/**`, `src/extensions/**`, `src/hooks/**`, `src/provider/**`, `src/utils/**` and `src/data/**` were repointed from `react-klinecharts` to `klinecharts`. Because `react-klinecharts` only re-exports these symbols, the change is type- and value-equivalent.
- `examples/` and `docs/` keep their `react-klinecharts` dependency because their demos render `<KLineChart>` / use `Widget` / `useKLineChart`; only their type-only imports (`Chart`, `KLineData`, `SymbolInfo`) were repointed to `klinecharts` for consistency.
- **Lint compliance with React 19.** All ref mutations that happened during render (`stateRef.current = state`, `callbacksRef`, the drawing-tool refs, `createOverlayForToolRef`) moved to commit-phase `useEffect`s — required by `eslint-plugin-react-hooks` v7's `react-hooks/refs` rule. `examples/OrderBookPanel` and `useLayoutManager`'s mount-effects that triggered cascading renders were replaced with lazy `useState` initializers / deferred microtasks.
- **`dispatchValue` is now referentially stable** even when the consumer passes inline `datafeed` / `onSettingsChange` props. Both are mirrored into refs (mirroring the existing `extraOverlaysRef` pattern), so inline object/function props no longer recreate the dispatch context and re-render every hook consumer on each provider render.
- **New internal reducer actions** `ADD_ALERT` / `REMOVE_ALERT` / `CLEAR_ALERTS` / `MARK_ALERT_TRIGGERED` (the full-replace `SET_ALERTS` is kept for preset restore). These compose instead of clobbering, fixing the alert lost-update race (see Bug Fixes).
- `eslint.config.js` `ignores` extended with `docs/.astro` (generated) and `examples/src/components/ui` (shadcn-generated) so lint no longer reports on files that should not be hand-edited.

### Bug Fixes

This release also resolves a broad set of correctness bugs uncovered in a full audit. Grouped by area:

**State synchronization & React correctness**

- **`useAlerts` lost-update race.** The hook mutators (`addAlert` / `removeAlert` / `clearAlerts`) dispatched `SET_ALERTS` with a list read from their `useCallback` closure, while the provider's crossing poller dispatched off `stateRef.current.alerts`. A trigger followed by a quick `addAlert` (before React re-rendered the hook) reverted the just-set `triggered: true` flag, so an alert could fire again. Now the poller dispatches the granular `MARK_ALERT_TRIGGERED { ids }` action and the mutators use `ADD_ALERT` / `REMOVE_ALERT` / `CLEAR_ALERTS`, which compose and never revert each other.
- **Alert poller baseline not reset on symbol/period change.** Because the `KLineChart` component is reused (not remounted) across symbol changes, the poller effect did not re-run and `alertPrevCloseRef` kept the old symbol's last close — producing spurious triggers or missed crossings right after a symbol switch. A separate effect now resets the baseline on `state.symbol` / `state.period` change.
- **`useReplay` corrupted chart data on symbol/period change mid-session.** The playback interval kept pushing the OLD symbol's saved bars onto the chart after the dataLoader reloaded the new symbol, silently mixing two symbols' candles. A session now auto-stops when the symbol or period changes.
- **`useReplay` double-`startReplay` truncated the saved dataset.** Calling `startReplay` while a session was already running overwrote the saved buffer with the partially-played (truncated) chart data, permanently losing the unplayed tail. Guarded with `if (isReplaying) return`.
- **`useLayoutManager` save/load was a no-op for indicators.** It called `chart.getIndicatorByPaneId()`, which is not part of the klinecharts public API — the optional-chain `?.()` silently returned `undefined`, so neither the save nor the load path ever ran. Migrated to the public `chart.getIndicators()` (flat `Indicator[]`) in both paths.
- **`useLayoutManager` load inverted `isStack` for main indicators.** After the `getIndicators()` fix above, main indicators were recreated with `isStack: false` on the candle pane, which replaced the candle series instead of overlaying it. Now matches `useIndicators` (`isStack: true` for main).
- **`useScriptEditor.hasActiveScript` was not reactive** — it read `activeNameRef.current` during render, so toggling a script on/off did not update the UI until an unrelated re-render. Backed by `useState` now.
- **`useAnnotations.clearAnnotations` performed side effects inside a `setState` updater** (calling `removeOverlay`), which double-runs under React 18/19 StrictMode. Side effects moved out of the updater.
- **`useFullscreen` swallowed an unhandled Promise rejection** from `requestFullscreen()` / `exitFullscreen()` (they reject on missing user gesture, cross-origin iframe, or browser denial). Added `.catch(() => {})`.

**Indicator math**

- **`ichimoku` Chikou Span had look-ahead bias.** It read `dataList[index + offset].close`, i.e. a FUTURE close, instead of the current close displaced into the past. Fixed to `dataList[index - offset].close`, matching TradingView's Chikou.
- **`rsiTv` RSI-MA was corrupted during warm-up.** The RSI moving average was computed over `null → 0` substitutions, pulling the MA toward zero for the first `rsiPeriod + maPeriod` bars. The SMA now runs only over valid RSI values and propagates `null` through warm-up, matching TradingView.
- **`vwap` / `pivotPoints` day boundary used the host's local timezone.** `toLocaleDateString()` resolved against the runtime timezone (browser or server), so the VWAP reset and pivot levels shifted with the machine's TZ. Replaced with a deterministic UTC day key (`toISOString().slice(0,10)`).

**Drawing overlays**

- **`measure` overlay drew a solid line instead of dashed.** The style `"dash"` is not a valid klinecharts `LineType` (only `"solid"` / `"dashed"`), so the measurement diagonal was always solid. Fixed to `"dashed"`.
- **`measure` overlay showed `NaN` / `Infinity` labels** when a point had no `value` or the start value was `0`. Added guards with a `0` fallback for the percentage.
- **`longPosition` / `shortPosition` stop price was unreachable.** `totalStep: 3` only collects 2 points interactively (entry + target), so the stop was always a hardcoded 40px offset and the R/R ratio was meaningless. Bumped to `totalStep: 4` so the user places the stop.
- **`orderLine` line style accepted `"dotted"`**, which klinecharts does not support (renders as solid). Removed from the `OrderLineLineStyle.style` type.
- **`depthOverlay` `maxQty || 1` replaced a legitimately-zero maxQty** with `1`, blowing out bar widths. Changed to `?? 1`.

**Lifecycle & leaks**

- **`useOrderLines` did not clean up its overlays on unmount**, leaving orphaned lines on the chart. Now tracks created ids in a `Set` and removes them on unmount.
- **`useCompare` / `useScriptEditor` leaked a new indicator template into klinecharts' global registry on every run** (there is no unregister API). Both now use a stable template name (per-ticker for compare, `_custom_script_active` for the script editor) so `registerIndicator` overwrites instead of accumulating. The compare name is additionally salted per hook instance (`useId()`) so two terminals comparing the same ticker on one page don't overwrite each other's `calc` closure.
- **`useCompare` line broke (`NaN`) as soon as bars streamed in** because `calc` closed over a one-time snapshot. Replaced with a `calc` that recomputes from the live `dataList`, carrying forward the last known % for bars with no compare-symbol quote yet.
- **`useUndoRedo` rapid double-undo applied the same action's side effects twice.** The keyboard handler read the top of the stack from a stale closure within one frame. Now reads the current top via ref-mirrored stacks.
- **`useLayoutManager` crashed under SSR** — the lazy `useState` initializer touched `localStorage` during render. Guarded with `typeof localStorage === "undefined"`.

**Documentation**

- README listed `TA.stoch` in the TA function table, but no such function exists. Removed the row.

### Dependencies & upstream notes

- Pinned and tested against **klinecharts `10.0.0-beta3`** (the exact version `react-klinecharts 0.3.0` depended on, so behaviour is identical to the previous release's effective resolution). `react-klinecharts 0.3.0` remains a dev dependency of the `examples` and `docs` workspace packages.
- Supersedes the stale 0.6.0 note that claimed the peer range "stays `>=0.2.0`" — the range had already drifted to `>=0.3.0` in `package.json` at that time.

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
