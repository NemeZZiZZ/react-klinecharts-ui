import { useRef, useMemo } from "react";
import { useScriptEditor } from "react-klinecharts-ui";
import {
  Code2,
  Upload,
  Download,
  RotateCcw,
  Play,
  Trash2,
  AlertCircle,
  CheckCircle2,
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface ScriptEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScriptEditorDialog({
  open,
  onOpenChange,
}: ScriptEditorDialogProps) {
  const {
    code,
    setCode,
    scriptName,
    setScriptName,
    params,
    setParams,
    placement,
    setPlacement,
    error,
    status,
    isRunning,
    hasActiveScript,
    runScript,
    removeScript,
    resetCode,
    exportScript,
    importScript,
  } = useScriptEditor();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lineNumbers = useMemo(
    () => code.split("\n").map((_, i) => i + 1),
    [code],
  );

  const handleImport = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importScript(file);
      e.target.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newVal =
        el.value.substring(0, start) + "  " + el.value.substring(end);
      setCode(newVal);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      runScript();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Code2 className="size-4" />
            Script Indicator Editor
            <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              JS
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Write JavaScript to create custom indicators. Use TA, dataList, and
            params.
          </DialogDescription>
        </DialogHeader>

        {/* Settings row */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Name:</span>
            <Input
              value={scriptName}
              onChange={(e) => setScriptName(e.target.value)}
              placeholder="My Script"
              className="h-7 w-28 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Params:</span>
            <Input
              value={params}
              onChange={(e) => setParams(e.target.value)}
              placeholder="14, 26, 9"
              className="h-7 w-28 font-mono text-xs"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Placement:</span>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="radio"
                name="script-placement"
                checked={placement === "sub"}
                onChange={() => setPlacement("sub")}
                className="accent-primary"
              />
              Sub
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="radio"
                name="script-placement"
                checked={placement === "main"}
                onChange={() => setPlacement("main")}
                className="accent-primary"
              />
              Main
            </label>
          </div>
          {hasActiveScript && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={removeScript}
            >
              <Trash2 className="mr-1 size-3" />
              Remove
            </Button>
          )}
        </div>

        {/* Code editor */}
        <div className="flex flex-1 min-h-0 bg-[#0d1117] font-mono text-[13px] leading-[1.7]">
          <div className="select-none border-r border-[#21262d] bg-[#161b22] px-2.5 py-3 text-right text-xs text-[#484f58] leading-[1.7]">
            {lineNumbers.map((n) => (
              <div key={n}>{n}</div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
            className="flex-1 resize-none border-none bg-transparent p-3 text-[#e6edf3] outline-none caret-[#58a6ff] selection:bg-[rgba(88,166,255,0.22)] placeholder:text-[#484f58]"
            style={{ tabSize: 2, fontSize: "13px", lineHeight: "1.7" }}
          />
        </div>

        {/* Error / Status */}
        {error && (
          <div className="flex items-start gap-2 border-t border-red-500/30 bg-red-500/10 px-4 py-2 font-mono text-xs text-red-400">
            <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
            <span className="whitespace-pre-wrap wrap-break-word">{error}</span>
          </div>
        )}
        {status && !error && (
          <div className="flex items-center gap-2 border-t border-green-500/25 bg-green-500/8 px-4 py-2 text-xs text-green-400">
            <CheckCircle2 className="size-3.5 shrink-0" />
            {status}
          </div>
        )}

        <Separator />

        {/* Footer */}
        <div className="flex items-center justify-between bg-muted/30 px-4 py-2">
          <div className="flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".js,.ts,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleImport}>
              <Upload className="mr-1 size-3" />
              Import
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={exportScript}>
              <Download className="mr-1 size-3" />
              Export
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="mr-2 flex items-center gap-1 text-[11px] text-muted-foreground">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground shadow-sm">Ctrl</kbd>
              <span>+</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground shadow-sm">Enter</kbd>
              <span className="ml-0.5">to run</span>
            </span>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={resetCode}>
              <RotateCcw className="mr-1 size-3" />
              Reset
            </Button>
            <Button size="sm" className="h-7 text-xs" disabled={isRunning} onClick={runScript}>
              <Play className="mr-1 size-3" />
              {isRunning ? "..." : "Run"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
