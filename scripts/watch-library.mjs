import { build } from "vite";

// Neither watcher may clear the other one's outputs.
const watch = { build: { watch: {}, emptyOutDir: false } };
await Promise.all([build(watch), build({ ...watch, configFile: "vite.styles.config.ts" })]);
