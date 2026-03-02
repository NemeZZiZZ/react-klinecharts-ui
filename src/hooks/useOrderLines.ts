import { useCallback, useRef } from "react";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";
import type { OrderLineExtendData } from "../extensions/overlays/orderLine";

export interface OrderLineOptions extends OrderLineExtendData {
  /** Unique identifier. Auto-generated if omitted. */
  id?: string;
  /** Price level for the line. */
  price: number;
  /** Whether the user can drag the line to change its price. Defaults to false. */
  draggable?: boolean;
  /**
   * Called when the user finishes dragging the line to a new price.
   * Receives the final price value after the drag ends.
   */
  onPriceChange?: (price: number) => void;
}

export interface UseOrderLinesReturn {
  /**
   * Creates an order line overlay at the given price level.
   * Returns the line id, or null if the chart is not yet ready.
   */
  createOrderLine: (options: OrderLineOptions) => string | null;
  /**
   * Updates an existing order line.
   * Supply only the fields you want to change.
   * Updating onPriceChange replaces the previous callback.
   */
  updateOrderLine: (
    id: string,
    options: Partial<Omit<OrderLineOptions, "id">>,
  ) => void;
  /** Removes the order line with the given id. */
  removeOrderLine: (id: string) => void;
  /** Removes all order lines created with this hook. */
  removeAllOrderLines: () => void;
}

export function useOrderLines(): UseOrderLinesReturn {
  const { state } = useKlinechartsUI();

  // Map of id → onPriceChange callback. The stable onPressedMoveEnd closure
  // reads from this ref so callbacks can be updated without re-creating overlays.
  const callbacksRef = useRef<Map<string, (price: number) => void>>(new Map());

  const createOrderLine = useCallback(
    (options: OrderLineOptions): string | null => {
      if (!state.chart) return null;
      const {
        id: optId,
        price,
        draggable = false,
        onPriceChange,
        ...extendData
      } = options;
      const id =
        optId ??
        `order_line_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      if (onPriceChange) {
        callbacksRef.current.set(id, onPriceChange);
      }

      // klinecharts needs at least a dataIndex to anchor the point so that
      // needDefaultYAxisFigure can compute the Y coordinate and render the
      // price label on the right axis. We use the last bar's index.
      const dataCount = state.chart.getDataList().length;
      const anchorIndex = dataCount > 0 ? dataCount - 1 : 0;

      state.chart.createOverlay({
        name: "orderLine",
        id,
        points: [{ dataIndex: anchorIndex, value: price }],
        extendData,
        lock: !draggable,
        mode: "normal",
        onPressedMoveEnd: (event) => {
          const newPrice = event.overlay.points[0]?.value;
          if (newPrice != null) {
            callbacksRef.current.get(id)?.(newPrice);
          }
        },
      });
      return id;
    },
    [state.chart],
  );

  const updateOrderLine = useCallback(
    (id: string, options: Partial<Omit<OrderLineOptions, "id">>) => {
      if (!state.chart) return;
      const { price, draggable, onPriceChange, ...extendData } = options;
      const existing = state.chart.getOverlays({ id })?.[0];
      if (!existing) return;

      if (onPriceChange !== undefined) {
        callbacksRef.current.set(id, onPriceChange);
      }

      const dataCount = state.chart.getDataList().length;
      const anchorIndex = dataCount > 0 ? dataCount - 1 : 0;
      state.chart.overrideOverlay({
        id,
        ...(price != null
          ? { points: [{ dataIndex: anchorIndex, value: price }] }
          : {}),
        ...(draggable != null ? { lock: !draggable } : {}),
        extendData: {
          ...(existing.extendData as OrderLineExtendData),
          ...extendData,
        },
      });
    },
    [state.chart],
  );

  const removeOrderLine = useCallback(
    (id: string) => {
      state.chart?.removeOverlay({ id });
      callbacksRef.current.delete(id);
    },
    [state.chart],
  );

  const removeAllOrderLines = useCallback(() => {
    state.chart?.removeOverlay({ name: "orderLine" });
    callbacksRef.current.clear();
  }, [state.chart]);

  return {
    createOrderLine,
    updateOrderLine,
    removeOrderLine,
    removeAllOrderLines,
  };
}
