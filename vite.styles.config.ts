import { defineConfig } from "vite";

// Build both CSS alternatives together outside library mode so they share one
// font file. Keep the public stylesheet names stable and hash the asset URLs.
export default defineConfig({
  base: "./",
  publicDir: false,
  build: {
    emptyOutDir: false,
    rolldownOptions: {
      input: {
        "glowing-telegram-video-editor": "src/index.css",
        "custom-only": "src/custom-only.css",
      },
      output: {
        assetFileNames: ({ names }) =>
          names[0]?.endsWith(".css") ? "[name][extname]" : "assets/[name]-[hash][extname]",
      },
    },
  },
});
