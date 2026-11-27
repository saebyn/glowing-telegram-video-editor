import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:6007";

export default defineConfig({
  testDir: "src",
  testMatch: "**/*.browser.ts",
  use: {
    baseURL,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  webServer: {
    command: "storybook dev --port 6007 --exact-port --host 127.0.0.1 --ci --disable-telemetry",
    url: `${baseURL}/index.json`,
  },
});
