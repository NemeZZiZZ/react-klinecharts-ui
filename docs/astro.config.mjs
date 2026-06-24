// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import react from "@astrojs/react";

// Docs are the default site at the GitHub Pages root; the live example app is
// deployed alongside under /examples/:
//   docs     → https://nemezzizz.github.io/react-klinecharts-ui/
//   examples → https://nemezzizz.github.io/react-klinecharts-ui/examples/
const site = "https://nemezzizz.github.io";
const base = "/react-klinecharts-ui";

export default defineConfig({
  site,
  base,
  integrations: [
    starlight({
      title: "react-klinecharts-ui",
      description:
        "Headless React hooks and overlay templates for building financial trading terminals with klinecharts.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/NemeZZiZZ/react-klinecharts-ui",
        },
      ],
      editLink: {
        baseUrl:
          "https://github.com/NemeZZiZZ/react-klinecharts-ui/edit/main/docs/",
      },
      customCss: ["./src/styles/custom.css"],
      sidebar: [
        {
          label: "Live Demo ↗",
          link: "https://nemezzizz.github.io/tradedash/",
          attrs: { target: "_blank", rel: "noopener" },
          badge: { text: "app", variant: "success" },
        },
        {
          label: "Examples ↗",
          link: "https://nemezzizz.github.io/react-klinecharts-ui/examples/",
          attrs: { target: "_blank", rel: "noopener" },
          badge: { text: "code", variant: "note" },
        },
        {
          label: "Getting Started",
          items: [
            { label: "Introduction", slug: "getting-started/introduction" },
            { label: "Installation", slug: "getting-started/installation" },
            { label: "Quick Start", slug: "getting-started/quick-start" },
            { label: "Concept", slug: "getting-started/concept" },
          ],
        },
        {
          label: "Core",
          items: [
            { label: "KlinechartsUIProvider", slug: "core/provider" },
            { label: "Datafeed", slug: "core/datafeed" },
            { label: "State & Actions", slug: "core/state-actions" },
          ],
        },
        {
          label: "Hooks",
          autogenerate: { directory: "hooks" },
        },
        {
          label: "Overlays",
          items: [{ label: "Drawing Overlays", slug: "overlays/overview" }],
        },
        {
          label: "Indicators",
          items: [
            { label: "Custom Indicators", slug: "indicators/overview" },
          ],
        },
        {
          label: "Utilities",
          items: [
            { label: "createDataLoader", slug: "utilities/create-data-loader" },
            { label: "TA (Technical Analysis)", slug: "utilities/ta" },
          ],
        },
        {
          label: "Guides",
          autogenerate: { directory: "guides" },
        },
      ],
    }),
    react(),
  ],
});
