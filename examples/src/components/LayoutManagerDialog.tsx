import { useState } from "react";
import { useLayoutManager } from "react-klinecharts-ui";
import { Save, Trash2, Upload, Edit3, Check, X } from "lucide-react";
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

interface LayoutManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LayoutManagerDialog({
  open,
  onOpenChange,
}: LayoutManagerDialogProps) {
  const {
    layouts,
    saveLayout,
    loadLayout,
    deleteLayout,
    renameLayout,
  } = useLayoutManager();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleSave = () => {
    if (!newName.trim()) return;
    saveLayout(newName.trim());
    setNewName("");
  };

  const handleLoad = (id: string) => {
    loadLayout(id);
    onOpenChange(false);
  };

  const handleStartRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const handleConfirmRename = () => {
    if (editingId && editName.trim()) {
      renameLayout(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName("");
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chart Layouts</DialogTitle>
          <DialogDescription>
            Save, load, and manage chart layouts.
          </DialogDescription>
        </DialogHeader>

        {/* Save new layout */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Layout name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="h-8"
          />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!newName.trim()}
          >
            <Save className="mr-1 size-3.5" />
            Save
          </Button>
        </div>

        <Separator />

        {/* Saved layouts list */}
        <ScrollArea className="max-h-[50vh]">
          {layouts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No saved layouts yet.
            </p>
          ) : (
            <div className="space-y-1">
              {layouts.map((layout) => (
                <div
                  key={layout.id}
                  className="flex items-center gap-1.5 rounded-md border border-border p-2"
                >
                  {editingId === layout.id ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleConfirmRename();
                          if (e.key === "Escape") handleCancelRename();
                        }}
                        className="h-6 flex-1 text-sm"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={handleConfirmRename}
                      >
                        <Check className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={handleCancelRename}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">
                          {layout.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {layout.symbol} &middot; {layout.period} &middot;{" "}
                          {new Date(layout.lastModified).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={() => handleLoad(layout.id)}
                        title="Load"
                      >
                        <Upload className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={() =>
                          handleStartRename(layout.id, layout.name)
                        }
                        title="Rename"
                      >
                        <Edit3 className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteLayout(layout.id)}
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
