import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    extensions: "src/extensions/index.ts",
    chart: "src/chart/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // react-klinecharts is an OPTIONAL peer (only the ./chart entry needs it),
  // so it must stay external and not be bundled.
  external: ["react", "react-dom", "klinecharts", "react-klinecharts"],
  treeshake: true,
  splitting: true,
});
