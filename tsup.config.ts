import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    extensions: "src/extensions/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "react-klinecharts"],
  treeshake: true,
  splitting: true,
});
