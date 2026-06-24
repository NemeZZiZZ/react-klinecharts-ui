import { useState, useEffect } from "react";
import { useAlerts, useKlinechartsUI } from "react-klinecharts-ui";
import type { Alert, AlertCondition } from "react-klinecharts-ui";
import { Bell, Plus, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useModalState } from "../hooks/use-modal-state";

const CONDITIONS: {
  value: AlertCondition;
  label: string;
  icon: typeof ArrowUp;
}[] = [
  { value: "crossing_up", label: "Crossing up", icon: ArrowUp },
  { value: "crossing_down", label: "Crossing down", icon: ArrowDown },
  { value: "crossing", label: "Crossing", icon: ArrowUpDown },
];

function playBeep() {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 660;
  gain.gain.value = 0.3;
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  osc.stop(ctx.currentTime + 0.4);
}

/**
 * Self-contained Bell button + dialog demonstrating `useAlerts`.
 *
 * - Creates price-crossing alerts (drawn as locked horizontal lines).
 * - Lists active alerts with their triggered state and per-item removal.
 * - Wires `onAlertTriggered` to a beep + an optional browser notification.
 */
export function AlertsButton() {
  const { state } = useKlinechartsUI();
  const { alerts, addAlert, removeAlert, clearAlerts, onAlertTriggered } =
    useAlerts();
  const modal = useModalState();

  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState<AlertCondition>("crossing");
  const [message, setMessage] = useState("");

  // Notify on trigger: beep + browser notification (if permitted).
  useEffect(() => {
    onAlertTriggered((alert: Alert) => {
      playBeep();
      const body =
        alert.message ||
        `Price ${alert.condition.replace("_", " ")} ${alert.price}`;
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification("Price alert", { body });
      }
    });
  }, [onAlertTriggered]);

  // Prefill price with the latest close, then open the dialog.
  const handleOpen = () => {
    const dataList = state.chart?.getDataList();
    const lastClose = dataList?.[dataList.length - 1]?.close;
    if (lastClose != null) setPrice(String(lastClose));
    modal.open();
  };

  const handleAdd = () => {
    const priceNum = parseFloat(price);
    if (isNaN(priceNum)) return;
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission();
    }
    addAlert(priceNum, condition, message.trim() || undefined);
    setMessage("");
  };

  const activeCount = alerts.filter((a) => !a.triggered).length;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={modal.isOpen ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={handleOpen}
            className="relative"
          >
            <Bell className="size-3.5" />
            {activeCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-1 size-4 p-0 text-[9px] leading-none"
              >
                {activeCount}
              </Badge>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Price alerts</TooltipContent>
      </Tooltip>

      <Dialog open={modal.isOpen} onOpenChange={modal.setIsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Price Alerts</DialogTitle>
            <DialogDescription>
              Get notified when the price crosses a level.
            </DialogDescription>
          </DialogHeader>

          {/* Create form */}
          <div className="space-y-3">
            <Input
              type="number"
              placeholder="Price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />

            <div className="flex gap-1">
              {CONDITIONS.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant={condition === value ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setCondition(value)}
                  className="flex-1"
                  title={label}
                >
                  <Icon className="size-4" />
                </Button>
              ))}
            </div>

            <Input
              placeholder="Message (optional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />

            <Button
              onClick={handleAdd}
              disabled={!price || isNaN(parseFloat(price))}
              className="w-full"
              size="sm"
            >
              <Plus className="size-4" />
              Add Alert
            </Button>
          </div>

          {alerts.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <Separator className="flex-1" />
                <button
                  className="ml-2 text-[10px] text-muted-foreground hover:text-destructive"
                  onClick={clearAlerts}
                >
                  Clear all
                </button>
              </div>

              <ScrollArea className="max-h-48">
                <div className="space-y-1 pr-2">
                  {alerts.map((alert) => {
                    const cond = CONDITIONS.find(
                      (c) => c.value === alert.condition,
                    );
                    const Icon = cond?.icon ?? ArrowUpDown;
                    return (
                      <div
                        key={alert.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                      >
                        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="font-mono text-sm">
                          {alert.price.toLocaleString()}
                        </span>
                        {alert.message && (
                          <span className="truncate text-xs text-muted-foreground">
                            {alert.message}
                          </span>
                        )}
                        <span className="flex-1" />
                        {alert.triggered && (
                          <Badge variant="outline" className="text-[9px]">
                            triggered
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => removeAlert(alert.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
