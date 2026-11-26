import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  layeredEditStoryId,
  noEdits,
  recordEditorEmissions,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

test("hovering two clips from one source cycles through each clip's frames in native source order", async ({
  page,
}) => {
  await openThumbnails(
    page,
    [294, 240, 233, 113, 234, 114],
    [
      // The reusable Harbor and Departure ranges are [114, 234) and [234, 294).
      // This source runs at 30 fps in a 60 fps project.
      "clips[0].sourceFrameRate.numerator:30",
      "clips[2].sourceFrameRate.numerator:30",
    ],
  );
  const now = new Date("2025-01-01T00:00:00Z");
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));

  for (const [name, first, second] of [
    ["Harbor", "harbor-frame-114", "harbor-frame-233"],
    ["Departure", "harbor-frame-234", "harbor-frame-240"],
  ]) {
    const clip = poolCard(page, name);
    await clip.hover();
    await expect
      .poll(() => hoverFrames(clip), { message: `${name} starts at its in point` })
      .toEqual([first]);
    await expectNextHoverFrame(page, clip, first, second);
    await expectNextHoverFrame(page, clip, second, first);
  }
});

test("a clip keeps its static thumbnail on hover when no source frame is in range", async ({
  page,
}) => {
  // Departure uses [234, 294), so neither the preceding frame nor its out point qualifies.
  await openThumbnails(page, [233, 294]);
  const departure = poolCard(page, "Departure");
  await expectStaticHarborThumbnail(departure);
  await departure.hover();
  await expectStaticHarborThumbnail(departure);
});

test("a placement shows only thumbnails in its effective native source range", async ({ page }) => {
  // The second Harbor uses [120, 240), which extends beyond the clip's original out point (234).
  const { harbors } = await openThumbnails(page, [240, 237, 113, 119, 120, 114, 260]);
  await expectThumbnails(harbors.first(), [
    "harbor-frame-114",
    "harbor-frame-119",
    "harbor-frame-120",
  ]);
  await expectThumbnails(harbors.last(), ["harbor-frame-120", "harbor-frame-237"]);
});

test("a trailing trim changes thumbnail eligibility only for the trimmed placement", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  const { timeline, harbors } = await openThumbnails(
    page,
    [119, 237],
    [
      // Leave room after the closing Harbor to exercise its trim away from the scroll edge.
      "sequence.tracks[0].placements[2].id:departure-tail",
      "sequence.tracks[0].placements[2].clipId:departure",
      "sequence.tracks[0].placements[2].sequenceStartFrame:420",
    ],
  );
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
    args: "sources.harbor-recording:!undefined",
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

function poolCard(page: Page, name: string) {
  return page
    .getByRole("heading", { name: "Clip Pool" })
    .locator("..")
    .locator('[draggable="true"]')
    .filter({ hasText: name });
}

async function hoverFrames(clip: Locator) {
  return (await cardImageUrls(clip)).filter((url) => /^harbor-frame-\d+$/.test(url));
}

async function cardImageUrls(clip: Locator) {
  return clip.locator("*").evaluateAll((elements) =>
    elements.flatMap((element) => {
      const imageUrl = getComputedStyle(element).backgroundImage.match(/^url\("(.+)"\)$/);
      return imageUrl ? [new URL(imageUrl[1]).pathname.replace(/^.*\//, "")] : [];
    }),
  );
}

async function expectStaticHarborThumbnail(clip: Locator) {
  await expect
    .poll(() => cardImageUrls(clip))
    .toEqual([expect.stringMatching(/^sequence-harbor(?:-[\w-]+)?\.svg$/)]);
}

async function expectNextHoverFrame(page: Page, clip: Locator, previous: string, next: string) {
  await expect
    .poll(
      async () => {
        await page.clock.runFor(20);
        return hoverFrames(clip);
      },
      { intervals: [10], message: `hover advances from ${previous} to ${next}` },
    )
    .not.toEqual([previous]);
  expect(await hoverFrames(clip), `hover advances from ${previous} to ${next}`).toEqual([next]);
}

async function openThumbnails(page: Page, frames: number[], extraArgs: string[] = []) {
  const args = [
    ...frames.flatMap((frame, index) => [
      `sources.harbor-recording.frameThumbnails[${index}].sourceFrame:${frame}`,
      `sources.harbor-recording.frameThumbnails[${index}].url:harbor-frame-${frame}`,
    ]),
    ...extraArgs,
  ].join(";");
  const query = new URLSearchParams({ id: roughCutStoryId, viewMode: "story", args });
  // Use URL-safe relative paths in Storybook args and serve local stills for both clip ranges.
  await page.route(/\/harbor-frame-\d+$/, (route) => {
    const sourceFrame = Number(route.request().url().match(/\d+$/)?.[0]);
    const fixture = sourceFrame < 234 ? "sequence-harbor" : "sequence-harbor-departure";
    return route.fulfill({ contentType: "image/svg+xml", path: `src/fixtures/${fixture}.svg` });
  });
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
