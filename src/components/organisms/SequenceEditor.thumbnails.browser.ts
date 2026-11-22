import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  layeredEditStoryId,
  noEdits,
  recordEditorEmissions,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

test("a placement shows only thumbnails in its effective native source range", async ({ page }) => {
  // The second Harbor uses [120, 240), which extends beyond the clip's original out point (234).
  const { harbors } = await openThumbnails(page, [240, 237, 119, 120, 260]);
  await expectThumbnails(harbors.last(), ["harbor-frame-120", "harbor-frame-237"]);
});

test("a trailing trim changes thumbnail eligibility only for the trimmed placement", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  const { timeline, harbors } = await openThumbnails(page, [119, 237]);
  const opening = harbors.first();
  const closing = harbors.last();
  await expectThumbnails(opening, ["harbor-frame-119"]);
  await expectThumbnails(closing, ["harbor-frame-237"]);

  const grip = timeline.getByRole("button", { name: "Trim trailing edge: Harbor" }).last();
  const [placementBox, gripBox] = await Promise.all([closing.boundingBox(), grip.boundingBox()]);
  if (!placementBox || !gripBox) throw new Error("Expected a visible placement and trim grip");
  const x = Math.round(gripBox.x + gripBox.width / 2);
  const y = gripBox.y + gripBox.height / 2;
  // The closing placement spans 120 frames. Make source frame 237 the exclusive out point.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - Math.round(placementBox.width / 40), y);
  await expect(timeline.getByRole("status")).toHaveText("Harbor · Sequence frame 357");
  expect(await emissions()).toStrictEqual(noEdits);
  await expectThumbnails(closing, ["harbor-frame-237"]);

  await page.mouse.up();
  await expectThumbnails(closing, []);
  await expect(closing).toBeVisible();
  await expectThumbnails(opening, ["harbor-frame-119"]);
  await closing.click();
  await expect(closing).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Source out (exclusive frame)")).toHaveValue("237");
});

test("placements stay readable and selectable without timed source thumbnails", async ({
  page,
}) => {
  const query = new URLSearchParams({
    id: layeredEditStoryId,
    viewMode: "story",
    // Harbor has no matching source metadata; Lighthouse has a source but no timed thumbnails.
    args: "sources[0].id:unmapped",
  });
  await page.goto(`/iframe.html?${query}`);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true }).last();
  for (const placement of [harbor, lighthouse]) {
    await expect(placement).toBeVisible();
    await expectThumbnails(placement, []);
    await placement.click();
    await expect(placement).toHaveAttribute("aria-pressed", "true");
  }
});

async function openThumbnails(page: Page, frames: number[]) {
  const args = [
    // Leave room after the closing Harbor to exercise its trim away from the scroll edge.
    "sequence.durationFrames:480",
    ...frames.flatMap((frame, index) => [
      `sources[0].keyframes[${index}].sourceFrame:${frame}`,
      `sources[0].keyframes[${index}].url:harbor-frame-${frame}`,
    ]),
  ].join(";");
  const query = new URLSearchParams({ id: roughCutStoryId, viewMode: "story", args });
  // Use URL-safe relative paths in Storybook args and serve a local image for each path.
  await page.route(/\/harbor-frame-\d+$/, (route) =>
    route.fulfill({ contentType: "image/svg+xml", path: "src/fixtures/sequence-harbor.svg" }),
  );
  await page.goto(`/iframe.html?${query}`);

  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbors = timeline.getByRole("button", { name: "Harbor", exact: true });
  await expect(harbors.last()).toBeVisible({ timeout: 20_000 });
  return { timeline, harbors };
}

async function expectThumbnails(placement: Locator, urls: string[]) {
  const images = placement.locator("img");
  await expect(images).toHaveCount(urls.length);
  for (const [index, url] of urls.entries()) {
    const image = images.nth(index);
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute("src", url);
    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
      .toBeGreaterThan(0);
  }
}
