import { useDataExport } from "react-klinecharts-ui";

/** Export loaded candles to CSV/JSON — showcases `useDataExport`. */
export function DataExportToolbar() {
  const { exportAll, exportVisible } = useDataExport();
  return (
    <>
      <button onClick={() => exportAll("csv")}>Export all · CSV</button>
      <button onClick={() => exportAll("json")}>Export all · JSON</button>
      <button onClick={() => exportVisible("csv")}>Visible · CSV</button>
    </>
  );
}
