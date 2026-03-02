import { useState } from "react";
import { useIndicators } from "react-klinecharts-ui";
import {
  Eye,
  EyeOff,
  Settings2,
  X,
  Plus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface IndicatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function IndicatorParamsEditor({
  name,
  paneId,
  params,
  onUpdate,
}: {
  name: string;
  paneId: string;
  params: { label: string; defaultValue: number }[];
  onUpdate: (name: string, paneId: string, values: number[]) => void;
}) {
  const [values, setValues] = useState(() => params.map((p) => p.defaultValue));

  const handleChange = (index: number, val: string) => {
    const num = Number(val);
    if (isNaN(num)) return;
    const next = [...values];
    next[index] = num;
    setValues(next);
    onUpdate(name, paneId, next);
  };

  return (
    <div className="mt-2 flex flex-wrap gap-2 pl-7">
      {params.map((param, i) => (
        <div key={param.label} className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{param.label}:</span>
          <Input
            type="number"
            value={values[i]}
            onChange={(e) => handleChange(i, e.target.value)}
            className="h-6 w-16 text-xs"
          />
        </div>
      ))}
    </div>
  );
}

function ActiveIndicatorRow({
  name,
  isMain,
  paneId,
  params,
  onRemove,
  onToggleVisible,
  onUpdateParams,
}: {
  name: string;
  isMain: boolean;
  paneId: string;
  params: { label: string; defaultValue: number }[];
  onRemove: () => void;
  onToggleVisible: (visible: boolean) => void;
  onUpdateParams: (name: string, paneId: string, values: number[]) => void;
}) {
  const [visible, setVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const hasParams = params.length > 0;

  const handleToggleVisible = () => {
    const next = !visible;
    setVisible(next);
    onToggleVisible(next);
  };

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center gap-1 px-2 py-1.5">
        {hasParams ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        ) : (
          <div className="size-5" />
        )}

        <span
          className={cn(
            "flex-1 text-sm font-medium",
            !visible && "text-muted-foreground line-through"
          )}
        >
          {name}
        </span>

        <span className="text-[10px] text-muted-foreground">
          {isMain ? "main" : "sub"}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={handleToggleVisible}
        >
          {visible ? (
            <Eye className="size-3.5" />
          ) : (
            <EyeOff className="size-3.5 text-muted-foreground" />
          )}
        </Button>

        {hasParams && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => setExpanded((v) => !v)}
          >
            <Settings2 className="size-3.5" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {expanded && hasParams && (
        <div className="border-t border-border px-2 pb-2">
          <IndicatorParamsEditor
            name={name}
            paneId={paneId}
            params={params}
            onUpdate={onUpdateParams}
          />
        </div>
      )}
    </div>
  );
}

export function IndicatorDialog({ open, onOpenChange }: IndicatorDialogProps) {
  const {
    mainIndicators,
    subIndicators,
    addMainIndicator,
    addSubIndicator,
    removeMainIndicator,
    removeSubIndicator,
    setIndicatorVisible,
    updateIndicatorParams,
    getIndicatorParams,
    activeSubIndicators,
  } = useIndicators();

  const activeMainList = mainIndicators.filter((i) => i.isActive);
  const activeSubList = subIndicators.filter((i) => i.isActive);
  const inactiveMainList = mainIndicators.filter((i) => !i.isActive);
  const inactiveSubList = subIndicators.filter((i) => !i.isActive);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Indicators</DialogTitle>
          <DialogDescription>
            Manage active indicators and add new ones.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-3">
            {/* Active indicators */}
            {(activeMainList.length > 0 || activeSubList.length > 0) && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Active
                </h3>
                <div className="space-y-1.5">
                  {activeMainList.map((indicator) => (
                    <ActiveIndicatorRow
                      key={`main_${indicator.name}`}
                      name={indicator.name}
                      isMain
                      paneId="candle_pane"
                      params={getIndicatorParams(indicator.name)}
                      onRemove={() => removeMainIndicator(indicator.name)}
                      onToggleVisible={(v) =>
                        setIndicatorVisible(indicator.name, true, v)
                      }
                      onUpdateParams={updateIndicatorParams}
                    />
                  ))}
                  {activeSubList.map((indicator) => (
                    <ActiveIndicatorRow
                      key={`sub_${indicator.name}`}
                      name={indicator.name}
                      isMain={false}
                      paneId={activeSubIndicators[indicator.name] ?? ""}
                      params={getIndicatorParams(indicator.name)}
                      onRemove={() => removeSubIndicator(indicator.name)}
                      onToggleVisible={(v) =>
                        setIndicatorVisible(indicator.name, false, v)
                      }
                      onUpdateParams={updateIndicatorParams}
                    />
                  ))}
                </div>
              </div>
            )}

            {(activeMainList.length > 0 || activeSubList.length > 0) &&
              (inactiveMainList.length > 0 || inactiveSubList.length > 0) && (
                <Separator />
              )}

            {/* Available main indicators */}
            {inactiveMainList.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Main Chart
                </h3>
                <div className="space-y-0.5">
                  {inactiveMainList.map((indicator) => (
                    <button
                      key={indicator.name}
                      onClick={() => addMainIndicator(indicator.name)}
                      className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                    >
                      <span>{indicator.name}</span>
                      <Plus className="size-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Available sub indicators */}
            {inactiveSubList.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Sub Chart
                </h3>
                <div className="space-y-0.5">
                  {inactiveSubList.map((indicator) => (
                    <button
                      key={indicator.name}
                      onClick={() => addSubIndicator(indicator.name)}
                      className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                    >
                      <span>{indicator.name}</span>
                      <Plus className="size-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
