import { expect, test, type Page } from "@playwright/test";
import { layeredEditStoryId } from "./SequenceEditor.browserHarness";

test("the clip pool labels the host-supplied media kinds", async ({ page }) => {
  await openMediaKinds(page, [
    "sources[0].mediaKind:video-only",
    "sources[1].mediaKind:audio-only",
  ]);

  const pool = page.getByRole("heading", { name: "Clip Pool" }).locator("..");
  const harbor = pool.locator('[draggable="true"]').filter({ hasText: "Harbor" });
  const lighthouse = pool.locator('[draggable="true"]').filter({ hasText: "Lighthouse" });
  await expect(harbor.getByText("Video only", { exact: true })).toBeVisible();
  await expect(lighthouse.getByText("Audio only", { exact: true })).toBeVisible();
});

test("the clip pool labels audio and video without guessing the omitted kind", async ({ page }) => {
  await openMediaKinds(page, ["sources[0].mediaKind:audio-video"]);

  const pool = page.getByRole("heading", { name: "Clip Pool" }).locator("..");
  const harbor = pool.locator('[draggable="true"]').filter({ hasText: "Harbor" });
  const lighthouse = pool.locator('[draggable="true"]').filter({ hasText: "Lighthouse" });
  await expect(harbor.getByText("Audio and video", { exact: true })).toBeVisible();
  await expect(lighthouse).toBeVisible();
  await expect(lighthouse).not.toContainText(/Audio only|Video only|Audio and video/);
});

test("the timeline distinguishes audio-only placements from video without thumbnails", async ({
  page,
}) => {
  await openMediaKinds(page, [
    "sources[0].mediaKind:video-only",
    "sources[1].mediaKind:audio-only",
    "sources[1].keyframes[0].sourceFrame:515",
    "sources[1].keyframes[0].url:source-preview-thumb",
  ]);

  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: /^Harbor\b/ });
  const lighthouse = timeline.getByRole("button", { name: /^Lighthouse\b/ }).last();
  await expect.soft(harbor.getByText("Video only", { exact: true })).toBeVisible();
  await expect.soft(lighthouse.getByText("Audio only", { exact: true })).toBeVisible();
  await expect(harbor.locator("img")).toHaveCount(0);
  await expect(lighthouse.locator("img")).toHaveCount(0);
  await expect(lighthouse).not.toHaveCSS(
    "background-color",
    await harbor.evaluate((placement) => getComputedStyle(placement).backgroundColor),
  );
});

test("the timeline keeps thumbnails without inferring a media kind", async ({ page }) => {
  await openMediaKinds(page, [
    "sources[0].mediaKind:audio-video",
    "sources[0].keyframes[0].sourceFrame:120",
    "sources[0].keyframes[0].url:source-preview-thumb",
    "sources[1].keyframes[0].sourceFrame:515",
    "sources[1].keyframes[0].url:source-preview-thumb",
  ]);

  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: /^Harbor\b/ });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true }).last();
  await expect.soft(harbor.getByText("Audio and video", { exact: true })).toBeVisible();
  await expect(harbor.locator("img")).toBeVisible();
  await expect(lighthouse.locator("img")).toBeVisible();
  await expect(harbor.locator("img")).toHaveCSS(
    "height",
    await lighthouse.locator("img").evaluate((image) => getComputedStyle(image).height),
  );
  await expect(lighthouse).not.toContainText(/Audio only|Video only|Audio and video/);
  await expect(lighthouse).toHaveCSS(
    "background-color",
    await harbor.evaluate((placement) => getComputedStyle(placement).backgroundColor),
  );
});

async function openMediaKinds(page: Page, args: string[]) {
  const query = new URLSearchParams({
    id: layeredEditStoryId,
    viewMode: "story",
    args: args.join(";"),
  });
  await page.route("**/source-preview-thumb", (route) =>
    route.fulfill({ contentType: "image/svg+xml", path: "src/fixtures/sequence-harbor.svg" }),
  );
  await page.goto(`/iframe.html?${query}`);
  await expect(page.getByRole("region", { name: "Sequence timeline" })).toBeVisible({
    timeout: 20_000,
  });
}
