import type { OverlayTemplate } from "klinecharts";

const gannFan: OverlayTemplate = {
  name: "gannFan",
  // klinecharts totalStep = points + 1: the fan needs 2 points (anchor +
  // slope reference), so totalStep must be 3. With totalStep 2 the drawing
  // finished after a single click, p2 fell back to p1, dx/dy were 0 and all
  // nine ratio lines degenerated into one horizontal line through p1.
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, bounding }: any) => {
    if (coordinates.length > 0) {
      const p1 = coordinates[0];
      const p2 = coordinates[1] || p1;
      const lines: any[] = [];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;

      const ratios = [8, 4, 3, 2, 1, 0.5, 0.333, 0.25, 0.125];

      ratios.forEach((ratio) => {
        const targetX = bounding.width;
        const targetY =
          p1.y + dy * (ratio * ((targetX - p1.x) / (dx || 1)));
        lines.push({ coordinates: [p1, { x: targetX, y: targetY }] });
      });

      return [{ type: "line", attrs: lines }];
    }
    return [];
  },
};

export default gannFan;
