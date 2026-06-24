---
title: useSymbolSearch
description: Search and select a trading instrument.
sidebar:
  order: 6
---

Search and select a trading instrument. The hook debounces queries and cancels
in-flight requests via `AbortController` on every keystroke and on unmount.

```ts
const {
  query,
  results,
  isSearching,
  activeSymbol,
  setQuery,
  selectSymbol,
  clearResults,
} = useSymbolSearch(debounceMs);
```

| Parameter | Type | Default | Description |
| --------- | ---- | ------- | ----------- |
| `debounceMs` | `number` | `300` | Delay before calling `datafeed.searchSymbols` |

| Field | Type | Description |
| ----- | ---- | ----------- |
| `query` | `string` | Current search query |
| `results` | `PartialSymbolInfo[]` | Results from the last search |
| `isSearching` | `boolean` | `true` while the request is in flight |
| `activeSymbol` | `PartialSymbolInfo \| null` | Currently selected symbol from `state.symbol` |
| `setQuery` | `(q: string) => void` | Update the query (triggers debounced search) |
| `selectSymbol` | `(symbol: PartialSymbolInfo) => void` | Select a symbol — dispatches `SET_SYMBOL` |
| `clearResults` | `() => void` | Clear search results |

## Usage

```tsx
const { query, results, isSearching, selectSymbol, setQuery } =
  useSymbolSearch(300);

<input
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  placeholder="Search…"
/>;
{isSearching && <Spinner />}
{results.map((sym) => (
  <button key={sym.ticker} onClick={() => selectSymbol(sym)}>
    {sym.ticker}
  </button>
))}
```

The search itself is delegated to your [`Datafeed.searchSymbols`](../../core/datafeed/)
implementation — forward the provided `AbortSignal` to `fetch` to cancel stale
requests.
