import type { OverlayTemplate } from "react-klinecharts";

const threeWaves: OverlayTemplate = {
  name: "threeWaves",
  totalStep: 5,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates }) => {
    const texts = coordinates.map((coordinate, i) => ({
      ...coordinate,
      text: `(${i})`,
      baseline: "bottom" as const,
    }));
    return [
      { type: "line", attrs: { coordinates } },
      { type: "text", ignoreEvent: true, attrs: texts },
    ];
  },
};

export default threeWaves;
