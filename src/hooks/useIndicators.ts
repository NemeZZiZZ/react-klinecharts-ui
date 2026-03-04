import { useCallback, useMemo } from "react";
import { useKlinechartsUI, useKlinechartsUIDispatch } from "../provider/ChartTerminalContext";
import {
  MAIN_INDICATORS,
  SUB_INDICATORS,
  INDICATOR_PARAMS,
} from "../data/indicators";

export interface IndicatorInfo {
  name: string;
  isActive: boolean;
}

export interface UseIndicatorsReturn {
  mainIndicators: IndicatorInfo[];
  subIndicators: IndicatorInfo[];
  activeMainIndicators: string[];
  activeSubIndicators: Record<string, string>;
  availableMainIndicators: string[];
  availableSubIndicators: string[];
  addMainIndicator: (name: string) => void;
  removeMainIndicator: (name: string) => void;
  addSubIndicator: (name: string) => void;
  removeSubIndicator: (name: string) => void;
  toggleMainIndicator: (name: string) => void;
  toggleSubIndicator: (name: string) => void;
  moveToMain: (name: string) => void;
  moveToSub: (name: string) => void;
  setIndicatorVisible: (
    name: string,
    isMain: boolean,
    visible: boolean,
  ) => void;
  updateIndicatorParams: (
    name: string,
    paneId: string,
    params: number[],
  ) => void;
  getIndicatorParams: (
    name: string,
  ) => { label: string; defaultValue: number }[];
  isMainIndicatorActive: (name: string) => boolean;
  isSubIndicatorActive: (name: string) => boolean;
}

