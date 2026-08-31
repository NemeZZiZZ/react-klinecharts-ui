---
title: useLayoutManager
description: Save, load, rename and delete named chart layouts with optional persistence.
sidebar:
  order: 14
---

Save, load, rename and delete named chart layouts. Captures
indicators, drawings, symbol and period. Optional auto-save with a 5-second
debounce.

Layouts persist through the provider [`storage`](../../guides/persisting-preferences/)
adapter when it is configured (the `layouts` namespace), and fall back to raw
`localStorage` otherwise — layouts saved by 2.0.3 and earlier under the legacy
`klinecharts_layout*` keys are migrated automatically on first use.

```ts
import { useLayoutManager } from "react-klinecharts-ui";

const {
  layouts,
  saveLayout,
  loadLayout,
  deleteLayout,
  renameLayout,
  refreshLayouts,
  autoSaveEnabled,
  setAutoSaveEnabled,
} = useLayoutManager();
```

| Property | Type | Description |
| -------- | ---- | ----------- |
| `layouts` | `LayoutEntry[]` | List of saved layout entries |
| `saveLayout` | `(name: string) => string \| null` | Save current state; returns layout ID |
| `loadLayout` | `(id: string) => boolean` | Load and apply a layout by ID |
| `deleteLayout` | `(id: string) => void` | Delete a layout |
| `renameLayout` | `(id: string, name: string) => boolean` | Rename a layout |
| `refreshLayouts` | `() => void` | Refresh the list from the persistence backend |
| `autoSaveEnabled` | `boolean` | Whether auto-save is enabled |
| `setAutoSaveEnabled` | `(enabled: boolean) => void` | Toggle auto-save |

## Types

```ts
interface LayoutEntry {
  id: string;
  name: string;
  symbol: string;
  period: string;
  timestamp: number;
  lastModified: number;
  state: ChartLayoutState;
}

interface ChartLayoutState {
  version: string;
  meta: { symbol: string; period: string; timestamp: number; lastModified: number };
  indicators: Array<{ paneId: string; name: string; calcParams: any[]; visible: boolean }>;
  drawings: Array<{ name: string; points: any[]; styles?: any; extendData?: any }>;
}
```

Layouts reproduce each indicator's secondary-axis binding 1:1 (see
[`useIndicators` → Y-axis binding](../use-indicators/#secondary-y-axis-binding)).
