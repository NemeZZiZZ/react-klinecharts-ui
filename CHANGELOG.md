# Changelog

All notable changes to **react-klinecharts-ui** are documented in this file.

---

## 2.2.0 — 2026-09-08

### Fixed

- **Crosshair sync is time-based, not pixel-based.** `useChartSync` forwarded
  the whole crosshair object to every sibling (`executeAction(
  "onCrosshairChange", data)`). klinecharts v10's `ChartImp.executeAction`
  calls `setCrosshair(data, { notExecuteAction: true })`, and `StoreImp.
  setCrosshair` recomputes `dataIndex` / `kLineData` / `timestamp` from `x` via
  `coordinateToDataIndex(x)` **on the receiving chart's own scale** — so the
  mirrored value was a pixel offset, and any sibling with a different scroll
  position, zoom, timeframe or symbol landed on a different bar (four charts,
  four dates under one crosshair). The source now converts its pixel to a
  timestamp with `convertFromPixel` and each target maps that timestamp back to
  its own pixel with `convertToPixel`, sending only `{ x, paneId }`. `y` is
  dropped on purpose: a foreign instrument's price means nothing on another
  scale, and klinecharts draws the horizontal line only when `y` is present.
  No echo loop — `executeAction` sets the crosshair with
  `notExecuteAction: true`.
- **Scroll sync sent a bar index where a timestamp was expected.**
  `getVisibleRange().realTo` is an (exclusive) BAR INDEX, not a timestamp, but
  it was passed straight to `scrollToTimestamp`. That method binary-searches
  the data list for the nearest `timestamp`, so small integers always resolved
  to the first bar and every sibling scrolled to the start of loaded history.
  The right-most visible bar's real timestamp is now resolved from the data
  list (clamped to the last bar when scrolled into the future) before
  broadcasting.
- The multi-chart example had the same two defects in its own sync hook
  (crosshair driven by the never-populated `event.dataIndex`, scroll driven by
  the private `_chartStore`); it now uses the same public, time-based path.

**Trap worth recording:** `onCrosshairChange` subscribers receive the RAW
crosshair — `{ x, y, paneId }` — because the store executes the action with the
argument it was given, not with its enriched internal `_crosshair`.
`Crosshair` declares `timestamp` / `dataIndex` / `kLineData`, so
`crosshair.timestamp` type-checks silently and is always `undefined` on the
mouse path.

- **`useCrosshair` always returned `null`** — same root cause. It read
  `event.kLineData` off the raw crosshair, which is never populated, so the
  bar panel never showed anything. It now resolves the bar itself:
  `convertFromPixel([{ x }], { paneId })` → `dataIndex` → `getDataList()[i]`
  (unclamped indices outside the loaded history map to `null`). A supplied
  `event.kLineData` still wins when present.
- **`useCrosshair` never cleared when the cursor left the chart.** klinecharts
  clears its crosshair on `mouseleave` via `setCrosshair()`, which leaves
  `_crosshair.paneId` undefined, and `setCrosshair` only emits
  `onCrosshairChange` when that pane id is a string — so no event arrives and
  the panel kept displaying the last bar indefinitely. The hook now listens for
  `mouseleave` on the chart root (when `getDom()` is available), which restores
  the documented "null when the cursor is off-chart" contract.

### Added

- `src/workspace/useChartSync.test.tsx` (+11): crosshair mirroring goes
  pixel → timestamp → pixel (and never forwards `y` or the source pixel),
  no-op when the pixel maps to no bar, `candle_pane` fallback when the sibling
  lacks the source pane, per-channel disable, scroll mirroring of the
  right-edge timestamp (with a regression guard against the bar index),
  future-scroll clamping, and zoom mirroring.
- `src/hooks/useCrosshair.test.tsx` (+8): the bar is resolved from the pixel
  (with correct `change` / `changePercent`), a supplied `event.kLineData` still
  wins, `null` when the pixel maps to no bar or to an index outside the loaded
  history, `null` when the crosshair has no `x`, the default `candle_pane`
  fallback, and clear-on-`mouseleave` plus listener teardown.

### Fixed

- **`useUndoRedo` shared its history across instances.** The undo/redo stacks
  were `useState` inside the hook, while the provider's recording slot and the
  hotkeys are single-slot (owned by the first mounted instance). Every other
  `useUndoRedo()` consumer therefore recorded nothing, permanently reported
  `canUndo === false`, and popped an empty stack on `undo()`. The stacks now
  live in a provider-owned store (`createUndoRedoStore`) that every instance
  reads with `useSyncExternalStore`, so all of them see — and undo — the same
  history. The Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z listener also moved to the
  provider: one window listener per chart instead of one per instance (N-1 of
  which bailed out immediately), still driving only the owning instance.
- **`ChartCanvas` dropped the persisted indicator state on bootstrap.** It
  re-created the saved main/sub indicators from `state.mainIndicators` /
  `state.subIndicators` only, ignoring `state.indicatorAxes` and
  `state.indicatorVisibility`. After a reload an indicator bound to a secondary
  Y-axis silently fell back to the pane default, and a hidden one came back
  visible while the provider (and every checkbox) still claimed it was hidden.
  Both maps are now applied through `IndicatorCreate` (`yAxisId`, `visible`).
- **`useLayoutManager.loadLayout` kept the SAVED pane id.** Sub-indicator panes
  are minted per chart instance, so the restored `subIndicators` map pointed at
  pane ids that no longer existed — breaking collapse, reorder, axis overrides
  and removal for every restored sub indicator. The id is now read back from
  `getIndicators({ id })` after creation (like `addSubIndicator`), and sub
  indicators are created without a `paneId` so klinecharts cannot resurrect a
  stale pane or merge two indicators into one.
- **Layout auto-save missed drawing-only edits.** The 5s debounce re-armed only
  when `mainIndicators` / `subIndicators` changed, so adding, moving or
  clearing drawings — which have no provider state and no klinecharts change
  event — never scheduled a save, while an untouched chart still got an
  "Auto-save" entry 5s after enabling. Auto-save is now a 5s sweep that
  serializes the chart and writes only when the persisted content actually
  differs from the last write.
- **`isSubIndicatorCollapsed` never re-rendered.** It read a `useRef` set, so a
  UI rendering a collapse/expand button from it showed the pre-click state
  forever, and the height saved before collapsing was lost whenever the hook
  remounted (expand fell back to 100px). Collapsed panes now live in provider
  state (`collapsedPanes: paneId → height before collapse`), cleared by
  `SET_CHART` since pane ids are per-instance.
