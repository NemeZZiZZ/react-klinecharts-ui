import { describe, it, expect } from "vitest";
import { DEFAULT_PERIODS, type TerminalPeriod } from "./periods";
import { TIMEZONES } from "./timezones";
import {
  DRAWING_CATEGORIES,
  type MagnetMode,
} from "./drawings";
import {
  MAIN_INDICATORS,
  SUB_INDICATORS,
  INDICATOR_PARAMS,
} from "./indicators";
import {
  CANDLE_TYPES,
  PRICE_AXIS_TYPES,
  YAXIS_POSITIONS,
  COMPARE_RULES,
  TOOLTIP_SHOW_RULES,
  type PriceAxisType,
  type YAxisPosition,
  type CompareRule,
  type TooltipShowRule,
} from "./candle-types";

describe("DEFAULT_PERIODS", () => {
  it("is a non-empty array with unique labels", () => {
    expect(DEFAULT_PERIODS.length).toBeGreaterThan(0);
    const labels = DEFAULT_PERIODS.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("every entry has a label and a valid type/span", () => {
    const validTypes = ["minute", "hour", "day", "week", "month", "year", "second"];
    for (const p of DEFAULT_PERIODS as TerminalPeriod[]) {
      expect(typeof p.label).toBe("string");
      expect(p.label.length).toBeGreaterThan(0);
      // Period from klinecharts has `span` + `type`; TerminalPeriod adds `label`.
      expect((p as { type?: string }).type).toBeTruthy();
      expect(validTypes).toContain((p as { type: string }).type);
      expect((p as { span?: number }).span).toBeGreaterThan(0);
    }
  });

  it("includes the common trading timeframes", () => {
    const labels = DEFAULT_PERIODS.map((p) => p.label);
    expect(labels).toContain("1m");
    expect(labels).toContain("1H");
    expect(labels).toContain("D");
  });
});

describe("TIMEZONES", () => {
  it("is a non-empty array", () => {
    expect(TIMEZONES.length).toBeGreaterThan(0);
  });

  it("every entry has a key (IANA tz) and a localeKey", () => {
    for (const tz of TIMEZONES) {
      expect(typeof tz.key).toBe("string");
      expect(tz.key.length).toBeGreaterThan(0);
      expect(typeof tz.localeKey).toBe("string");
    }
  });

  it("has unique keys", () => {
    const keys = TIMEZONES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("includes UTC and a couple of common zones", () => {
    const keys = TIMEZONES.map((t) => t.key);
    expect(keys).toContain("Etc/UTC");
    expect(keys).toContain("Europe/London");
  });
});

describe("DRAWING_CATEGORIES", () => {
  it("is a non-empty array of categories each with tools", () => {
    expect(DRAWING_CATEGORIES.length).toBeGreaterThan(5);
    for (const cat of DRAWING_CATEGORIES) {
      expect(typeof cat.key).toBe("string");
      expect(cat.tools.length).toBeGreaterThan(0);
      for (const tool of cat.tools) {
        expect(typeof tool.name).toBe("string");
        expect(typeof tool.localeKey).toBe("string");
      }
    }
  });

  it("has unique tool names across all categories", () => {
    const names = DRAWING_CATEGORIES.flatMap((c) => c.tools.map((t) => t.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it("includes the canonical tool categories", () => {
    const keys = DRAWING_CATEGORIES.map((c) => c.key);
    expect(keys).toContain("singleLine");
    expect(keys).toContain("fibonacci");
    expect(keys).toContain("position");
  });

  it("MagnetMode covers normal/weak/strong", () => {
    const modes: MagnetMode[] = ["normal", "weak", "strong"];
    expect(modes.length).toBe(3);
  });
});

describe("MAIN_INDICATORS / SUB_INDICATORS", () => {
  it("are non-empty arrays of unique names", () => {
    expect(MAIN_INDICATORS.length).toBeGreaterThan(0);
    expect(SUB_INDICATORS.length).toBeGreaterThan(0);
    expect(new Set(MAIN_INDICATORS).size).toBe(MAIN_INDICATORS.length);
    expect(new Set(SUB_INDICATORS).size).toBe(SUB_INDICATORS.length);
  });

  it("include the core built-ins", () => {
    expect(MAIN_INDICATORS).toContain("MA");
    expect(SUB_INDICATORS).toContain("VOL");
    expect(SUB_INDICATORS).toContain("MACD");
  });
});

describe("INDICATOR_PARAMS", () => {
  it("every entry has a name matching its key and a params array", () => {
    for (const [key, def] of Object.entries(INDICATOR_PARAMS)) {
      expect(def.name).toBe(key);
      expect(Array.isArray(def.params)).toBe(true);
      for (const p of def.params) {
        expect(typeof p.label).toBe("string");
        expect(typeof p.defaultValue).toBe("number");
      }
    }
  });

  it("MACD params default to 12/26/9 (TradingView convention)", () => {
    expect(INDICATOR_PARAMS.MACD.params.map((p) => p.defaultValue)).toEqual([12, 26, 9]);
  });

  it("BOLL params default to period 20, stddev 2", () => {
    expect(INDICATOR_PARAMS.BOLL.params.map((p) => p.defaultValue)).toEqual([20, 2]);
  });
});

describe("candle-types constants", () => {
  it("CANDLE_TYPES lists the standard candle styles", () => {
    const keys = CANDLE_TYPES.map((c) => c.key);
    expect(keys).toContain("candle_solid");
    expect(keys).toContain("ohlc");
    expect(keys).toContain("area");
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("PRICE_AXIS_TYPES / YAXIS_POSITIONS / COMPARE_RULES / TOOLTIP_SHOW_RULES are frozen tuples", () => {
    expect(PRICE_AXIS_TYPES).toEqual(["normal", "percentage", "logarithm"]);
    expect(YAXIS_POSITIONS).toEqual(["left", "right"]);
    expect(COMPARE_RULES).toEqual(["current_open", "prev_close"]);
    expect(TOOLTIP_SHOW_RULES).toEqual(["always", "follow_cross", "none"]);
  });

  it("the derived union types admit exactly the listed values", () => {
    const priceAxis: PriceAxisType[] = [...PRICE_AXIS_TYPES];
    const yAxis: YAxisPosition[] = [...YAXIS_POSITIONS];
    const compare: CompareRule[] = [...COMPARE_RULES];
    const tooltip: TooltipShowRule[] = [...TOOLTIP_SHOW_RULES];
    expect(priceAxis.length + yAxis.length + compare.length + tooltip.length).toBe(10);
  });
});
