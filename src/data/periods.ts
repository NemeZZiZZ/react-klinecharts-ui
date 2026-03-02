import type { Period as KlinechartsPeriod } from "react-klinecharts";

export interface TerminalPeriod extends KlinechartsPeriod {
  label: string;
}

export const DEFAULT_PERIODS: TerminalPeriod[] = [
  { span: 1, type: "minute", label: "1m" },
  { span: 5, type: "minute", label: "5m" },
  { span: 15, type: "minute", label: "15m" },
  { span: 1, type: "hour", label: "1H" },
  { span: 2, type: "hour", label: "2H" },
  { span: 4, type: "hour", label: "4H" },
  { span: 1, type: "day", label: "D" },
  { span: 1, type: "week", label: "W" },
  { span: 1, type: "month", label: "M" },
  { span: 1, type: "year", label: "Y" },
];
