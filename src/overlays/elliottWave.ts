import type { OverlayTemplate } from "react-klinecharts";

const elliottWave: OverlayTemplate = {
  name: "elliottWave",
  totalStep: 6,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates }: any) => {
    if (coordinates.length > 1) {
      const lines: any[] = [];
      const texts: any[] = [];
      for (let i = 0; i < coordinates.length - 1; i++) {
        lines.push({
          coordinates: [coordinates[i], coordinates[i + 1]],
        });
        texts.push({
          ...coordinates[i],
          text: `(${i})`,
          align: "center",
          baseline: "bottom",
        });
      }
      if (coordinates.length === 6) {
        texts.push({
          ...coordinates[5],
          text: "(5)",
          align: "center",
          baseline: "bottom",
        });
      }
      return [
        { type: "line", attrs: lines },
        { type: "text", attrs: texts },
      ];
    }
    return [];
  },
};

export default elliottWave;
