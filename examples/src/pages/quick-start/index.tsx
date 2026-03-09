/** Minimal example — just a chart with default settings. */
import { KlinechartsUIProvider } from "react-klinecharts-ui";
import { binanceDatafeed, defaultSymbol } from "../../datafeed";
import { ChartView } from "../../components/ChartView";

export default function QuickStart() {
  return (
    <KlinechartsUIProvider
      datafeed={binanceDatafeed}
      defaultSymbol={defaultSymbol}
      defaultTheme="dark"
    >
      <div className="h-svh">
        <ChartView className="h-full" />
      </div>
    </KlinechartsUIProvider>
  );
}
