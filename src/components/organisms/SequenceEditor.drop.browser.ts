import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

async function openDropStory(page: Page, story: Parameters<typeof openWorkflow>[1]) {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, story);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const pool = page.getByRole("heading", { name: "Clip Pool" }).locator("..");
  const lighthouse = pool.locator('[draggable="true"]').filter({ hasText: "Lighthouse" });
  await expect(lighthouse).toBeVisible({ timeout: 15_000 });

  async function startDrag(x: number, y: number) {
    const card = await lighthouse.boundingBox();
    if (!card) throw new Error("Expected the draggable Lighthouse pool card");
    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
    await page.mouse.down();
    await page.mouse.move(x - 2, y, { steps: 24 });
    // Chromium needs another dragover after entering the target before mouseup.
    await page.mouse.move(x, y);
  }

  return {
    timeline,
    startDrag,
    emissions,
  };
}

async function trackGeometry(timeline: Locator, label: string, duration: number) {
  const [row, timelineBox] = await Promise.all([
    timeline.getByText(label, { exact: true }).boundingBox(),
    timeline.boundingBox(),
  ]);
  if (!row || !timelineBox) throw new Error(`Expected the ${label} track`);
  const zero = row.x + row.width;
  const end = timelineBox.x + timelineBox.width;
  const pixelsPerFrame = (end - zero) / duration;
  return {
    xAt: (frame: number) => zero + frame * pixelsPerFrame,
    y: row.y + row.height / 2,
    pixelsPerFrame,
  };
}

test("a pool drop on Cutaways extends the sequence and emits one exact CutList", async ({
  page,
}) => {
  const { timeline, startDrag, emissions } = await openDropStory(page, layeredEditStoryId);
  const { xAt, y } = await trackGeometry(timeline, "Cutaways", 240);

  // The existing Lighthouse covers [0, 60), Harbor supplies [60, 225),
  // and the new Lighthouse covers [225, 345), superseding both lower tracks.
  await startDrag(xAt(225), y);
  await expect(timeline).toContainText("Duration: 00:04");
  expect(await emissions()).toStrictEqual(noEdits);
  await page.mouse.up();

  await expect.poll(emissions).toStrictEqual({
    sequences: [
      {
        durationFrames: 345,
        tracks: [
          {
            id: "cutaways",
            label: "Cutaways",
            placements: [
              {
                id: "lighthouse-open",
                clipId: "lighthouse",
                sequenceStartFrame: 0,
                sourceOutOffsetFrames: -60,
              },
              { id: expect.any(String), clipId: "lighthouse", sequenceStartFrame: 225 },
            ],
          },
          {
            id: "main",
            label: "Main",
            placements: [
              {
                id: "harbor-bed",
                clipId: "harbor",
                sequenceStartFrame: 0,
                sourceOutOffsetFrames: 120,
              },
            ],
          },
          {
            id: "alternate",
            label: "Alternate",
            placements: [
              {
                id: "lighthouse-alternate",
                clipId: "lighthouse",
                sequenceStartFrame: 120,
                sourceInOffsetFrames: 6,
                sourceOutOffsetFrames: -6,
              },
            ],
          },
        ],
      },
    ],
    cutLists: [
      {
        version: "1.0.0",
        inputMedia: [
          {
            s3Location: "s3://sequence-fixtures/lighthouse.mp4",
            sections: [
              { startFrame: 501, endFrame: 561 },
              { startFrame: 501, endFrame: 621 },
            ],
          },
          {
            s3Location: "s3://sequence-fixtures/harbor.mp4",
            sections: [{ startFrame: 174, endFrame: 339 }],
          },
        ],
        outputTrack: [
          { mediaIndex: 0, sectionIndex: 0 },
          { mediaIndex: 1, sectionIndex: 0 },
          { mediaIndex: 0, sectionIndex: 1 },
        ],
      },
    ],
  });
  await expect(timeline.getByRole("button", { name: "Lighthouse", exact: true })).toHaveCount(3);
  await expect(timeline).toContainText("Duration: 00:05.75");
});

