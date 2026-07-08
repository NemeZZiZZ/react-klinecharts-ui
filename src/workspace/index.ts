export { WorkspaceProvider, type WorkspaceProviderProps } from "./WorkspaceProvider";
export { useWorkspace } from "./WorkspaceContext";
export { useChartSync, type UseChartSyncOptions } from "./useChartSync";
export type {
  ChartCell,
  WorkspaceState,
  WorkspaceAction,
  WorkspaceContextValue,
  SyncChannel,
  SyncConfig,
} from "./types";
export { DEFAULT_SYNC_CONFIG } from "./types";
