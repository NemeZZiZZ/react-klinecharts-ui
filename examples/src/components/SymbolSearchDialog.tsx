import { useSymbolSearch } from "react-klinecharts-ui";
import { Loader2 } from "lucide-react";
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

interface SymbolSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SymbolSearchDialog({
  open,
  onOpenChange,
}: SymbolSearchDialogProps) {
  const {
    query,
    results,
    isSearching,
    activeSymbol,
    setQuery,
    selectSymbol,
    clearResults,
  } = useSymbolSearch();

  const handleSelect = (symbol: (typeof results)[number]) => {
    selectSymbol(symbol);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) clearResults();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Symbol Search</DialogTitle>
          <DialogDescription>Search and select a trading pair.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Input
            placeholder="Search symbol..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        <ScrollArea className="max-h-72">
          {query && !isSearching && results.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No symbols found
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              {results.map((symbol) => (
                <button
                  key={symbol.ticker}
                  onClick={() => handleSelect(symbol)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    "hover:bg-accent",
                    activeSymbol?.ticker === symbol.ticker && "bg-accent/50"
                  )}
                >
                  {symbol.ticker}
                </button>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Type to search for symbols
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
