import { DemoFrame } from "./DemoFrame";
import { PeriodsToolbar } from "./PeriodsToolbar";
import { ThemeToolbar } from "./ThemeToolbar";
import { IndicatorsToolbar } from "./IndicatorsToolbar";
import { DrawingToolbar } from "./DrawingToolbar";
import { SettingsToolbar } from "./SettingsToolbar";
import { ScreenshotToolbar } from "./ScreenshotToolbar";
import { MeasureToolbar } from "./MeasureToolbar";
import { ReplayToolbar } from "./ReplayToolbar";
import { DataExportToolbar } from "./DataExportToolbar";
import { CrosshairPanel } from "./CrosshairPanel";

// Each export is a single self-contained React island. Astro client directives
// only apply to components Astro renders directly, so a toolbar passed as a prop
// from MDX (`toolbar={<X client:only />}`) would arrive as an Astro-JSX object
// and crash React. Composing DemoFrame + toolbar *inside* one component keeps
// everything in a single React tree, where passing JSX as a prop is fine.

export function BasicChartDemo() {
  return (
    <DemoFrame note="Live data from Binance public API. Scroll to load history; drag to pan." />
  );
}

export function PeriodsDemo() {
  return <DemoFrame toolbar={<PeriodsToolbar />} />;
}

export function ThemeDemo() {
  return <DemoFrame toolbar={<ThemeToolbar />} />;
}

export function IndicatorsDemo() {
  return (
    <DemoFrame
      toolbar={<IndicatorsToolbar />}
      subIndicators={["VOL"]}
      note="Main indicators stack on the candle pane; sub indicators get their own pane."
    />
  );
}

export function DrawingDemo() {
  return (
    <DemoFrame
      toolbar={<DrawingToolbar />}
      note="Select a tool, then click on the chart to draw. Click the active button again to deselect."
    />
  );
}

export function SettingsDemo() {
  return <DemoFrame toolbar={<SettingsToolbar />} />;
}

export function ScreenshotDemo() {
  return <DemoFrame toolbar={<ScreenshotToolbar />} />;
}

export function MeasureDemo() {
  return (
    <DemoFrame
      toolbar={<MeasureToolbar />}
      note="Click Measure, then click two points on the chart."
    />
  );
}

export function ReplayDemo() {
  return (
    <DemoFrame
      toolbar={<ReplayToolbar />}
      note="Start replay to animate history bar by bar; pause and Step to advance one bar."
    />
  );
}

export function CrosshairDemo() {
  return (
    <DemoFrame
      panel={<CrosshairPanel />}
      note="Move the cursor over candles — the readout below updates in real time."
    />
  );
}

export function DataExportDemo() {
  return (
    <DemoFrame
      toolbar={<DataExportToolbar />}
      note="Triggers a real file download from the bars currently loaded in the chart."
    />
  );
}