- **`useKlinechartsUISettings` state was per-instance.** Two components calling
  the hook got independent copies, each writing the whole slice to the same
  storage key, so a change in one panel was invisible to (and eventually
  overwritten by) the other. Settings now live in a provider-owned store.
  Two related defects went with it: the "apply initial settings" effect was
  guarded by a one-shot ref, so a REPLACED chart instance never got the axis
  settings / `lastValueMark` re-applied — it is now keyed on the chart identity
  and applies every style-backed setting (`buildStyles`) — and the
  `onSettingsChange` callback was in the effect's dep array, so an inline
  consumer callback fired on every render (it is now read through a ref and
  fires on real changes only).
- **`setDrawingVisible` / `setDrawingLocked` could hit a foreign overlay.**
  Unlike `removeDrawing`, they called `overrideOverlay({ id, … })` without
  `groupId: "drawing_tools"`, so an id collision with an order/alert line
  toggled that one instead.
- **Annotations and order lines vanished on chart remount.** An annotation
  added before the chart was ready (or after a remount) existed only in state
  with no overlay, and order lines kept ids pointing at overlays the new chart
  instance did not have (so `updateOrderLine` silently no-oped). Both hooks now
  reconcile their tracked entries onto every new chart instance, mirroring the
  provider's alert-line reconciliation.
- **Alert / annotation ids could collide with hydrated ones.** The module
  counters (`alert_1`, `annotation_1`) restarted at 1 on every page load, so a
  fresh entry could reuse the id of one restored from storage — duplicate React
  keys and two overlays sharing an id. Ids now carry a per-load session tag.
- **`useCompare` assigned duplicate colors.** The palette index came from
  `symbols.length`, so after removing a symbol the next one reused a color
  still in use. It now picks the first palette color nobody uses yet.
- **Replay playback was O(n²) over a session.** Every step (timer tick,
  `stepForward`, `stepBackward`, `seekTo`) called `chart.resetData()` with the
  whole slice, so a 5 000-bar replay at 10 bars/s performed 5 000 reloads of an
  ever-growing array. Steps are now grouped: the interval advances
  `ceil(speed / 6)` bars per tick at a proportionally longer period, keeping the
  same wall-clock pace with at most 6 reloads per second
  (`MAX_RELOADS_PER_SECOND`, exported for tuning). Opt-in `useReplay({ maxBars })`
  additionally caps the buffered window for pathological histories.
- **The undo/redo stack survived a chart / symbol / period change.** Entries
  reference overlay ids that no longer exist after a reload, so `undo()` either
  did nothing or removed a same-id overlay of the new symbol. The provider now
  clears the history when the chart instance, symbol or period changes.
- **Redo of a drawing recreated it unlocked and visible.** Only `name` /
  `points` / `styles` were stored, so `lock`, `visible` and `mode` were lost on
  every undo → redo cycle. The payloads in `useDrawingTools` (draw end,
  remove-all snapshot) and the redo re-snapshot in `useUndoRedo` now carry all
  three.
- **Two `useDrawingTools` timers leaked.** The initial `queueMicrotask`
  snapshot still ran after unmount (setState on a dead hook), and the
  auto-retrigger `requestAnimationFrame` scheduled after a completed drawing
  was never cancelled — it survived unmount and a tool switch. Both are now
  cancelled on cleanup.
- **Alert crossings were missed inside a bar.** The poller sampled only the
  last bar's `close` once per second, so a wick that pierced the level and came
  back between two ticks never triggered. The baseline is now the previous
  (final) bar's close instead of the previous 1s sample, and the forming bar's
  `high`/`low` count as touching the level.
- **The layout list was re-read from storage on every mutation.** Saving,
  renaming, deleting or auto-saving re-read and `JSON.parse`d every stored
  layout to refresh the list. The list is now updated incrementally
  (`upsertLayout` / `removeLayoutFromList`) and only read in full on mount.
- **`useWatchlist` double-subscribed with two instances.** Items and the
  subscription map were hook-local, so two components using the hook each
  opened a datafeed subscription per ticker (two quotes per tick) and rendered
  divergent lists. Both now live in a provider-owned store with one
  subscription per ticker (`subscribeWatchlist` / `unsubscribeWatchlist`).
- **Watchlist quotes stuck to the old timeframe after a period switch.**
  Subscriptions captured the period at add-time and were never revisited, so
  the rows kept quoting the previous timeframe. The provider re-subscribes
  every ticker when `state.period` changes (compared by span/type value, so a
  mere object-identity churn does not churn subscriptions) and on a datafeed
  swap — unsubscribing from the feed the sub was opened on, not the new one.
- **`useAlerts.removeAlert` could delete a foreign overlay.** It called
  `removeOverlay({ id })` without the `price_alerts` group this hook assigns
  at creation — a bare `{ id }` drops the FIRST overlay with that id in ANY
  group, so an id clash with a drawing/order overlay removed that one instead
  (same defect class as the drawing-tools `groupId` fix).
- **`useAlerts.addAlert` accepted non-finite prices.** A `NaN`/`Infinity` alert
  can never cross anything (the poller comparisons stay false) and its overlay
  label rendered "NaN". The call is now ignored and returns `""`.
- **`useScreenshot` served a stale picture after a symbol/period change.** The
  captured data-URL depicts one concrete chart state, but the chart reloads in
  place without remounting, so the old screenshot survived indefinitely. The
  hook resets the URL when the chart instance, symbol or period changes (plus
  an identity guard in the `SET_SCREENSHOT_URL` reducer so the mount reset
  does not re-render the terminal for nothing).
- **`useScriptEditor` wrote a ref during render and leaked across chart swaps.**
  `activeNameRef.current = activeName` ran in the render body (impure under
  concurrent rendering), and the active id/name pointed at the discarded chart
  after a remount — `hasActiveScript` stayed true for a script that no longer
  existed, and `removeScript()` fired at the NEW chart with the OLD id. The
  binding (`chart`, `name`, `id`) is now one state object synced to a ref in an
  effect, and `hasActiveScript` additionally requires the bound chart to be the
  current one — no reset effect needed. `removeScript` is chart-independent
  (stable identity) and removes from the chart the script was created on.
- **`useMeasure` measured against a discarded chart.** `onDrawEnd` closed over
  `state.chart` from `startMeasure` time; when the chart swapped between the
  two clicks, the result was computed from the old instance's data. The
  callback now reads the chart through a ref.
- **`orderLine` / `alertLine` threw on an empty drag.** `performEventPressedMove`
  assigned `points[0].value` unconditionally — a drag event with no points (or
  no `performPoint.value`) raised a TypeError inside klinecharts' drag handling.
  Both now bail out on missing data.
