import { useState } from "react";
import { useOrderLines, useKlinechartsUI, orderLine } from "react-klinecharts-ui";
import { DemoFrame } from "./DemoFrame";

function Toolbar() {
  const { state } = useKlinechartsUI();
  const { createOrderLine, removeAllOrderLines } = useOrderLines();
  const [count, setCount] = useState(0);

  function lastClose(): number | null {
    const data = state.chart?.getDataList();
    if (!data || data.length === 0) return null;
    return data[data.length - 1].close;
  }

  function add(side: "buy" | "sell") {
    const price = lastClose();
    if (price == null) return;
    const offset = side === "buy" ? -0.005 : 0.005;
    createOrderLine({
      price: +(price * (1 + offset)).toFixed(2),
      color: side === "buy" ? "#2DC08E" : "#F92855",
      text: side === "buy" ? "BUY" : "SELL",
      line: { style: "dashed" },
      draggable: true,
    });
    setCount((c) => c + 1);
  }

  return (
    <>
      <button onClick={() => add("buy")}>Add buy line</button>
      <button onClick={() => add("sell")}>Add sell line</button>
      <button
        onClick={() => {
          removeAllOrderLines();
          setCount(0);
        }}
      >
        Clear lines
      </button>
      <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>{count} lines</span>
    </>
  );
}

/** Self-contained demo: registers the `orderLine` overlay and drives `useOrderLines`. */
export function OrderLinesDemo() {
  return (
    <DemoFrame
      overlays={[orderLine]}
      toolbar={<Toolbar />}
      note="Order lines are draggable. They require the orderLine overlay on the provider."
    />
  );
}
