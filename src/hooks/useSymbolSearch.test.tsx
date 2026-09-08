import { describe, it, expect, vi, afterEach } from "vitest";
import { useState, useEffect } from "react";
import { renderHook, act } from "@testing-library/react";
import { KlinechartsUIProvider } from "../provider/ChartTerminalProvider";
import type { Datafeed } from "../provider/types";
import { fakeDatafeed } from "../../test/renderHook";
import { useSymbolSearch } from "./useSymbolSearch";

afterEach(() => {
  vi.useRealTimers();
});

function searchFeed(tag: string) {
  const feed = fakeDatafeed() as Datafeed & {
    searchSymbols: ReturnType<typeof vi.fn>;
  };
  feed.searchSymbols = vi.fn(async () => [{ ticker: tag }]);
  return feed;
}

describe("useSymbolSearch — datafeed swaps", () => {
  it("a pending debounced search queries the CURRENT feed, not the stale closure", async () => {
    vi.useFakeTimers();
    const feed1 = searchFeed("FROM_FEED_1");
    const feed2 = searchFeed("FROM_FEED_2");
    const feedBox: { setFeed: ((f: Datafeed) => void) | null } = {
      setFeed: null,
    };
    function Wrapper({ children }: { children: React.ReactNode }) {
      const [feed, setFeedState] = useState<Datafeed>(feed1);
      useEffect(() => {
        feedBox.setFeed = setFeedState;
      });
      return (
        <KlinechartsUIProvider datafeed={feed}>{children}</KlinechartsUIProvider>
      );
    }
    const { result } = renderHook(() => useSymbolSearch(50), {
      wrapper: Wrapper,
    });

    act(() => result.current.setQuery("btc"));
    // Swap the feed while the debounce timer is still pending.
    act(() => feedBox.setFeed!(feed2));
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(feed2.searchSymbols).toHaveBeenCalledWith(
      "btc",
      expect.any(AbortSignal),
    );
    expect(feed1.searchSymbols).not.toHaveBeenCalled();
    expect(result.current.results).toEqual([{ ticker: "FROM_FEED_2" }]);
    expect(result.current.isSearching).toBe(false);
  });
});
