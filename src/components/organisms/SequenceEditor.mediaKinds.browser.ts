import { expect, test, type Page } from "@playwright/test";
import {
  layeredEditStoryId,
  noEdits,
  recordEditorEmissions,
} from "./SequenceEditor.browserHarness";

test("the clip pool labels the host-supplied media kinds", async ({ page }) => {
  await openMediaKinds(page, [
    "sources.harbor-recording.mediaKind:video-only",
    "sources.lighthouse-recording.mediaKind:audio-only",
  ]);

  const pool = page.getByRole("heading", { name: "Clip Pool" }).locator("..");
  const harbor = pool.locator('[draggable="true"]').filter({ hasText: "Harbor" });
  const lighthouse = pool.locator('[draggable="true"]').filter({ hasText: "Lighthouse" });
  await expect(harbor.getByText("Video only", { exact: true })).toBeVisible();
  await expect(lighthouse.getByText("Audio only", { exact: true })).toBeVisible();
});

test("the clip pool labels audio and video without guessing the omitted kind", async ({ page }) => {
  await openMediaKinds(page, ["sources.harbor-recording.mediaKind:audio-video"]);

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
    "sources.harbor-recording.mediaKind:video-only",
    "sources.lighthouse-recording.mediaKind:audio-only",
    "sources.lighthouse-recording.frameThumbnails[0].sourceFrame:515",
    "sources.lighthouse-recording.frameThumbnails[0].url:source-preview-thumb",
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
    "sources.harbor-recording.mediaKind:audio-video",
    "sources.harbor-recording.frameThumbnails[0].sourceFrame:120",
    "sources.harbor-recording.frameThumbnails[0].url:source-preview-thumb",
    "sources.lighthouse-recording.frameThumbnails[0].sourceFrame:515",
    "sources.lighthouse-recording.frameThumbnails[0].url:source-preview-thumb",
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

test("converting an audio transition to a competing dissolve under video is blocked", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openMediaKinds(page, [
    "sources.harbor-recording.mediaKind:video-only",
    "sources.lighthouse-recording.mediaKind:audio-only",
    // Harbor covers [0, 240) in picture. The two Lighthouse placements meet at 120 in sound.
    "initialSequence.tracks[0].placements[0].clipId:harbor",
    "initialSequence.tracks[0].placements[0].sourceOutOffsetFrames:120",
    "initialSequence.tracks[1].placements[0].clipId:lighthouse",
    "initialSequence.tracks[1].placements[0].sourceOutOffsetFrames:0",
    "initialSequence.tracks[2].placements[0].sourceInOffsetFrames:0",
    "initialSequence.tracks[2].placements[0].sourceOutOffsetFrames:0",
    // Load an authored pair (as can result from a move). The Inspector can edit, but not add,
    // a dissolve directly.
    "initialSequence.tracks[1].placements[0].transitionOut.id:outgoing-reveal",
    "initialSequence.tracks[1].placements[0].transitionOut.kind:fade",
    "initialSequence.tracks[1].placements[0].transitionOut.durationFrames:12",
    "initialSequence.tracks[2].placements[0].transitionIn.id:incoming-fade",
    "initialSequence.tracks[2].placements[0].transitionIn.kind:fade",
    "initialSequence.tracks[2].placements[0].transitionIn.durationFrames:12",
  ]);

  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const inspector = page.getByRole("region", { name: "Inspector" });
  const entry = timeline.getByRole("button", { name: "Select entry fade: Lighthouse" });
  await entry.click();
  await inspector.getByRole("combobox", { name: "Type", exact: true }).selectOption("dissolve");
  await inspector.getByRole("button", { name: "Apply", exact: true }).click();

  expect.soft(await emissions()).toStrictEqual(noEdits);
  await expect(inspector.getByRole("alert")).toHaveText(
    "This transition competes with another transition on the same cut or visible frames.",
  );
  await expect(entry).toHaveAttribute("aria-pressed", "true");
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
