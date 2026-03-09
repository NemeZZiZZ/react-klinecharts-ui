/** Depth / Order Book (DOM) example — chart with a live order book panel. */
import {
  KlinechartsUIProvider,
  useKlinechartsUITheme,
} from "react-klinecharts-ui";
import { binanceDatafeed, defaultSymbol } from "../../datafeed";
import { ChartView } from "../../components/ChartView";
import { OrderBookPanel } from "../../components/OrderBookPanel";
import { useSyncTheme } from "../../hooks/use-sync-theme";

function DepthLayout() {
  const { theme } = useKlinechartsUITheme();
  useSyncTheme(theme);

  return (
    <div className="flex h-svh bg-background">
      <ChartView className="flex-1" />
      <OrderBookPanel />
    </div>
  );
}

export default function DepthExample() {
  return (
    <KlinechartsUIProvider
      datafeed={binanceDatafeed}
      defaultSymbol={defaultSymbol}
      defaultTheme="dark"
    >
      <DepthLayout />
    </KlinechartsUIProvider>
  );
}
