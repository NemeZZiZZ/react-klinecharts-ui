import type { OverlayTemplate } from "klinecharts";

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
  // Dragging vertex 0/1 keeps the shared edge horizontal: both anchor points
  // follow the dragged price level. klinecharts points carry `value` (not
  // `price`) — the previous `.price` assignment silently no-oped and leaked
  // an undefined `price` key into persisted overlay JSON.
  performEventPressedMove: ({ points, performPointIndex, performPoint }) => {
    if (performPointIndex < 2 && performPoint.value !== undefined) {
      if (points[0]) points[0].value = performPoint.value;
      if (points[1]) points[1].value = performPoint.value;
    }
  },
  performEventMoveForDrawing: ({ currentStep, points, performPoint }) => {
    if (currentStep === 2 && performPoint.value !== undefined) {
      if (points[0]) points[0].value = performPoint.value;
    }
  },
};

export default parallelogram;
