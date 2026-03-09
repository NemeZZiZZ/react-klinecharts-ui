import { cn } from "@/lib/utils";
import { useKlinechartsUI } from "react-klinecharts-ui";

interface WatermarkProps {
  className?: string;
}

export function Watermark({ className }: WatermarkProps) {
  const { state } = useKlinechartsUI();

  const ticker = state.symbol?.ticker;
  const period = state.period?.label;

  if (!ticker) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-center pointer-events-none select-none text-foreground text-[3rem] font-bold opacity-[0.07]",
        className,
      )}
    >
      {ticker}
      {period ? ` · ${period}` : ""}
    </div>
  );
}
