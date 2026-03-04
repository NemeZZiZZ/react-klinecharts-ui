import type { OverlayTemplate } from "react-klinecharts";

const gannFan: OverlayTemplate = {
  name: "gannFan",
  totalStep: 2,
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