- **`useCompare` ran a stale clear-all after unmount.** The symbol/period-change
  `queueMicrotask(() => clearAll())` was never cancelled, so it could wipe a
  list that no longer belonged to it. It now carries a cancellation flag
  (same discipline as the drawing-tools microtask fix).
- **`useSymbolSearch` queried a stale datafeed.** The debounced continuation
  closed over the `datafeed` prop from keystroke time; a feed swap inside the
  debounce window sent the search to the old feed. It now reads the feed
  through a ref (which also keeps `setQuery` identity stable across swaps).
- **TA math poisoned by one non-finite value.** `sma`/`ema`/`rma` folded every
  input into a running accumulator unconditionally, so a single `NaN` turned
  the rest of the series into `NaN` forever (EMA/RMA even seeded `NaN` when it
  sat in the head). All three now restart their window/seed on non-finite
  input and emit `null` until a fresh window accumulates; degenerate periods
  emit all-`null` instead of dividing by zero.
- **`TA.rsi` returned 100 on a flat market.** With no up AND no down movement
  the ratio is 0/0 (Pine yields na); the `down === 0` branch caught it and
  reported maximum bullishness. All-zero Wilder averages now yield `null`.
- **`TA.vwap` had no session reset.** It accumulated from bar 0 forever, unlike
  the `vwap` chart indicator (UTC-day reset) — a line dragged by yesterday's
  volume. It accepts an optional `timestamps` array plus a session key
  (`"utc-day"` by default, or a custom `(ts) => key` function); without
  timestamps the behavior is unchanged.
- **`stochastic` scanned every window from scratch (O(n·period)).** The
  lowest-low/highest-high double loop now runs through O(n) monotone deques
  (`src/indicators/window.ts`), verified value-identical against the naive
  loop.
- **`ichimoku` re-scanned windows up to 3× per bar.** Tenkan/kijun/spanB were
  recomputed inside the per-bar map (tenkan walked again for spanA's
  `prevTenkan`, etc.). Each window is now computed once up front with the
  shared deque helper; spanA/spanB read off the precomputed lines at
  `index - offset` with identical values.
- **`TA.stdev` / `TA.wma` / `TA.bollinger` are single-pass O(n).** `stdev` used
  Var = E[x²] − E[x]² over a running sum/sum-of-squares instead of re-scanning
  each window against a separately allocated SMA array; `wma` uses the sliding
  recurrence instead of re-summing `period` weighted terms per bar; `bollinger`
  derives mid and width from one shared window instead of calling `sma` AND
  `stdev` (which called `sma` again — three passes, two throwaway arrays).
  `cci` keeps its exact mean-absolute-deviation loop (no exact incremental
  form exists) but now documents it.

### Changed

- **Drawing-overlay polling moved to the provider.** Each `useDrawingTools`
  instance used to run its own 1s `getOverlays()` interval for the lifetime of
  the chart (klinecharts v10 has no overlay add/remove event, so polling cannot
  be removed outright). There is now ONE ref-counted interval: it runs only
  while at least one hook is subscribed and a chart exists, and the snapshot is
  published through a shared store, so every consumer re-renders only when the
  list actually changes (`drawingOverlaysEqual`).
- **The workspace mirror dispatched unchanged values on every mount.**
  `useChartSync` reported its symbol/period to the workspace unconditionally,
  and the workspace reducer always builds a new cells array — so each cell's
  mount re-rendered every workspace consumer for nothing. Both effects now
  compare by value (ticker/precisions, span/type) and skip the dispatch when
  the cell already agrees.
- **The layout list and auto-save moved to the provider.** `layouts`,
  `autoSaveEnabled` and the 5s sweep were hook-local, so two `useLayoutManager`
  instances each kept a private list (a save in one was invisible to the other)
  and each ran its own sweep. Both live in provider stores now; the pure
  storage helpers (`createLayoutBackend`, `serializeChartLayout`, …) moved to
  `src/provider/layouts.ts`.

### Added

- `src/provider/alertPoller.test.tsx` (+4): a crossing_up fires when the wick
  touched the level but the close came back below it (the regression), a
  crossing_down fires on a downward wick, and nothing fires when the level was
  never reached or the price merely stayed on the same side.
- `src/hooks/useReplay.test.ts` (+4): `maxBars` caps the buffered window, an
  uncapped session keeps every bar, and speed 10 advances two bars per 200ms
  tick with exactly ONE `resetData` call (grouping) while speed 1 stays at one
  bar per tick.
- `src/hooks/useLayoutManager.test.ts` (+2) and `useDrawingTools.test.tsx` (+1):
  two hook instances share one layouts list / overlays list, and
  `autoSaveEnabled` is shared.
- `useUndoRedo` tests (+2): the history is cleared on a symbol change, and a
  redo re-creates the drawing with its `lock` / `visible` / `mode`.
- `src/hooks/useWatchlist.test.tsx` (+6): two instances share one list and one
  subscription per ticker, no resubscribe on a duplicate add, ticks update both
  instances, one unsubscribe on remove, re-subscribe on the new timeframe after
  a period change (row survives), and shared `activeSymbol`.
- `src/hooks/useAlerts.test.ts` (+4): `NaN`/`Infinity`/`-Infinity` prices are
  ignored (`""`, no alert, no overlay) and `removeAlert` scopes the removal to
  `groupId: "price_alerts"`.
- `src/hooks/useScreenshot.test.ts` (+4), `useScriptEditor.test.ts` (+4),
  `useMeasure.test.ts` (+2): capture stores the URL; symbol change and chart
  swap clear it; run/swap/remove semantics of the script binding; measure
  result shape and measuring against the current chart after a swap.
- `src/hooks/useCompare.test.ts` (+1): `addSymbol`/`toggleSymbol` keep their
  identity across list changes. `src/hooks/useSymbolSearch.test.tsx` (+1): a
  pending debounced search queries the swapped-in feed.
- `src/workspace/useChartSync.test.tsx` (+2): mount dispatches nothing when the
  cell already agrees (cells array identity stable), and a real symbol change
  still propagates.
- `src/utils/TA.test.ts` (+14): NaN recovery for sma/ema/rma/wma/stdev,
  all-null degenerate periods, RSI `null` on a flat series, O(n) recurrence
  equivalence vs the naive loops (wma/stdev, several periods), bollinger
  consistency with sma/stdev, and VWAP session reset (default UTC-day, custom
  key, back-compatible cumulative mode).
- `src/indicators/window.test.ts` (+4): the deque min/max matches the naive
  loop on random/monotonic/constant series, degenerate periods, and warm-up
  behavior. `src/extensions/overlays/dragGuard.test.ts` (+6): the drag guards
  on `orderLine` / `alertLine`.

### Fixed

