export interface IndicatorParamConfig {
  label: string;
  defaultValue: number;
}

export interface IndicatorDefinition {
  name: string;
  localeKey: string;
  params: IndicatorParamConfig[];
}

export const MAIN_INDICATORS: string[] = [
  "MA",
  "EMA",
  "SMA",
  "BOLL",
  "SAR",
  "BBI",
  "BOLL_TV",
  "Ichimoku",
  "SuperTrend",
  "HMA",
  "VWAP",
  "PivotPoints",
  "MA_Ribbon",
];

export const SUB_INDICATORS: string[] = [
  "MA",
  "EMA",
  "VOL",
  "MACD",
  "BOLL",
  "KDJ",
  "RSI",
  "BIAS",
  "BRAR",
  "CCI",
  "DMI",
  "CR",
  "PSY",
  "DMA",
  "TRIX",
  "OBV",
  "VR",
  "WR",
  "MTM",
  "EMV",
  "SAR",
  "SMA",
  "ROC",
  "PVT",
  "BBI",
  "AO",
  "MACD_TV",
  "RSI_TV",
  "CCI_TV",
  "Stochastic",
];

export const INDICATOR_PARAMS: Record<string, IndicatorDefinition> = {
  SMA: {
    name: "SMA",
    localeKey: "sma",
    params: [
      { label: "params_1", defaultValue: 12 },
      { label: "params_2", defaultValue: 2 },
    ],
  },
  BOLL: {
    name: "BOLL",
    localeKey: "boll",
    params: [
      { label: "period", defaultValue: 20 },
      { label: "standard_deviation", defaultValue: 2 },
    ],
  },
  SAR: {
    name: "SAR",
    localeKey: "sar",
    params: [
      { label: "params_1", defaultValue: 2 },
      { label: "params_2", defaultValue: 2 },
      { label: "params_3", defaultValue: 20 },
    ],
  },
  BBI: {
    name: "BBI",
    localeKey: "bbi",
    params: [
      { label: "params_1", defaultValue: 3 },
      { label: "params_2", defaultValue: 6 },
      { label: "params_3", defaultValue: 12 },
      { label: "params_4", defaultValue: 24 },
    ],
  },
  MACD: {
    name: "MACD",
    localeKey: "macd",
    params: [
      { label: "params_1", defaultValue: 12 },
      { label: "params_2", defaultValue: 26 },
      { label: "params_3", defaultValue: 9 },
    ],
  },
  KDJ: {
    name: "KDJ",
    localeKey: "kdj",
    params: [
      { label: "params_1", defaultValue: 9 },
      { label: "params_2", defaultValue: 3 },
      { label: "params_3", defaultValue: 3 },
    ],
  },
  BRAR: {
    name: "BRAR",
    localeKey: "brar",
    params: [{ label: "params_1", defaultValue: 26 }],
  },
  CCI: {
    name: "CCI",
    localeKey: "cci",
    params: [{ label: "params_1", defaultValue: 20 }],
  },
  DMI: {
    name: "DMI",
    localeKey: "dmi",
    params: [
      { label: "params_1", defaultValue: 14 },
      { label: "params_2", defaultValue: 6 },
    ],
  },
  CR: {
    name: "CR",
    localeKey: "cr",
    params: [
      { label: "params_1", defaultValue: 26 },
      { label: "params_2", defaultValue: 10 },
      { label: "params_3", defaultValue: 20 },
      { label: "params_4", defaultValue: 40 },
      { label: "params_5", defaultValue: 60 },
    ],
  },
  PSY: {
    name: "PSY",
    localeKey: "psy",
    params: [
      { label: "params_1", defaultValue: 12 },
      { label: "params_2", defaultValue: 6 },
    ],
  },
  DMA: {
    name: "DMA",
    localeKey: "dma",
    params: [
      { label: "params_1", defaultValue: 10 },
      { label: "params_2", defaultValue: 50 },
      { label: "params_3", defaultValue: 10 },
    ],
  },
  TRIX: {
    name: "TRIX",
    localeKey: "trix",
    params: [
      { label: "params_1", defaultValue: 12 },
      { label: "params_2", defaultValue: 9 },
    ],
  },
  OBV: {
    name: "OBV",
    localeKey: "obv",
    params: [{ label: "params_1", defaultValue: 30 }],
  },
  VR: {
    name: "VR",
    localeKey: "vr",
    params: [
      { label: "params_1", defaultValue: 26 },
      { label: "params_2", defaultValue: 6 },
    ],
  },
  MTM: {
    name: "MTM",
    localeKey: "mtm",
    params: [
      { label: "params_1", defaultValue: 12 },
      { label: "params_2", defaultValue: 6 },
    ],
  },
  EMV: {
    name: "EMV",
    localeKey: "emv",
    params: [
      { label: "params_1", defaultValue: 14 },
      { label: "params_2", defaultValue: 9 },
    ],
  },
  ROC: {
    name: "ROC",
    localeKey: "roc",
    params: [
      { label: "params_1", defaultValue: 12 },
      { label: "params_2", defaultValue: 6 },
    ],
  },
  PVT: {
    name: "PVT",
    localeKey: "pvt",
    params: [],
  },
  AO: {
    name: "AO",
    localeKey: "ao",
    params: [
      { label: "params_1", defaultValue: 5 },
      { label: "params_2", defaultValue: 34 },
    ],
  },
  BOLL_TV: {
    name: "BOLL_TV",
    localeKey: "boll_tv",
    params: [
      { label: "period", defaultValue: 20 },
      { label: "multiplier", defaultValue: 2 },
    ],
  },
  Ichimoku: {
    name: "Ichimoku",
    localeKey: "ichimoku",
    params: [
      { label: "tenkan", defaultValue: 9 },
      { label: "kijun", defaultValue: 26 },
      { label: "senkou_b", defaultValue: 52 },
      { label: "offset", defaultValue: 26 },
    ],
  },
  SuperTrend: {
    name: "SuperTrend",
    localeKey: "super_trend",
    params: [
      { label: "period", defaultValue: 10 },
      { label: "factor", defaultValue: 3 },
    ],
  },
  HMA: {
    name: "HMA",
    localeKey: "hma",
    params: [{ label: "period", defaultValue: 9 }],
  },
  VWAP: {
    name: "VWAP",
    localeKey: "vwap",
    params: [],
  },
  PivotPoints: {
    name: "PivotPoints",
    localeKey: "pivot_points",
    params: [],
  },
  MA_Ribbon: {
    name: "MA_Ribbon",
    localeKey: "ma_ribbon",
    params: [
      { label: "period_1", defaultValue: 10 },
      { label: "period_2", defaultValue: 20 },
      { label: "period_3", defaultValue: 30 },
      { label: "period_4", defaultValue: 40 },
    ],
  },
  MACD_TV: {
    name: "MACD_TV",
    localeKey: "macd_tv",
    params: [
      { label: "fast", defaultValue: 12 },
      { label: "slow", defaultValue: 26 },
      { label: "signal", defaultValue: 9 },
    ],
  },
  RSI_TV: {
    name: "RSI_TV",
    localeKey: "rsi_tv",
    params: [
      { label: "rsi_period", defaultValue: 14 },
      { label: "ma_period", defaultValue: 14 },
    ],
  },
  CCI_TV: {
    name: "CCI_TV",
    localeKey: "cci_tv",
    params: [{ label: "period", defaultValue: 20 }],
  },
  Stochastic: {
    name: "Stochastic",
    localeKey: "stochastic",
    params: [
      { label: "period", defaultValue: 14 },
      { label: "smooth_k", defaultValue: 3 },
      { label: "smooth_d", defaultValue: 3 },
    ],
  },
};
