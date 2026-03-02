import { useCallback } from "react";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";
import type { TerminalPeriod } from "../data/periods";

export interface UsePeriodsReturn {
  periods: TerminalPeriod[];
  activePeriod: TerminalPeriod;
  setPeriod: (period: TerminalPeriod) => void;
}

export function usePeriods(): UsePeriodsReturn {
  const { state, dispatch } = useKlinechartsUI();

  const setPeriod = useCallback(
    (period: TerminalPeriod) => {
      dispatch({ type: "SET_PERIOD", period });
    },
    [dispatch]
  );

  return {
    periods: state.periods,
    activePeriod: state.period,
    setPeriod,
  };
}
