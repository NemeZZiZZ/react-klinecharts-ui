import type { OverlayTemplate } from "klinecharts";

const ray: OverlayTemplate = {
  name: "ray",
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, bounding }: any) => {
    if (coordinates.length > 1) {
      const coordinate = (() => {
        if (
          coordinates[0].x === coordinates[1].x &&
          coordinates[0].y !== coordinates[1].y
        ) {
          return coordinates[0].y < coordinates[1].y
            ? { x: coordinates[0].x, y: bounding.height }
            : { x: coordinates[0].x, y: 0 };
        }
        const x = coordinates[0].x < coordinates[1].x ? bounding.width : 0;
        const y =
          ((coordinates[1].y - coordinates[0].y) /
            (coordinates[1].x - coordinates[0].x)) *
            (x - coordinates[0].x) +
          coordinates[0].y;
        return { x, y };
      })();
      return [
        {
          type: "line",
          attrs: { coordinates: [coordinates[0], coordinate] },
        },
      ];
    }
    return [];
  },
};

export default ray;