- **Watchlist re-subscription could leak one feed per extra ticker (round-4
  audit).** The provider effect that re-subscribes watchlist rows on a
  datafeed/period change assigned `watchlistFeedRef.current = datafeed` INSIDE
  the loop over subscriptions. With two or more tickers and a datafeed swap,
  the first ticker updated the ref and every subsequent ticker compared the new
  feed against itself (`sameFeed === true`) and returned early — it stayed
  subscribed on the OLD feed forever (leak) and received no quotes from the new
  one. When feed AND period changed together, those tickers also unsubscribed
  on the wrong feed. The opened feed is now captured once before the loop and
  the ref is assigned a single time after it.
- **Layouts dropped drawing `lock` / `visible` / `mode`.**
  `serializeChartLayout` persisted only name/points/styles/extendData, so a
  locked or hidden drawing reloaded from a layout came back unlocked and
  visible (undo/redo had the same fix in the previous round; layouts were
  missed). The three flags are now persisted and passed back to
  `createOverlay` on restore.
- **Alerts stopped re-materializing their overlays after the first chart.**
  The reconciliation effect ran only on `state.chart` changes with a
  mount-time list: an alert added while no chart existed, or after the chart
  was replaced, never got its `price_alerts` line. The effect now also depends
  on `state.alerts` and skips alerts whose overlay already exists.
- **A re-initialized indicator lost `visible: true`.** The canvas bootstrap
  override only forwarded `visible: false` from the persisted visibility map;
  an explicit `true` fell through to the template default (invisible templates
  stayed invisible after a reload). The override now forwards the stored value
  in both directions.
- **`updateOrderLine` / `updateAnnotation` were lost on a chart remount.** The
  updates mutated the live overlay but not the reconciliation source
  (`linesRef` / state), so a chart swap re-created the line with the OLD
  price/draggable and the annotation with the OLD text/color. Both updates now
  also land in the reconciliation source.
- **`brush` stored bar indices disguised as timestamps.** `extendData.points`
  (which `serializeChartLayout` persists into layouts) filled `timestamp` with
  `xAxis.convertFromPixel(x)` — the axis-level converter returns a DATA INDEX,
  so a saved freehand stroke shifted by one bar for every bar of prepended
  history and broke entirely when the index pointed past the data list. Strokes
  are now anchored with `convertTimestampToPixel` / `convertTimestampFromPixel`
  and carry real timestamps; indices found in previously saved layouts are
  repaired against the data list on load (values `< 1e8` are treated as legacy
  indices).
- **Identical ray points produced a NaN figure.** `ray` / `getRayLine`
  (`src/overlays/utils.ts`) computed a slope of 0/0 when both points were equal
  and emitted a coordinate of `NaN`. Both now return no figure.
- **Position overlays ignored `pricePrecision`.** `longPosition` /
  `shortPosition` rendered Target/Stop labels with `toFixed(2)`; they now use
  the chart symbol's `pricePrecision` (falling back to 2) and guard against a
  missing second point instead of a non-null assertion.
- **VWAP / pivot points built a `Date` per bar.** The session key used
  `new Date(ts).toISOString().slice(0, 10)` per bar per calc pass; it is now
  integer math (`Math.floor(ts / 86_400_000)`), matching `TA.vwap`.
- **A throwing `datafeed.subscribe` zombie-blocked the ticker.**
  `subscribeWatchlist` recorded the subscription BEFORE calling it; when the
  feed threw, the row was never added yet the duplicate guard rejected every
  retry. The entry is now rolled back on throw.
- **Docs (`docs/utilities/ta.md`).** The signature table still listed
  `TA.sma/ema/rma/wma/stdev` as `number[]` (they return `(number|null)[]`
  since the NaN-handling fix), and listed a `TA.stoch(...)` that does not
  exist (stochastic lives in `src/indicators/stochastic.ts`); both corrected.

### Added

- `TA.macd(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9)` and
  `TA.bollinger(data, period = 20, multiplier = 2)` now carry the defaults the
  documentation always promised — previously a doc-following caller got all-null
  results silently (`ema(undefined)` never seeds).
- `src/hooks/useWatchlist.test.tsx` (+2): a throwing `subscribe` does not
  zombie-block a retry, and a datafeed swap moves EVERY subscription to the new
  feed (the R1 regression test).
- `src/hooks/useOrderLines.test.ts` (+1) and `src/hooks/useAnnotations.test.ts`
  (+1): updates made while the chart is unavailable survive the remount.
- `src/hooks/useLayoutManager.test.ts` (+1): a layout round-trips drawing
  `lock` / `visible` / `mode`.
- `src/overlays/ray.test.ts` (+3): identical points yield no figure, distinct
  points produce a finite line, `getRayLine` guard.
- `src/utils/TA.test.ts` (+2): `macd()` and `bollinger()` defaults equal the
  explicit 12/26/9 and 20/2 calls.

---

## 2.1.0 — 2026-09-03

Integration-DX release prompted by third-party integration feedback: chart
container sizing gets a first-class API and documentation, the chart instance
is reachable via ref, `searchSymbols` is no longer a mandatory part of the
datafeed contract, and the `react-klinecharts` peer can no longer be silently
missing. Typecheck, lint, the full test suite, and the build pass.

### Added

- **`ChartCanvas` forwards a ref to the klinecharts `Chart` instance.** The
  chart was already reachable via `useKlinechartsUI().state.chart`, but as a
  `Chart | null` state field; now `<ChartCanvas ref={chartRef} />` works the
  same way as `<KLineChart ref={…} />` upstream — populated on ready, reset
  to `null` on unmount.
- **`ChartCanvas` accepts a `style` prop**, forwarded straight to the chart
  container `<div>` (same passthrough as `className`). The container has no
  default size, and the single most common integration failure is a height
  chain that collapses to 0 — `style={{ height: 500 }}` is now the one-liner
  fix documented up front.
- **Dev-only zero-height warning in `ChartCanvas`.** If the chart container
  still has zero height ~1.5s after mount (and is not deliberately hidden
  via `display: none` / `visibility: hidden`), a console warning explains
  the three ways to give the container a height and points at the README
  "Chart sizing" section. klinecharts resizes via a `ResizeObserver`, so
  late-sized containers (hidden tabs, dock panels) keep recovering on their
  own — the delay and the hidden-element guard keep the warning quiet for
  those legitimate cases. Stripped from production builds via
  `process.env.NODE_ENV`.
- **README "Chart sizing" section**: why the container div has no default
  size, the three ways to give it a height, the `height: 100%` /
  `min-height: 0` pitfalls in flex/grid/dock layouts, and a note that late
  sizing recovers automatically. The installation section now shows a single
  command including `react-klinecharts` and explains the headless split.

### Changed

