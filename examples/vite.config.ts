import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "/react-klinecharts-ui/examples/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep React in a single shared chunk. Do NOT group other libs with
        // their React-using peers here — that created a circular import
        // between the react and klinecharts chunks and crashed the production
        // build ("Cannot read properties of undefined (reading 'forwardRef')").
        // Everything else is left to Vite's default chunking.
        manualChunks(id) {
          if (
            id.includes("node_modules") &&
            (id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("/scheduler/"))
          ) {
            return "react";
          }
        },
      },
    },
  },
});
