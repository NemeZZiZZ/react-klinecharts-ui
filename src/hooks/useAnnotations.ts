import { useCallback, useEffect, useState } from "react";
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

let annotationCounter = 0;

export function useAnnotations(): UseAnnotationsReturn {
  const { state } = useKlinechartsUI();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  const addAnnotation = useCallback(
    (text: string, price: number, timestamp: number, color?: string): string => {
      const id = `annotation_${++annotationCounter}`;

      const annotation: Annotation = {
        id,
        text,
        price,
        timestamp,
        color,
      };

      setAnnotations((prev) => [...prev, annotation]);

      if (state.chart) {
        state.chart.createOverlay({
          name: "simpleAnnotation",
          id,
          groupId: "annotations",
          points: [{ timestamp, value: price }],
          extendData: text,
          styles: color
            ? {
                text: {
                  color,
                },
              }
            : undefined,
          lock: true,
        });
      }

      return id;
    },
    [state.chart],
  );

  const removeAnnotation = useCallback(
    (id: string) => {
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
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
    }
    setAnnotations([]);
  }, [state.chart, annotations]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      state.chart?.removeOverlay({ groupId: "annotations" });
    };
  }, [state.chart]);

  return {
    annotations,
    addAnnotation,
    removeAnnotation,
    updateAnnotation,
    clearAnnotations,
  };
}
