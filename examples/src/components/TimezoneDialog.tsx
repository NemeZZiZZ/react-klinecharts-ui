import { useState, useMemo } from "react";
import { useTimezone } from "react-klinecharts-ui";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface TimezoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TimezoneDialog({ open, onOpenChange }: TimezoneDialogProps) {
  const { timezones, activeTimezone, setTimezone } = useTimezone();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTimezones = useMemo(() => {
    if (!searchQuery.trim()) return timezones;
    const query = searchQuery.toLowerCase();
    return timezones.filter(
      (tz) =>
        tz.key.toLowerCase().includes(query) ||
        tz.localeKey.toLowerCase().includes(query)
    );
  }, [timezones, searchQuery]);

  const handleSelect = (key: string) => {
    setTimezone(key);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setSearchQuery("");
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Timezone</DialogTitle>
          <DialogDescription>Select a timezone for the chart.</DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search timezone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <ScrollArea className="max-h-72">
          {filteredTimezones.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No timezones found
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTimezones.map((tz) => (
                <button
                  key={tz.key}
                  onClick={() => handleSelect(tz.key)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                    "hover:bg-accent",
                    activeTimezone === tz.key && "bg-accent/50"
                  )}
                >
                  <span>{tz.key}</span>
                  {activeTimezone === tz.key && (
                    <Check className="size-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
