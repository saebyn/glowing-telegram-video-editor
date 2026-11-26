import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  compiled,
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
} from "./SequenceEditor.browserHarness";

async function visibleBox(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected visible timeline geometry");
  return box;
}

async function openLayeredEdit(page: Page) {
  await page.setViewportSize({ width: 1280, height: 1100 });
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  return {
    emissions,
    timeline,
    snap: page.getByRole("button", { name: "Snap", exact: true }),
    undo: page.getByRole("button", { name: "Undo", exact: true }),
    guide: timeline.getByRole("img", { name: /Snap guide/ }),
  };
}

test("Snap starts off and can be toggled by keyboard without creating an edit", async ({
  page,
}) => {
  const { emissions, snap, undo } = await openLayeredEdit(page);

  await expect(snap).toHaveAttribute("aria-pressed", "false");
  await snap.press("Space");
  await expect(snap).toHaveAttribute("aria-pressed", "true");
  await snap.press("Enter");
  await expect(snap).toHaveAttribute("aria-pressed", "false");
  await expect(undo).toBeDisabled();
  expect(await emissions()).toStrictEqual(noEdits);
});

test("a companion's snap shows the guide and both destinations, then commits and undoes the group", async ({
  page,
}) => {
  const { emissions, timeline, snap, undo, guide } = await openLayeredEdit(page);
  await snap.click();
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouses = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await harbor.click();
  await lighthouses.last().click({ modifiers: ["Shift"] });
  const [stationary, main, alternate] = await Promise.all([
    visibleBox(lighthouses.first()),
    visibleBox(harbor),
    visibleBox(lighthouses.last()),
  ]);
  const pixelsPerFrame = (alternate.x - main.x) / 120;
  const x = alternate.x + 12;
  const mainY = main.y + main.height / 2;
  await page.mouse.move(x, alternate.y + alternate.height / 2);
  await page.mouse.down();
  // At frame 181 the grabbed Lighthouse is not near a target. Harbor's
  // leading edge at 61 can align with the stationary Lighthouse's end at 60.
  await page.mouse.move(x + 61 * pixelsPerFrame, mainY, { steps: 10 });
  await expect(timeline.getByRole("status")).toHaveText("Lighthouse → Main · Sequence frame 180");
  await expect(timeline.getByRole("list", { name: "Other proposed placements" })).toHaveText(
    "Harbor → Cutaways · Sequence frame 60",
  );
  await expect(guide).toHaveAccessibleName("Snap guide at sequence frame 60");
  const [guideBox, harborPreview, lighthousePreview] = await Promise.all([
    visibleBox(guide),
    visibleBox(timeline.getByRole("figure", { name: "Proposed placement: Harbor" })),
    visibleBox(timeline.getByRole("figure", { name: "Proposed placement: Lighthouse" })),
  ]);
  expect(guideBox.x).toBeCloseTo(stationary.x + stationary.width + 1, 0);
  expect(harborPreview.x).toBeCloseTo(main.x + 60 * pixelsPerFrame, 0);
  expect(harborPreview.y + harborPreview.height / 2).toBeCloseTo(
    stationary.y + stationary.height / 2,
    0,
  );
  expect(lighthousePreview.x).toBeCloseTo(main.x + 180 * pixelsPerFrame, 0);
  expect(lighthousePreview.y + lighthousePreview.height / 2).toBeCloseTo(mainY, 0);
  expect(await emissions()).toStrictEqual(noEdits);

  await page.mouse.up();
  await expect(guide).toHaveCount(0);
  await expect(timeline.getByRole("figure")).toHaveCount(0);
  await expect.poll(emissions).toMatchObject({
    sequences: [
      {
        tracks: [
          {
            id: "cutaways",
            placements: [
              { id: "lighthouse-open", sequenceStartFrame: 0 },
              { id: "harbor-bed", sequenceStartFrame: 60 },
            ],
          },
          { id: "main", placements: [{ id: "lighthouse-alternate", sequenceStartFrame: 180 }] },
          { id: "alternate", placements: [] },
        ],
      },
    ],
    cutListResults: [
      compiled({
        version: "1.0.0",
        inputMedia: [
          {
            s3Location: "s3://sequence-fixtures/lighthouse.mp4",
            sections: [{ startFrame: 501, endFrame: 561 }],
          },
          {
            s3Location: "s3://sequence-fixtures/harbor.mp4",
            sections: [{ startFrame: 114, endFrame: 354 }],
          },
        ],
        outputTrack: [
          { mediaIndex: 0, sectionIndex: 0 },
          { mediaIndex: 1, sectionIndex: 0 },
        ],
      }),
    ],
  });

  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(undo).toBeDisabled();
  await expect(snap).toHaveAttribute("aria-pressed", "true");
  const undone = await emissions();
  expect(undone.sequences).toHaveLength(2);
  expect(undone.cutListResults).toHaveLength(2);
  expect(undone.sequences[1]).toMatchObject({
    tracks: [
      { id: "cutaways", placements: [{ id: "lighthouse-open", sequenceStartFrame: 0 }] },
      { id: "main", placements: [{ id: "harbor-bed", sequenceStartFrame: 0 }] },
      { id: "alternate", placements: [{ id: "lighthouse-alternate", sequenceStartFrame: 120 }] },
    ],
  });
  expect(await visibleBox(harbor)).toEqual(main);
  expect(await visibleBox(lighthouses.last())).toEqual(alternate);
});

