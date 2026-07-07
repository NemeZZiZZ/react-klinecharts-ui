import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    // Some klinecharts / chart code checks for a browser global; provide a
    // stable value under jsdom/happy-dom so imports don't crash at load time.
    "process.env.NODE_ENV": JSON.stringify("test"),
  },
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/**/index.ts",
        "test/**",
      ],
    },
  },
});
