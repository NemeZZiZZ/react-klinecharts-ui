---
title: useKlinechartsUILoading
description: Loading state of chart data.
sidebar:
  order: 3
---

Loading state of chart data.

```ts
const { isLoading } = useKlinechartsUILoading();
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `isLoading` | `boolean` | `true` while `createDataLoader` is fetching bars |

## Usage

```tsx
const { isLoading } = useKlinechartsUILoading();

{isLoading && <div className="spinner" />}
```

The flag is driven by the data loader's `init`/`forward` requests, so it covers
both the initial load and history pagination on left-scroll.
