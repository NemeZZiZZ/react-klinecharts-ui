import { createContext, useContext } from "react";
import type {
  KlinechartsUIState,
  KlinechartsUIContextValue,
  KlinechartsUIDispatchValue,
} from "./types";

export const KlinechartsUIStateContext =
  createContext<KlinechartsUIState | null>(null);

export const KlinechartsUIDispatchContext =
  createContext<KlinechartsUIDispatchValue | null>(null);

/**
 * @internal
 * Reads only the stable dispatch slice. Hooks that use this won't re-render
 * when chart state changes (e.g. symbol, period, isLoading).
 */
export function useKlinechartsUIDispatch(): KlinechartsUIDispatchValue {
  const ctx = useContext(KlinechartsUIDispatchContext);
  if (!ctx) {
    throw new Error(
      "useKlinechartsUI must be used within a <KlinechartsUIProvider>"
    );
  }
  return ctx;
}

/**
 * Primary hook — returns the full combined context value.
 * For performance-sensitive cases, prefer the two split hooks internally.
 */
export function useKlinechartsUI(): KlinechartsUIContextValue {
  const state = useContext(KlinechartsUIStateContext);
  const dispatch = useContext(KlinechartsUIDispatchContext);
  if (!state || !dispatch) {
    throw new Error(
      "useKlinechartsUI must be used within a <KlinechartsUIProvider>"
    );
  }
  return { state, ...dispatch };
}
