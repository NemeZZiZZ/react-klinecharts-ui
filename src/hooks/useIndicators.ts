import { useCallback, useMemo, useRef } from "react";
import type { YAxisOverride } from "klinecharts";
import { useKlinechartsUI, useKlinechartsUIDispatch } from "../provider/ChartTerminalContext";
import {
  MAIN_INDICATORS,
  SUB_INDICATORS,
  INDICATOR_PARAMS,
} from "../data/indicators";

export interface IndicatorInfo {
  name: string;
  isActive: boolean;
  /**
   * Whether the indicator is currently visible on the chart. Defaults to
   * `true`; only `false` after the indicator has been hidden via
   * `setIndicatorVisible` or `collapseSubIndicator`. Meaningful only when
   * `isActive` is `true` (inactive indicators are always reported `true`).
   */
  visible: boolean;
}

/** Options accepted when adding an indicator. */
export interface AddIndicatorOptions {
  /**
   * Bind the indicator to a custom Y-axis (klinecharts v10 multiple y-axes).
   * Provide a stable `id` to create/share a secondary axis; e.g.
   * `{ id: "rsi_axis", position: "left" }`. Omit to use the pane's default
   * (shared) axis.
   */
  yAxis?: YAxisOverride;
}

export interface UseIndicatorsReturn {
  mainIndicators: IndicatorInfo[];
  subIndicators: IndicatorInfo[];
  activeMainIndicators: string[];
  activeSubIndicators: Record<string, string>;
  availableMainIndicators: string[];
  availableSubIndicators: string[];
  addMainIndicator: (name: string, options?: AddIndicatorOptions) => void;
  removeMainIndicator: (name: string) => void;
  addSubIndicator: (name: string, options?: AddIndicatorOptions) => void;
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
  /**
   * Read whether an indicator is currently visible. Returns `true` for the
   * default (un-toggled) state and for inactive indicators. This is the
   * reactive read counterpart to `setIndicatorVisible` — UI no longer needs to
   * track visibility locally or reach into the chart instance.
   */
  isIndicatorVisible: (name: string, isMain: boolean) => boolean;
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
  /** Collapse a sub-indicator pane to minimal height (30px). */
  collapseSubIndicator: (name: string) => void;
  /** Expand a previously collapsed sub-indicator pane to its prior height. */
  expandSubIndicator: (name: string) => void;
  /** Whether the given sub-indicator pane is currently collapsed. */
  isSubIndicatorCollapsed: (name: string) => boolean;
  /** Reorder a sub-indicator pane up or down relative to other sub-indicators. */
  reorderSubIndicator: (name: string, direction: "up" | "down") => void;
  /**
   * Custom Y-axis bindings, keyed by indicator id (`main_<name>` /
   * `sub_<name>`). Only contains indicators bound to a secondary axis.
   */
  indicatorAxes: Record<string, string>;
  /** Get the custom `yAxisId` an indicator is bound to, or `undefined` for the default axis. */
  getIndicatorAxis: (name: string, isMain: boolean) => string | undefined;
  /**
   * Visibility overrides keyed by indicator id (`main_<name>` / `sub_<name>`).
   * Only contains indicators hidden away from the default; an absent key means
   * visible. Mirror of the provider state, exposed for layout-preset
   * persistence and direct rendering.
   */
  indicatorVisibility: Record<string, boolean>;
  /**
   * Rebind an existing indicator to a different Y-axis. Because klinecharts v10
   * `overrideIndicator` cannot change axis binding, this removes and recreates
   * the indicator (preserving calc params, styles and visibility).
   * Pass `yAxis` to bind to a secondary axis, or omit it to return the
   * indicator to the pane's default (shared) axis.
   */
  bindIndicatorToNewAxis: (
    name: string,
    isMain: boolean,
    yAxis?: YAxisOverride,
  ) => void;
}

const COLLAPSED_HEIGHT = 30;

