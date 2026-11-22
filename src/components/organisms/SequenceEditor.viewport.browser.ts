import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

async function visibleBox(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected visible timeline geometry");
  return box;
}

async function openViewport(page: Page) {
  await page.setViewportSize({ width: 1_280, height: 1_100 });
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    "sequence.durationFrames": 480,
    "sequence.tracks[0].placements[1].id": "lighthouse-close",
    "sequence.tracks[0].placements[1].clipId": "lighthouse",
    "sequence.tracks[0].placements[1].sequenceStartFrame": 210,
    "sequence.tracks[0].placements[1].sourceInOffsetFrames": undefined,
    "sequence.tracks[0].placements[1].sourceOutOffsetFrames": undefined,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  return {
    emissions,
    timeline,
    ruler: timeline.locator(".timeline-editor-time-area-interact"),
    playhead: timeline.getByRole("slider", { name: "Sequence playhead" }),
    frameReadout: page.getByLabel("Sequence playhead position"),
    lighthouse: timeline.getByRole("button", { name: "Lighthouse", exact: true }),
    fit: timeline.getByRole("button", { name: "Fit sequence", exact: true }),
    zoomIn: timeline.getByRole("button", { name: "Zoom in", exact: true }),
    zoomOut: timeline.getByRole("button", { name: "Zoom out", exact: true }),
  };
}

test("zooming in from Fit widens placements without moving a visible playhead or editing", async ({
  page,
}) => {
  const { emissions, timeline, ruler, playhead, frameReadout, lighthouse, fit, zoomIn } =
    await openViewport(page);
  await lighthouse.click();
  const rail = await visibleBox(ruler);
  // Seek to frame 192, away from the viewport center, so anchoring to the
  // center instead of the visible playhead would move the grip.
  await page.mouse.click(rail.x + rail.width * 0.4, rail.y + rail.height * 0.75);
  await expect(frameReadout).toHaveText("Sequence frame 192");
  const overview = await visibleBox(lighthouse);
  await zoomIn.click({ timeout: 3_000 });
  await expect
    .poll(async () => (await visibleBox(lighthouse)).width)
    .toBeGreaterThan(overview.width);
  await fit.click();
  const fitted = await visibleBox(lighthouse);
  expect(fitted.width).toBeCloseTo(overview.width, 0);
  const before = await visibleBox(playhead);
  expect(before.x + before.width / 2).toBeCloseTo(rail.x + rail.width * 0.4, 0);
  expect(await emissions()).toStrictEqual(noEdits);

  await zoomIn.click();
  // Lighthouse still spans the same 120 sequence frames.
  await expect.poll(async () => (await visibleBox(lighthouse)).width).toBeGreaterThan(fitted.width);
  await expect
    .poll(async () => {
      const after = await visibleBox(playhead);
      return Math.abs(after.x + after.width / 2 - (before.x + before.width / 2));
    })
    .toBeLessThan(2);
  await expect(frameReadout).toHaveText("Sequence frame 192");
  await expect(lighthouse).toHaveAttribute("aria-pressed", "true");
  await expect(timeline).toContainText("Duration: 00:08");
  expect(await emissions()).toStrictEqual(noEdits);
});

test("horizontal panning preserves the edit and the ruler seeks on the right of the panned view", async ({
  page,
}) => {
  const { emissions, timeline, ruler, playhead, frameReadout, lighthouse, zoomIn } =
    await openViewport(page);
  await lighthouse.click();
  await zoomIn.click();

  const nearStart = await visibleBox(lighthouse);
  const rail = await visibleBox(ruler);
  const pan = await visibleBox(timeline.getByRole("slider", { name: "Pan timeline" }));
  await page.mouse.click(pan.x + pan.width - 2, pan.y + pan.height / 2);
  await expect
    .poll(async () => (await visibleBox(lighthouse)).x)
    .toBeLessThan(nearStart.x - rail.width / 2);
  expect((await visibleBox(lighthouse)).width).toBeCloseTo(nearStart.width, 0);
  await expect(playhead).toBeHidden();
  await expect(frameReadout).toHaveText("Sequence frame 0");
  await expect(lighthouse).toHaveAttribute("aria-pressed", "true");
  await expect(timeline).toContainText("Duration: 00:08");
  expect(await emissions()).toStrictEqual(noEdits);

  // Use the visible width of a 120-frame placement as a ruler. The clip starts
  // at 210 and its edges are inset by a pixel; frame 414 is 204 frames later.
  const clip = await visibleBox(lighthouse);
  const x = clip.x - 1 + ((clip.width + 2) * 204) / 120;
  expect(x).toBeGreaterThan(rail.x + rail.width * 0.7);
  await page.mouse.click(x, rail.y + rail.height * 0.75);
  await expect(frameReadout).toHaveText("Sequence frame 414");
  const sought = await visibleBox(playhead);
  expect(Math.abs(sought.x + sought.width / 2 - x)).toBeLessThan(2);
  await expect(lighthouse).toHaveAttribute("aria-pressed", "true");
  expect(await emissions()).toStrictEqual(noEdits);

  // This time the playhead is visible in an already panned view. Another
  // zoom must still anchor to the playhead rather than the viewport center.
  await zoomIn.click();
  await expect.poll(async () => (await visibleBox(lighthouse)).width).toBeGreaterThan(clip.width);
  await expect
    .poll(async () => {
      const after = await visibleBox(playhead);
      return Math.abs(after.x + after.width / 2 - x);
    })
    .toBeLessThan(2);
  await expect(frameReadout).toHaveText("Sequence frame 414");
  expect(await emissions()).toStrictEqual(noEdits);
});