test("the playhead guide has the same CSS-pixel reach at Fit and after zooming", async ({
  page,
}) => {
  const { emissions, timeline, snap, undo, guide } = await openLayeredEdit(page);
  const ruler = timeline.locator(".timeline-editor-time-area-interact");
  const rail = await visibleBox(ruler);
  await ruler.click({ position: { x: (rail.width * 90) / 240, y: rail.height * 0.75 } });
  await expect(page.getByLabel("Sequence playhead position")).toHaveText("Sequence frame 90");
  const placement = timeline.getByRole("button", { name: "Lighthouse", exact: true }).last();
  const fitWidth = (await visibleBox(placement)).width;

  async function startDragNearPlayhead() {
    const box = await visibleBox(placement);
    // The alternate Lighthouse occupies [120, 228), inset a pixel on either side.
    const pixelsPerFrame = (box.width + 2) / 108;
    const grabX = Math.round(box.x + 48);
    const y = box.y + box.height / 2;
    const alignedX = grabX - 30 * pixelsPerFrame;
    await page.mouse.move(grabX, y);
    await page.mouse.down();
    await page.mouse.move(alignedX + 7, y, { steps: 6 });
    return (offset: number) => page.mouse.move(alignedX + offset, y);
  }

  const preview = timeline.getByRole("status");
  await startDragNearPlayhead();
  await expect(preview).toHaveText("Lighthouse → Alternate · Sequence frame 91");
  await expect(guide).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.mouse.up();

  await snap.click();
  for (const zoomed of [false, true]) {
    if (zoomed) {
      await timeline.getByRole("button", { name: "Zoom in", exact: true }).click();
      await expect.poll(async () => (await visibleBox(placement)).width).toBeGreaterThan(fitWidth);
    }
    const playhead = await visibleBox(timeline.getByRole("slider", { name: "Sequence playhead" }));
    const move = await startDragNearPlayhead();
    await expect(preview).toHaveText("Lighthouse → Alternate · Sequence frame 90");
    await expect(guide).toHaveAccessibleName("Snap guide at sequence frame 90");
    expect((await visibleBox(guide)).x).toBeCloseTo(playhead.x + playhead.width / 2, 0);

    await move(10);
    await expect(preview).toHaveText(`Lighthouse → Alternate · Sequence frame ${zoomed ? 91 : 92}`);
    await expect(guide).toHaveCount(0);

    await move(7);
    await expect(guide).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(guide).toHaveCount(0);
    await page.mouse.up();
  }
  await expect(undo).toBeDisabled();
  expect(await emissions()).toStrictEqual(noEdits);
});

test("blocked and unchanged releases with Snap on do not emit edits", async ({ page }) => {
  const { emissions, timeline, snap, undo, guide } = await openLayeredEdit(page);
  await snap.click();
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true }).last();
  await harbor.click();
  await lighthouse.click({ modifiers: ["Shift"] });
  const [main, alternate] = await Promise.all([visibleBox(harbor), visibleBox(lighthouse)]);
  const x = alternate.x + 12;
  const mainY = main.y + main.height / 2;
  await page.mouse.move(x, alternate.y + alternate.height / 2);
  await page.mouse.down();
  await page.mouse.move(x + (alternate.x - main.x) / 4, mainY, { steps: 10 });
  await expect(timeline.getByRole("status")).toHaveText(
    "Lighthouse → Main · Sequence frame 150 · Blocked: Overlaps another placement on Cutaways",
  );
  await expect(guide).toHaveCount(0);
  await page.mouse.up();
  await expect(timeline.getByRole("figure")).toHaveCount(0);
  await expect(undo).toBeDisabled();
  expect(await emissions()).toStrictEqual(noEdits);

  // Drag only Harbor close enough to its current frame zero to snap back.
  await harbor.click();
  const box = await visibleBox(harbor);
  const grabX = box.x + box.width / 2;
  const grabY = box.y + box.height / 2;
  await page.mouse.move(grabX, grabY);
  await page.mouse.down();
  await page.mouse.move(grabX + 6, grabY);
  await expect(timeline.getByRole("status")).toHaveText("Harbor → Main · Sequence frame 0");
  await expect(guide).toHaveAccessibleName("Snap guide at sequence frame 0");
  await page.mouse.up();
  await expect(guide).toHaveCount(0);
  await expect(undo).toBeDisabled();
  expect(await emissions()).toStrictEqual(noEdits);
});
