import {
  KlinechartsUIProvider,
  useKlinechartsUITheme,
  useScriptEditor,
} from "react-klinecharts-ui";
import type { ScriptPlacement } from "react-klinecharts-ui";
import { binanceDatafeed, defaultSymbol } from "../../datafeed";
import { ChartView } from "../../components/ChartView";
import { useSyncTheme } from "../../hooks/use-sync-theme";

const SAMPLE_SCRIPT = `const period = 20;
const dataList = kLineDataList.map(d => d.close);
const result = [];
for (let i = 0; i < dataList.length; i++) {
  if (i < period - 1) {
    result.push({ sma: NaN });
  } else {
    const slice = dataList.slice(i - period + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / period;
    result.push({ sma: avg });
  }
}
return result;`;

function IndicatorBuilderLayout() {
  const { theme } = useKlinechartsUITheme();
  useSyncTheme(theme);

  const {
    code,
    setCode,
    placement,
    setPlacement,
    error,
    status,
    isRunning,
    hasActiveScript,
    runScript,
    removeScript,
  } = useScriptEditor();

  return (
    <div className="flex h-svh bg-background text-foreground">
      {/* Left Panel - Code Editor */}
      <div className="flex w-[350px] shrink-0 flex-col border-r border-border bg-background">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold">Indicator Builder</h2>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-auto p-3">
          {/* Code textarea */}
          <label className="text-xs font-medium text-muted-foreground">
            Script
          </label>
          <textarea
            className="flex-1 min-h-[300px] resize-none rounded-md border border-border bg-zinc-900 p-3 font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-ring"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            placeholder="Write your indicator script here..."
          />

          {/* Placement select */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Placement
            </label>
            <select
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={placement}
              onChange={(e) =>
                setPlacement(e.target.value as ScriptPlacement)
              }
            >
              <option value="main">Main Chart</option>
              <option value="sub">Sub Pane</option>
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={runScript}
              disabled={isRunning || !code.trim()}
            >
              {isRunning ? "Running..." : "Apply"}
            </button>
            <button
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={removeScript}
              disabled={!hasActiveScript}
            >
              Remove
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Status message */}
          {status && !error && (
            <div className="rounded-md border border-border bg-muted p-2 text-xs text-muted-foreground">
              {status}
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Chart */}
      <div className="flex-1 relative">
        <ChartView className="absolute inset-0" />
      </div>
    </div>
  );
}

export default function IndicatorBuilderExample() {
  return (
    <KlinechartsUIProvider
      datafeed={binanceDatafeed}
      defaultSymbol={defaultSymbol}
      defaultTheme="dark"
    >
      <IndicatorBuilderLayout />
    </KlinechartsUIProvider>
  );
}
