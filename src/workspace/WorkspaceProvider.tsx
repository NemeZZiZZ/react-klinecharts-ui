import {
  useReducer,
  useMemo,
  useRef,
  type ReactNode,
  type Dispatch,
} from "react";
import type { Chart } from "klinecharts";
import { WorkspaceContext } from "./WorkspaceContext";
import type {
  ChartCell,
  WorkspaceState,
  WorkspaceAction,
  WorkspaceContextValue,
  SyncConfig,
  SyncChannel,
} from "./types";
import { DEFAULT_SYNC_CONFIG } from "./types";

export interface WorkspaceProviderProps {
  /** Initial chart cells for the grid. */
  defaultCells: ChartCell[];
  /** Per-channel sync enable/disable. Defaults to all channels on. */
  sync?: SyncConfig;
  children: ReactNode;
}

function reducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "SET_CELLS":
      return { ...state, cells: action.cells };
    case "ADD_CELL":
      return { ...state, cells: [...state.cells, action.cell] };
    case "REMOVE_CELL": {
      const cells = state.cells.filter((c) => c.id !== action.id);
      return {
        cells,
        activeCellId:
          state.activeCellId === action.id
            ? (cells[0]?.id ?? null)
            : state.activeCellId,
      };
    }
    case "SET_CELL_SYMBOL":
      return {
        ...state,
        cells: state.cells.map((c) =>
          c.id === action.id ? { ...c, symbol: action.symbol } : c,
        ),
      };
    case "SET_CELL_PERIOD":
      return {
        ...state,
        cells: state.cells.map((c) =>
          c.id === action.id ? { ...c, period: action.period } : c,
        ),
      };
    case "SET_ACTIVE_CELL":
      return { ...state, activeCellId: action.id };
    default:
      return state;
  }
}

/**
 * Coordinator above a grid of `<KlinechartsUIProvider>` trees. Holds the
 * workspace layout state (cells, active cell), a chart-instance registry that
 * `useChartSync` populates, and the sync configuration. Charts stay isolated
 * per provider — alerts/replay/drawings are per-cell in this foundation.
 */
export function WorkspaceProvider({
  defaultCells,
  sync,
  children,
}: WorkspaceProviderProps): ReactNode {
  const [state, dispatch] = useReducer(reducer, defaultCells, (cells) => ({
    cells,
    activeCellId: cells[0]?.id ?? null,
  }));

  // Mutable registry — chart instances come and go as cells mount/unmount.
  const chartsRef = useRef<Map<string, Chart>>(new Map());
  // Re-entrancy guard so mirroring doesn't feedback-loop.
  const broadcastingRef = useRef(false);

  const resolvedSync = useMemo<Record<SyncChannel, boolean>>(
    () => ({ ...DEFAULT_SYNC_CONFIG, ...sync }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      state,
      dispatch: dispatch as Dispatch<WorkspaceAction>,
      chartsRef,
      broadcastingRef,
      sync: resolvedSync,
    }),
    [state, resolvedSync],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
