import { useScreenshot } from "react-klinecharts-ui";

/** Capture and download a chart screenshot — showcases `useScreenshot`. */
export function ScreenshotToolbar() {
  const { screenshotUrl, capture, download, clear } = useScreenshot();
  return (
    <>
      <button onClick={capture}>Capture</button>
      <button onClick={() => download()} disabled={!screenshotUrl}>
        Download
      </button>
      <button onClick={clear} disabled={!screenshotUrl}>
        Clear
      </button>
      {screenshotUrl ? (
        <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>
          captured ✓
        </span>
      ) : null}
    </>
  );
}
