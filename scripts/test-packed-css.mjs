import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import { chromium } from "playwright";
import { build, preview } from "vite";

const repo = fileURLToPath(new URL("../", import.meta.url));
const work = await mkdtemp(join(process.env.TMPDIR || tmpdir(), "video-editor-packed-css-"));
const deadline = 15_000;

function npm(args, cwd = repo) {
  return execFileSync("npm", args, { cwd, encoding: "utf8", timeout: 90_000 });
}

try {
  const tarball = process.argv[2]
    ? resolve(process.argv[2])
    : join(
        work,
        JSON.parse(npm(["pack", "--ignore-scripts", "--json", "--pack-destination", work]))[0]
          .filename,
      );
  const root = join(work, "consumer");
  await cp(new URL("./packed-css-fixture/", import.meta.url), root, { recursive: true });
  await writeFile(join(root, "package.json"), '{"private":true,"type":"module"}');
  const { packages } = JSON.parse(await readFile(join(repo, "package-lock.json"), "utf8"));
  npm(
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--prefer-offline",
      tarball,
      `react@${packages["node_modules/react"].version}`,
      `react-dom@${packages["node_modules/react-dom"].version}`,
    ],
    root,
  );

  await build({ root, configFile: false, publicDir: false });
  const server = await preview({
    root,
    configFile: false,
    preview: { host: "127.0.0.1", port: 0, strictPort: true },
  });
  const { port } = server.httpServer.address();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`Packed CSS preview: ${origin}`);
  try {
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      timeout: deadline,
    });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(deadline);
      // No media playback is needed to select a clip in this fixture.
      await page.route("**/unused.m3u8", (route) => route.abort());
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("DOM.enable");
      await cdp.send("CSS.enable");
      await cdp.send("CSS.setLocalFontsEnabled", { enabled: false });

      await page.goto(origin);
      await page.getByRole("button", { name: "Clip Silences", exact: true }).click();
      const icon = page
        .getByRole("button", { name: "file_export Export", exact: true })
        .getByText("file_export", { exact: true });
      await expect(icon).toBeVisible({ timeout: deadline });
      await icon.evaluate(async (element) => {
        element.dataset.testedIcon = "";
        await document.fonts.ready;
      });

      // Inspect the font Chromium actually used, not just the declared font-family.
      const { root: documentNode } = await cdp.send("DOM.getDocument");
      const { nodeId } = await cdp.send("DOM.querySelector", {
        nodeId: documentNode.nodeId,
        selector: "[data-tested-icon]",
      });
      const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
      expect(
        fonts,
        "The packed Material Symbols font renders the Export icon as one glyph",
      ).toMatchObject([
        { familyName: "Material Symbols Outlined", isCustomFont: true, glyphCount: 1 },
      ]);
      console.log("Packed custom-only.css renders the Export icon with Material Symbols Outlined.");
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
    console.log(`Stopped packed CSS preview: ${origin}`);
  }
} finally {
  await rm(work, { recursive: true, force: true });
}
