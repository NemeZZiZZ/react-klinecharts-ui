import type { OverlayTemplate } from "react-klinecharts";

const anyWaves: OverlayTemplate = {
  name: "anyWaves",
  totalStep: Number.MAX_SAFE_INTEGER,
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

export default anyWaves;
