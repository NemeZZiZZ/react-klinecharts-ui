import { useReplay } from "react-klinecharts-ui";
import type { ReplaySpeed } from "react-klinecharts-ui";

const SPEEDS: ReplaySpeed[] = [1, 2, 5, 10];

/** Play/pause/step historical replay — showcases `useReplay`. */
export function ReplayToolbar() {
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
    setSpeed,
  } = useReplay();

  return (
    <>
      {!isReplaying ? (
        <button onClick={startReplay}>Start replay</button>
      ) : (
        <>
          <button onClick={togglePause}>{isPaused ? "Play" : "Pause"}</button>
          <button onClick={stepForward} disabled={!isPaused}>
            Step
          </button>
          <button onClick={stopReplay}>Stop</button>
        </>
      )}
      {SPEEDS.map((s) => (
        <button key={s} data-active={speed === s} onClick={() => setSpeed(s)}>
          {s}×
        </button>
      ))}
      {isReplaying ? (
        <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>
          {barIndex}/{totalBars}
        </span>
      ) : null}
    </>
  );
}
