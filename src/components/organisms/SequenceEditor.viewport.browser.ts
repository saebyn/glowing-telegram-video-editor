import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  blockedOutput,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutDepartureAt,
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
    ...roughCutDepartureAt(420).args,
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
    fit: page.getByRole("button", { name: "Fit to view", exact: true }),
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

test("keyboard toolbar navigation pans half a view at both zooms and fits from far away", async ({
  page,
}) => {
  const { emissions, ruler, frameReadout, lighthouse, zoomIn } = await openViewport(page);
  const editor = page.getByRole("region", { name: "Sequence editor", exact: true });
  const panLeft = editor.getByRole("button", { name: "Pan left", exact: true });
  const panRight = editor.getByRole("button", { name: "Pan right", exact: true });
  const fit = editor.getByRole("button", { name: "Fit to view", exact: true });
  const rail = await visibleBox(ruler);
  await lighthouse.click();
  await expect(panLeft).toHaveAttribute("title", "Pan left");
  await expect(panRight).toHaveAttribute("title", "Pan right");
  await expect(fit).toHaveAttribute("title", "Fit to view");
  const fitted = await visibleBox(lighthouse);
  const leftEdge = () => lighthouse.evaluate((el) => el.getBoundingClientRect().x);
  await panLeft.press("Enter");
  await expect.poll(leftEdge).toBeCloseTo(fitted.x + rail.width / 2, 0);
  await panRight.press("Space");
  await expect.poll(leftEdge).toBeCloseTo(fitted.x, 0);

  await zoomIn.click();
  const zoomed = await visibleBox(lighthouse);
  expect(zoomed.width).toBeGreaterThan(fitted.width);
  await panRight.press("Enter");
  await expect.poll(leftEdge).toBeCloseTo(zoomed.x - rail.width / 2, 0);
  for (let step = 0; step < 8; step++) await panRight.press("Enter");
  await expect(lighthouse).not.toBeInViewport();
  await fit.press("Space");
  await expect.poll(leftEdge).toBeCloseTo(fitted.x, 0);
  await expect(lighthouse).toHaveAttribute("aria-pressed", "true");
  await expect(frameReadout).toHaveText("Sequence frame 0");
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
  await page.mouse.move(rail.x + rail.width / 2, rail.y + 50);
  await page.mouse.wheel(rail.width, 0);
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

test("a drag on empty track space pans before zero without seeking or clearing selection", async ({
  page,
}) => {
  const { emissions, ruler, playhead, frameReadout, lighthouse } = await openViewport(page);
  await lighthouse.click();
  const rail = await visibleBox(ruler);
  // Frame 165 is in the gap between Harbor and Lighthouse.
  const x = rail.x + (rail.width * 165) / 480;
  const y = rail.y + rail.height + 36;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 100, y, { steps: 8 });
  await expect.poll(async () => (await visibleBox(playhead)).x + 8).toBeCloseTo(rail.x + 100, 0);
  await page.mouse.up();
  await expect(frameReadout).toHaveText("Sequence frame 0");
  await expect(lighthouse).toHaveAttribute("aria-pressed", "true");
  await page.mouse.click(rail.x + 40, rail.y + rail.height * 0.75);
  await expect(frameReadout).toHaveText("Sequence frame 0");
  await page.mouse.move(rail.x + 40, y);
  await page.mouse.down();
  await page.mouse.move(rail.x + 42, y);
  await page.mouse.up();
  await expect(lighthouse).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await visibleBox(playhead)).x + 8).toBeCloseTo(rail.x + 100, 0);
  expect(await emissions()).toStrictEqual(noEdits);
});

