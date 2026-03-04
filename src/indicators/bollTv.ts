import type { IndicatorTemplate, KLineData, Indicator } from "react-klinecharts";
import TA from "../utils/TA";

const bollTv: IndicatorTemplate = {
  name: "BOLL_TV",
  shortName: "BOLL (TV)",
  calcParams: [20, 2],
  figures: [
    { key: "mid", title: "Mid: ", type: "line" },
    { key: "upper", title: "Upper: ", type: "line" },
    { key: "lower", title: "Lower: ", type: "line" },
  ],
  calc: (dataList: KLineData[], indicator: Indicator) => {
    const period = indicator.calcParams[0] as number;
    const multiplier = indicator.calcParams[1] as number;
    const closes = dataList.map((d) => d.close);
    const { mid, upper, lower } = TA.bollinger(closes, period, multiplier);
    return dataList.map((_, i) => ({
      mid: mid[i],
      upper: upper[i],
      lower: lower[i],
    }));
  },
};

export default bollTv;
