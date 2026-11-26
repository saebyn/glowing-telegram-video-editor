import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  blockedOutput,
  compiled,
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
    timeline.getByRole("group", { name: `Track: ${label}`, exact: true }).boundingBox(),
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

test("a replacement pool can preview and release a native drag without a JSON payload", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto("/iframe.html?id=testing-sequence-pool-handoff--replacement-pool&viewMode=story");
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await expect(timeline).toBeVisible({ timeout: 20_000 });
  // The empty timeline displays one frame across its width; the right half rounds to frame 1.
  const { xAt, y } = await trackGeometry(timeline, "Main", 1);
  const source = page.getByRole("button", { name: "Drag Example clip" });
  const card = await source.boundingBox();
  if (!card) throw new Error("Expected a draggable replacement pool clip");
  const preview = timeline.getByRole("figure", { name: "Proposed placement: Example clip" });
  const undo = page.getByRole("button", { name: "Undo", exact: true });

  async function previewDrop() {
    await page.mouse.move(card!.x + card!.width / 2, card!.y + card!.height / 2);
    await page.mouse.down();
    await page.mouse.move(xAt(0.75) - 2, y, { steps: 12 });
    await page.mouse.move(xAt(0.75), y);
    await expect(preview).toBeVisible();
    await expect(timeline.getByRole("status")).toHaveText("Example clip → Main · Sequence frame 1");
    expect(await emissions()).toEqual(noEdits);
  }

  await previewDrop();
  // The replacement pool can end the handoff while the native gesture is still active.
  await page
    .getByRole("button", { name: "End clip handoff" })
    .evaluate((button) => (button as HTMLButtonElement).click());
  await expect(preview).toHaveCount(0);
  await page.mouse.up();
  expect(await emissions()).toEqual(noEdits);
  await expect(undo).toBeDisabled();

  await previewDrop();
  await page.mouse.up();
  await expect.poll(emissions).toEqual({
    sequences: [
      {
        tracks: [
          {
            id: "main",
            label: "Main",
            placements: [{ id: expect.any(String), clipId: "clip", sequenceStartFrame: 1 }],
          },
        ],
      },
    ],
    cutListResults: [blockedOutput],
  });
  await undo.click();
  await expect(timeline.getByRole("button", { name: "Example clip" })).toHaveCount(0);
  const undone = await emissions();
  expect(undone.sequences).toHaveLength(2);
  expect(undone.sequences[1]).toEqual({
    tracks: [{ id: "main", label: "Main", placements: [] }],
  });
  expect(undone.cutListResults).toEqual([blockedOutput, blockedOutput]);
});

test("frame-based actions place without a drag and reject a move invalidated by the host", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(
    "/iframe.html?id=testing-sequence-pool-handoff--frame-based-actions&viewMode=story",
  );
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await expect(timeline).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Preview placement move" }).click();
  await expect(page.getByLabel("Move preview")).toHaveText("Move to 60");
  expect(await emissions()).toEqual(noEdits);
  await page.getByRole("button", { name: "Host locks destination" }).click();
  await page.getByRole("button", { name: "Release placement move" }).click();
  await expect(timeline.getByText("Duration: 00:02")).toBeVisible();
  expect(await emissions()).toEqual(noEdits);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();

  await page.reload();
  await page.getByRole("button", { name: "Place clip without dragging" }).click();
  await expect(timeline.getByText("Duration: 00:04")).toBeVisible();
  const placed = await emissions();
  expect(placed.sequences).toHaveLength(1);
  expect(placed.sequences[0].tracks[0].placements[1]).toMatchObject({
    clipId: "clip",
    sequenceStartFrame: 120,
  });
  expect(placed.cutListResults).toHaveLength(1);
  expect(placed.cutListResults[0]).toHaveProperty("ok", true);
});

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
    cutListResults: [
      compiled({
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
      }),
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
    cutListResults: [blockedOutput],
  });
  await expect(lighthouse).toHaveCount(3);
  await expect(timeline).toContainText("Duration: 00:06.5");
  await expect(preview).toHaveCount(0);
});

test("a pool drop cannot place before zero and extends at the exact frame in a panned view", async ({
  page,
}) => {
  const { timeline, startDrag, emissions } = await openDropStory(page, layeredEditStoryId);
  const { xAt, y } = await trackGeometry(timeline, "Alternate", 240);
  const width = xAt(240) - xAt(0);
  const ruler = timeline.locator(".timeline-editor-time-area-interact");
  const rail = (await ruler.boundingBox())!;
  const readout = page.getByLabel("Sequence playhead position");
  const preview = timeline.getByRole("figure", { name: "Proposed placement: Lighthouse" });
  await ruler.click({ position: { x: width / 2, y: rail.height * 0.75 } });
  await expect(readout).toHaveText("Sequence frame 120");
  await page.mouse.move(xAt(120), y);
  await page.mouse.wheel(-width, 0);
  await expect(timeline.getByRole("slider", { name: "Sequence playhead" })).toBeHidden();
  await startDrag(xAt(60), y); // The left edge is at −240, so this targets −180.
  await expect(preview).toHaveCount(0);
  await page.mouse.up();
  expect(await emissions()).toEqual(noEdits);
  await ruler.click({ position: { x: width / 4, y: rail.height * 0.75 } });
  await expect(readout).toHaveText("Sequence frame 0");

  await page.mouse.move(xAt(120), y);
  await page.mouse.wheel(2 * width, 0);
  await ruler.click({ position: { x: width / 4, y: rail.height * 0.75 } });
  await expect(readout).toHaveText("Sequence frame 240");
  await startDrag(xAt(60), y);
  await expect(timeline.getByRole("status")).toHaveText(
    "Lighthouse → Alternate · Sequence frame 300",
  );
  expect((await preview.boundingBox())?.x).toBeCloseTo(xAt(60) + 1, 0);
  expect(await emissions()).toEqual(noEdits);
  await page.mouse.up();
  const result = await emissions();
  expect(result.sequences).toHaveLength(1);
  expect(result.sequences[0].tracks[2].placements.at(-1)).toMatchObject({
    clipId: "lighthouse",
    sequenceStartFrame: 300,
  });
  expect(result.cutListResults).toEqual([blockedOutput]);
});

test("hovering a pool clip over a bounded gap previews the exact fitted placement before drop", async ({
  page,
}) => {
  const { timeline, startDrag, emissions } = await openDropStory(page, roughCutStoryId);
  const issues = page.getByRole("region", { name: "CutList issues" });
  await expect(issues).toContainText("120 inclusive – 240 exclusive");
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
    cutListResults: [
      compiled({
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
      }),
    ],
  });
  await expect(timeline).toContainText("Duration: 00:06");
  await expect(preview).toHaveCount(0);
  await expect(issues).toHaveCount(0);
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
