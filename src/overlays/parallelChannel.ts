import type { OverlayTemplate } from "react-klinecharts";

const parallelChannel: OverlayTemplate = {
  name: "parallelChannel",
  totalStep: 4,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates }: any) => {
    if (coordinates.length > 1) {
      const p1 = coordinates[0];
      const p2 = coordinates[1];
      const p3 = coordinates[2] || p2;

      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;

      const p4 = {
        x: p3.x + dx,
        y: p3.y + dy,
      };

      return [
        {
          type: "line",
          attrs: [
            { coordinates: [p1, p2] },
            { coordinates: [p3, p4] },
            { coordinates: [p1, p4] },
            { coordinates: [p2, p3] },
          ],
        },
        {
          type: "polygon",
          attrs: { coordinates: [p1, p2, p3, p4] },
          styles: { style: "fill" },
        },
      ];
    }
    return [];
  },
};

export default parallelChannel;
