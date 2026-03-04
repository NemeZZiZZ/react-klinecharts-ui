import type { OverlayTemplate } from "react-klinecharts";

const fibRetracement: OverlayTemplate = {
  name: "fibRetracement",
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, bounding }: any) => {
    if (coordinates.length > 1) {
      const lines: any[] = [];
      const texts: any[] = [];
      const x1 = coordinates[0].x;
      const x2 = bounding.width;
      const y1 = coordinates[0].y;
      const y2 = coordinates[1].y;
      const diff = y2 - y1;
      const levels = [
        { level: 0, text: "0 (0.00%)" },
        { level: 0.236, text: "0.236 (23.6%)" },
        { level: 0.382, text: "0.382 (38.2%)" },
        { level: 0.5, text: "0.5 (50.0%)" },
        { level: 0.618, text: "0.618 (61.8%)" },
        { level: 0.786, text: "0.786 (78.6%)" },
        { level: 1, text: "1 (100.0%)" },
      ];
      levels.forEach((l) => {
        const y = y1 + diff * l.level;
        lines.push({ coordinates: [{ x: x1, y }, { x: x2, y }] });
        texts.push({
          x: x1,
          y,
          text: l.text,
          align: "left",
          baseline: "bottom",
        });
      });
      return [
        { type: "line", attrs: lines },
        { type: "text", attrs: texts },
      ];
    }
    return [];
  },
};

export default fibRetracement;
