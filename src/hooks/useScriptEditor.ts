import { useState, useCallback, useRef } from "react";
import { registerIndicator } from "react-klinecharts";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";
import TA from "../utils/TA";

const DEFAULT_SCRIPT = `// Custom Indicator — Pine Script Style
// Available: TA, dataList, params

const period = params[0] ?? 14
const closes = dataList.map(d => d.close)
const highs  = dataList.map(d => d.high)
const lows   = dataList.map(d => d.low)

// Example: RSI + Bollinger Bands
const rsi  = TA.rsi(closes, period)
const boll = TA.bollinger(closes, period, 2)

// Return one object per candle — each key = one line on chart
return rsi.map((v, i) => ({
  rsi:   v,
  upper: boll.upper[i],
  mid:   boll.mid[i],
  lower: boll.lower[i],
}))`;

const SERIES_COLORS = [
  "#2962FF",
  "#FF6D00",
  "#00BCD4",
  "#E91E63",
  "#76FF03",
  "#FFD600",
];

/** Keys shadowed inside the sandbox so user code cannot access them. */
const SHADOW_KEYS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "Worker",
  "SharedWorker",
  "importScripts",
  "self",
  "caches",
  "indexedDB",
];

let scriptCounter = 0;

export type ScriptPlacement = "main" | "sub";

export interface UseScriptEditorReturn {
  /** Current script source code */
  code: string;
  setCode: (code: string) => void;
  /** Display name of the script */
  scriptName: string;
  setScriptName: (name: string) => void;
  /** Comma-separated numeric params (e.g. "14, 26, 9") */
  params: string;
  setParams: (params: string) => void;
  /** Where to place the indicator */
  placement: ScriptPlacement;
  setPlacement: (p: ScriptPlacement) => void;
  /** Last error message (empty = no error) */
  error: string;
  /** Last status message */
  status: string;
  /** Whether the script is currently running */
  isRunning: boolean;
  /** Whether there is a script indicator currently on the chart */
  hasActiveScript: boolean;
  /** Execute the script and register the indicator */
  runScript: () => void;
  /** Remove the current script indicator from the chart */
  removeScript: () => void;
  /** Reset code to the default template */
  resetCode: () => void;
  /** Export the current code as a downloadable .js file */
  exportScript: () => void;
  /** Import a script from a File object */
  importScript: (file: File) => void;
  /** The default template code */
  defaultScript: string;
}

/**
 * Headless hook for a Pine Script-style custom indicator editor.
 *
 * Scripts are plain JavaScript function bodies that receive:
 *   - `TA`       — technical analysis math library
 *   - `dataList` — KLineData[] (open, high, low, close, volume, timestamp)
 *   - `params`   — number[] from the params input
 *
 * Must return an array of objects, one per candle. Each key = one chart series.
 */
export function useScriptEditor(): UseScriptEditorReturn {
  const { state } = useKlinechartsUI();

  const [code, setCode] = useState(DEFAULT_SCRIPT);
  const [scriptName, setScriptName] = useState("");
  const [params, setParams] = useState("14");
  const [placement, setPlacement] = useState<ScriptPlacement>("sub");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const activeIdRef = useRef<string | null>(null);
  const activeNameRef = useRef<string | null>(null);

  const hasActiveScript = activeNameRef.current !== null;

  const runScript = useCallback(() => {
    const chart = state.chart;
    if (!chart) {
      setError("Chart not initialized");
      return;
    }

    setError("");
    setStatus("Running...");
    setIsRunning(true);

    try {
      const parsedParams = params
        .split(",")
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n));

      const dataList = (chart as any).getDataList?.() ?? [];

      // Execute in sandboxed new Function — shadow dangerous globals
      const allArgs = [
        ...SHADOW_KEYS,
        "TA",
        "dataList",
        "params",
        `"use strict";\n${code}`,
      ];
      const fn = new Function(...allArgs);
      const shadowValues = SHADOW_KEYS.map(() => undefined);
      const result = fn(...shadowValues, TA, dataList, parsedParams);

      if (!Array.isArray(result)) {
        throw new Error("Script must return an Array.");
      }

      const sample = result.find((v: unknown) => v !== null && v !== undefined);
      const seriesKeys: string[] = sample ? Object.keys(sample) : ["value"];
      if (seriesKeys.length === 0) {
        throw new Error("Returned objects have no keys.");
      }

      scriptCounter++;
      const indicatorName = `_custom_script_${scriptCounter}`;

      const figures = seriesKeys.map((key, i) => ({
        key,
        title: `${key}: `,
        type: "line" as const,
        styles: () => ({ color: SERIES_COLORS[i % SERIES_COLORS.length] }),
      }));

      registerIndicator({
        name: indicatorName,
        shortName:
          (scriptName.trim() || `Script #${scriptCounter}`) +
          (placement === "main" ? " (Main)" : " (Sub)"),
        calcParams: parsedParams,
        figures: figures as any,
        calc: () => result,
        extendData: {
          isCustomScript: true,
          code,
          placement,
        },
      });

      // Remove previous custom script indicator if exists
      if (activeNameRef.current) {
        try {
          chart.removeIndicator({
            id:
              activeIdRef.current === "candle_pane"
                ? "candle_pane"
                : activeIdRef.current!,
            name: activeNameRef.current,
          } as any);
        } catch {
          // ignore
        }
      }

      // Add to chart
      let paneId: string | null = null;
      if (placement === "main") {
        paneId = chart.createIndicator(
          { name: indicatorName },
          true,
          { id: "candle_pane" },
        );
      } else {
        paneId = chart.createIndicator({ name: indicatorName });
      }

      activeIdRef.current = typeof paneId === "string" ? paneId : null;
      activeNameRef.current = indicatorName;

      const title = scriptName.trim() || `Script #${scriptCounter}`;
      setStatus(
        `${title} applied to ${placement === "main" ? "Main Chart" : "Sub Pane"} — ${seriesKeys.length} series: ${seriesKeys.join(", ")}`,
      );
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setIsRunning(false);
    }
  }, [state.chart, code, scriptName, params, placement]);

  const removeScript = useCallback(() => {
    const chart = state.chart;
    if (chart && activeNameRef.current && activeIdRef.current) {
      try {
        chart.removeIndicator({
          id: activeIdRef.current,
          name: activeNameRef.current,
        } as any);
      } catch {
        // ignore
      }
      activeIdRef.current = null;
      activeNameRef.current = null;
      setStatus("Indicator removed.");
    }
  }, [state.chart]);

  const resetCode = useCallback(() => {
    setCode(DEFAULT_SCRIPT);
    setError("");
    setStatus("");
  }, []);

  const exportScript = useCallback(() => {
    const blob = new Blob([code], {
      type: "text/javascript;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scriptName.trim() || "custom_indicator"}.js`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus("Script exported.");
  }, [code, scriptName]);

  const importScript = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          setCode(content);
          if (!scriptName) {
            setScriptName(file.name.replace(/\.(js|ts|txt)$/i, ""));
          }
          setError("");
          setStatus(`Loaded ${file.name}`);
        }
      };
      reader.readAsText(file);
    },
    [scriptName],
  );

  return {
    code,
    setCode,
    scriptName,
    setScriptName,
    params,
    setParams,
    placement,
    setPlacement,
    error,
    status,
    isRunning,
    hasActiveScript,
    runScript,
    removeScript,
    resetCode,
    exportScript,
    importScript,
    defaultScript: DEFAULT_SCRIPT,
  };
}
