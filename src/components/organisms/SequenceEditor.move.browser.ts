import { expect, test, type Page } from "@playwright/test";
import type { CutList } from "@saebyn/glowing-telegram-types";
import type { Sequence } from "@/types";
import {
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

async function openFadedMove(page: Page) {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    "sequence.durationFrames": 372,
    "sequence.tracks[0].placements[1].id": "lighthouse-close",
    "sequence.tracks[0].placements[1].clipId": "lighthouse",
    "sequence.tracks[0].placements[1].sourceInOffsetFrames": -6,
    "sequence.tracks[0].placements[1].entryTransitionFrames": 30,
  });
  return emissions;
}

test("moving a placement preserves duration, trims and its fade, leaving an uncovered tail", async ({
  page,
}) => {
  const expectedSequence: Sequence = {
    durationFrames: 372,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          { id: "harbor-open", clipId: "harbor", sequenceStartFrame: 0 },
          {
            id: "lighthouse-close",
            clipId: "lighthouse",
            sequenceStartFrame: 120,
            sourceInOffsetFrames: -6,
            sourceOutOffsetFrames: 6,
            entryTransitionFrames: 30,
          },
        ],
      },
    ],
  };

  const emissions = await openFadedMove(page);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await expect(lighthouse).toBeVisible({ timeout: 15_000 });
  expect(await emissions()).toStrictEqual(noEdits);

  const [first, last] = await Promise.all([harbor.boundingBox(), lighthouse.boundingBox()]);
  if (!first || !last || first.x + first.width >= last.x) {
    throw new Error("Expected a gap between Harbor and Lighthouse");
  }
  const startX = last.x + last.width / 2;
  const rowY = last.y + last.height / 2;
  const pixelsFor120Frames = (last.x - first.x) / 2;

  async function dragTo(x: number) {
    await page.mouse.move(startX, rowY);
    await page.mouse.down();
    await page.mouse.move(x, rowY, { steps: 12 });
    expect(await emissions()).toStrictEqual(noEdits);
    await page.mouse.up();
  }

  // Releasing over Harbor, starting before frame zero, or returning to the
  // original position commits neither callback.
  await dragTo(startX - 2 * pixelsFor120Frames);
  expect(await emissions()).toStrictEqual(noEdits);
  await page.mouse.move(startX, rowY);
  await page.mouse.down();
  await page.mouse.move(startX - (250 / 120) * pixelsFor120Frames, rowY, { steps: 12 });
  await expect(timeline.getByRole("status")).toContainText(
    "Sequence frame -10 · Blocked: Cannot start before sequence frame 0",
  );
  await page.mouse.up();
  expect(await emissions()).toStrictEqual(noEdits);
  await page.mouse.move(startX, rowY);
  await page.mouse.down();
  await page.mouse.move(startX - pixelsFor120Frames / 4, rowY, { steps: 4 });
  await page.mouse.move(startX, rowY, { steps: 4 });
  await page.mouse.up();
  expect(await emissions()).toStrictEqual(noEdits);
  await expect(lighthouse).toHaveAttribute("aria-pressed", "false");

  // The placement now starts immediately after Harbor, leaving the last 120 frames uncovered.
  await dragTo(startX - pixelsFor120Frames);
  await expect.poll(emissions).toStrictEqual({ sequences: [expectedSequence], cutLists: [null] });
  await expect(timeline).toContainText("Duration: 00:06.2");
  await expect(timeline.getByText("Fade in", { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await lighthouse.boundingBox())?.x)
    .toBeCloseTo(first.x + pixelsFor120Frames, 0);
});