test("a pool drop on an occupied part of Alternate does not extend or commit", async ({ page }) => {
  const { timeline, startDrag, emissions } = await openDropStory(page, layeredEditStoryId);
  const { xAt, y } = await trackGeometry(timeline, "Alternate", 240);
  // [180, 300) would extend the sequence, but it overlaps Alternate's [120, 228).
  await startDrag(xAt(180), y);
  await expect(timeline.getByRole("status")).toHaveText(
    "Lighthouse → Alternate · Sequence frame 180 · Blocked: Overlaps another placement on Alternate",
  );
  const preview = timeline.getByRole("figure", { name: "Proposed placement: Lighthouse" });
  await expect(preview).toBeVisible();
  expect(await emissions()).toStrictEqual(noEdits);
  await page.mouse.up();

  expect(await emissions()).toStrictEqual(noEdits);
  await expect(preview).toHaveCount(0);
  await expect(timeline).toContainText("Duration: 00:04");
  await expect(timeline.getByRole("button", { name: "Lighthouse", exact: true })).toHaveCount(2);
});

test("holding a pool clip at the right edge reaches past the endpoint without changing scale", async ({
  page,
}) => {
  const { timeline, startDrag, emissions } = await openDropStory(page, layeredEditStoryId);
  const { xAt, y, pixelsPerFrame } = await trackGeometry(timeline, "Alternate", 240);
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const before = await lighthouse.last().boundingBox();
  if (!before) throw new Error("Expected Lighthouse on Alternate");

  await startDrag(xAt(240) - 12, y);
  // Scroll far enough that frame 270 will be safely away from the right scroll zone.
  await expect
    .poll(async () => (await lighthouse.last().boundingBox())?.x ?? before.x)
    .toBeLessThan(before.x - 30 * pixelsPerFrame - 50);
  await page.mouse.move(xAt(180) - 2, y);
  await page.mouse.move(xAt(180), y);
  // Wait for the final native dragover and the widget's pending scroll render.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  const after = await lighthouse.last().boundingBox();
  if (!after) throw new Error("Expected Lighthouse to remain visible after scrolling");
  expect(after.width).toBeCloseTo(before.width, 0);
  const destination = xAt(270) - (before.x - after.x);
  await page.mouse.move(destination - 2, y);
  await page.mouse.move(destination, y);
  await expect(timeline.getByRole("status")).toHaveText(
    "Lighthouse → Alternate · Sequence frame 270",
  );
  const preview = timeline.getByRole("figure", { name: "Proposed placement: Lighthouse" });
  await expect(preview).toBeVisible();
  expect((await preview.boundingBox())?.x).toBeCloseTo(destination + 1, 0);
  await expect(timeline).toContainText("Duration: 00:04");
  expect(await emissions()).toStrictEqual(noEdits);
  await page.mouse.up();

  await expect.poll(emissions).toStrictEqual({
    sequences: [
      {
        durationFrames: 390,
        tracks: [
          {
            id: "cutaways",
            label: "Cutaways",
            placements: [
              {
                id: "lighthouse-open",
                clipId: "lighthouse",
                sequenceStartFrame: 0,
                sourceOutOffsetFrames: -60,
              },
            ],
          },
          {
            id: "main",
            label: "Main",
            placements: [
              {
                id: "harbor-bed",
                clipId: "harbor",
                sequenceStartFrame: 0,
                sourceOutOffsetFrames: 120,
              },
            ],
          },
          {
            id: "alternate",
            label: "Alternate",
            placements: [
              {
                id: "lighthouse-alternate",
                clipId: "lighthouse",
                sequenceStartFrame: 120,
                sourceInOffsetFrames: 6,
                sourceOutOffsetFrames: -6,
              },
              { id: expect.any(String), clipId: "lighthouse", sequenceStartFrame: 270 },
            ],
          },
        ],
      },
    ],
    cutLists: [null],
  });
  await expect(lighthouse).toHaveCount(3);
  await expect(timeline).toContainText("Duration: 00:06.5");
  await expect(preview).toHaveCount(0);
});

