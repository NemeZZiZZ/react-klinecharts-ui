import type { IndicatorTemplate, KLineData, Indicator } from "react-klinecharts";
import TA from "../utils/TA";

/**
 * TradingView-style RSI with RMA-based calculation,
 * dashed level lines at 70/50/30, and gradient fills.
 */
const rsiTv: IndicatorTemplate = {
  name: "RSI_TV",
  shortName: "RSI (TV)",
  calcParams: [14, 14],
  figures: [
    {
      key: "rsi",
      title: "RSI: ",
      type: "line",
      styles: () => ({ color: "#7E57C2", size: 1.5 }),
    },
    {
      key: "rsi_ma",
      title: "MA: ",
      type: "line",
      styles: () => ({ color: "#FFEE58", size: 1.2 }),
    },
  ],
  calc: (dataList: KLineData[], indicator: Indicator) => {
    const rsiPeriod = indicator.calcParams[0] as number;
    const maPeriod = indicator.calcParams[1] as number;
    const closes = dataList.map((d) => d.close);

    const rsiValues = TA.rsi(closes, rsiPeriod);
    const nonNullRsi = rsiValues.map((v) => v ?? 0);
    const maValues = TA.sma(nonNullRsi, maPeriod);

    return dataList.map((_, i) => {
      const rsi = rsiValues[i];
      const rsi_ma =
        rsi !== null && maValues[i] !== null ? maValues[i] : null;
      return { rsi, rsi_ma };
    });
  },
  draw: ({
    ctx,
    chart,
    indicator,
    bounding,
    yAxis,
  }: any): boolean => {
    const { from, to } = chart.getVisibleRange();
    const barSpace = chart.getBarSpace();
    const resultData = indicator.result as Array<{
      rsi: number | null;
    } | null>;

    const y70 = yAxis.convertToPixel(70);
    const y50 = yAxis.convertToPixel(50);
    const y30 = yAxis.convertToPixel(30);

    const left = bounding.left;
    const right = bounding.left + bounding.width;

    const getX = (i: number): number =>
      right - barSpace.halfBar - (to - 1 - i) * barSpace.bar;

    ctx.save();

    const fillZone = (
      yThreshold: number,
      above: boolean,
      gradFrom: string,
      gradTo: string,
    ) => {
      const compare = above
        ? (v: number) => v > 70
        : (v: number) => v < 30;

      let i = from;
      while (i < to) {
        while (i < to) {
          const d = resultData[i];
          const v = d?.rsi;
          if (v !== null && v !== undefined && compare(v)) break;
          i++;
        }
        if (i >= to) break;

        const pts: { x: number; y: number }[] = [];
        while (i < to) {
          const d = resultData[i];
          const v = d?.rsi;
          if (v === null || v === undefined || !compare(v)) break;
          pts.push({ x: getX(i), y: yAxis.convertToPixel(v) });
          i++;
        }
        if (pts.length === 0) continue;

        ctx.beginPath();
        ctx.moveTo(pts[0].x, yThreshold);
        for (const p of pts) ctx.lineTo(p.x, p.y);
        ctx.lineTo(pts[pts.length - 1].x, yThreshold);
        ctx.closePath();

        const gradY1 = yThreshold;
        const gradY2 = above
          ? Math.min(...pts.map((p) => p.y)) - 5
          : Math.max(...pts.map((p) => p.y)) + 5;
        const grad = ctx.createLinearGradient(0, gradY1, 0, gradY2);
        grad.addColorStop(0, gradFrom);
        grad.addColorStop(1, gradTo);

        ctx.globalAlpha = 1;
        ctx.fillStyle = grad;
        ctx.fill();
      }
    };

    fillZone(
      y70,
      true,
      "rgba(239,83,80,0.0)",
      "rgba(239,83,80,0.35)",
    );
    fillZone(
      y30,
      false,
      "rgba(38,166,154,0.0)",
      "rgba(38,166,154,0.35)",
    );

    const drawDash = (y: number, color: string, alpha: number) => {
      ctx.beginPath();
      ctx.globalAlpha = alpha;
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    };

    ctx.globalAlpha = 1;
    drawDash(y70, "#EF5350", 0.7);
    drawDash(y30, "#26A69A", 0.7);
    drawDash(y50, "#aaaaaa", 0.3);

    ctx.restore();
    return false;
  },
};

export default rsiTv;
