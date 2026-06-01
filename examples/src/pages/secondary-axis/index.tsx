/**
 * Secondary Y-axis demo — showcases klinecharts v10 multiple y-axes through
 * `useIndicators`. An RSI oscillator (range 0–100) is placed on the *main*
 * (price) pane. On the shared price axis it collapses into a flat line at the
 * bottom; bound to its own left axis it reads as a proper 0–100 oscillator
 * without distorting the candle scale. The binding survives Undo/Redo.
 */
import { KlinechartsUIProvider, useIndicators, useUndoRedo } from "react-klinecharts-ui";
import { binanceDatafeed, defaultSymbol } from "../../datafeed";
import { ChartView } from "../../components/ChartView";
import { Columns2, Undo2, Redo2, ArrowLeft } from "lucide-react";

const RSI = "RSI";
const RSI_AXIS = { id: "rsi_axis", position: "left" as const };

function SecondaryAxisControls() {
  const {
    addMainIndicator,
    removeMainIndicator,
    isMainIndicatorActive,
    getIndicatorAxis,
    bindIndicatorToNewAxis,
  } = useIndicators();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();

  const active = isMainIndicatorActive(RSI);
  const onOwnAxis = !!getIndicatorAxis(RSI, true);

  return (
    <div className="absolute left-4 top-4 z-10 w-72 rounded-lg border border-zinc-800 bg-zinc-900/95 p-4 text-zinc-100 shadow-xl backdrop-blur">
      <a
        href="#"
        className="mb-3 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
      >
        <ArrowLeft className="size-3" /> Examples
      </a>

      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Columns2 className="size-4 text-primary" />
        Secondary Y-axis
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
        Put an RSI oscillator (0–100) on the price pane. On the shared price
        axis it squishes into a flat line; on its own axis it reads correctly
        without distorting candles.
      </p>

      <div className="mt-4 space-y-2">
        {!active ? (
          <>
            <button
              onClick={() => addMainIndicator(RSI, { yAxis: RSI_AXIS })}
              className="w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90"
            >
              Add RSI on its own left axis ✓
            </button>
            <button
              onClick={() => addMainIndicator(RSI)}
              className="w-full rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
            >
              Add RSI on the shared price axis
            </button>
          </>
        ) : (
          <>
            <div className="rounded-md bg-zinc-800/60 px-3 py-2 text-xs">
              RSI is on{" "}
              <span className="font-semibold text-primary">
                {onOwnAxis ? "its own left axis" : "the shared price axis"}
              </span>
            </div>
            <button
              onClick={() =>
                bindIndicatorToNewAxis(
                  RSI,
                  true,
                  onOwnAxis ? undefined : RSI_AXIS,
                )
              }
              className="w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90"
            >
              {onOwnAxis ? "Move to shared price axis" : "Move to its own axis"}
            </button>
            <button
              onClick={() => removeMainIndicator(RSI)}
              className="w-full rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
            >
              Remove RSI
            </button>
          </>
        )}
      </div>

      <div className="mt-4 border-t border-zinc-800 pt-3">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
          Binding survives undo / redo
        </p>
        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
          >
            <Undo2 className="size-3.5" /> Undo
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
          >
            <Redo2 className="size-3.5" /> Redo
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SecondaryAxisExample() {
  return (
    <KlinechartsUIProvider
      datafeed={binanceDatafeed}
      defaultSymbol={defaultSymbol}
      defaultTheme="dark"
      defaultMainIndicators={[]}
      defaultSubIndicators={[]}
    >
      <div className="relative h-svh">
        <SecondaryAxisControls />
        <ChartView className="h-full" />
      </div>
    </KlinechartsUIProvider>
  );
}