export function useIndicators(): UseIndicatorsReturn {
  const { state, dispatch } = useKlinechartsUI();
  const { undoRedoListenerRef } = useKlinechartsUIDispatch();

  const mainIndicators = useMemo(() => {
    const activeNames = state.mainIndicators;
    const inactive = MAIN_INDICATORS.filter((n) => !activeNames.includes(n));
    return [
      ...activeNames.map((name) => ({ name, isActive: true })),
      ...inactive.map((name) => ({ name, isActive: false })),
    ];
  }, [state.mainIndicators]);

  const subIndicators = useMemo(() => {
    const activeNames = Object.keys(state.subIndicators);
    const inactive = SUB_INDICATORS.filter((n) => !activeNames.includes(n));
    return [
      ...activeNames.map((name) => ({ name, isActive: true })),
      ...inactive.map((name) => ({ name, isActive: false })),
    ];
  }, [state.subIndicators]);

  const addMainIndicator = useCallback(
    (name: string) => {
      if (state.mainIndicators.includes(name)) return;
      state.chart?.createIndicator(
        { name, id: `main_${name}`, paneId: "candle_pane" },
        true,
        { id: "candle_pane" },
      );
      const newIndicators = [...state.mainIndicators, name];
      dispatch({ type: "SET_MAIN_INDICATORS", indicators: newIndicators });
      undoRedoListenerRef.current?.({
        type: "indicator_toggled",
        data: { name, wasActive: false, isMain: true, paneId: "candle_pane" },
      });
    },
    [state.chart, state.mainIndicators, dispatch, undoRedoListenerRef],
  );

  const removeMainIndicator = useCallback(
    (name: string) => {
      state.chart?.removeIndicator({ id: `main_${name}` });
      const newIndicators = state.mainIndicators.filter((n) => n !== name);
      dispatch({ type: "SET_MAIN_INDICATORS", indicators: newIndicators });
      undoRedoListenerRef.current?.({
        type: "indicator_toggled",
        data: { name, wasActive: true, isMain: true, paneId: "candle_pane" },
      });
    },
    [state.chart, state.mainIndicators, dispatch, undoRedoListenerRef],
  );

  const addSubIndicator = useCallback(
    (name: string) => {
      if (name in state.subIndicators) return;
      const id = `sub_${name}`;
      state.chart?.createIndicator({ name, id });
      const paneId = state.chart?.getIndicators({ id })?.[0]?.paneId ?? "";
      const newIndicators = { ...state.subIndicators, [name]: paneId };
      dispatch({ type: "SET_SUB_INDICATORS", indicators: newIndicators });
      undoRedoListenerRef.current?.({
        type: "indicator_toggled",
        data: { name, wasActive: false, isMain: false, paneId },
      });
    },
    [state.chart, state.subIndicators, dispatch, undoRedoListenerRef],
  );

  const removeSubIndicator = useCallback(
    (name: string) => {
      const paneId = state.subIndicators[name] ?? "";
      state.chart?.removeIndicator({ id: `sub_${name}` });
      const newIndicators = { ...state.subIndicators };
      delete newIndicators[name];
      dispatch({ type: "SET_SUB_INDICATORS", indicators: newIndicators });
      undoRedoListenerRef.current?.({
        type: "indicator_toggled",
        data: { name, wasActive: true, isMain: false, paneId },
      });
    },
    [state.chart, state.subIndicators, dispatch, undoRedoListenerRef],
  );

  const toggleMainIndicator = useCallback(
    (name: string) => {
      if (state.mainIndicators.includes(name)) {
        removeMainIndicator(name);
      } else {
        addMainIndicator(name);
      }
    },
    [state.mainIndicators, addMainIndicator, removeMainIndicator],
  );

  const toggleSubIndicator = useCallback(
    (name: string) => {
      if (name in state.subIndicators) {
        removeSubIndicator(name);
      } else {
        addSubIndicator(name);
      }
    },
    [state.subIndicators, addSubIndicator, removeSubIndicator],
  );

  const setIndicatorVisible = useCallback(
    (name: string, isMain: boolean, visible: boolean) => {
      const id = isMain ? `main_${name}` : `sub_${name}`;
      state.chart?.overrideIndicator({ name, id, visible });
    },
    [state.chart],
  );

  const updateIndicatorParams = useCallback(
    (name: string, paneId: string, params: number[]) => {
      state.chart?.overrideIndicator({ name, paneId, calcParams: params });
    },
    [state.chart],
  );

  const getIndicatorParams = useCallback((name: string) => {
    const config = INDICATOR_PARAMS[name];
    if (!config) return [];
    return config.params.map((p) => ({
      label: p.label,
      defaultValue: p.defaultValue,
    }));
  }, []);

  const moveToMain = useCallback(
    (name: string) => {
      if (!state.chart) return;
      state.chart.removeIndicator({ id: `sub_${name}` });
      state.chart.createIndicator(
        { name, id: `main_${name}`, paneId: "candle_pane" },
        true,
        { id: "candle_pane" },
      );
      const newSub = { ...state.subIndicators };
      delete newSub[name];
      dispatch({ type: "SET_SUB_INDICATORS", indicators: newSub });
      dispatch({
        type: "SET_MAIN_INDICATORS",
        indicators: [...state.mainIndicators, name],
      });
    },
    [state.chart, state.mainIndicators, state.subIndicators, dispatch],
  );

  const moveToSub = useCallback(
    (name: string) => {
      if (!state.chart) return;
      state.chart.removeIndicator({ id: `main_${name}` });
      const subId = `sub_${name}`;
      state.chart.createIndicator({ name, id: subId });
      const paneId =
        state.chart.getIndicators({ id: subId })?.[0]?.paneId ?? "";
      const newMain = state.mainIndicators.filter((n) => n !== name);
      dispatch({ type: "SET_MAIN_INDICATORS", indicators: newMain });
      dispatch({
        type: "SET_SUB_INDICATORS",
        indicators: { ...state.subIndicators, [name]: paneId },
      });
    },
    [state.chart, state.mainIndicators, state.subIndicators, dispatch],
  );

  const isMainIndicatorActive = useCallback(
    (name: string) => state.mainIndicators.includes(name),
    [state.mainIndicators],
  );

  const isSubIndicatorActive = useCallback(
    (name: string) => name in state.subIndicators,
    [state.subIndicators],
  );

  return {
    mainIndicators,
    subIndicators,
    activeMainIndicators: state.mainIndicators,
    activeSubIndicators: state.subIndicators,
    availableMainIndicators: MAIN_INDICATORS,
    availableSubIndicators: SUB_INDICATORS,
    addMainIndicator,
    removeMainIndicator,
    addSubIndicator,
    removeSubIndicator,
    toggleMainIndicator,
    toggleSubIndicator,
    moveToMain,
    moveToSub,
    setIndicatorVisible,
    updateIndicatorParams,
    getIndicatorParams,
    isMainIndicatorActive,
    isSubIndicatorActive,
  };
}
