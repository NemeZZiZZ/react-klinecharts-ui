import { useCallback, useEffect, useRef, useState } from "react";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";

export interface Annotation {
  id: string;
  text: string;
  price: number;
  timestamp: number;
  color?: string;
}

export interface UseAnnotationsReturn {
  annotations: Annotation[];
  addAnnotation: (
    text: string,
    price: number,
    timestamp: number,
    color?: string,
  ) => string;
  removeAnnotation: (id: string) => void;
  updateAnnotation: (
    id: string,
    updates: Partial<Pick<Annotation, "text" | "color">>,
  ) => void;
  clearAnnotations: () => void;
}

// See useAlerts: a bare module counter restarts on every page load and could
// mint an id that a hydrated entry already uses.
const ANNOTATION_ID_SESSION = Math.random().toString(36).slice(2, 8);
let annotationCounter = 0;

/** Overlay descriptor for an annotation — shared by add and reconciliation. */
function annotationOverlay(annotation: Annotation) {
  return {
    name: "simpleAnnotation",
    id: annotation.id,
    groupId: "annotations",
    points: [{ timestamp: annotation.timestamp, value: annotation.price }],
    extendData: annotation.text,
    styles: annotation.color ? { text: { color: annotation.color } } : undefined,
    lock: true,
  };
}

export function useAnnotations(): UseAnnotationsReturn {
  const { state } = useKlinechartsUI();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  // Ids of the overlays created by THIS instance. The groupId "annotations"
  // is a module constant shared by every useAnnotations instance on the
  // chart, so an unmount cleanup keyed by groupId wiped sibling instances'
  // overlays while their React state still listed them.
  const ownedIdsRef = useRef<Set<string>>(new Set());

  const addAnnotation = useCallback(
    (text: string, price: number, timestamp: number, color?: string): string => {
      const id = `annotation_${ANNOTATION_ID_SESSION}_${++annotationCounter}`;
      ownedIdsRef.current.add(id);

      const annotation: Annotation = {
        id,
        text,
        price,
        timestamp,
        color,
      };

      setAnnotations((prev) => [...prev, annotation]);

      // NOTE: when the chart is not ready yet the annotation still lands in
      // state — the reconciliation effect below creates its overlay as soon as
      // a chart instance appears.
      if (state.chart) {
        state.chart.createOverlay(
          annotationOverlay({ id, text, price, timestamp, color }),
        );
      }

      return id;
    },
    [state.chart],
  );

  const removeAnnotation = useCallback(
    (id: string) => {
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      ownedIdsRef.current.delete(id);
      state.chart?.removeOverlay({ id });
    },
    [state.chart],
  );

  const updateAnnotation = useCallback(
    (id: string, updates: Partial<Pick<Annotation, "text" | "color">>) => {
      setAnnotations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...updates } : a)),
      );

      if (state.chart) {
        const overrideData: Record<string, any> = { id };

        if (updates.text !== undefined) {
          overrideData.extendData = updates.text;
        }

        if (updates.color !== undefined) {
          overrideData.styles = {
            text: {
              color: updates.color,
            },
          };
        }

        state.chart.overrideOverlay(overrideData as any);
      }
    },
    [state.chart],
  );

  const clearAnnotations = useCallback(() => {
    // Perform chart side effects outside the setState updater: React 18/19 may
    // invoke updaters more than once (StrictMode, concurrent rendering), which
    // would otherwise call removeOverlay multiple times.
    for (const annotation of annotations) {
      state.chart?.removeOverlay({ id: annotation.id });
      ownedIdsRef.current.delete(annotation.id);
    }
    setAnnotations([]);
  }, [state.chart, annotations]);

  // Clean up on unmount — only the overlays created by THIS instance (see
  // ownedIdsRef above).
  useEffect(() => {
    const chart = state.chart;
    const owned = ownedIdsRef.current;
    return () => {
      owned.forEach((id) => {
        try {
          chart?.removeOverlay({ id });
        } catch {
          // overlay may already be gone
        }
      });
    };
  }, [state.chart]);

  // Reconcile: annotations added before the chart existed, whose chart was
  // remounted, or that were edited while the chart was briefly unavailable
  // (updateAnnotation then skipped overrideOverlay — its chart-only update
  // made the remount revert to the stale text/color) live in state but have
  // no/fresh overlays. Recreate the missing ones from the CURRENT state
  // entries whenever the chart instance or the list changes (mirrors the
  // provider's alert-line reconciliation).
  useEffect(() => {
    const chart = state.chart;
    if (!chart) return;
    for (const annotation of annotations) {
      if (chart.getOverlays({ id: annotation.id }).length > 0) continue;
      chart.createOverlay(annotationOverlay(annotation));
      ownedIdsRef.current.add(annotation.id);
    }
  }, [state.chart, annotations]);

  return {
    annotations,
    addAnnotation,
    removeAnnotation,
    updateAnnotation,
    clearAnnotations,
  };
}
