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
        manualChunks: {
          react: ["react", "react-dom"],
          // react-klinecharts-ui now imports klinecharts directly (external),
          // so include the bare "klinecharts" module in the same chunk as the
          // wrapper and the UI library to avoid it landing in a default chunk.
          klinecharts: ["klinecharts", "react-klinecharts", "react-klinecharts-ui"],
          ui: ["radix-ui", "lucide-react"],
        },
      },
    },
  },
});
