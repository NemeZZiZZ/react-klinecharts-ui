import { describe, it, expect } from "vitest";
import ray from "./ray";
import { getRayLine } from "./utils";

const BOUNDING = { width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600 };

describe("ray overlay — degenerate anchors (R10)", () => {
  it("identical points produce no figure instead of a NaN line", () => {
    const figures = ray.createPointFigures!({
      coordinates: [
        { x: 100, y: 100 },
        { x: 100, y: 100 },
      ],
      bounding: BOUNDING,
    } as never) as unknown[];
    expect(figures).toEqual([]);
  });

  it("distinct points still produce the extended line", () => {
    const figures = ray.createPointFigures!({
      coordinates: [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ],
      bounding: BOUNDING,
    } as never) as { attrs: { coordinates: { x: number; y: number }[] } }[];
    expect(figures).toHaveLength(1);
    const [a, b] = figures[0]!.attrs.coordinates;
    expect(a).toEqual({ x: 100, y: 100 });
    expect(b.x).toBe(800);
    expect(Number.isFinite(b.y)).toBe(true);
  });
});

describe("getRayLine — degenerate anchors (R10)", () => {
  it("identical points return no figures (slope branch would be 0/0)", () => {
    const out = getRayLine(
      [
        { x: 50, y: 50 },
        { x: 50, y: 50 },
      ],
      BOUNDING as never,
    );
    expect(out).toEqual([]);
  });
});
