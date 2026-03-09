import { useState, useCallback, useEffect, useRef } from "react";
import {
  useKlinechartsUI,
  type DepthOverlayExtendData,
  type DepthOverlayRow,
} from "react-klinecharts-ui";

const OVERLAY_ID = "__depth_overlay__";

function useDepthOverlay() {
  const { state } = useKlinechartsUI();
  const overlayCreatedRef = useRef(false);

  const ensureOverlay = useCallback(() => {
    if (!state.chart || overlayCreatedRef.current) return;
    const dataList = state.chart.getDataList();
    const lastTimestamp = dataList?.[dataList.length - 1]?.timestamp;
    if (!lastTimestamp) return;

    state.chart.createOverlay({
      id: OVERLAY_ID,
      name: "depthOverlay",
      groupId: "depthOverlay",
      lock: true,
      visible: true,
      zLevel: -1,
      points: [{ timestamp: lastTimestamp, value: 0 }],
      extendData: { rows: [], maxQty: 1 },
    } as any);
    overlayCreatedRef.current = true;
  }, [state.chart]);

  const removeOverlay = useCallback(() => {
    if (!state.chart || !overlayCreatedRef.current) return;
    try {
      state.chart.removeOverlay({ id: OVERLAY_ID } as any);
    } catch {
      // ignore
    }
    overlayCreatedRef.current = false;
  }, [state.chart]);

  const updateData = useCallback(
    (bids: [number, number][], asks: [number, number][]) => {
      if (!state.chart) return;
      if (!overlayCreatedRef.current) ensureOverlay();
      if (!overlayCreatedRef.current) return;

      const rows: DepthOverlayRow[] = [];
      let maxQty = 0;
      for (const [price, qty] of asks) {
        rows.push({ price, qty, side: "ask" });
        if (qty > maxQty) maxQty = qty;
      }
      for (const [price, qty] of bids) {
        rows.push({ price, qty, side: "bid" });
        if (qty > maxQty) maxQty = qty;
      }

      state.chart.overrideOverlay({
        id: OVERLAY_ID,
        extendData: { rows, maxQty } satisfies DepthOverlayExtendData,
      } as any);
    },
    [state.chart, ensureOverlay],
  );

  useEffect(() => {
    return () => {
      if (overlayCreatedRef.current && state.chart) {
        try {
          state.chart.removeOverlay({ id: OVERLAY_ID } as any);
        } catch {
          // ignore
        }
        overlayCreatedRef.current = false;
      }
    };
  }, [state.chart]);

  return { ensureOverlay, removeOverlay, updateData };
}

export function DepthOverlayManager({ isActive }: { isActive: boolean }) {
  const { state } = useKlinechartsUI();
  const ticker = state.symbol?.ticker ?? "BTCUSDT";
  const { ensureOverlay, removeOverlay, updateData } = useDepthOverlay();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAndPush = useCallback(async () => {
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/depth?symbol=${ticker}&limit=20`,
      );
      if (!res.ok) return;
      const raw: { bids: [string, string][]; asks: [string, string][] } =
        await res.json();

      const bids: [number, number][] = raw.bids.map(([p, q]) => [
        parseFloat(p),
        parseFloat(q),
      ]);
      const asks: [number, number][] = raw.asks.map(([p, q]) => [
        parseFloat(p),
        parseFloat(q),
      ]);

      updateData(bids, asks);
    } catch {
      // ignore
    }
  }, [ticker, updateData]);

  useEffect(() => {
    if (isActive) {
      ensureOverlay();
      fetchAndPush();
      intervalRef.current = setInterval(fetchAndPush, 1000);
    } else {
      removeOverlay();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, ensureOverlay, removeOverlay, fetchAndPush]);

  return null;
}
