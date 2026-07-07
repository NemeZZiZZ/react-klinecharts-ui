import { describe, it, expect } from "vitest";
import type { OverlayTemplate } from "klinecharts";
import {
  getRotateCoordinate,
  getDistance,
  getRayLine,
} from "./utils";
import * as overlays from "./index";

describe("getDistance", () => {
  it("is the Euclidean distance", () => {
    expect(getDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(getDistance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
  });

  it("is symmetric", () => {
    const a = { x: 2, y: 7 };
    const b = { x: 9, y: 1 };
    expect(getDistance(a, b)).toBeCloseTo(getDistance(b, a), 10);
  });
});

describe("getRotateCoordinate", () => {
  it("rotates a point 90° counterclockwise around the origin", () => {
    const r = getRotateCoordinate({ x: 1, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);
    expect(r.x).toBeCloseTo(0, 10);
    expect(r.y).toBeCloseTo(1, 10);
  });

  it("rotates 180° around a non-origin pivot", () => {
    const r = getRotateCoordinate({ x: 2, y: 0 }, { x: 1, y: 0 }, Math.PI);
    expect(r.x).toBeCloseTo(0, 10);
    expect(r.y).toBeCloseTo(0, 10);
  });

  it("returns the point unchanged when the angle is 0", () => {
    const r = getRotateCoordinate({ x: 5, y: 7 }, { x: 1, y: 1 }, 0);
    expect(r.x).toBeCloseTo(5, 10);
    expect(r.y).toBeCloseTo(7, 10);
  });
});

describe("getRayLine", () => {
  const bounding = { width: 1000, height: 500 } as never;

  it("returns [] for fewer than 2 coordinates", () => {
    expect(getRayLine([], bounding)).toEqual([]);
    expect(getRayLine([{ x: 0, y: 0 }], bounding)).toEqual([]);
  });

  it("extends a horizontal line to the bottom edge when going down", () => {
    const out = getRayLine(
      [
        { x: 5, y: 10 },
        { x: 5, y: 20 },
      ],
      bounding,
    ) as { coordinates: { x: number; y: number }[] };
    expect(out.coordinates[1]).toEqual({ x: 5, y: 500 });
  });

  it("extends a horizontal line to the top edge when going up", () => {
    const out = getRayLine(
      [
        { x: 5, y: 20 },
        { x: 5, y: 10 },
      ],
      bounding,
    ) as { coordinates: { x: number; y: number }[] };
    expect(out.coordinates[1]).toEqual({ x: 5, y: 0 });
  });
});

describe("overlays package contract", () => {
  const all = overlays as unknown as Record<string, OverlayTemplate>;

  it("exports a non-empty set of templates", () => {
    expect(Object.keys(all).length).toBeGreaterThanOrEqual(20);
  });

  it("every template has a name matching its export key and totalStep >= 2", () => {
    for (const [key, tpl] of Object.entries(all)) {
      expect(tpl.name).toBe(key);
      expect(typeof tpl.name).toBe("string");
      expect(tpl.totalStep).toBeGreaterThanOrEqual(2);
      expect(typeof tpl.createPointFigures).toBe("function");
    }
  });

  it("includes the canonical drawing tools", () => {
    const keys = Object.keys(all);
    for (const required of [
      "rect",
      "circle",
      "triangle",
      "arrow",
      "measure",
      "longPosition",
      "shortPosition",
      "parallelChannel",
      "fibRetracement",
    ]) {
      expect(keys).toContain(required);
    }
  });

  it("longPosition and shortPosition use totalStep 4 (3 interactive points)", () => {
    // regression for the round-1 unreachable-stop bug
    expect(all.longPosition.totalStep).toBe(4);
    expect(all.shortPosition.totalStep).toBe(4);
  });
});
