import type { OverlayTemplate } from "react-klinecharts";

const ray: OverlayTemplate = {
  name: "ray",
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, bounding }: any) => {
    if (coordinates.length > 1) {
      let coordinate = { x: 0, y: 0 };
      if (
        coordinates[0].x === coordinates[1].x &&
        coordinates[0].y !== coordinates[1].y
      ) {
        if (coordinates[0].y < coordinates[1].y) {
          coordinate = { x: coordinates[0].x, y: bounding.height };
        } else {
          coordinate = { x: coordinates[0].x, y: 0 };
        }
      } else {
        const x =
          coordinates[0].x < coordinates[1].x ? bounding.width : 0;
        const y =
          ((coordinates[1].y - coordinates[0].y) /
            (coordinates[1].x - coordinates[0].x)) *
            (x - coordinates[0].x) +
          coordinates[0].y;
        coordinate = { x, y };
      }
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
