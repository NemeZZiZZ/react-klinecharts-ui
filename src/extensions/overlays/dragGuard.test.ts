/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import orderLine from "./orderLine";
import alertLine from "./alertLine";

describe("orderLine/alertLine performEventPressedMove", () => {
  it.each([
    ["orderLine", orderLine],
    ["alertLine", alertLine],
  ])("%s ignores a drag with no points (no TypeError)", (_, template) => {
    const move = (template as any).performEventPressedMove as (
      args: unknown,
    ) => void;
    expect(() =>
      move({ points: [], performPoint: { value: 100 } }),
    ).not.toThrow();
  });

  it.each([
    ["orderLine", orderLine],
    ["alertLine", alertLine],
  ])("%s ignores a drag with no performPoint value", (_, template) => {
    const move = (template as any).performEventPressedMove as (
      args: unknown,
    ) => void;
    const points = [{ value: 100 }];
    expect(() =>
      move({ points, performPoint: {} }),
    ).not.toThrow();
    expect(points[0].value).toBe(100);
  });

  it.each([
    ["orderLine", orderLine],
    ["alertLine", alertLine],
  ])("%s moves the line on a normal drag", (_, template) => {
    const move = (template as any).performEventPressedMove as (
      args: unknown,
    ) => void;
    const points = [{ value: 100 }];
    move({ points, performPoint: { value: 105.5 } });
    expect(points[0].value).toBe(105.5);
  });
});
