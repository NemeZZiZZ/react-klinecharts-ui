import { useKlinechartsUISettings } from "react-klinecharts-ui";
import { RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const {
    candleType,
    candleTypes,
    candleUpColor,
    candleDownColor,
    compareRule,
    compareRules,
    priceAxisType,
    priceAxisTypes,
    yAxisPosition,
    yAxisPositions,
    yAxisInside,
    showLastPrice,
    showLastPriceLine,
    showHighPrice,
    showLowPrice,
    showIndicatorLastValue,
    reverseCoordinate,
    showGrid,
    showCrosshair,
    showCandleTooltip,
    showIndicatorTooltip,
    tooltipShowRule,
    tooltipShowRules,
    showTimeAxis,
    setCandleType,
    setCandleUpColor,
    setCandleDownColor,
    setCompareRule,
    setPriceAxisType,
    setYAxisPosition,
    setYAxisInside,
    setShowLastPrice,
    setShowLastPriceLine,
    setShowHighPrice,
    setShowLowPrice,
    setShowIndicatorLastValue,
    setReverseCoordinate,
    setShowGrid,
    setShowCrosshair,
    setShowCandleTooltip,
    setShowIndicatorTooltip,
    setTooltipShowRule,
    setShowTimeAxis,
    resetToDefaults,
  } = useKlinechartsUISettings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Settings</DialogTitle>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={resetToDefaults}
              className="mr-6"
            >
              <RotateCcw />
            </Button>
          </div>
          <DialogDescription>Customize chart appearance.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 pr-3">
            {/* Candle Type */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                Candle Type
              </h3>
              <div className="grid grid-cols-2 gap-1">
                {candleTypes.map((ct) => (
                  <Button
                    key={ct.key}
                    variant={candleType === ct.key ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setCandleType(ct.key)}
                    className="justify-start"
                  >
                    {ct.localeKey}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Candle Colors */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                Candle Colors
              </h3>
              <div className="space-y-2">
                <ColorRow
                  label="Bullish (up)"
                  value={candleUpColor}
                  onChange={setCandleUpColor}
                />
                <ColorRow
                  label="Bearish (down)"
                  value={candleDownColor}
                  onChange={setCandleDownColor}
                />
              </div>
            </div>

            <Separator />

            {/* Compare Rule */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                Compare Rule
              </h3>
              <div className="flex gap-1">
                {compareRules.map((cr) => (
                  <Button
                    key={cr.key}
                    variant={compareRule === cr.key ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setCompareRule(cr.key)}
                    className="flex-1"
                  >
                    {cr.localeKey === "current_open" ? "Current Open" : "Prev Close"}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Price Axis */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                Price Axis
              </h3>
              <div className="flex gap-1">
                {priceAxisTypes.map((pat) => (
                  <Button
                    key={pat.key}
                    variant={priceAxisType === pat.key ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setPriceAxisType(pat.key)}
                    className="flex-1 capitalize"
                  >
                    {pat.localeKey}
                  </Button>
                ))}
              </div>

              <div className="flex gap-1 mt-1">
                {yAxisPositions.map((p) => (
                  <Button
                    key={p.key}
                    variant={yAxisPosition === p.key ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setYAxisPosition(p.key)}
                    className="flex-1 capitalize"
                  >
                    {p.localeKey}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Display toggles */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Display
              </h3>
              <SettingsRow label="Grid lines" checked={showGrid} onCheckedChange={setShowGrid} />
              <SettingsRow label="Crosshair" checked={showCrosshair} onCheckedChange={setShowCrosshair} />
              <SettingsRow label="Time axis" checked={showTimeAxis} onCheckedChange={setShowTimeAxis} />
              <SettingsRow label="Reverse coordinate" checked={reverseCoordinate} onCheckedChange={setReverseCoordinate} />
              <SettingsRow label="Y-axis inside" checked={yAxisInside} onCheckedChange={setYAxisInside} />
            </div>

            <Separator />

            {/* Tooltips */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Tooltips
              </h3>
              <SettingsRow label="Candle OHLCV tooltip" checked={showCandleTooltip} onCheckedChange={setShowCandleTooltip} />
              <SettingsRow label="Indicator tooltip" checked={showIndicatorTooltip} onCheckedChange={setShowIndicatorTooltip} />
              <div>
                <span className="text-sm mb-1 block">Show rule</span>
                <div className="flex gap-1">
                  {tooltipShowRules.map((r) => (
                    <Button
                      key={r.key}
                      variant={tooltipShowRule === r.key ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setTooltipShowRule(r.key)}
                      className="flex-1 text-xs"
                    >
                      {r.localeKey === "follow_cross" ? "Crosshair" : r.localeKey === "always" ? "Always" : "None"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            {/* Price marks */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Price Marks
              </h3>
              <SettingsRow label="Last price mark" checked={showLastPrice} onCheckedChange={setShowLastPrice} />
              <SettingsRow label="Last price line" checked={showLastPriceLine} onCheckedChange={setShowLastPriceLine} />
              <SettingsRow label="High price mark" checked={showHighPrice} onCheckedChange={setShowHighPrice} />
              <SettingsRow label="Low price mark" checked={showLowPrice} onCheckedChange={setShowLowPrice} />
              <SettingsRow label="Indicator last value" checked={showIndicatorLastValue} onCheckedChange={setShowIndicatorLastValue} />
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function SettingsRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <label className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-7 cursor-pointer rounded border border-border bg-transparent p-0.5"
        />
      </div>
    </label>
  );
}
