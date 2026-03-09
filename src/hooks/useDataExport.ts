import { useCallback } from "react";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";

export type ExportFormat = "csv" | "json";

export interface UseDataExportReturn {
  /** Export all chart data */
  exportAll: (format: ExportFormat) => void;
  /** Export only the visible range */
  exportVisible: (format: ExportFormat) => void;
}

export function useDataExport(): UseDataExportReturn {
  const { state } = useKlinechartsUI();

  const exportAll = useCallback(
    (format: ExportFormat) => {
      if (!state.chart) return;
      const dataList = state.chart.getDataList();
      if (!dataList || dataList.length === 0) return;
      downloadData(dataList, format, state.symbol?.ticker);
    },
    [state.chart, state.symbol?.ticker]
  );

  const exportVisible = useCallback(
    (format: ExportFormat) => {
      if (!state.chart) return;
      const dataList = state.chart.getDataList();
      if (!dataList || dataList.length === 0) return;

      const visibleRange = (state.chart as any).getVisibleRange?.();
      if (!visibleRange) {
        downloadData(dataList, format, state.symbol?.ticker);
        return;
      }

      const { from, to } = visibleRange as { from: number; to: number };
      const visibleData = dataList.slice(from, to);
      downloadData(visibleData, format, state.symbol?.ticker);
    },
    [state.chart, state.symbol?.ticker]
  );

  return { exportAll, exportVisible };
}

function formatRow(bar: any): {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
} {
  return {
    date: new Date(bar.timestamp).toISOString(),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume ?? 0,
  };
}

function buildCsv(dataList: any[]): string {
  const header = "Date,Open,High,Low,Close,Volume\n";
  const rows = dataList.map((bar) => {
    const r = formatRow(bar);
    return `${r.date},${r.open},${r.high},${r.low},${r.close},${r.volume}`;
  });
  return header + rows.join("\n");
}

function buildJson(dataList: any[]): string {
  return JSON.stringify(dataList.map(formatRow), null, 2);
}

function downloadData(
  dataList: any[],
  format: ExportFormat,
  ticker?: string
): void {
  const content = format === "csv" ? buildCsv(dataList) : buildJson(dataList);
  const mimeType = format === "csv" ? "text/csv" : "application/json";

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().slice(0, 10);
  const prefix = ticker ?? "chart";
  const filename = `${prefix}_${date}.${format}`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
