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
        manualChunks: {
          motion: ["gsap", "motion"],
          recharts: ["recharts"],
        },
      },
    },
  },
});
