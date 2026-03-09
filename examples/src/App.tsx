import { useState, useEffect, lazy, Suspense } from "react";

const TerminalExample = lazy(() => import("./pages/terminal"));
const MultiChartExample = lazy(() => import("./pages/multi-chart"));
const IndicatorBuilderExample = lazy(() => import("./pages/indicator-builder"));
const MobileExample = lazy(() => import("./pages/mobile"));
const QuickStartExample = lazy(() => import("./pages/quick-start"));
const DepthExample = lazy(() => import("./pages/depth"));

const EXAMPLES = [
  {
    id: "terminal",
    label: "Trading Terminal",
    component: TerminalExample,
    features: [
      "useFullscreen",
      "useSymbolSearch",
      "usePeriods",
      "useIndicators",
      "useDrawingTools",
      "useOrderLines",
      "useUndoRedo",
      "useScreenshot",
      "useTimezone",
      "useKlinechartsUISettings",
      "useLayoutManager",
      "useCrosshair",
      "useDataExport",
      "useReplay",
      "useCompare",
      "useMeasure",
      "useAnnotations",
      "useWatchlist",
      "createDataLoader",
      "orderLine",
      "depthOverlay",
    ],
  },
  {
    id: "multi-chart",
    label: "Multi-Chart (Synced)",
    component: MultiChartExample,
    features: [
      "useKlinechartsUI",
      "orderLine",
      "Crosshair sync",
      "Scroll sync",
    ],
  },
  {
    id: "indicator-builder",
    label: "Indicator Builder",
    component: IndicatorBuilderExample,
    features: ["useScriptEditor"],
  },
  {
    id: "depth",
    label: "Order Book / Depth",
    component: DepthExample,
    features: ["useKlinechartsUI", "Live order book"],
  },
  {
    id: "mobile",
    label: "Mobile",
    component: MobileExample,
    features: [
      "usePeriods",
      "useIndicators",
      "useFullscreen",
      "orderLine",
    ],
  },
  {
    id: "quick-start",
    label: "Quick Start",
    component: QuickStartExample,
    features: ["KlinechartsUIProvider", "createDataLoader"],
  },
] as const;

function getRoute(): string {
  return window.location.hash.replace("#", "") || "";
}

function Loader() {
  return (
    <div className="flex h-svh items-center justify-center bg-[#0a0a0b] text-white">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-white" />
    </div>
  );
}

function IndexPage({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <div className="min-h-svh bg-[#0a0a0b] text-zinc-100 flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-2">react-klinecharts-ui</h1>
      <p className="text-zinc-400 mb-10 text-center max-w-md">
        Headless React hooks for building professional trading terminals with
        klinecharts v10.
      </p>

      <div className="grid gap-3 w-full max-w-lg">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.id}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4 text-left transition hover:border-zinc-600 hover:bg-zinc-800"
            onClick={() => onNavigate(ex.id)}
          >
            <div className="flex items-baseline gap-2">
              <span className="font-medium">{ex.label}</span>
              <span className="text-xs text-zinc-500">#{ex.id}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {ex.features.map((f) => (
                <span
                  key={f}
                  className="inline-block rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
                >
                  {f}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      <a
        href="https://github.com/NemeZZiZZ/react-klinecharts-ui"
        className="mt-10 text-sm text-zinc-500 hover:text-zinc-300 transition"
        target="_blank"
        rel="noopener noreferrer"
      >
        GitHub
      </a>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const handler = () => setRoute(getRoute());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const navigate = (id: string) => {
    window.location.hash = id;
  };

  const example = EXAMPLES.find((e) => e.id === route);

  if (!example) {
    return <IndexPage onNavigate={navigate} />;
  }

  const Component = example.component;

  return (
    <Suspense fallback={<Loader />}>
      <Component />
    </Suspense>
  );
}
