import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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
  plugins: [react(), preserveAnalysisArchive()],
  build: {
    outDir: outputDirectory,
    emptyOutDir: true,
    sourcemap: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks: {
          motion: ["gsap", "motion"],
          recharts: ["recharts"],
          tremor: ["@tremor/react"],
        },
      },
    },
  },
});
