import { useReplay, type ReplaySpeed } from "react-klinecharts-ui";
import {
  Play,
  Pause,
  Square,
  SkipForward,
  SkipBack,
  Rewind,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const SPEEDS: ReplaySpeed[] = [1, 2, 5, 10];

export function ReplayControls() {
  const {
    isReplaying,
    isPaused,
    speed,
    barIndex,
    totalBars,
    startReplay,
    stopReplay,
    togglePause,
    stepForward,
    stepBackward,
    setSpeed,
  } = useReplay();

  if (!isReplaying) {
    return (
      <Button variant="ghost" size="sm" onClick={startReplay}>
        <Rewind className="size-3.5 mr-1" />
        Replay
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" onClick={stepBackward}>
        <SkipBack className="size-3.5" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={togglePause}>
        {isPaused ? (
          <Play className="size-3.5" />
        ) : (
          <Pause className="size-3.5" />
        )}
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={stepForward}>
        <SkipForward className="size-3.5" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={stopReplay}>
        <Square className="size-3.5" />
      </Button>

      <select
        className="h-6 text-xs bg-transparent border rounded px-1"
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value) as ReplaySpeed)}
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}x
          </option>
        ))}
      </select>

      <span className="text-xs text-muted-foreground tabular-nums ml-1">
        {barIndex}/{totalBars}
      </span>
    </div>
  );
}