- **`react-klinecharts` is now a required peer dependency** (the
  `peerDependenciesMeta.optional` marker is removed). The `./chart` entry
  statically imports it, and the optional marker let consumers install
  without it and only discover the break as a bundler error on first import
  of `react-klinecharts-ui/chart`. npm 7+ and pnpm auto-install required
  peers, so the common path now just works; consumers rendering via direct
  `klinecharts.init()` never import the `./chart` entry, so the extra
  installed package is unused (and tree-shaken) for them. The peer range
  (`react-klinecharts >=1.0.0`) is unchanged.
- **`Datafeed.searchSymbols` is optional.** It is consumed by exactly one
  call site (`useSymbolSearch`), and datafeeds without a symbol-search
  backend previously had to ship a stub. The hook now resolves to an empty
  result list when the method is absent. Existing datafeeds that implement
  it are unaffected. README, docs-site datafeed/quick-start/useSymbolSearch
  pages updated to mark the method optional.

---

## 2.0.4 — 2026-08-31

Patch release backing the klinecharts upstream patches (`10.0.1` → `10.0.3`),
a full-codebase audit with 19 bug fixes followed by a hardening pass (13
risk-class fixes and 8 optimizations) and a self-review of that pass (9
further fixes), plus one small overlay-behaviour improvement that opts into a
new upstream option. Typecheck, lint, the full test suite (215 tests), and
the build pass. Backwards compatible (additive type exports only; see
**Added**).

### Changed

- **klinecharts `^10.0.1` → `^10.0.3`** (dev dependency). Diffing the published
  `.d.ts` between `10.0.1` and `10.0.3` shows zero removed symbols and exactly
  one added field: `Overlay.fixedZLevel` (optional in `OverlayTemplate` /
  `OverlayCreate`); all symbols the library imports are preserved. No
  `react-klinecharts` bump is required — `1.0.1` depends on
  `klinecharts ^10.0.1`, which already resolves to `10.0.3`, so the dependency
  tree keeps a single klinecharts copy. The peer ranges
  (`klinecharts >=10.0.0`, `react-klinecharts >=1.0.0`) are unchanged.

- **`depthOverlay` now declares `fixedZLevel: true`.** klinecharts 10.0.3 added
  the `fixedZLevel` overlay option, which keeps an overlay at its configured
  `zLevel` while hovered instead of temporarily raising it above every other
  overlay. The depth overlay deliberately renders at `zLevel: -1` (behind the
  candle series); `fixedZLevel: true` makes that placement sticky, so hovering
  can no longer lift the liquidity bars over the candles. On klinecharts
  `< 10.0.3` the property is unknown to the runtime and ignored, so behaviour
  there is unchanged.

### Fixed

A full-codebase audit (provider, hooks, overlays, indicators, data pipeline)
landed 19 fixes, each as a separate commit:

- **`gannFan` overlay was impossible to draw.** `totalStep` counts points + 1,
  so `totalStep: 2` finished the drawing after a single click; with
  `p2 === p1` all nine ratio lines degenerated into one horizontal line.
  Now `totalStep: 3`.
- **`elliottWave` never collected its 6th point** (`totalStep: 6` → 5 points),
  leaving the `(5)` label branch unreachable. Now `totalStep: 7`, matching
  `fiveWaves`.
- **`parallelogram` vertex dragging was a silent no-op.** The perform handlers
  assigned to a nonexistent `point.price` field (klinecharts points carry
  `value`), which also leaked an undefined `price` key into persisted overlay
  JSON. They now assign `.value`.
- **Alert crossings could fire spuriously after a symbol/period change.** The
  reset effect cleared a ref that was never read; the poller's real per-alert
  baseline (`prevValueByAlert` Map) survived the change, so the new symbol's
  first close was compared against the old symbol's last one. The poller now
  reseeds on symbol/period change and the dead ref is removed.
- **Persisted alerts were never redrawn after a reload or chart remount.** The
  list hydrated into state and the poller kept working, but no `alertLine`
  overlays existed and `removeAlert` silently no-oped. The provider recreates
  the overlays whenever the chart instance appears.
- **`loadLayout` destroyed alert lines and order lines** — a bare
  `removeOverlay()` matches every overlay — and `saveLayout` serialized them
  as plain drawings, recreating them without id/groupId/lock (breaking the
  alert line↔state pairing and duplicating them on every save). Layouts now
  own only the `drawing_tools` group, restored drawings get the group id so
  `useDrawingTools` can manage them, and subsystem overlays
  (`alertLine`/`orderLine`/`depthOverlay`/`simpleAnnotation`) captured by
  pre-2.0.4 layouts are skipped on restore instead of resurrecting as ghost
  drawings.
- **`updateIndicatorParams` updated every same-named indicator** (e.g.
  `main_MA` and `sub_MA` simultaneously) because it overrode by name only. It
  now derives the canonical id from the pane.
- **Starting a replay leaked the live bar subscription.** The replay flag
  flips before `resetData()`, whose unsubscribe was swallowed by the loader's
  replay gate — live ticks streamed into the chart on top of the replayed
  prefix for the whole session, and a mid-replay symbol change leaked the old
  symbol's channel. `unsubscribeBar` now always reaches the datafeed.
- **A stale rejected data request could wipe the chart.** The data loader's
  catch path ignored the stale-generation guard: a late init rejection emptied
  the freshly loaded chart, and a late forward rejection permanently disabled
  forward pagination until the next `resetData`.
- **`useCompare.addSymbol` raced itself.** The duplicate guard was checked
  before the data fetch but written after it: a double-call registered two
  indicators, and a removal issued mid-flight was undone when the fetch
  resolved. A pending set now holds the slot for the whole flight.
- **Compare projections went stale on symbol/period change.** The base prices
  and timestamp map are baked into the registered `calc` closure, so the old
  anchor's scale was drawn over the new symbol (or the line silently became
  nulls). Comparisons are now cleared on the change; re-adding re-anchors.
- **Script-editor indicators collided across provider instances.** The
  template used one global registry name, so running a script on chart B
  recomputed chart A's indicator with B's code. The name is now salted per
  hook instance (same pattern as `useCompare`).
- **`resetToDefaults` desynced the indicator last-value toggle.**
  `setStyles(theme)` restored klinecharts' built-in `lastValueMark.show:
