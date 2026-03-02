import { useKlinechartsUI } from "../provider/ChartTerminalContext";

export interface UseKlinechartsUILoadingReturn {
  isLoading: boolean;
}

export function useKlinechartsUILoading(): UseKlinechartsUILoadingReturn {
  const { state } = useKlinechartsUI();
  return { isLoading: state.isLoading };
}
