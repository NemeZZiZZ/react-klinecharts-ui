import type { IndicatorTemplate, KLineData, Indicator } from "react-klinecharts";
import TA from "../utils/TA";

const COLORS = [
  "#001CFF", "#0055FF", "#008CFF", "#00C4FF", "#00FFED",
  "#00FF8E", "#2EFF00", "#B7FF00", "#FFE100", "#FF9100",
  "#FF4400", "#FF0000", "#C4003E", "#8A007B", "#4E00B8",
];

const maRibbon: IndicatorTemplate = {
  name: "MA_Ribbon",
  shortName: "Ribbon",
  series: "price",
  calcParams: [10, 20, 30, 40],
  figures: Array.from({ length: 15 }).map((_, i) => ({
    key: `ma${i}`,
    title: `MA${i + 1}: `,
    type: "line" as const,
    styles: () => ({ color: COLORS[i] }),
  })),
  calc: (dataList: KLineData[], indicator: Indicator) => {
    const params = indicator.calcParams as number[];
    const closes = dataList.map((d) => d.close);
    const count = Math.min(params.length, COLORS.length);

    const emas: (number | null)[][] = [];
    for (let i = 0; i < count; i++) {
      emas.push(TA.ema(closes, params[i]));
    }

    return dataList.map((_, i) => {
      const barData: Record<string, number | null> = {};
      for (let j = 0; j < count; j++) {
        barData[`ma${j}`] = emas[j][i];
      }
      return barData;
    });
  },
};

export default maRibbon;
