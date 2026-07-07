import { useState, useCallback, useEffect } from "react";
import { useKlinechartsUIDispatch } from "../provider/ChartTerminalContext";

export interface UseFullscreenReturn {
  isFullscreen: boolean;
  toggle: () => void;
  enter: () => void;
  exit: () => void;
  containerRef: React.RefObject<HTMLElement | null>;
}

export function useFullscreen(): UseFullscreenReturn {
  const { fullscreenContainerRef } = useKlinechartsUIDispatch();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enter = useCallback(() => {
    const el = fullscreenContainerRef.current;
    if (!el) return;
    // requestFullscreen() returns a Promise that rejects when the browser
    // denies the request (missing user gesture, cross-origin iframe, etc.).
    // Swallow the rejection so it never surfaces as an unhandled rejection.
    let result: Promise<void> | undefined;
    if (el.requestFullscreen) {
      result = el.requestFullscreen();
    } else if ("webkitRequestFullscreen" in el) {
      (el as HTMLElement & { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
    } else if ("msRequestFullscreen" in el) {
      (el as HTMLElement & { msRequestFullscreen: () => void }).msRequestFullscreen();
    }
    result?.catch(() => {});
  }, [fullscreenContainerRef]);

  const exit = useCallback(() => {
    let result: Promise<void> | undefined;
    if (document.exitFullscreen) {
      result = document.exitFullscreen();
    } else if ("webkitExitFullscreen" in document) {
      (document as Document & { webkitExitFullscreen: () => void }).webkitExitFullscreen();
    } else if ("msExitFullscreen" in document) {
      (document as Document & { msExitFullscreen: () => void }).msExitFullscreen();
    }
    result?.catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    if (isFullscreen) {
      exit();
    } else {
      enter();
    }
  }, [isFullscreen, enter, exit]);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, []);

  return {
    isFullscreen,
    toggle,
    enter,
    exit,
    containerRef: fullscreenContainerRef,
  };
}