test("dragging a placement after zoom and pan previews the exact frame and retains the panned view", async ({
  page,
}) => {
  const { emissions, timeline, ruler, lighthouse, zoomIn } = await openViewport(page);
  await lighthouse.click();
  await zoomIn.click();

  const unpanned = await visibleBox(lighthouse);
  const rail = await visibleBox(ruler);
  const pan = await visibleBox(timeline.getByRole("slider", { name: "Pan timeline" }));
  await page.mouse.click(pan.x + pan.width / 2, pan.y + pan.height / 2);
  await expect
    .poll(async () => (await visibleBox(lighthouse)).x)
    .toBeLessThan(unpanned.x - rail.width / 4);

  const placement = await visibleBox(lighthouse);
  const delta = (placement.width + 2) / 6; // 20 of Lighthouse's 120 sequence frames.
  const x = placement.x + placement.width / 2;
  const y = placement.y + placement.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + delta, y, { steps: 8 });
  await expect(timeline.getByRole("status")).toHaveText("Lighthouse → Main · Sequence frame 230");
  const preview = timeline.getByRole("figure", { name: "Proposed placement: Lighthouse" });
  const draft = await visibleBox(preview);
  expect(draft.x).toBeCloseTo(placement.x + delta, 0);
  expect(draft.width).toBeCloseTo(placement.width, 0);
  expect(await emissions()).toStrictEqual(noEdits);

  await page.mouse.up();
  await expect.poll(emissions).toStrictEqual({
    sequences: [
      {
        durationFrames: 480,
        tracks: [
          {
            id: "main",
            label: "Main",
            placements: [
              { id: "harbor-open", clipId: "harbor", sequenceStartFrame: 0 },
              { id: "lighthouse-close", clipId: "lighthouse", sequenceStartFrame: 230 },
            ],
          },
        ],
      },
    ],
    cutLists: [null],
  });
  await expect(preview).toHaveCount(0);
  await expect.poll(async () => (await visibleBox(lighthouse)).x).toBeCloseTo(draft.x, 0);
});

test("zooming out with the playhead offscreen anchors the center of the view", async ({ page }) => {
  const { emissions, timeline, ruler, playhead, frameReadout, lighthouse, zoomIn, zoomOut } =
    await openViewport(page);
  const rail = await visibleBox(ruler);
  await page.mouse.click(rail.x + rail.width * 0.875, rail.y + rail.height * 0.75);
  await expect(frameReadout).toHaveText("Sequence frame 420");
  await zoomIn.click();
  await zoomIn.click();
  const panControl = timeline.getByRole("slider", { name: "Pan timeline" });
  const pan = await visibleBox(panControl);
  await page.mouse.click(pan.x + pan.width / 2, pan.y + pan.height / 2);
  await expect(playhead).toBeHidden();
  const before = await visibleBox(lighthouse);
  // A quarter of the way through Lighthouse is frame 240, the midpoint of
  // the 480-frame sequence and near the center of this panned view.
  const frame240X = (clip: typeof before) => clip.x + clip.width / 4;
  expect(Math.abs(frame240X(before) - (rail.x + rail.width / 2))).toBeLessThan(3);
  await zoomOut.click();
  await expect.poll(async () => (await visibleBox(lighthouse)).width).toBeLessThan(before.width);
  await expect
    .poll(async () => Math.abs(frame240X(await visibleBox(lighthouse)) - frame240X(before)))
    .toBeLessThan(3);
  await expect(playhead).toBeHidden();
  await expect(frameReadout).toHaveText("Sequence frame 420");
  expect(await emissions()).toStrictEqual(noEdits);
});

test("zooming at the sequence endpoint keeps the whole playhead grip reachable", async ({
  page,
}) => {
  const { emissions, ruler, playhead, frameReadout, zoomIn } = await openViewport(page);
  const rail = await visibleBox(ruler);
  await playhead.press("End");
  await expect(frameReadout).toHaveText("Sequence frame 480");
  await zoomIn.click();

  await expect
    .poll(async () => {
      const grip = await visibleBox(playhead);
      return Math.abs(grip.x + grip.width - (rail.x + rail.width));
    })
    .toBeLessThan(2);
  await expect(frameReadout).toHaveText("Sequence frame 480");
  expect(await emissions()).toStrictEqual(noEdits);
});
