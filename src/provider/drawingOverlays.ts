import type { Chart } from "klinecharts";

/**
 * Group id shared by `useDrawingTools`, `useUndoRedo` and layout
 * serialization. Only overlays in this group are user drawings — alert lines
 * ("price_alerts"), order lines, annotations and the depth overlay live in
 * their own subsystems and must never be listed, overridden or wiped as
 * drawings.
 */
export const DRAWING_GROUP_ID = "drawing_tools";

/**
 * Реактивный snapshot одного рисунка из группы `drawing_tools`.
 * Поля соответствуют публичным свойствам `Overlay` в klinecharts v10.
 */
export interface DrawingOverlayInfo {
  /** Stable id из klinecharts (chart.getOverlays()[].id). */
  id: string;
  /** Имя overlay'я, напр. "segment", "fibonacciLine", "arrow". */
  name: string;
  /** Pane id, где нарисован. */
  paneId: string;
  /** Текущее состояние блокировки. */
  locked: boolean;
  /** Текущая видимость. */
  visible: boolean;
}

/**
 * Прочитать текущий список рисунков группы `drawing_tools`.
 * Возвращает `[]` для отсутствующего чарта — вызывающий код (polling в
 * провайдере, refresh после мутации) не должен делать ветвление на null.
 */
export function readDrawingOverlays(
  chart: Chart | null | undefined,
): DrawingOverlayInfo[] {
  if (!chart) return [];
  const list = chart.getOverlays({ groupId: DRAWING_GROUP_ID }) as any[];
  if (!list) return [];
  return list.map((o) => ({
    id: o.id,
    name: o.name,
    paneId: o.paneId,
    locked: !!o.lock,
    visible: o.visible !== false, // klinecharts default = true
  }));
}

/**
 * Сравнить два snapshot'а по полям, которые видит потребитель.
 * Polling тикает раз в секунду: без этого сравнения каждый тик подменял бы
 * массив и ререндерил дерево даже когда рисунки не менялись.
 */
export function drawingOverlaysEqual(
  a: DrawingOverlayInfo[],
  b: DrawingOverlayInfo[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.name !== y.name ||
      x.paneId !== y.paneId ||
      x.locked !== y.locked ||
      x.visible !== y.visible
    ) {
      return false;
    }
  }
  return true;
}
