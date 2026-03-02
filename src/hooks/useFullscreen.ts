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
    if (el.requestFullscreen) {
      el.requestFullscreen();
    } else if ("webkitRequestFullscreen" in el) {
      (el as HTMLElement & { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
    } else if ("msRequestFullscreen" in el) {
      (el as HTMLElement & { msRequestFullscreen: () => void }).msRequestFullscreen();
    }
  }, [fullscreenContainerRef]);

  const exit = useCallback(() => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ("webkitExitFullscreen" in document) {
      (document as Document & { webkitExitFullscreen: () => void }).webkitExitFullscreen();
    } else if ("msExitFullscreen" in document) {
      (document as Document & { msExitFullscreen: () => void }).msExitFullscreen();
    }
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
