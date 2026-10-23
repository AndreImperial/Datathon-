import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFile, mkdir } from "node:fs/promises";

const rootDirectory = fileURLToPath(new URL(".", import.meta.url));
const outputDirectory = resolve(rootDirectory, "public");

function preserveAnalysisArchive() {
  return {
    name: "preserve-analysis-archive",
    apply: "build" as const,
    async closeBundle() {
      const archiveDirectory = resolve(outputDirectory, "full-analysis");
      await mkdir(archiveDirectory, { recursive: true });
      await copyFile(
        resolve(rootDirectory, "outputs/dashboard/Marketing_Analytics_Dashboard.html"),
        resolve(archiveDirectory, "index.html"),
      );
    },
  };
}

export default defineConfig({
  root: resolve(rootDirectory, "frontend"),
  base: "./",
  plugins: [react(), tailwindcss(), preserveAnalysisArchive()],
  // Tailwind v4 runs through @tailwindcss/vite; an inline (empty) PostCSS config
  // stops Vite from picking up a stray postcss.config.* from a parent directory.
  css: { postcss: { plugins: [] } },
  build: {
    outDir: outputDirectory,
    emptyOutDir: true,
    sourcemap: false,
    manifest: true,
    modulePreload: false,
    rollupOptions: {
      output: {
        // Function form, matched on the package path only.  The object form
        // (`recharts: ["recharts"]`) also pulled recharts' shared deps (react,
        // clsx, …) into the recharts chunk, so the entry chunk had to import
        // all ~560 kB of chart code before the first paint.  Here React gets
        // its own vendor chunk and the chart stack stays reachable only from
        // the lazily imported Charts chunk.
        manualChunks(id: string) {
          const match = /[\\/]node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/.exec(id);
          if (!match) return undefined;
          const pkg = match[1].replace(/\\/g, "/");
          if (["react", "react-dom", "scheduler"].includes(pkg)) return "react";
          if (["gsap", "motion", "framer-motion", "motion-dom", "motion-utils"].includes(pkg)) return "motion";
          // d3 scales/shapes (via victory-vendor) are split from recharts so
          // neither lazy chunk crosses the 500 kB warning on its own.
          if (pkg === "victory-vendor" || pkg === "internmap" || pkg.startsWith("d3-")) return "d3";
          if (["recharts", "recharts-scale", "react-smooth", "lodash", "decimal.js-light", "eventemitter3", "tiny-invariant", "fast-equals", "react-transition-group", "dom-helpers", "prop-types", "react-is"].includes(pkg)) return "recharts";
          return undefined;
        },
      },
    },
  },
});
