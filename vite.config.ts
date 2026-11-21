import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config https://vitest.dev/config
export default defineConfig({
  plugins: [
    react(),
    {
      ...dts({ outDir: "dist" }),
      // Storybook loads this config too, but only the library needs declarations.
      apply: ({ build }, { command }) => command === "build" && Boolean(build?.lib),
    },
  ],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
    },
    sourcemap: true,
    rolldownOptions: {
      external: [/^react(?:-dom)?(?:\/|$)/],
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ".vitest/setup",
    include: [
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "**/__tests__/**",
      "**/test.{ts,tsx}",
    ],
  },
});
