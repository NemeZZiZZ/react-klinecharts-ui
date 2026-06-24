---
title: useUndoRedo
description: Undo/redo history for drawings and indicator toggles.
sidebar:
  order: 13
---

Undo/redo history for drawing overlays and indicator toggles. Automatically
connected to [`useDrawingTools`](../use-drawing-tools/) and
[`useIndicators`](../use-indicators/) via a shared context ref — actions are
recorded without manual wiring.

**Keyboard shortcuts:** `Ctrl+Z` (undo), `Ctrl+Y` / `Ctrl+Shift+Z` (redo).

```ts
import { useUndoRedo } from "react-klinecharts-ui";

const { canUndo, canRedo, undo, redo, pushAction, clear } = useUndoRedo();
```

| Property | Type | Description |
| -------- | ---- | ----------- |
| `canUndo` | `boolean` | Whether there are actions to undo |
| `canRedo` | `boolean` | Whether there are actions to redo |
| `undo` | `() => void` | Undo the last action |
| `redo` | `() => void` | Redo the last undone action |
| `pushAction` | `(action: UndoRedoAction) => void` | Push a new action (clears redo) |
| `clear` | `() => void` | Clear all history |

## Action types

| Type | Trigger | Undo | Redo |
| ---- | ------- | ---- | ---- |
| `overlay_added` | User completes a drawing | Removes the overlay | Re-creates it |
| `overlays_removed` | `removeAllDrawings()` | Restores all removed overlays | Re-removes them |
| `indicator_toggled` | Add/remove indicator | Reverses the toggle | Re-applies it |

## Cross-hook communication

`useUndoRedo` registers a `pushAction` callback on `undoRedoListenerRef` (shared
via provider context). When `useDrawingTools` finishes a drawing or
`useIndicators` toggles an indicator, they call the ref to record the action — no
prop drilling required. Just mount `useUndoRedo` once and the history fills in
automatically.
