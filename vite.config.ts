/// <reference types="vitest" />
import { defineConfig } from "vite";
import dts from 'vite-plugin-dts';
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config https://vitest.dev/config
export default defineConfig({
  plugins: [react(), tsconfigPaths(), dts()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
    },
    sourcemap: true,
    rollupOptions: {
      external: ["react", "react-dom"],
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