test("hovering a pool clip over a bounded gap previews the exact fitted placement before drop", async ({
  page,
}) => {
  const { timeline, startDrag, emissions } = await openDropStory(page, roughCutStoryId);
  const { xAt, y, pixelsPerFrame } = await trackGeometry(timeline, "Main", 360);
  // Lighthouse spans 120 frames. A drop near the center of [120, 240) fits only at 120.
  await startDrag(xAt(180), y);
  await expect(timeline.getByRole("status")).toHaveText("Lighthouse → Main · Sequence frame 120");
  const preview = timeline.getByRole("figure", { name: "Proposed placement: Lighthouse" });
  await expect(preview).toBeVisible();
  const box = (await preview.boundingBox())!;
  expect(box.x).toBeCloseTo(xAt(120) + 1, 0);
  expect(box.y + box.height / 2).toBeCloseTo(y, 0);
  expect(box.width).toBeCloseTo(120 * pixelsPerFrame - 2, 0);
  await expect(timeline.getByRole("button", { name: "Lighthouse", exact: true })).toHaveCount(0);
  expect(await emissions()).toStrictEqual(noEdits);
  await page.mouse.up();

  await expect.poll(emissions).toStrictEqual({
    sequences: [
      {
        durationFrames: 360,
        tracks: [
          {
            id: "main",
            label: "Main",
            placements: [
              { id: "harbor-open", clipId: "harbor", sequenceStartFrame: 0 },
              {
                id: "harbor-close",
                clipId: "harbor",
                sequenceStartFrame: 240,
                sourceInOffsetFrames: 6,
                sourceOutOffsetFrames: 6,
              },
              { id: expect.any(String), clipId: "lighthouse", sequenceStartFrame: 120 },
            ],
          },
        ],
      },
    ],
    cutLists: [
      {
        version: "1.0.0",
        inputMedia: [
          {
            s3Location: "s3://sequence-fixtures/harbor.mp4",
            sections: [
              { startFrame: 114, endFrame: 234 },
              { startFrame: 120, endFrame: 240 },
            ],
          },
          {
            s3Location: "s3://sequence-fixtures/lighthouse.mp4",
            sections: [{ startFrame: 501, endFrame: 621 }],
          },
        ],
        outputTrack: [
          { mediaIndex: 0, sectionIndex: 0 },
          { mediaIndex: 1, sectionIndex: 0 },
          { mediaIndex: 0, sectionIndex: 1 },
        ],
      },
    ],
  });
  await expect(timeline).toContainText("Duration: 00:06");
  await expect(preview).toHaveCount(0);
});

test("leaving the tracks clears a pool preview without committing an edit", async ({ page }) => {
  const { timeline, startDrag, emissions } = await openDropStory(page, roughCutStoryId);
  const { xAt, y } = await trackGeometry(timeline, "Main", 360);
  const preview = timeline.getByRole("figure", { name: "Proposed placement: Lighthouse" });
  await startDrag(xAt(180), y);
  await expect(preview).toBeVisible();

  const heading = await timeline.getByRole("heading", { name: "Sequence timeline" }).boundingBox();
  if (!heading) throw new Error("Expected the timeline heading above the tracks");
  await page.mouse.move(xAt(180), heading.y + heading.height / 2, { steps: 4 });
  await expect(preview).toHaveCount(0);
  await expect(timeline.getByRole("status")).toHaveCount(0);
  await page.mouse.up();

  expect(await emissions()).toStrictEqual(noEdits);
  await expect(timeline).toContainText("Duration: 00:06");
});
