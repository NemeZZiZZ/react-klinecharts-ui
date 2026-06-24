import type { ReactNode } from "react";
import { KlinechartsUIProvider } from "react-klinecharts-ui";
import type { PartialSymbolInfo, OverlayTemplate } from "react-klinecharts-ui";
import { binanceDatafeed, defaultSymbol } from "./datafeed";
import { ChartView } from "./ChartView";

interface DemoFrameProps {
  /** Toolbar rendered above the chart; use hooks inside it. */
  toolbar?: ReactNode;
  /** Extra panels rendered below the chart (e.g. data readouts). */
  panel?: ReactNode;
  /** Footer note shown under the demo. */
  note?: ReactNode;
  symbol?: PartialSymbolInfo;
  theme?: string;
  mainIndicators?: string[];
  subIndicators?: string[];
  overlays?: OverlayTemplate[];
  height?: number;
}

/**
 * Shared shell for every live demo: wires the Binance datafeed into a
 * KlinechartsUIProvider and renders a chart with an optional toolbar/panel.
 * Hook-driven controls are passed in via `toolbar`/`panel` so each page can
 * showcase exactly the hook it documents.
 */
export function DemoFrame({
  toolbar,
  panel,
  note,
  symbol = defaultSymbol,
  theme = "dark",
  mainIndicators,
  subIndicators,
  overlays,
  height = 380,
}: DemoFrameProps) {
  return (
    <KlinechartsUIProvider
      datafeed={binanceDatafeed}
      defaultSymbol={symbol}
      defaultTheme={theme}
      defaultMainIndicators={mainIndicators}
      defaultSubIndicators={subIndicators}
      overlays={overlays}
    >
      <div className="kc-demo not-content">
        {toolbar ? <div className="kc-demo__bar">{toolbar}</div> : null}
        <div className="kc-demo__chart" style={{ height }}>
          <ChartView height={height} />
        </div>
        {panel}
        {note ? <div className="kc-demo__note">{note}</div> : null}
      </div>
    </KlinechartsUIProvider>
  );
}
