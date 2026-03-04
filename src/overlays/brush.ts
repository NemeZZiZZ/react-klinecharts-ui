import type { OverlayTemplate } from "react-klinecharts";
import { registerFigure } from "react-klinecharts";

function getSqSegDist(
  p: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
) {
  let x = p1.x;
  let y = p1.y;
  let dx = p2.x - x;
  let dy = p2.y - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = p2.x;
      y = p2.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = p.x - x;
  dy = p.y - y;
  return dx * dx + dy * dy;
}

function rdp(points: { x: number; y: number }[], epsilon: number) {
  const len = points.length;
  if (len <= 2) return points;

  const sqEpsilon = epsilon * epsilon;
  const markers = new Uint8Array(len);
  markers[0] = markers[len - 1] = 1;

  const stack: [number, number][] = [[0, len - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let maxSqDist = 0;
    let index = 0;

    for (let i = first + 1; i < last; i++) {
      const sqDist = getSqSegDist(points[i], points[first], points[last]);
      if (sqDist > maxSqDist) {
        maxSqDist = sqDist;
        index = i;
      }
    }

    if (maxSqDist > sqEpsilon) {
      markers[index] = 1;
      stack.push([first, index]);
      stack.push([index, last]);
    }
  }

  const result: { x: number; y: number }[] = [];
  for (let i = 0; i < len; i++) {
    if (markers[i]) result.push(points[i]);
  }
  return result;
}

registerFigure({
  name: "brush_path",
  draw: (ctx: CanvasRenderingContext2D, attrs: any, styles: any) => {
    const { coordinates } = attrs;
    if (coordinates.length < 2) return;

    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = styles.color || "#f00";
    ctx.lineWidth = styles.size || 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(coordinates[0].x, coordinates[0].y);

    if (coordinates.length === 2) {
      ctx.lineTo(coordinates[1].x, coordinates[1].y);
    } else {
      for (let i = 1; i < coordinates.length - 2; i++) {
        const xc = (coordinates[i].x + coordinates[i + 1].x) / 2;
        const yc = (coordinates[i].y + coordinates[i + 1].y) / 2;
        ctx.quadraticCurveTo(coordinates[i].x, coordinates[i].y, xc, yc);
      }
      const last = coordinates.length - 2;
      ctx.quadraticCurveTo(
        coordinates[last].x,
        coordinates[last].y,
        coordinates[last + 1].x,
        coordinates[last + 1].y,
      );
    }

    ctx.stroke();
    ctx.restore();
  },
  checkEventOn: (
    coordinate: { x: number; y: number },
    attrs: any,
    styles: any,
  ) => {
    const { coordinates } = attrs;
    if (!coordinates || coordinates.length < 2) return false;

    const radius = (styles?.size ?? 2) / 2 + 4;
    const sqRadius = radius * radius;

    for (let i = 0; i < coordinates.length - 1; i++) {
      const sqDist = getSqSegDist(
        coordinate,
        coordinates[i],
        coordinates[i + 1],
      );
      if (sqDist <= sqRadius) return true;
    }
    return false;
  },
});

interface BrushDataPoint {
  timestamp: number;
  value: number;
}

interface BrushData {
  pixels: Array<{ x: number; y: number }>;
  points: BrushDataPoint[];
  isDirty: boolean;
  paneId?: string;
}

const brush: OverlayTemplate = {
  name: "brush",
  totalStep: 3,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  onDrawing: (params: any) => {
    const { overlay, x, y } = params;
    const paneId = params.paneId;
    if (x === undefined || y === undefined) return true;
    if (overlay.currentStep !== 2) return true;

    if (!overlay.extendData) {
      overlay.extendData = {
        pixels: [],
        points: [],
        isDirty: false,
        paneId,
      } as BrushData;
    }

    const data = overlay.extendData as BrushData;
    if (data.paneId && data.paneId !== paneId) return true;

    const lastPixel = data.pixels[data.pixels.length - 1];
    if (lastPixel) {
      const dx = x - lastPixel.x;
      const dy = y - lastPixel.y;
      if (dx * dx + dy * dy < 4) return true;
    }

    data.pixels.push({ x, y });
    return true;
  },
  onDrawEnd: (params: any) => {
    const { overlay } = params;
    const data = overlay.extendData as BrushData | undefined;
    if (data) {
      data.isDirty = true;
    }
    return true;
  },
  createPointFigures: ({ overlay, xAxis, yAxis, defaultStyles }: any) => {
    const data = overlay.extendData as BrushData | undefined;
    if (!data || !xAxis || !yAxis) return [];

    if (data.pixels.length > 0) {
      for (const p of data.pixels) {
        data.points.push({
          timestamp: xAxis.convertFromPixel(p.x),
          value: yAxis.convertFromPixel(p.y),
        });
      }
      data.pixels = [];
    }

    let { points } = data;

    if (data.isDirty && points.length > 2) {
      const pixelPoints = points.map((p) => ({
        x: xAxis.convertToPixel(p.timestamp),
        y: yAxis.convertToPixel(p.value),
      }));

      const simplified = rdp(pixelPoints, 1.5);

      data.points = simplified.map((p) => ({
        timestamp: xAxis.convertFromPixel(p.x),
        value: yAxis.convertFromPixel(p.y),
      }));
      points = data.points;
      data.isDirty = false;
    }

    if (points.length < 2) return [];

    const coordinates = points.map((p) => ({
      x: xAxis.convertToPixel(p.timestamp),
      y: yAxis.convertToPixel(p.value),
    }));

    return [
      {
        type: "brush_path",
        attrs: { coordinates },
        styles: {
          color:
            overlay.styles?.line?.color ??
            defaultStyles?.line?.color ??
            "#1677ff",
          size:
            overlay.styles?.line?.size ?? defaultStyles?.line?.size ?? 2,
        },
      },
    ];
  },
};

export default brush;
