---
title: useKlinechartsUI
description: The primary hook — full context access.
sidebar:
  order: 1
---

The primary hook. Returns the full context: state, dispatch, datafeed and the
fullscreen container ref.

```ts
const { state, dispatch, datafeed, onSettingsChange, fullscreenContainerRef } =
  useKlinechartsUI();
```

## Return value

```ts
interface KlinechartsUIContextValue {
  state: KlinechartsUIState;
  dispatch: Dispatch<KlinechartsUIAction>; // enhancedDispatch with synchronous callbacks
  datafeed: Datafeed;
  onSettingsChange?: (settings: Record<string, unknown>) => void;
  fullscreenContainerRef: RefObject<HTMLElement | null>;
}
```

:::note[enhancedDispatch]
`dispatch` is `enhancedDispatch`. It synchronously computes the next state by
calling the pure reducer directly and immediately invokes `onStateChange` and
the individual `on*Change` callbacks — without waiting for a React re-render.
This makes immediate persistence possible.
:::

Most features have a dedicated hook (see the sidebar). Reach for
`useKlinechartsUI` directly when you need the raw `chart` instance
(`state.chart`) or to dispatch an action no hook wraps.

See [State & Actions](../../core/state-actions/) for the full state and action
shapes.