test("Shift+wheel crosses both ends of a zero-duration timeline with no tracks", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, { startWithoutTracks: "!true" });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const rail = await visibleBox(timeline.locator(".timeline-editor-time-area-interact"));
  const readout = page.getByLabel("Sequence playhead position");
  const labelsInView = () =>
    timeline.locator(".timeline-editor-time-unit-scale").evaluateAll(
      (labels, bounds) =>
        labels
          .filter((label) => {
            const { left, right } = label.getBoundingClientRect();
            return left >= bounds.x && right <= bounds.x + bounds.width;
          })
          .map((label) => label.textContent),
      rail,
    );
  await page.mouse.move(rail.x + rail.width / 2, rail.y + 50);
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, -rail.width * 3);
  await expect.poll(labelsInView).toContain("−00:10");
  await page.mouse.wheel(0, rail.width * 6);
  await expect.poll(labelsInView).toContain("00:13");
  await page.keyboard.up("Shift");
  await page.mouse.click(rail.x + rail.width / 2, rail.y + rail.height * 0.75);
  await expect(readout).toHaveText("Sequence frame 0");
  await page.getByRole("button", { name: "Fit to view", exact: true }).press("Enter");
  await expect.poll(labelsInView).toContain("00:01");
  await expect.poll(labelsInView).not.toContain("00:13");
  await expect(timeline).toContainText("Duration: 00:00");
  await expect(timeline.getByText("Add your first track to begin")).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  expect(await emissions()).toEqual(noEdits);
});

test("dragging a placement after zoom and pan previews the exact frame and retains the panned view", async ({
  page,
}) => {
  const { emissions, timeline, ruler, lighthouse, zoomIn } = await openViewport(page);
  await lighthouse.click();
  await zoomIn.click();

  const unpanned = await visibleBox(lighthouse);
  const rail = await visibleBox(ruler);
  await page.mouse.move(rail.x + rail.width / 2, rail.y + 50);
  await page.mouse.wheel(rail.width / 2 + 8, 0);
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
        tracks: [
          {
            id: "main",
            label: "Main",
            placements: [
              { id: "harbor-open", clipId: "harbor", sequenceStartFrame: 0 },
              { id: "lighthouse-close", clipId: "lighthouse", sequenceStartFrame: 230 },
              roughCutDepartureAt(420).placement,
            ],
          },
        ],
      },
    ],
    cutListResults: [blockedOutput],
  });
  await expect(preview).toHaveCount(0);
  await expect.poll(async () => (await visibleBox(lighthouse)).x).toBeCloseTo(draft.x, 0);
});

test("a placement drag stays on the same frame grid through a window shift", async ({ page }) => {
  const { emissions, timeline, ruler, lighthouse, frameReadout } = await openViewport(page);
  const rail = await visibleBox(ruler);
  const placement = await visibleBox(lighthouse);
  const x = placement.x + placement.width / 2;
  const y = placement.y + placement.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + rail.width / 24, y, { steps: 6 });
  await expect(timeline.getByRole("status")).toHaveText("Lighthouse → Main · Sequence frame 230");
  // The mouse is stationary. A scroll by a full view must advance the
  // proposal by another 480 frames, not reset the grab offset at recenter.
  await page.mouse.wheel(rail.width, 0);
  await expect(timeline.getByRole("status")).toHaveText("Lighthouse → Main · Sequence frame 710");
  const preview = await visibleBox(
    timeline.getByRole("figure", { name: "Proposed placement: Lighthouse" }),
  );
  expect(preview.x).toBeCloseTo(placement.x + rail.width / 24, 0);
  expect(preview.width).toBeCloseTo(placement.width, 0);
  expect(await emissions()).toEqual(noEdits);
  await page.mouse.up();
  await expect
    .poll(async () => (await emissions()).sequences[0]?.tracks[0].placements[1].sequenceStartFrame)
    .toBe(710);
  expect((await emissions()).cutListResults).toEqual([blockedOutput]);
  await expect.poll(async () => (await visibleBox(lighthouse)).x).toBeCloseTo(preview.x, 0);
  expect((await visibleBox(lighthouse)).width).toBeCloseTo(preview.width, 0);
  await page.mouse.click(rail.x + rail.width * 0.9, rail.y + rail.height * 0.75);
  await expect(frameReadout).toHaveText("Sequence frame 830");
});

