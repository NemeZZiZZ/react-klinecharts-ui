---
title: createDataLoader
description: Bridge a Datafeed into a klinecharts DataLoader.
---

Creates a klinecharts `DataLoader` from a `Datafeed` instance, wiring history
pagination and real-time subscription into the chart.

```ts
function createDataLoader(
  datafeed: Datafeed,
  dispatch: Dispatch<KlinechartsUIAction>,
): DataLoader;
```

## Behavior

| klinecharts request | Action |
| ------------------- | ------ |
| `"init"`     | Loads the latest ~1000 bars (`to=Date.now(), from=0`), saves `oldestTimestamp`, increments `currentGen` |
| `"forward"`  | Loads bars older than `oldestTimestamp - 1` for left-scroll pagination |
| `"backward"` | Ignored (real-time is handled via `subscribeBar`) |

**Race-condition protection:** each `"init"` increments an internal generation
counter. If a `"forward"` request resolves after a newer `"init"` has started,
its result is discarded — so switching symbols rapidly never mixes data.

## Usage

Memoize it so the loader is stable across renders:

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
