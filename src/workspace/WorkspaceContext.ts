import { createContext, useContext } from "react";
import type { WorkspaceContextValue } from "./types";

/**
 * Workspace context — sits ABOVE the `KlinechartsUIProvider` trees. A
 * `useChartSync(cellId)` bridge inside each provider registers its chart into
 * the shared registry and mirrors viewport/crosshair events to siblings.
 */
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/**
 * Read the workspace context. Throws if used outside a `<WorkspaceProvider>`.
 */
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a <WorkspaceProvider>");
  }
  return ctx;
}