test("changing duration by trimming leaves the same frame grid until Fit is requested", async ({
  page,
}) => {
  const { emissions, ruler, lighthouse, timeline, fit } = await openViewport(page);
  const rail = await visibleBox(ruler);
  await page.mouse.move(rail.x + rail.width / 2, rail.y + 50);
  await page.mouse.wheel(rail.width / 8, 0);
  await expect
    .poll(async () => (await visibleBox(lighthouse)).x)
    .toBeCloseTo(rail.x + (rail.width * 150) / 480 + 1, -1);
  const unchanged = await visibleBox(lighthouse);
  const edge = await visibleBox(
    timeline.getByRole("button", { name: "Trim trailing edge: Departure" }),
  );
  const x = edge.x + edge.width / 2;
  const y = edge.y + edge.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - rail.width / 16, y, { steps: 8 });
  await expect(timeline.getByRole("status")).toHaveText("Departure · Sequence frame 450");
  expect(await emissions()).toEqual(noEdits);
  await page.mouse.up();
  await expect(timeline).toContainText("Duration: 00:07.5");
  const result = await emissions();
  expect(result.sequences).toHaveLength(1);
  expect(result.sequences[0].tracks[0].placements.at(-1)).toMatchObject({
    clipId: "departure",
    sequenceStartFrame: 420,
    sourceOutOffsetFrames: -30,
  });
  expect(result.cutListResults).toEqual([blockedOutput]);
  const after = await visibleBox(lighthouse);
  expect(after.x).toBeCloseTo(unchanged.x, 0);
  expect(after.width).toBeCloseTo(unchanged.width, 0);
  await fit.click();
  await expect
    .poll(async () => (await visibleBox(lighthouse)).width)
    .toBeGreaterThan(unchanged.width);
  expect(await emissions()).toEqual(result);
});

test("zooming out with the playhead offscreen anchors the center of the view", async ({ page }) => {
  const { emissions, ruler, playhead, frameReadout, lighthouse, zoomIn, zoomOut } =
    await openViewport(page);
  const rail = await visibleBox(ruler);
  await page.mouse.click(rail.x + rail.width * 0.875, rail.y + rail.height * 0.75);
  await expect(frameReadout).toHaveText("Sequence frame 420");
  await zoomIn.click();
  await zoomIn.click();
  // The viewport is now [315, 435); move left by 135 frames to show [180, 300).
  await page.mouse.move(rail.x + rail.width / 2, rail.y + 50);
  await page.mouse.wheel(-rail.width * (135 / 120), 0);
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

test("scrubbing past the zoomed ruler stops at the last visible sequence frame", async ({
  page,
}) => {
  const { emissions, ruler, playhead, frameReadout, zoomIn } = await openViewport(page);
  await zoomIn.click();
  const rail = await visibleBox(ruler);
  await ruler.click({ position: { x: rail.width / 2, y: rail.height * 0.75 } });
  await expect(frameReadout).toHaveText("Sequence frame 120");

  const grip = await visibleBox(playhead);
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(rail.x + rail.width + 10, grip.y + grip.height / 2, { steps: 6 });
  await expect(frameReadout).toHaveText("Sequence frame 240");
  await page.mouse.up();
  await expect(frameReadout).toHaveText("Sequence frame 240");
  expect(await emissions()).toStrictEqual(noEdits);
});

test("scrubbing in a panned viewport uses absolute frames and clamps to the sequence end", async ({
  page,
}) => {
  const { emissions, ruler, playhead, frameReadout, zoomIn } = await openViewport(page);
  const rail = await visibleBox(ruler);
  const { x, y, width, height } = rail;
  await zoomIn.click();
  await page.mouse.move(x + width / 2, y + height + 36);
  await page.mouse.wheel((width * 360) / 240, 0); // Show frames [360, 600).
  await page.mouse.click(x + width / 4, y + height * 0.75);
  await expect(frameReadout).toHaveText("Sequence frame 420");

  const grip = await visibleBox(playhead);
  const gripY = grip.y + grip.height / 2;
  await page.mouse.move(grip.x + grip.width / 2, gripY);
  await page.mouse.down();
  await page.mouse.move(x + (width * 3) / 8, gripY, { steps: 5 });
  await expect(frameReadout).toHaveText("Sequence frame 450");
  await page.mouse.move(x + (width * 3) / 4, gripY, { steps: 5 });
  await page.mouse.up();
  await expect(frameReadout).toHaveText("Sequence frame 480");
  const endpoint = await visibleBox(playhead);
  expect(endpoint.x + endpoint.width / 2).toBeCloseTo(x + width / 2, 0);
  expect(await emissions()).toEqual(noEdits);
});
