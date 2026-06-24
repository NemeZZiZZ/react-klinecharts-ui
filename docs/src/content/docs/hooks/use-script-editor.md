---
title: useScriptEditor
description: Pine Script-style custom indicator editor running sandboxed JavaScript.
sidebar:
  order: 15
---

A Pine Script-style custom indicator editor. Users write plain JavaScript
function bodies that receive `TA`, `dataList` (array of `KLineData`) and `params`
(parsed from a comma-separated string). The script returns an array of objects —
one per candle, where each key becomes a chart series.

Scripts execute inside a sandboxed `new Function()` with dangerous globals
shadowed: `fetch`, `XMLHttpRequest`, `WebSocket`, `Worker`, `SharedWorker`,
`importScripts`, `self`, `caches`, `indexedDB`.

```ts
import { useScriptEditor } from "react-klinecharts-ui";

const {
  code, setCode,
  scriptName, setScriptName,
  params, setParams,
  placement, setPlacement,
  error, status, isRunning, hasActiveScript,
  runScript, removeScript, resetCode,
  exportScript, importScript,
  defaultScript,
} = useScriptEditor();
```

| Property | Type | Description |
| -------- | ---- | ----------- |
| `code` | `string` | Current script source |
| `setCode` | `(code: string) => void` | Update the source |
| `scriptName` | `string` | Display name |
| `setScriptName` | `(name: string) => void` | Update the name |
| `params` | `string` | Comma-separated numeric params (e.g. `"14, 26, 9"`) |
| `setParams` | `(params: string) => void` | Update params |
| `placement` | `ScriptPlacement` | `"main"` or `"sub"` |
| `setPlacement` | `(p: ScriptPlacement) => void` | Set placement |
| `error` | `string` | Last error message (empty = none) |
| `status` | `string` | Last status message |
| `isRunning` | `boolean` | Whether the script is executing |
| `hasActiveScript` | `boolean` | Whether a script indicator is on the chart |
| `runScript` | `() => void` | Execute and register the indicator |
| `removeScript` | `() => void` | Remove the script indicator |
| `resetCode` | `() => void` | Reset to the default template |
| `exportScript` | `() => void` | Download the code as a `.js` file |
| `importScript` | `(file: File) => void` | Load a script from a file |
| `defaultScript` | `string` | The default template code |

## Example script

```js
// Available: TA, dataList, params
const period = params[0] ?? 14;
const closes = dataList.map((d) => d.close);

const rsi = TA.rsi(closes, period);
const boll = TA.bollinger(closes, period, 2);

// Return one object per candle — each key = one line on the chart
return rsi.map((v, i) => ({
  rsi: v,
  upper: boll.upper[i],
  mid: boll.mid[i],
  lower: boll.lower[i],
}));
```

The `TA` helpers available inside scripts are documented in
[TA (Technical Analysis)](../../utilities/ta/).
