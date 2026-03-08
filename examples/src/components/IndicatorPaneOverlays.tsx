import { useState, useEffect, useCallback, useMemo } from "react";
import { useKlinechartsUI, useIndicators } from "react-klinecharts-ui";
import { useKLineChart, Widget } from "react-klinecharts";
import type { Chart } from "react-klinecharts";
import { Eye, EyeOff, PanelTop, PanelBottom, Settings2, X, ChevronUp, ChevronDown, Minimize2, Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// --- Indicator settings dialog ---

interface SettingsTarget {
  name: string;
  paneId: string;
  calcParams: number[];
}

function IndicatorSettingsDialog({
  target,
  paramLabels,
  onUpdate,
  onClose,
}: {
  target: SettingsTarget;
  paramLabels: { label: string; defaultValue: number }[];
  onUpdate: (name: string, paneId: string, values: number[]) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState(target.calcParams);

  const handleChange = (index: number, val: string) => {
    const num = Number(val);
    if (isNaN(num)) return;
    const next = [...values];
    next[index] = num;
    setValues(next);
    onUpdate(target.name, target.paneId, next);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{target.name} Settings</DialogTitle>
          <DialogDescription>Adjust calculation parameters.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {values.map((val, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-20 text-sm text-muted-foreground">
                {paramLabels[i]?.label ?? `Param ${i + 1}`}
              </span>
              <Input
                type="number"
                value={val}
                onChange={(e) => handleChange(i, e.target.value)}
                className="h-8 w-24"
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Tooltip layout helpers ---

interface TooltipLayout {
  offsetLeft: number;
  offsetTop: number;
  titleMarginLeft: number;
  titleMarginTop: number;
  titleMarginBottom: number;
  titleSize: number;
  titleFamily: string;
  titleWeight: string;
  titleColor: string;
  legendSize: number;
  legendMarginTop: number;
  legendMarginBottom: number;
  rowHeight: number;
  candleTooltipHeight: number;
}

function getTooltipLayout(chart: Chart): TooltipLayout {
  const indStyles = chart.getStyles().indicator.tooltip;
  const t = indStyles.title;
  const l = indStyles.legend;

  const titleH = (t.marginTop ?? 0) + (t.size ?? 12) + (t.marginBottom ?? 0);
  const legendH = (l.marginTop ?? 0) + (l.size ?? 12) + (l.marginBottom ?? 0);

  // Estimate candle tooltip height (title + OHLCV line).
  // On candle_pane the indicator tooltip is drawn BELOW the candle tooltip.
  const cs = chart.getStyles().candle.tooltip;
  const ct = cs.title;
  const cl = cs.legend;
  let candleH = 0;
  if (ct.show) {
    candleH += (ct.marginTop ?? 0) + (ct.size ?? 12) + (ct.marginBottom ?? 0);
  }
  // In standard showType all price values are drawn on a single row.
  candleH += (cl.marginTop ?? 0) + (cl.size ?? 12) + (cl.marginBottom ?? 0);

  return {
    offsetLeft: indStyles.offsetLeft ?? 8,
    offsetTop: indStyles.offsetTop ?? 6,
    titleMarginLeft: t.marginLeft ?? 6,
    titleMarginTop: t.marginTop ?? 0,
    titleMarginBottom: t.marginBottom ?? 0,
    titleSize: t.size ?? 12,
    titleFamily: t.family ?? "Helvetica Neue",
    titleWeight: String(t.weight ?? "normal"),
    titleColor: t.color ?? "rgba(210,210,210,0.9)",
    legendSize: l.size ?? 12,
    legendMarginTop: l.marginTop ?? 0,
    legendMarginBottom: l.marginBottom ?? 0,
    rowHeight: Math.max(titleH, legendH),
    candleTooltipHeight: candleH,
  };
}

interface NamePosition {
  x: number;
  y: number;
  width: number;
  displayText: string;
  visible: boolean;
}

function calcNamePositions(
  chart: Chart,
  paneId: string,
  indicators: string[],
  layout: TooltipLayout,
): NamePosition[] {
  const ctx = getMeasureCtx();
  ctx.font = `${layout.titleWeight} ${layout.titleSize}px ${layout.titleFamily}`;

  // On candle_pane, indicator tooltip starts AFTER the candle tooltip.
  // On sub-panes, indicator tooltip starts at offsetTop.
  let y =
    paneId === "candle_pane"
      ? layout.offsetTop + layout.candleTooltipHeight
      : layout.offsetTop;

  return indicators.map((name) => {
    const ind = chart.getIndicators({ name, paneId })[0];
    let displayText = ind?.shortName ?? name;
    const params = ind?.calcParams;
    if (params && params.length > 0) {
      displayText += `(${params.join(",")})`;
    }
    const textWidth = ctx.measureText(displayText).width;

    const pos: NamePosition = {
      x: layout.offsetLeft + layout.titleMarginLeft,
      y: y + layout.titleMarginTop,
      width: textWidth,
      displayText,
      visible: ind?.visible !== false,
    };

    y += layout.rowHeight;
    return pos;
  });
}

// --- Offscreen canvas for text measurement (reused across calls) ---

let _measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D {
  if (!_measureCtx) {
    _measureCtx = document.createElement("canvas").getContext("2d")!;
  }
  return _measureCtx;
}

// --- Per-name hover zone ---

const iconBtn =
  "flex items-center border-0 bg-transparent p-0.5 cursor-pointer transition-colors";

function NameHoverZone({
  displayText,
  x,
  y,
  width,
  fontSize,
  fontFamily,
  fontWeight,
  titleColor,
  overlayBg,
  initialVisible,
  isMainPane,
  hasSettings,
  isCollapsed,
  onToggleVisible,
  onMovePane,
  onRemove,
  onOpenSettings,
  onCollapse,
  onReorderUp,
  onReorderDown,
}: {
  displayText: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  titleColor: string;
  overlayBg: string;
  initialVisible: boolean;
  isMainPane: boolean;
  hasSettings: boolean;
  isCollapsed?: boolean;
  onToggleVisible: (visible: boolean) => void;
  onMovePane: () => void;
  onRemove: () => void;
  onOpenSettings: () => void;
  onCollapse?: () => void;
  onReorderUp?: () => void;
  onReorderDown?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [hidden, setHidden] = useState(!initialVisible);
  const [prevVisible, setPrevVisible] = useState(initialVisible);

  // Sync with chart state if visibility changed externally (e.g. from IndicatorDialog)
  if (prevVisible !== initialVisible) {
    setPrevVisible(initialVisible);
    setHidden(!initialVisible);
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute inline-flex items-center gap-1 px-0.75 rounded-[3px] pointer-events-auto z-100 transition-colors duration-100 whitespace-nowrap"
      style={{
        left: x - 3,
        top: y - 2,
        height: fontSize + 2,
        minWidth: width + 4,
        background: hovered ? overlayBg : "transparent",
      }}
    >
      <span
        className={`select-none leading-none ${hidden ? "line-through" : ""}`}
        style={{
          fontSize,
          fontFamily,
          fontWeight: fontWeight as React.CSSProperties["fontWeight"],
          color: hidden ? "rgba(150,150,150,0.5)" : titleColor,
        }}
      >
        {displayText}
      </span>

      {hovered && (
        <>
          <button
            onClick={() => {
              const next = !hidden;
              setHidden(next);
              onToggleVisible(!next);
            }}
            className={`${iconBtn} ${hidden ? "text-[rgba(150,150,150,0.4)]" : "text-[rgba(180,180,180,0.8)]"}`}
            title={hidden ? "Show" : "Hide"}
          >
            {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
          {hasSettings && (
            <button
              onClick={onOpenSettings}
              className={`${iconBtn} text-[rgba(180,180,180,0.8)]`}
              title="Settings"
            >
              <Settings2 size={12} />
            </button>
          )}
          <button
            onClick={onMovePane}
            className={`${iconBtn} text-[rgba(180,180,180,0.8)]`}
            title={isMainPane ? "Move to sub-pane" : "Move to main pane"}
          >
            {isMainPane ? <PanelBottom size={12} /> : <PanelTop size={12} />}
          </button>
          {!isMainPane && onCollapse && (
            <button
              onClick={onCollapse}
              className={`${iconBtn} text-[rgba(180,180,180,0.8)]`}
              title={isCollapsed ? "Expand pane" : "Collapse pane"}
            >
              {isCollapsed ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
            </button>
          )}
          {!isMainPane && onReorderUp && (
            <button
              onClick={onReorderUp}
              className={`${iconBtn} text-[rgba(180,180,180,0.8)]`}
              title="Move up"
            >
              <ChevronUp size={12} />
            </button>
          )}
          {!isMainPane && onReorderDown && (
            <button
              onClick={onReorderDown}
              className={`${iconBtn} text-[rgba(180,180,180,0.8)]`}
              title="Move down"
            >
              <ChevronDown size={12} />
            </button>
          )}
          <button
            onClick={onRemove}
            className={`${iconBtn} text-red-500/70`}
            title="Remove"
          >
            <X size={12} />
          </button>
        </>
      )}
    </div>
  );
}

// --- Pane overlay container ---

function PaneOverlay({
  indicators,
  paneId,
  chart,
  layout,
  overlayBg,
  isMainPane,
  getIndicatorParams,
  onRemove,
  onToggleVisible,
  onMovePane,
  onOpenSettings,
  isCollapsed,
  onCollapse,
  onReorderUp,
  onReorderDown,
}: {
  indicators: string[];
  paneId: string;
  chart: Chart;
  layout: TooltipLayout;
  overlayBg: string;
  isMainPane: boolean;
  getIndicatorParams: (
    name: string,
  ) => { label: string; defaultValue: number }[];
  onRemove: (name: string) => void;
  onToggleVisible: (name: string, visible: boolean) => void;
  onMovePane: (name: string) => void;
  onOpenSettings: (name: string, paneId: string) => void;
  isCollapsed?: (name: string) => boolean;
  onCollapse?: (name: string) => void;
  onReorderUp?: (name: string) => void;
  onReorderDown?: (name: string) => void;
}) {
  const positions = useMemo(
    () => calcNamePositions(chart, paneId, indicators, layout),
    [chart, paneId, indicators, layout],
  );

  return (
    <>
      {indicators.map((name, i) => (
        <NameHoverZone
          key={name}
          displayText={positions[i].displayText}
          x={positions[i].x}
          y={positions[i].y}
          width={positions[i].width}
          fontSize={layout.titleSize}
          fontFamily={layout.titleFamily}
          fontWeight={layout.titleWeight}
          titleColor={layout.titleColor}
          overlayBg={overlayBg}
          initialVisible={positions[i].visible}
          isMainPane={isMainPane}
          hasSettings={getIndicatorParams(name).length > 0}
          isCollapsed={isCollapsed?.(name)}
          onToggleVisible={(vis) => onToggleVisible(name, vis)}
          onMovePane={() => onMovePane(name)}
          onRemove={() => onRemove(name)}
          onOpenSettings={() => onOpenSettings(name, paneId)}
          onCollapse={onCollapse ? () => onCollapse(name) : undefined}
          onReorderUp={onReorderUp ? () => onReorderUp(name) : undefined}
          onReorderDown={onReorderDown ? () => onReorderDown(name) : undefined}
        />
      ))}
    </>
  );
}

// --- Main component ---

export function IndicatorPaneOverlays() {
  const { state } = useKlinechartsUI();
  const {
    mainIndicators,
    subIndicators,
    activeSubIndicators,
    removeMainIndicator,
    removeSubIndicator,
    moveToMain,
    moveToSub,
    setIndicatorVisible,
    getIndicatorParams,
    updateIndicatorParams,
    collapseSubIndicator,
    expandSubIndicator,
    isSubIndicatorCollapsed,
    reorderSubIndicator,
  } = useIndicators();

  const chart = useKLineChart();
  const [settingsTarget, setSettingsTarget] = useState<SettingsTarget | null>(
    null,
  );

  const overlayBg = useMemo(() => {
    const isDark =
      typeof state.theme === "string"
        ? state.theme === "dark"
        : document.documentElement.classList.contains("dark");
    return isDark ? "rgba(22, 22, 28, 0.97)" : "rgba(255, 255, 255, 0.97)";
  }, [state.theme]);

  const layout = useMemo(
    () => (chart ? getTooltipLayout(chart) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chart, state.theme],
  );

  // Force re-render when panes change
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!chart) return;
    const el = chart.getDom();
    if (!el) return;

    const resizeObserver = new ResizeObserver(refresh);
    resizeObserver.observe(el);

    const mutationObserver = new MutationObserver(refresh);
    mutationObserver.observe(el, { childList: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [chart, refresh]);

  useEffect(() => {
    const raf = requestAnimationFrame(refresh);
    return () => cancelAnimationFrame(raf);
  }, [state.mainIndicators, state.subIndicators, refresh]);

  const handleOpenSettings = useCallback(
    (name: string, paneId: string) => {
      const params = getIndicatorParams(name);
      if (params.length === 0) return;
      const indicators = chart?.getIndicators({ name, paneId }) ?? [];
      const ind = indicators[0];
      setSettingsTarget({
        name,
        paneId,
        calcParams:
          (ind?.calcParams as number[]) ?? params.map((p) => p.defaultValue),
      });
    },
    [chart, getIndicatorParams],
  );

  if (!chart || !layout) return null;

  const activeMain = mainIndicators.filter((i) => i.isActive);
  const activeSub = subIndicators.filter((i) => i.isActive);

  return (
    <>
      {activeMain.length > 0 && (
        <Widget paneId="candle_pane" position="main">
          <PaneOverlay
            indicators={activeMain.map((i) => i.name)}
            paneId="candle_pane"
            chart={chart}
            layout={layout}
            overlayBg={overlayBg}
            isMainPane={true}
            getIndicatorParams={getIndicatorParams}
            onRemove={removeMainIndicator}
            onToggleVisible={(name, vis) =>
              setIndicatorVisible(name, true, vis)
            }
            onMovePane={moveToSub}
            onOpenSettings={handleOpenSettings}
          />
        </Widget>
      )}
      {activeSub.map((ind) => {
        const paneId = activeSubIndicators[ind.name];
        if (!paneId) return null;
        return (
          <Widget key={paneId} paneId={paneId} position="main">
            <PaneOverlay
              indicators={[ind.name]}
              paneId={paneId}
              chart={chart}
              layout={layout}
              overlayBg={overlayBg}
              isMainPane={false}
              getIndicatorParams={getIndicatorParams}
              onRemove={removeSubIndicator}
              onToggleVisible={(name, vis) =>
                setIndicatorVisible(name, false, vis)
              }
              onMovePane={moveToMain}
              onOpenSettings={handleOpenSettings}
              isCollapsed={isSubIndicatorCollapsed}
              onCollapse={(name) =>
                isSubIndicatorCollapsed(name)
                  ? expandSubIndicator(name)
                  : collapseSubIndicator(name)
              }
              onReorderUp={(name) => reorderSubIndicator(name, "up")}
              onReorderDown={(name) => reorderSubIndicator(name, "down")}
            />
          </Widget>
        );
      })}
      {settingsTarget && (
        <IndicatorSettingsDialog
          target={settingsTarget}
          paramLabels={getIndicatorParams(settingsTarget.name)}
          onUpdate={updateIndicatorParams}
          onClose={() => setSettingsTarget(null)}
        />
      )}
    </>
  );
}
