import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: resolve(rootDirectory, "frontend"),
  base: "./",
  plugins: [react()],
  build: {
    outDir: resolve(rootDirectory, "public"),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          motion: ["gsap", "motion"],
        },
      },
    },
  },
});
