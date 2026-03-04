import type { IndicatorTemplate, KLineData, Indicator } from "react-klinecharts";

const ichimoku: IndicatorTemplate = {
  name: "Ichimoku",
  shortName: "Ichimoku",
  calcParams: [9, 26, 52, 26],
  figures: [
    { key: "tenkan", title: "Tenkan: ", type: "line" },
    { key: "kijun", title: "Kijun: ", type: "line" },
    { key: "chikou", title: "Chikou: ", type: "line" },
    { key: "spanA", title: "Span A: ", type: "line" },
    { key: "spanB", title: "Span B: ", type: "line" },
  ],
  calc: (dataList: KLineData[], indicator: Indicator) => {
    const params = indicator.calcParams as number[];
    const tenkanPeriod = params[0];
    const kijunPeriod = params[1];
    const spanBPeriod = params[2];
    const offset = params[3];

    const highLowAvg = (data: KLineData[], start: number, end: number) => {
      let high = -Infinity;
      let low = Infinity;
      for (let i = start; i <= end; i++) {
        high = Math.max(high, data[i].high);
        low = Math.min(low, data[i].low);
      }
      return (high + low) / 2;
    };

    return dataList.map((_kLineData: KLineData, index: number) => {
      const item: Record<string, number | null> = {
        tenkan: null,
        kijun: null,
        chikou: null,
        spanA: null,
        spanB: null,
      };

      if (index >= tenkanPeriod - 1) {
        item.tenkan = highLowAvg(
          dataList,
          index - tenkanPeriod + 1,
          index,
        );
      }

      if (index >= kijunPeriod - 1) {
        item.kijun = highLowAvg(dataList, index - kijunPeriod + 1, index);
      }

      if (index + offset < dataList.length) {
        item.chikou = dataList[index + offset].close;
      }

      const prevIndex = index - offset;
      if (prevIndex >= 0) {
        const prevTenkan =
          prevIndex >= tenkanPeriod - 1
            ? highLowAvg(dataList, prevIndex - tenkanPeriod + 1, prevIndex)
            : null;
        const prevKijun =
          prevIndex >= kijunPeriod - 1
            ? highLowAvg(dataList, prevIndex - kijunPeriod + 1, prevIndex)
            : null;

        if (prevTenkan !== null && prevKijun !== null) {
          item.spanA = (prevTenkan + prevKijun) / 2;
        }

        if (prevIndex >= spanBPeriod - 1) {
          item.spanB = highLowAvg(
            dataList,
            prevIndex - spanBPeriod + 1,
            prevIndex,
          );
        }
      }

      return item;
    });
  },
};

export default ichimoku;
