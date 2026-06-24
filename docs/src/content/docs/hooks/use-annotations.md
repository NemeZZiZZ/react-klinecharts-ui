---
title: useAnnotations
description: Add text annotations at specific price levels and timestamps.
sidebar:
  order: 19
---

Add text annotations at specific price levels and timestamps, with optional
colors.

```ts
import { useAnnotations } from "react-klinecharts-ui";

const {
  annotations,
  addAnnotation,
  removeAnnotation,
  updateAnnotation,
  clearAnnotations,
} = useAnnotations();
```

| Property | Type | Description |
| -------- | ---- | ----------- |
| `annotations` | `Annotation[]` | All annotations |
| `addAnnotation` | `(text, price, timestamp, color?) => string` | Add annotation; returns ID |
| `removeAnnotation` | `(id: string) => void` | Remove by ID |
| `updateAnnotation` | `(id, updates) => void` | Update text or color |
| `clearAnnotations` | `() => void` | Remove all |

```ts
interface Annotation {
  id: string;
  text: string;
  price: number;
  timestamp: number;
  color?: string;
}
```

## Usage

```tsx
const { addAnnotation, removeAnnotation } = useAnnotations();

const id = addAnnotation("Earnings", 178.4, Date.parse("2026-01-30"), "#f59e0b");
// later…
removeAnnotation(id);
```
