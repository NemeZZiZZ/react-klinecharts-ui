import { useCallback, useMemo } from "react";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";
import { TIMEZONES } from "../data/timezones";

export interface TimezoneItem {
  key: string;
  localeKey: string;
}

export interface UseTimezoneReturn {
  timezones: TimezoneItem[];
  activeTimezone: string;
  setTimezone: (timezone: string) => void;
}

export function useTimezone(): UseTimezoneReturn {
  const { state, dispatch } = useKlinechartsUI();

  const timezones = useMemo(
    () =>
      TIMEZONES.map((tz) => ({
        key: tz.key,
        localeKey: tz.localeKey,
      })),
    []
  );

  const setTimezone = useCallback(
    (timezone: string) => {
      state.chart?.setTimezone(timezone);
      dispatch({ type: "SET_TIMEZONE", timezone });
    },
    [state.chart, dispatch]
  );

  return {
    timezones,
    activeTimezone: state.timezone,
    setTimezone,
  };
}
