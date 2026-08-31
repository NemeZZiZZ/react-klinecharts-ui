import type { OverlayTemplate } from "klinecharts";

const elliottWave: OverlayTemplate = {
  name: "elliottWave",
  // A 5-wave Elliott pattern needs 6 anchor points (start + waves 1-5), and
  // klinecharts totalStep = points + 1, so 7. With totalStep 6 only 5 points
  // were collected and the "(5)" label branch below was unreachable.
  // (fiveWaves.ts already uses 7 for the same shape.)
  totalStep: 7,
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