test("moving a placement to an upper track covers the lower track at the matching source frames", async ({
  page,
}) => {
  const expectedSequence: Sequence = {
    durationFrames: 240,
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
          {
            id: "lighthouse-alternate",
            clipId: "lighthouse",
            sequenceStartFrame: 60,
            sourceInOffsetFrames: 6,
            sourceOutOffsetFrames: -6,
          },
        ],
      },
      {
        id: "main",
        label: "Main",
        placements: [
          { id: "harbor-bed", clipId: "harbor", sequenceStartFrame: 0, sourceOutOffsetFrames: 120 },
        ],
      },
      { id: "alternate", label: "Alternate", placements: [] },
    ],
  };
  // The Cutaways Lighthouse placements cover [0, 60) and [60, 168).
  // Harbor resumes at source frame 114 + 168 rather than restarting its range.
  const expectedCutList: CutList = {
    version: "1.0.0",
    inputMedia: [
      {
        s3Location: "s3://sequence-fixtures/lighthouse.mp4",
        sections: [
          { startFrame: 501, endFrame: 561 },
          { startFrame: 507, endFrame: 615 },
        ],
      },
      {
        s3Location: "s3://sequence-fixtures/harbor.mp4",
        sections: [{ startFrame: 282, endFrame: 354 }],
      },
    ],
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 0, sectionIndex: 1 },
      { mediaIndex: 1, sectionIndex: 0 },
    ],
  };

  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true }).last();
  const harbor = timeline.getByText("Harbor", { exact: true });
  const cutaways = timeline.getByText("Cutaways", { exact: true });
  const alternate = timeline.getByText("Alternate", { exact: true });
  await expect(lighthouse).toBeVisible({ timeout: 15_000 });
  const [source, middle, top, bottom] = await Promise.all([
    lighthouse.boundingBox(),
    harbor.boundingBox(),
    cutaways.boundingBox(),
    alternate.boundingBox(),
  ]);
  if (!source || !middle || !top || !bottom) throw new Error("Expected three visible tracks");
  const startX = source.x + source.width / 2;
  const startY = source.y + source.height / 2;
  const endX = startX - (source.x - middle.x) / 2;

  async function startDragTo(endY: number) {
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 12 });
    expect(await emissions()).toStrictEqual(noEdits);
  }

  // The Main track is occupied. A release below all tracks also has no destination.
  await startDragTo(middle.y + middle.height / 2);
  await expect(timeline.getByRole("status")).toContainText("Overlaps another placement on Main");
  await page.mouse.up();
  expect(await emissions()).toStrictEqual(noEdits);
  await startDragTo(bottom.y + bottom.height + 8);
  await expect(timeline.getByRole("status")).toContainText("Drop onto an existing track");
  await page.mouse.up();
  expect(await emissions()).toStrictEqual(noEdits);
  await startDragTo(top.y + top.height / 2);

  await expect(timeline.getByRole("status")).toHaveText(
    "Lighthouse → Cutaways · Sequence frame 60",
  );
  const preview = timeline.getByRole("figure", { name: "Proposed placement: Lighthouse" });
  await expect(preview).toBeVisible();
  const draft = await preview.boundingBox();
  if (!draft) throw new Error("Expected a visible placement preview");
  expect(draft.x).toBeCloseTo(middle.x + (source.x - middle.x) / 2, 0);
  expect(draft.y + draft.height / 2).toBeCloseTo(top.y + top.height / 2, 0);
  expect(draft.width).toBeCloseTo(source.width, 0);
  expect(await emissions()).toStrictEqual(noEdits);

  await page.mouse.up();
  await expect.poll(emissions).toStrictEqual({
    sequences: [expectedSequence],
    cutLists: [expectedCutList],
  });
  await expect(preview).toHaveCount(0);
  await expect.poll(async () => (await lighthouse.boundingBox())?.y).toBeLessThan(middle.y);
});

