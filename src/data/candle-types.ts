export interface CandleTypeOption {
  key: string;
  localeKey: string;
}

export const CANDLE_TYPES: CandleTypeOption[] = [
  { key: "candle_solid", localeKey: "candle_solid" },
  { key: "candle_stroke", localeKey: "candle_stroke" },
  { key: "candle_up_stroke", localeKey: "candle_up_stroke" },
  { key: "candle_down_stroke", localeKey: "candle_down_stroke" },
  { key: "ohlc", localeKey: "ohlc" },
  { key: "area", localeKey: "area" },
];

export const PRICE_AXIS_TYPES = ["normal", "percentage", "logarithm"] as const;
export type PriceAxisType = (typeof PRICE_AXIS_TYPES)[number];

export const YAXIS_POSITIONS = ["left", "right"] as const;
export type YAxisPosition = (typeof YAXIS_POSITIONS)[number];

export const COMPARE_RULES = ["current_open", "prev_close"] as const;
export type CompareRule = (typeof COMPARE_RULES)[number];

export const TOOLTIP_SHOW_RULES = ["always", "follow_cross", "none"] as const;
export type TooltipShowRule = (typeof TOOLTIP_SHOW_RULES)[number];