false` while the settings state kept `true`; the library default is now
  re-applied after the theme reset.
- **Symbol-search results resurrected after select/clear.** Only `setQuery`
  cancelled the pending debounce/fetch; `selectSymbol` and `clearResults` now
  share the same cancel helper.
- **Global Ctrl+Z / Ctrl+Y hijacked text inputs.** The undo/redo keydown
  handler `preventDefault`'d regardless of target, killing native text undo
  in the symbol search, layout rename and script editor. Inputs, textareas
  and contentEditable elements are now skipped.
- **Replay could not be restarted after finishing naturally** (`isReplaying`
  stayed `true`, and `startReplay` bailed on it). The double-start guard now
  only blocks while unplayed bars remain.
- **Redo of `overlays_removed` could wipe every overlay on the chart.** A
  failed restore (`createOverlay` returns null for an unregistered template)
  put an undefined id into the redo payload, and `removeOverlay({ id:
undefined })` matches all overlays. The redo payload now only contains
  successfully restored overlays, and redo skips entries without a string id.
- **Undoing an indicator removal restored it with library defaults.** The
  payload now snapshots `calcParams`/`styles`/`visible` before removal, and
  the re-add paths apply them (hidden state is mirrored into the visibility
  map).
- **Ichimoku Chikou span was shifted 2× offset away from TradingView.** The
  1.0.0 "look-ahead bias" fix read `close[i - offset]` (price line delayed,
  extending to the last bar); the canonical lagging span displays
  `close[i + offset]` at bar `i` and ends `offset` bars before the last bar —
  the displaced plot is the definition, and nothing unknown is shown at the
  right edge. The indicator and its test now assert TradingView parity.

### Added

- **`ReplayDataLoaderContext` is now exported** from the package root.
  `createDataLoader` was already public, but its options interface was not, so
  consumers building custom loaders could not type the replay refs. Purely
  additive.
- **New `layouts` storage namespace.** `useLayoutManager` now persists layouts
  through the provider storage adapter (see the layouts bullet under
  **Hardening**), which required a namespace declaration in the storage
  contract. Apps that don't configure `storage` keep the previous direct
  `localStorage` keys, so existing saved layouts survive the upgrade.

### Hardening

The audit's risk findings — states that were not outright bugs yet but could
corrupt data or destabilize the UI under real-world conditions — each as a
separate commit:

- **The data loader can no longer wedge the pipeline or misreport loading.**
  Three related defects. (1) A `forward` request arriving before any data
  (`oldestTimestamp === null`) fell through without calling the callback, and
  klinecharts clears its `_loading` latch only inside the callback — one such
  request permanently blocked all future loads; a terminal callback now always
  answers. (2) The loading flag was a boolean, so with an init and a forward
  request in flight concurrently, whichever finished first flipped the UI to
  "loaded"; an in-flight counter drives the flag now. (3) The stale-generation
  guard was per-loader-instance: swapping the `datafeed` prop builds a new
  loader with its own counter, and an in-flight request from the old loader
  could still deliver old-feed bars onto the freshly reset chart. The
  generation counter is now a ref shared by every loader instance of one chart
  (passed from `ChartCanvas`; deliberately not module-global, so workspace
  charts never cross-invalidate each other).
- **RSI now seeds Wilder smoothing canonically.** `TA.rsi` fed the running
  average a fake leading `0` change, so the seed averaged
  `(0, chg₁ … chg_{p−1})` instead of the first `period` changes: values began
  one bar early and carried a decaying seed bias on every series with mixed
  moves. The first RSI value now lands on bar `period` with the canonical
  Wilder seed (hand-computed test included; `RSI_TV` inherits the fix).
- **Indicator move/reorder keeps the axis binding and visibility.**
  `moveToMain` / `moveToSub` / `reorderSubIndicator` recreated the indicator
  without `yAxisId` or `visible` and never migrated the tracking maps: a bound
  indicator silently landed on the default axis while `indicatorAxes` kept
  pointing at the dead id, and a hidden indicator moved between panes
  resurrected visible while `isIndicatorVisible` still reported `false`. They
  now snapshot and carry both properties and migrate the map keys, mirroring
  `bindIndicatorToNewAxis`.
- **Hooks no longer drive a disposed chart.** `state.chart` was never cleared
  when `<ChartCanvas>` unmounted while the provider lived on (layout
  switching), leaving every `state.chart?.x()` call operating on a destroyed
  instance. The canvas unmount cleanup now dispatches `SET_CHART` with `null`.
- **Malformed persisted JSON falls back to defaults instead of crashing.** The
  provider's hydration helper validated JSON syntax only: a stored literal
  `"null"` or a wrong-shaped value (string where an array is expected) threw
  during init or on first render. Hydration now shape-checks the parsed value
  against the fallback's type and falls back.
- **Undo/redo is multi-instance safe.** The action listener was a single
  last-writer-wins slot (an unmounting instance killed recording for the
  survivors) and every instance registered its own Ctrl+Z/Ctrl+Y handler (one
  keystroke drove two independent stacks). A per-provider ownership registry
  now elects the first-mounted instance as the hotkey owner, with automatic
  promotion when it unmounts.
- **Overlay cleanup is scoped to the owning hook instance.** `useAnnotations`
  unmount removed overlays by the shared `annotations` group id and
  `useOrderLines.removeAllOrderLines` removed by template name — either wiped
  every sibling instance's overlays on the same chart. Both now track their
  own overlay ids and remove only those.
- **Layouts persist through the provider storage adapter.** `useLayoutManager`
  went straight to `localStorage`: writes were unguarded (quota/private-mode
  exceptions crashed the callback), a configured custom adapter was ignored,
  and the initial read ran during render (an SSR hydration mismatch, since the
  server renders `[]`). Reads/writes are routed through the adapter under the
  new `layouts` namespace (falling back to the previous direct `localStorage`
  keys when no adapter is configured), every write is exception-guarded, and
  hydration moved after mount.
- **`brush` follows the chart theme again.** The stroke colour was read from a
  `defaultStyles` parameter that v10 no longer passes to figure creators, so
  it was silently `undefined` and the brush rendered permanently in the
  fallback blue regardless of theme. The colour now comes from
  `chart.getStyles().overlay.line`; a dead `paneId` guard (the field is not
  part of `OverlayEvent`) was removed, and the header documents that the
  template intentionally replaces klinecharts' built-in continuous-mode brush
  (renaming it would break saved layouts).
- **Fullscreen state is correct on WebKit engines.** The
  `webkitfullscreenchange` handler read only the standard
  `document.fullscreenElement`, so `isFullscreen` stayed `false` and
  re-toggling kept requesting fullscreen instead of exiting. The WebKit
  fallback property is now checked.
- **Workspace cell writers are keyed by `cellId`.** The symbol/period effects
  in `useChartSync` omitted `cellId` from their dependencies, so a prop change
  kept dispatching to the old cell's id.
- **`useCompare.toggleSymbol` no longer performs chart work inside a
  `setState` updater.** StrictMode double-invocation could toggle the chart
  overlay visibility without a committed state change; the visibility is
  computed before the updater now (the same pattern `useAnnotations`
  documents).

### Self-review of this patch

The hardening pass itself was reviewed (four independent reviewers over the
full diff against `main`, every claim re-verified against the klinecharts
`10.0.3` runtime and typings), which caught defects the pass had introduced
or missed:

- **Indicator move/reorder transplanted the pane-default axis id.** Reading
  the previous axis via `indicator.yAxisId` never yields `undefined` in v10
  (klinecharts fills it with the pane's default axis id), so the intended
  fallback to the custom-binding map never fired: an unbound indicator moved
  to the candle pane sprouted a spurious extra Y-axis, and the pane-default
  id polluted the custom-only `indicatorAxes` map (persisted by layouts).
  The state map is now authoritative everywhere. Moving an indicator onto a
  pane where the target id already exists now merges into the existing
  instance instead of corrupting its axis/visibility tracking.
- **The symbol-search spinner stuck after selecting mid-search.** The new
  cancel-on-select aborted the fetch, whose `finally` deliberately skips the
  reset when aborted; `selectSymbol` now resets `isSearching` itself.
- **Starting a replay did not invalidate in-flight live requests.** The
  replay intercept answered from the buffer without bumping the generation
  counter, so a live init that was in flight when the replay started passed
  the staleness check and wiped the replayed prefix off the chart. The replay
  path now bumps the generation (regression test included).
- **Pre-2.0.4 layouts would have vanished for adapter-configured apps.**
  Earlier versions always wrote layouts to raw `localStorage`; routing them
  through a newly configured adapter orphanised those entries. A one-time
  merge-migration now copies legacy entries into the adapter (existing
  adapter entries keep their order) and removes the legacy keys. Auto-save
  also exits early when persistence is disabled instead of churning through
  no-op writes.
- **The hydration shape check accepted an array for an object fallback** —
  symmetric now (`[]` vs `{}` is the same mismatch as a wrong primitive).
- **`UndoRedoInstance` / `UndoRedoListener` are exported** — both are
  referenced by the exported `KlinechartsUIDispatchValue` and previously
  needed a deep import. The storage docs saying "all three" namespaces were
  corrected to all four.
- **The brush no longer snaps on the frame after draw end.** The simplify
  pass rendered the raw RDP pixels (sub-bar x precision) for one frame while
  every later frame re-derived coordinates from the quantized data points —
  the stroke jumped up to half a bar width, then snapped back. Coordinates
  are now always derived from the same quantized points.
- **Degenerate indicator periods can't leak NaN.** `TA.rsi(…, 0)` seeded the
  RMA at index −1, `TA.hma`/`HMA` divided by a zero-length WMA weight on
  period 0, and `RSI_TV` with an MA period of 0 walked its window out of
  bounds and divided by zero — all clamped to period ≥ 1 (with an all-null
  MA fallback). The HMA test now pins the TradingView rounding with a golden
  value that a regression back to `floor` provably fails (verified by
  reverting the fix and watching the test fail).
- A stale comment claiming the script-editor registry stays O(1) now
  correctly describes the per-mount-salt growth (O(mounts)) and the
  single-root uniqueness boundary of `useId`.

### Performance and internals

- **`RSI_TV`'s signal MA is now O(n)** instead of O(n·period): the last
  `maPeriod` valid RSI values are collected with a forward sliding window
  (null-tolerant, so the exact previous semantics are preserved).
- **HMA matches TradingView's window rounding** — `round(√period)` instead of
  `floor` (they diverge for periods 13, 21, 24, 32, …) — and degenerate
  periods no longer produce `NaN` (`wma(…, 0)` had a zero denominator;
  half/sqrt windows are clamped to at least 1).
- **`MA_Ribbon` regenerates its figures from `calcParams`.** The template
  declared a fixed 15 figures against 4 default params, so the legend
  permanently listed eleven `-` placeholders; the figure list now follows the
  parameter count (and honours custom params of any length).
- **VWAP renders the typical price on zero-volume prefixes.** The indicator
  divided by `cumulativeVolume || 1`, collapsing the line to literal 0 on
  illiquid opens; it now falls back to the typical price, matching `TA.vwap`.
- **`depthOverlay` guards a non-positive `maxQty`** — an explicit `0` produced
  an `Infinity` bar width, silently vanishing the whole panel.
- **Parameter metadata for the built-in `MA`, `EMA` and `RSI`** was added to
  `INDICATOR_PARAMS`, so the params editor covers them instead of silently
  skipping three of the most common indicators.
- Unnecessary `as any` / `?.()` indirections over typed v10 APIs
  (`subscribeAction`, `getVisibleRange`, `removeIndicator`/`overrideIndicator`
  filters) were removed, and a dead ternary in the localStorage probe was
  dropped.

### Known limitations (documented, deliberately not changed here)

- `useDrawingTools` runs one lightweight 1-second overlay poll per hook
  instance; hoisting a single shared poller into the provider would reshape
  the hook's public surface and is deferred.
- `VWAP` / `PivotPoints` anchor their session reset at 00:00 UTC; a
  configurable session offset is feature work, not a patch.
- The workspace `sync.symbol` / `sync.period` config channels remain the
  consumer's responsibility to act on (by design).
- `useScriptEditor`'s "sandbox" is a convenience shadowing of globals inside
  `new Function` — it is not a security boundary and should not be presented
  as one.

### Documentation

- README and docs synced with the new behaviour: layouts persistence now
  routed through the provider `storage` adapter (`layouts` namespace, legacy
  key migration) instead of raw `localStorage`; `useUndoRedo` multi-instance
  ownership and text-input skip documented; the `brush` note rewritten — the
  library intentionally replaces the built-in continuous-mode brush with a
  click-based, simplified, theme-aware stroke; default storage namespaces
  listed as four (`alerts` / `settings` / `indicators` / `layouts`).

### Notable upstream behaviour in klinecharts 10.0.2 / 10.0.3 (picked up automatically)

These ship in klinecharts and apply through the chart instance — no library
change is required to benefit:

- 10.0.3: fixed backward data loading not being triggered after forward loading
  was exhausted — relevant to `createDataLoader`-based setups that page history
  in both directions.
- 10.0.3: optimised default indicator style parsing, removing repeated
  calculations during rendering.
- 10.0.2: optimised path figure parsing/caching (less SVG path parsing
  overhead) and faster value lookup for simple fields during formatting.
- 10.0.2: fixed indicator math in the built-in `CR`, `ROC`, and `SAR`
  indicators; fixed `formatBigNumber` for negative values and exact magnitude
  boundaries; fixed the percentage y-axis producing `NaN` for flat data or a
  zero base price.
- 10.0.2: fixed dragging an overlay control point potentially replacing a valid
  timestamp with an invalid value (drawing-tool robustness); fixed y-axis tick
  label collision detection using the x-axis text size; fixed repeated `init`
  calls failing to identify a chart already initialized on the same container;
  fixed crosshair path features not accounting for padding.

## 2.0.3 — 2026-08-01

Patch (dependency maintenance) release. No source code or public API changes;
backs the klinecharts upstream patch (`10.0.0` → `10.0.1`) and the matching
`react-klinecharts` wrapper (`1.0.0` → `1.0.1`). Typecheck, lint, the full test
suite, and the build pass against the bumped versions. Backwards compatible.

### Changed

- **klinecharts `^10.0.0` → `^10.0.1`** (dev dependency). `10.0.1` is a strictly
  additive patch on the public type surface — diffing the published `.d.ts`
  shows zero removed symbols and exactly one added type (`IndicatorFigureStyleBase`);
  all symbols the library imports (`utils`, `registerFigure`, `registerIndicator`,
  `registerOverlay`, and the `OverlayTemplate` / `*Attrs` / `DeepPartial<Options>`
  types) are preserved.

- **react-klinecharts `1.0.0` → `1.0.1`** (dev dependency, and the same pin in the
  `docs` / `examples` workspace packages). `1.0.1` is itself a one-line release that
  raises its `klinecharts` dependency from `^10.0.0` to `^10.0.1`. Bumping it here
  eliminates the duplicate klinecharts copy the dependency tree previously held: with
  `1.0.0` the tree resolved to `klinecharts@10.0.1` (direct) **and** `klinecharts@10.0.0`
  (transitive via `react-klinecharts`); with `1.0.1` both resolve to a single
  `klinecharts@10.0.1`. The `react-klinecharts` peer range (`>=1.0.0`) is unchanged.

### Notable upstream behaviour in klinecharts 10.0.1 (picked up automatically)

These ship in klinecharts and apply through the chart instance — no library change
is required to benefit:

- Fixed a miscalculation in the built-in **PVT** indicator (the library exposes PVT
  as UI metadata over the built-in indicator, so the fix applies transparently).
- Fixed `rgbToHex` using the red channel value when converting the green/blue
  channels, and regex errors in `hsla` validation and transparent-color detection.
- Optimised Canvas rendering scheduling, resizing, and device-pixel-ratio handling;
  smoother/more consistent mobile inertial scrolling and touch handling that no
  longer drives page scroll or browser navigation gestures while dragging.

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

| Indicator            | Template name  | Placement | Description                                                                         |
| -------------------- | -------------- | --------- | ----------------------------------------------------------------------------------- |
| Bollinger Bands (TV) | `BOLL_TV`      | main      | TradingView-style with fill between upper/lower bands                               |
| CCI                  | `CCI`          | sub       | Commodity Channel Index with +100/-100 reference lines                              |
| HMA                  | `HMA`          | main      | Hull Moving Average — low-lag smoothing                                             |
| Ichimoku Cloud       | `ICHIMOKU`     | main      | Tenkan-sen, Kijun-sen, Senkou Span A/B, Chikou Span with cloud fill                 |
| MA Ribbon            | `MA_RIBBON`    | main      | 6-period moving average ribbon for trend visualization                              |
| MACD (TV)            | `MACD_TV`      | sub       | 4-color histogram (growing/shrinking x positive/negative), TradingView style        |
| Pivot Points         | `PIVOT_POINTS` | main      | Standard pivot with R1, R2, S1, S2 levels                                           |
| RSI (TV)             | `RSI_TV`       | sub       | RMA-based RSI + MA line, dashed 70/50/30 levels, gradient overbought/oversold fills |
| Stochastic           | `STOCHASTIC`   | sub       | %K and %D lines, TradingView-style calculation                                      |
| SuperTrend           | `SUPERTREND`   | main      | ATR-based trend indicator with dynamic up/down coloring                             |
| VWAP                 | `VWAP`         | main      | Volume-weighted average price                                                       |

### New Overlay Templates (9)

| Overlay               | Template name     | Category   | Description                                                     |
| --------------------- | ----------------- | ---------- | --------------------------------------------------------------- |
| Elliott Wave          | `elliottWave`     | wave       | Five-wave cycle markup with numbered vertices                   |
| Gann Fan              | `gannFan`         | fibonacci  | Gann angle fans (1x1, 1x2, etc.)                                |
| Fibonacci Retracement | `fibRetracement`  | fibonacci  | Standard retracement levels                                     |
| Parallel Channel      | `parallelChannel` | moreLine   | Two-point channel with parallel lines                           |
| Long Position         | `longPosition`    | position   | Risk/reward calculator with TP/SL levels and % labels           |
| Short Position        | `shortPosition`   | position   | Risk/reward calculator for short trades                         |
| Measure               | `measure`         | measure    | Price change %, bar count, and time interval between two points |
| Brush                 | `brush`           | annotation | Freehand drawing with Bezier smoothing                          |
| Ray                   | `ray`             | singleLine | Infinite ray from a point                                       |

### New TA (Technical Analysis) Library

A standalone math library (`TA`) exported for use in custom scripts and indicator templates:

| Function    | Signature                                                      | Description                       |
| ----------- | -------------------------------------------------------------- | --------------------------------- |
| `sma`       | `(data, period) => number[]`                                   | Simple Moving Average             |
| `ema`       | `(data, period) => number[]`                                   | Exponential Moving Average        |
| `rma`       | `(data, period) => number[]`                                   | Running (Wilder's) Moving Average |
| `wma`       | `(data, period) => number[]`                                   | Weighted Moving Average           |
| `hma`       | `(data, period) => number[]`                                   | Hull Moving Average               |
| `rsi`       | `(data, period) => (number \| null)[]`                         | Relative Strength Index           |
| `macd`      | `(data, fast, slow, signal) => { dif, dea, macd }`             | MACD                              |
| `bollinger` | `(data, period, mult) => { upper, mid, lower }`                | Bollinger Bands                   |
| `stdev`     | `(data, period) => number[]`                                   | Standard Deviation                |
| `tr`        | `(highs, lows, closes) => number[]`                            | True Range                        |
| `atr`       | `(highs, lows, closes, period) => number[]`                    | Average True Range                |
| `vwap`      | `(highs, lows, closes, volumes) => number[]`                   | Volume Weighted Average Price     |
| `cci`       | `(highs, lows, closes, period) => number[]`                    | Commodity Channel Index           |
| `stoch`     | `(highs, lows, closes, kPeriod, kSmooth, dPeriod) => { k, d }` | Stochastic Oscillator             |

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