test("a placement can preview beyond the endpoint at the same scale and extend on release", async ({
  page,
}) => {
  const emissions = await openFadedMove(page);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await expect(lighthouse).toBeVisible({ timeout: 15_000 });
  const [first, last] = await Promise.all([harbor.boundingBox(), lighthouse.boundingBox()]);
  if (!first || !last) throw new Error("Expected two placements");
  const pixelsPerFrame = (last.x - first.x) / 240;
  const grabOffset = 10;
  const y = first.y + first.height / 2;
  const endpoint = first.x + 372 * pixelsPerFrame;
  await page.mouse.move(first.x + grabOffset, y);
  await page.mouse.down();
  await page.mouse.move(endpoint - 12, y, { steps: 12 });

  // Holding near the right edge opens the later sequence frames without zooming.
  await expect
    .poll(async () => (await lighthouse.boundingBox())?.x ?? last.x)
    .toBeLessThan(last.x - 80);
  await page.mouse.move(endpoint - 70, y);
  const scrolled = await lighthouse.boundingBox();
  if (!scrolled) throw new Error("Expected Lighthouse to remain visible when scrolling");
  expect(scrolled.width).toBeCloseTo(last.width, 0);

  // Harbor spans 120 sequence frames; moving it to 375 ends at 495.
  const destination = scrolled.x + 135 * pixelsPerFrame;
  await page.mouse.move(destination + grabOffset, y);
  await expect(timeline.getByRole("status")).toContainText("Sequence frame 375");
  const preview = await timeline
    .getByRole("figure", { name: "Proposed placement: Harbor" })
    .boundingBox();
  if (!preview) throw new Error("Expected Harbor preview");
  expect(preview.x).toBeCloseTo(destination, 0);
  expect(preview.width).toBeCloseTo(first.width, 0);
  await expect(timeline).toContainText("Duration: 00:06.2");
  expect(await emissions()).toStrictEqual(noEdits);

  await page.mouse.up();
  await expect.poll(emissions).toStrictEqual({
    sequences: [
      {
        durationFrames: 495,
        tracks: [
          {
            id: "main",
            label: "Main",
            placements: [
              { id: "harbor-open", clipId: "harbor", sequenceStartFrame: 375 },
              {
                id: "lighthouse-close",
                clipId: "lighthouse",
                sequenceStartFrame: 240,
                sourceInOffsetFrames: -6,
                sourceOutOffsetFrames: 6,
                entryTransitionFrames: 30,
              },
            ],
          },
        ],
      },
    ],
    cutLists: [null],
  });
});

test("Escape cancels a valid move before release without changing the sequence or selection", async ({
  page,
}) => {
  const emissions = await openFadedMove(page);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await expect(lighthouse).toBeVisible({ timeout: 15_000 });
  const [first, last] = await Promise.all([harbor.boundingBox(), lighthouse.boundingBox()]);
  if (!first || !last) throw new Error("Expected two placements");
  const x = last.x + last.width / 2;
  const y = last.y + last.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - (last.x - first.x) / 2, y, { steps: 12 });
  const preview = timeline.getByRole("figure", { name: "Proposed placement: Lighthouse" });
  await expect(preview).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  await page.mouse.up();
  expect(await emissions()).toStrictEqual(noEdits);
  await expect(lighthouse).toHaveAttribute("aria-pressed", "false");
  expect((await lighthouse.boundingBox())?.x).toBe(last.x);
});

test("resizing the timeline cancels a pending drop rather than moving to another frame", async ({
  page,
}) => {
  const emissions = await openFadedMove(page);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await expect(lighthouse).toBeVisible({ timeout: 15_000 });
  const [first, last] = await Promise.all([harbor.boundingBox(), lighthouse.boundingBox()]);
  if (!first || !last) throw new Error("Expected two placements");
  const { width, height } = page.viewportSize()!;
  const x = last.x + last.width / 2;
  const y = last.y + last.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - (last.x - first.x) / 2, y, { steps: 12 });
  const preview = timeline.getByRole("figure", { name: "Proposed placement: Lighthouse" });
  await expect(preview).toBeVisible();

  await page.setViewportSize({ width: width + 180, height });
  await expect(preview).toHaveCount(0);
  await page.mouse.up();
  expect(await emissions()).toStrictEqual(noEdits);
  await expect(lighthouse).toHaveAttribute("aria-pressed", "false");
});
