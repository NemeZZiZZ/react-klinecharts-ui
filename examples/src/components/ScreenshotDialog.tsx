import { useScreenshot } from "react-klinecharts-ui";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ScreenshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScreenshotDialog({ open, onOpenChange }: ScreenshotDialogProps) {
  const { screenshotUrl, download, clear } = useScreenshot();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) clear();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Screenshot</DialogTitle>
          <DialogDescription>Preview and download your chart screenshot.</DialogDescription>
        </DialogHeader>

        {screenshotUrl ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-md border">
              <img
                src={screenshotUrl}
                alt="Chart screenshot"
                className="w-full"
              />
            </div>
            <Button onClick={() => download()} className="w-full">
              <Download />
              Download
            </Button>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No screenshot available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
