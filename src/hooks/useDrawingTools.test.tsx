import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { KlinechartsUIProvider } from "../provider/ChartTerminalProvider";
import { renderHookWithProvider } from "../../test/renderHook";
import { fakeDatafeed } from "../../test/renderHook";
import { useDrawingTools, drawingLabel } from "./useDrawingTools";

// Fake timers: per-drawing API запускает polling-fallback (setInterval 1s),
// который вне act() вызывает React-варнинги. Замораживаем таймеры, чтобы
// snapshot обновлялся только через явные операции (точечный апдейт).
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/**
 * Симулировать завершение рисования: достаёт onDrawEnd из последнего вызова
 * `chart.createOverlay` и вызывает его с синтетическим event'ом. mock сам не
 * эмитит onDrawEnd (это делают клики пользователя на канвасе).
 */
function finishDrawing(
  chart: ReturnType<typeof renderHookWithProvider>["chart"],
  overlay: { id: string; name: string; points?: unknown[]; styles?: unknown; extendData?: unknown },
) {
  // createOverlay принимает один аргумент (cfg), поэтому calls[i][0] — это cfg.
  const calls = chart.createOverlay.mock.calls as unknown as Array<
    [{ onDrawEnd?: (event: { overlay: Record<string, unknown> }) => void }]
  >;
  const last = [...calls].reverse().find((c) => typeof c[0]?.onDrawEnd === "function");
  if (!last || !last[0].onDrawEnd) {
    throw new Error("finishDrawing: не найден onDrawEnd в createOverlay calls");
  }
  act(() => {
    last[0].onDrawEnd!({
      overlay: {
        id: overlay.id,
        name: overlay.name,
        points: overlay.points ?? [],
        styles: overlay.styles ?? {},
        extendData: overlay.extendData ?? null,
      },
    });
  });
}