export function useIndicators(): UseIndicatorsReturn {
  const { state, dispatch } = useKlinechartsUI();
  const { undoRedoListenerRef } = useKlinechartsUIDispatch();

  // Track original pane heights for collapse/expand
  const paneHeightsRef = useRef<Record<string, number>>({});
  const collapsedPanesRef = useRef<Set<string>>(new Set());

  const mainIndicators = useMemo(() => {
    const activeNames = state.mainIndicators;
    const inactive = MAIN_INDICATORS.filter((n) => !activeNames.includes(n));
    return [
      ...activeNames.map((name) => ({
        name,
        isActive: true,
        visible: state.indicatorVisibility[`main_${name}`] ?? true,
      })),
      ...inactive.map((name) => ({ name, isActive: false, visible: true })),
    ];
  }, [state.mainIndicators, state.indicatorVisibility]);

  const subIndicators = useMemo(() => {
    const activeNames = Object.keys(state.subIndicators);
    const inactive = SUB_INDICATORS.filter((n) => !activeNames.includes(n));
    return [
      ...activeNames.map((name) => ({
        name,
        isActive: true,
        visible: state.indicatorVisibility[`sub_${name}`] ?? true,
      })),
      ...inactive.map((name) => ({ name, isActive: false, visible: true })),
    ];
  }, [state.subIndicators, state.indicatorVisibility]);

  const addMainIndicator = useCallback(
    (name: string, options?: AddIndicatorOptions) => {
      if (state.mainIndicators.includes(name)) return;
      const yAxis = options?.yAxis;
      state.chart?.createIndicator(
        { name, id: `main_${name}` },
        { isStack: true, pane: { id: "candle_pane" }, yAxis },
      );
      const newIndicators = [...state.mainIndicators, name];
      dispatch({ type: "SET_MAIN_INDICATORS", indicators: newIndicators });
      if (yAxis?.id) {
        dispatch({
          type: "SET_INDICATOR_AXES",
          axes: { ...state.indicatorAxes, [`main_${name}`]: yAxis.id },
        });
      }
      undoRedoListenerRef.current?.({
        type: "indicator_toggled",
        data: {
          name,
          wasActive: false,
          isMain: true,
          paneId: "candle_pane",
          yAxisId: yAxis?.id,
        },
      });
    },
    [state.chart, state.mainIndicators, state.indicatorAxes, dispatch, undoRedoListenerRef],
  );

  const removeMainIndicator = useCallback(
    (name: string) => {
      const id = `main_${name}`;
      const yAxisId = state.indicatorAxes[id];
      state.chart?.removeIndicator({ id });
      const newIndicators = state.mainIndicators.filter((n) => n !== name);
      dispatch({ type: "SET_MAIN_INDICATORS", indicators: newIndicators });
      if (yAxisId) {
        const nextAxes = { ...state.indicatorAxes };
        delete nextAxes[id];
        dispatch({ type: "SET_INDICATOR_AXES", axes: nextAxes });
      }
      if (id in state.indicatorVisibility) {
        const nextVisibility = { ...state.indicatorVisibility };
        delete nextVisibility[id];
        dispatch({ type: "SET_INDICATOR_VISIBILITY", visibility: nextVisibility });
      }
      undoRedoListenerRef.current?.({
        type: "indicator_toggled",
        data: { name, wasActive: true, isMain: true, paneId: "candle_pane", yAxisId },
      });
    },
    [
      state.chart,
      state.mainIndicators,
      state.indicatorAxes,
      state.indicatorVisibility,
      dispatch,
      undoRedoListenerRef,
    ],
  );

  const addSubIndicator = useCallback(
    (name: string, options?: AddIndicatorOptions) => {
      if (name in state.subIndicators) return;
      const id = `sub_${name}`;
      const yAxis = options?.yAxis;
      state.chart?.createIndicator({ name, id }, { yAxis });
      const paneId = state.chart?.getIndicators({ id })?.[0]?.paneId ?? "";
      const newIndicators = { ...state.subIndicators, [name]: paneId };
      dispatch({ type: "SET_SUB_INDICATORS", indicators: newIndicators });
      if (yAxis?.id) {
        dispatch({
          type: "SET_INDICATOR_AXES",
          axes: { ...state.indicatorAxes, [id]: yAxis.id },
        });
      }
      undoRedoListenerRef.current?.({
        type: "indicator_toggled",
        data: { name, wasActive: false, isMain: false, paneId, yAxisId: yAxis?.id },
      });
    },
    [state.chart, state.subIndicators, state.indicatorAxes, dispatch, undoRedoListenerRef],
  );

  const removeSubIndicator = useCallback(
    (name: string) => {
      const id = `sub_${name}`;
      const paneId = state.subIndicators[name] ?? "";
      const yAxisId = state.indicatorAxes[id];
      state.chart?.removeIndicator({ id });
      const newIndicators = { ...state.subIndicators };
      delete newIndicators[name];
      dispatch({ type: "SET_SUB_INDICATORS", indicators: newIndicators });
      if (yAxisId) {
        const nextAxes = { ...state.indicatorAxes };
        delete nextAxes[id];
        dispatch({ type: "SET_INDICATOR_AXES", axes: nextAxes });
      }
      if (id in state.indicatorVisibility) {
        const nextVisibility = { ...state.indicatorVisibility };
        delete nextVisibility[id];
        dispatch({ type: "SET_INDICATOR_VISIBILITY", visibility: nextVisibility });
      }
      undoRedoListenerRef.current?.({
        type: "indicator_toggled",
        data: { name, wasActive: true, isMain: false, paneId, yAxisId },
      });
    },
    [
      state.chart,
      state.subIndicators,
      state.indicatorAxes,
      state.indicatorVisibility,
      dispatch,
      undoRedoListenerRef,
    ],
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
      // Mirror into provider state so `isIndicatorVisible` / the `visible`
      // field stay reactive. Keep the map sparse: drop the key when visible
      // (the default) instead of storing `true`.
      const nextVisibility = { ...state.indicatorVisibility };
      if (visible) delete nextVisibility[id];
      else nextVisibility[id] = false;
      dispatch({ type: "SET_INDICATOR_VISIBILITY", visibility: nextVisibility });
    },
    [state.chart, state.indicatorVisibility, dispatch],
  );

  const isIndicatorVisible = useCallback(
    (name: string, isMain: boolean) =>
      state.indicatorVisibility[isMain ? `main_${name}` : `sub_${name}`] ?? true,
    [state.indicatorVisibility],
  );

  const updateIndicatorParams = useCallback(
    // `paneId` is kept in the signature for API stability; klinecharts v10
    // `overrideIndicator` no longer accepts it and targets by name/id instead.
    (name: string, _paneId: string, params: number[]) => {
      state.chart?.overrideIndicator({ name, calcParams: params });
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
      const prevCalcParams =
        state.chart.getIndicators({ id: `sub_${name}` })?.[0]?.calcParams;
      state.chart.removeIndicator({ id: `sub_${name}` });
      state.chart.createIndicator(
        {
          name,
          id: `main_${name}`,
          ...(prevCalcParams ? { calcParams: prevCalcParams } : {}),
        },
        { isStack: true, pane: { id: "candle_pane" } },
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
      const prevCalcParams =
        state.chart.getIndicators({ id: `main_${name}` })?.[0]?.calcParams;
      state.chart.removeIndicator({ id: `main_${name}` });
      const subId = `sub_${name}`;
      state.chart.createIndicator({
        name,
        id: subId,
        ...(prevCalcParams ? { calcParams: prevCalcParams } : {}),
      });
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

  const collapseSubIndicator = useCallback(
    (name: string) => {
      const paneId = state.subIndicators[name];
      if (!state.chart || !paneId) return;

      const currentSize = (state.chart as any).getSize?.(paneId);
      if (currentSize?.height && currentSize.height > COLLAPSED_HEIGHT) {
        paneHeightsRef.current[paneId] = currentSize.height;
      }
      collapsedPanesRef.current.add(paneId);

      (state.chart as any).setPaneOptions?.({
        id: paneId,
        height: COLLAPSED_HEIGHT,
      });
      const id = `sub_${name}`;
      state.chart.overrideIndicator({ name, id, visible: false });
      dispatch({
        type: "SET_INDICATOR_VISIBILITY",
        visibility: { ...state.indicatorVisibility, [id]: false },
      });
    },
    [state.chart, state.subIndicators, state.indicatorVisibility, dispatch],
  );

  const expandSubIndicator = useCallback(
    (name: string) => {
      const paneId = state.subIndicators[name];
      if (!state.chart || !paneId) return;

      const savedHeight = paneHeightsRef.current[paneId] ?? 100;
      collapsedPanesRef.current.delete(paneId);

      (state.chart as any).setPaneOptions?.({
        id: paneId,
        height: savedHeight,
      });
      const id = `sub_${name}`;
      state.chart.overrideIndicator({ name, id, visible: true });
      const nextVisibility = { ...state.indicatorVisibility };
      delete nextVisibility[id];
      dispatch({ type: "SET_INDICATOR_VISIBILITY", visibility: nextVisibility });
    },
    [state.chart, state.subIndicators, state.indicatorVisibility, dispatch],
  );

  const isSubIndicatorCollapsed = useCallback(
    (name: string) => {
      const paneId = state.subIndicators[name];
      return paneId ? collapsedPanesRef.current.has(paneId) : false;
    },
    [state.subIndicators],
  );

  const reorderSubIndicator = useCallback(
    (name: string, direction: "up" | "down") => {
      if (!state.chart) return;

      const subNames = Object.keys(state.subIndicators);
      const idx = subNames.indexOf(name);
      if (idx === -1) return;

      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= subNames.length) return;

      // Collect full indicator state for all sub-indicators
      const subStates = subNames.map((n) => {
        const id = `sub_${n}`;
        const indicator = state.chart!.getIndicators({ id })?.[0];
        return {
          name: n,
          calcParams: indicator?.calcParams,
          visible: indicator?.visible ?? true,
          styles: indicator?.styles,
          paneId: state.subIndicators[n],
        };
      });

      // Swap the two entries
      [subStates[idx], subStates[swapIdx]] = [subStates[swapIdx], subStates[idx]];

      // Remove all sub-indicators
      for (const n of subNames) {
        state.chart!.removeIndicator({ id: `sub_${n}` });
      }

      // Recreate in new order
      const newSubIndicators: Record<string, string> = {};
      for (const sub of subStates) {
        const id = `sub_${sub.name}`;
        state.chart!.createIndicator({
          name: sub.name,
          id,
          ...(sub.calcParams ? { calcParams: sub.calcParams } : {}),
          visible: sub.visible,
        });
        const paneId =
          state.chart!.getIndicators({ id })?.[0]?.paneId ?? "";
        newSubIndicators[sub.name] = paneId;

        if (sub.styles) {
          state.chart!.overrideIndicator({
            name: sub.name,
            id,
            styles: sub.styles,
          });
        }
      }

      dispatch({ type: "SET_SUB_INDICATORS", indicators: newSubIndicators });
    },
    [state.chart, state.subIndicators, dispatch],
  );

  const getIndicatorAxis = useCallback(
    (name: string, isMain: boolean) =>
      state.indicatorAxes[isMain ? `main_${name}` : `sub_${name}`],
    [state.indicatorAxes],
  );

  const bindIndicatorToNewAxis = useCallback(
    (name: string, isMain: boolean, yAxis?: YAxisOverride) => {
      if (!state.chart) return;
      const id = isMain ? `main_${name}` : `sub_${name}`;
      const current = state.chart.getIndicators({ id })?.[0];
      if (!current) return;

      // Snapshot the indicator before recreating it on a different axis.
      const calcParams = current.calcParams;
      const styles = current.styles;
      const visible = current.visible ?? true;
      // Main indicators live on the candle pane; sub-indicators keep their pane.
      const paneId = isMain
        ? "candle_pane"
        : (current.paneId ?? state.subIndicators[name] ?? "");

      state.chart.removeIndicator({ id });
      state.chart.createIndicator(
        {
          name,
          id,
          ...(calcParams ? { calcParams } : {}),
          visible,
        },
        {
          isStack: isMain,
          ...(paneId ? { pane: { id: paneId } } : {}),
          yAxis,
        },
      );
      if (styles) {
        state.chart.overrideIndicator({ name, id, styles });
      }

      const nextAxes = { ...state.indicatorAxes };
      if (yAxis?.id) nextAxes[id] = yAxis.id;
      else delete nextAxes[id];
      dispatch({ type: "SET_INDICATOR_AXES", axes: nextAxes });
    },
    [state.chart, state.indicatorAxes, state.subIndicators, dispatch],
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
    isIndicatorVisible,
    updateIndicatorParams,
    getIndicatorParams,
    isMainIndicatorActive,
    isSubIndicatorActive,
    collapseSubIndicator,
    expandSubIndicator,
    isSubIndicatorCollapsed,
    reorderSubIndicator,
    indicatorAxes: state.indicatorAxes,
    getIndicatorAxis,
    indicatorVisibility: state.indicatorVisibility,
    bindIndicatorToNewAxis,
  };
}
