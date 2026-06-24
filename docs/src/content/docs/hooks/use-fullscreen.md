---
title: useFullscreen
description: Toggle fullscreen mode for the chart container.
sidebar:
  order: 11
---

Toggle fullscreen mode. Uses `fullscreenContainerRef` from the provider and
supports cross-browser vendor prefixes (`webkit`, `ms`).

```ts
const { isFullscreen, toggle, enter, exit, containerRef } = useFullscreen();
```

| Field/Method | Type | Description |
| ------------ | ---- | ----------- |
| `isFullscreen` | `boolean` | Current fullscreen state |
| `toggle()` | `() => void` | Toggle |
| `enter()` | `() => void` | Enter fullscreen |
| `exit()` | `() => void` | Exit fullscreen |
| `containerRef` | `RefObject<HTMLElement \| null>` | The same ref from the provider |

:::caution[Assign the ref]
`containerRef` must be assigned to the element that should occupy the full
screen — typically the root layout element.
:::

```tsx
const { containerRef, toggle, isFullscreen } = useFullscreen();

<div ref={containerRef as React.RefObject<HTMLDivElement>}>
  <button onClick={toggle}>{isFullscreen ? "Exit" : "Fullscreen"}</button>
  <ChartView />
</div>;
```

Fullscreen relies on the browser Fullscreen API, which requires a user gesture —
call `toggle`/`enter` from a click handler.