describe("useDrawingTools — per-drawing API", () => {
  it("overlays пуст после mount (нет рисунков в группе)", () => {
    const { result } = renderHookWithProvider(() => useDrawingTools());
    expect(result.current.overlays).toEqual([]);
  });

  it("после создания рисунка (selectTool + onDrawEnd) overlays содержит один элемент", () => {
    const { result, chart } = renderHookWithProvider(() => useDrawingTools());

    // Отключаем auto-retrigger, чтобы onDrawEnd не запустил ещё один overlay.
    act(() => result.current.setAutoRetrigger(false));
    act(() => result.current.selectTool("segment"));

    // mock createOverlay возвращает сгенерированный id (ovl_1).
    const id = chart.createOverlay.mock.results[0].value as string;
    finishDrawing(chart, { id, name: "segment" });

    expect(result.current.overlays).toHaveLength(1);
    expect(result.current.overlays[0]).toMatchObject({
      id,
      name: "segment",
      locked: false,
      visible: true,
    });
  });

  it("removeDrawing(id) удаляет элемент из overlays и вызывает chart.removeOverlay", () => {
    const { result, chart } = renderHookWithProvider(() => useDrawingTools());
    act(() => result.current.setAutoRetrigger(false));
    act(() => result.current.selectTool("segment"));
    const id = chart.createOverlay.mock.results[0].value as string;
    finishDrawing(chart, { id, name: "segment" });
    expect(result.current.overlays).toHaveLength(1);

    chart.removeOverlay.mockClear();
    act(() => result.current.removeDrawing(id));

    expect(result.current.overlays).toHaveLength(0);
    expect(chart.removeOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ id, groupId: "drawing_tools" }),
    );
  });

  it("setDrawingVisible(id, false) прячет overlay и вызывает overrideOverlay", () => {
    const { result, chart } = renderHookWithProvider(() => useDrawingTools());
    act(() => result.current.setAutoRetrigger(false));
    act(() => result.current.selectTool("circle"));
    const id = chart.createOverlay.mock.results[0].value as string;
    finishDrawing(chart, { id, name: "circle" });

    chart.overrideOverlay.mockClear();
    act(() => result.current.setDrawingVisible(id, false));

    const target = result.current.overlays.find((o) => o.id === id);
    expect(target?.visible).toBe(false);
    expect(chart.overrideOverlay).toHaveBeenCalledWith({ id, visible: false });
  });

  it("setDrawingLocked(id, true) блокирует overlay и вызывает overrideOverlay", () => {
    const { result, chart } = renderHookWithProvider(() => useDrawingTools());
    act(() => result.current.setAutoRetrigger(false));
    act(() => result.current.selectTool("arrow"));
    const id = chart.createOverlay.mock.results[0].value as string;
    finishDrawing(chart, { id, name: "arrow" });

    chart.overrideOverlay.mockClear();
    act(() => result.current.setDrawingLocked(id, true));

    const target = result.current.overlays.find((o) => o.id === id);
    expect(target?.locked).toBe(true);
    expect(chart.overrideOverlay).toHaveBeenCalledWith({ id, lock: true });
  });

  it("изоляция группы: overlay с другим groupId не появляется в overlays и не удаляется removeDrawing", () => {
    const { result, chart } = renderHookWithProvider(() => useDrawingTools());

    // Создаём чужой overlay напрямую через mock chart (имитация orderLine).
    // Приводим к any — MockChart.createOverlay это vitest Mock, но хук
    // рассматривает его как метод Chart; в тестах нам нужен прямой вызов.
    const chartAny = chart as any;
    act(() => {
      chartAny.createOverlay({
        name: "orderLine",
        id: "foreign_1",
        groupId: "order_lines",
        lock: false,
        visible: true,
      });
    });

    // Наш рисунок.
    act(() => result.current.setAutoRetrigger(false));
    act(() => result.current.selectTool("segment"));
    // Идём от последнего результата (selectTool только что создал overlay).
    const results = chart.createOverlay.mock.results;
    const ourId = results[results.length - 1].value as string;
    finishDrawing(chart, { id: ourId, name: "segment" });

    // В overlays только наш рисунок, чужого нет.
    expect(result.current.overlays).toHaveLength(1);
    expect(result.current.overlays[0].id).toBe(ourId);

    // removeDrawing(наш id) не должен трогать чужой.
    const foreignBefore = chartAny.getOverlays({ groupId: "order_lines" });
    expect(foreignBefore).toHaveLength(1);
    act(() => result.current.removeDrawing(ourId));
    const foreignAfter = chartAny.getOverlays({ groupId: "order_lines" });
    expect(foreignAfter).toHaveLength(1);
    expect(foreignAfter[0].id).toBe("foreign_1");
  });

  it("no-op при state.chart === null: 3 операции не throw", () => {
    // Кастомный рендер без регистрации mock chart → state.chart остаётся null.
    const wrapper = ({ children }: { children: ReactNode }) => (
      <KlinechartsUIProvider datafeed={fakeDatafeed([])}>
        {children}
      </KlinechartsUIProvider>
    );
    const { result } = renderHook(() => useDrawingTools(), { wrapper });

    expect(() => {
      act(() => result.current.removeDrawing("any"));
    }).not.toThrow();
    expect(() => {
      act(() => result.current.setDrawingVisible("any", false));
    }).not.toThrow();
    expect(() => {
      act(() => result.current.setDrawingLocked("any", true));
    }).not.toThrow();
    expect(result.current.overlays).toEqual([]);
  });
});

describe("drawingLabel", () => {
  it("возвращает localeKey для известного имени инструмента", () => {
    expect(drawingLabel("segment")).toBe("segment");
    expect(drawingLabel("fibonacciLine")).toBe("fibonacci_line");
    expect(drawingLabel("horizontalStraightLine")).toBe("horizontal_straight_line");
  });

  it("fallback на само имя для неизвестного инструмента", () => {
    expect(drawingLabel("unknown_tool")).toBe("unknown_tool");
  });
});
