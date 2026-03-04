import type { IndicatorTemplate, KLineData, Indicator } from "react-klinecharts";
import TA from "../utils/TA";

const cci: IndicatorTemplate = {
  name: "CCI_TV",
  shortName: "CCI",
  calcParams: [20],
  figures: [{ key: "cci", title: "CCI: ", type: "line" }],
  calc: (dataList: KLineData[], indicator: Indicator) => {
    const period = indicator.calcParams[0] as number;
    const highs = dataList.map((d) => d.high);
    const lows = dataList.map((d) => d.low);
    const closes = dataList.map((d) => d.close);
    const cciValues = TA.cci(highs, lows, closes, period);
    return cciValues.map((v) => ({ cci: v }));
  },
};

export default cci;
