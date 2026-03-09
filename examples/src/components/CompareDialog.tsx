import { useState } from "react";
import { useCompare } from "react-klinecharts-ui";
import { GitCompareArrows, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const QUICK_SYMBOLS = ["ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"];

export function CompareDialog() {
  const { symbols, addSymbol, removeSymbol, toggleSymbol, clearAll } =
    useCompare();
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const ticker = input.trim().toUpperCase();
    if (ticker) {
      addSymbol(ticker);
      setInput("");
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <GitCompareArrows className="size-3.5 mr-1" />
          Compare
          {symbols.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({symbols.length})
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="space-y-2">
          <div className="flex gap-1">
            <input
              className="flex-1 h-7 text-xs border rounded px-2 bg-transparent"
              placeholder="ETHUSDT"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button size="sm" variant="secondary" onClick={handleAdd}>
              Add
            </Button>
          </div>

          <div className="flex flex-wrap gap-1">
            {QUICK_SYMBOLS.filter(
              (s) => !symbols.some((sym) => sym.ticker === s),
            ).map((s) => (
              <button
                key={s}
                className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80"
                onClick={() => addSymbol(s)}
              >
                {s}
              </button>
            ))}
          </div>

          {symbols.length > 0 && (
            <>
              <div className="space-y-1">
                {symbols.map((sym) => (
                  <div
                    key={sym.ticker}
                    className="flex items-center justify-between text-xs"
                  >
                    <button
                      className="flex items-center gap-1.5"
                      onClick={() => toggleSymbol(sym.ticker)}
                    >
                      <span
                        className="size-2.5 rounded-full"
                        style={{
                          backgroundColor: sym.color,
                          opacity: sym.visible ? 1 : 0.3,
                        }}
                      />
                      <span
                        className={sym.visible ? "" : "line-through opacity-50"}
                      >
                        {sym.ticker}
                      </span>
                    </button>
                    <button onClick={() => removeSymbol(sym.ticker)}>
                      <X className="size-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-xs"
                onClick={clearAll}
              >
                Clear all
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
