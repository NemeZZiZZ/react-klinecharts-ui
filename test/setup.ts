import "@testing-library/jest-dom/vitest";

// jsdom/happy-dom don't implement matchMedia; some chart code paths read it.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// requestAnimationFrame stub: happy-dom provides rAF but make sure it exists.
if (typeof globalThis.requestAnimationFrame === "undefined") {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 0) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}
