import type { OverlayTemplate } from "react-klinecharts";

const parallelogram: OverlayTemplate = {
  name: "parallelogram",
  totalStep: 4,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  styles: { polygon: { color: "rgba(22, 119, 255, 0.15)" } },
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length === 2) {
      return [{ type: "line", ignoreEvent: true, attrs: { coordinates } }];
    }
    if (coordinates.length === 3) {
      const coordinate = {
        x: coordinates[0].x + (coordinates[2].x - coordinates[1].x),
        y: coordinates[2].y - coordinates[1].y + coordinates[0].y,
      };
      return [
        {
          type: "polygon",
          attrs: {
            coordinates: [
              coordinates[0],
              coordinates[1],
              coordinates[2],
              coordinate,
            ],
          },
          styles: { style: "stroke_fill" },
        },
      ];
    }
    return [];
  },
  performEventPressedMove: ({ points, performPointIndex, performPoint }) => {
    if (performPointIndex < 2) {
      if (points[0]) (points[0] as any).price = (performPoint as any).price;
      if (points[1]) (points[1] as any).price = (performPoint as any).price;
    }
  },
  performEventMoveForDrawing: ({ currentStep, points, performPoint }) => {
    if (currentStep === 2) {
      if (points[0]) (points[0] as any).price = (performPoint as any).price;
    }
  },
};

export default parallelogram;
