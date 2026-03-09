import {
  DetailedHTMLProps,
  HTMLAttributes,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  useKlinechartsUI,
  useDataExport,
  useScreenshot,
} from "react-klinecharts-ui";

interface Position {
  x: number;
  y: number;
}

export function ChartContextMenu({
  children,
  className,
  onContextMenu,
  ...props
}: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [snapshotPrice, setSnapshotPrice] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { state } = useKlinechartsUI();
  const { exportAll } = useDataExport();
  const { capture, download } = useScreenshot();

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      onContextMenu?.(e);
      e.preventDefault();

      // Read the last bar's close price directly from chart data — avoids
      // any timing issues with crosshair subscriptions / RAF / React state.
      const dataList = state.chart?.getDataList();
      const lastBar = dataList?.[dataList.length - 1];
      setSnapshotPrice(lastBar?.close ?? null);

      setPosition({ x: e.clientX, y: e.clientY });
      setOpen(true);
    },
    [onContextMenu, state.chart],
  );
  const close = useCallback(() => setOpen(false), []);

  // Close on click outside or Escape
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, close]);

  const handleCopyPrice = useCallback(() => {
    if (snapshotPrice != null) {
      navigator.clipboard.writeText(String(snapshotPrice));
    }
    close();
  }, [snapshotPrice, close]);

  const handleExportCsv = useCallback(() => {
    exportAll("csv");
    close();
  }, [exportAll, close]);

  const handleExportJson = useCallback(() => {
    exportAll("json");
    close();
  }, [exportAll, close]);

  const handleScreenshot = useCallback(() => {
    capture();
    // download() depends on screenshotUrl state, which updates async.
    setTimeout(() => download(), 100);
    close();
  }, [capture, download, close]);

  return (
    <div {...props} className={className} onContextMenu={handleContextMenu}>
      {children}

      {open && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          style={{ left: position.x, top: position.y }}
        >
          <button
            className="flex w-full items-center rounded-sm px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            disabled={snapshotPrice == null}
            onClick={handleCopyPrice}
          >
            Copy price
          </button>

          <div className="my-1 h-px bg-border" />

          <button
            className="flex w-full items-center rounded-sm px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={handleExportCsv}
          >
            Export CSV
          </button>
          <button
            className="flex w-full items-center rounded-sm px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={handleExportJson}
          >
            Export JSON
          </button>

          <div className="my-1 h-px bg-border" />

          <button
            className="flex w-full items-center rounded-sm px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={handleScreenshot}
          >
            Take screenshot
          </button>
        </div>
      )}
    </div>
  );
}
