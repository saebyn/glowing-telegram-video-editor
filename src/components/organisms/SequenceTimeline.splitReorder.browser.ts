import { expect, test, type Page } from "@playwright/test";
import { noEdits, recordEditorEmissions } from "./SequenceEditor.browserHarness";

const splitFrameLabel = "Split at sequence frame 90";

async function openSplitMode(page: Page) {
  await page.goto(
    "/iframe.html?id=testing-sequence-split-reorder--host-reorders-tracks&viewMode=story",
  );
  const toggle = page.getByRole("button", { name: "Split mode", exact: true });
  await toggle.click({ timeout: 20_000 });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  return page.getByRole("region", { name: "Sequence timeline" });
}

async function hoverTopPlacementInSplitMode(page: Page) {
  const timeline = await openSplitMode(page);
  const harbor = timeline.getByRole("button", { name: "Harbor Audio and video", exact: true });
  const box = (await harbor.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(timeline.getByText(splitFrameLabel, { exact: true })).toBeVisible();
  return timeline;
}

async function clickWithoutMovingPointer(page: Page) {
  // No mouse move after the reorder, not even one from mouse.click(x, y).
  await page.mouse.down();
  await page.mouse.up();
}

test("Split cuts the placement brought under the stationary pointer by a reorder", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  const timeline = await hoverTopPlacementInSplitMode(page);
  await page.getByRole("button", { name: "Bring Lighthouse angle to top" }).press("Enter");
  await expect(timeline.getByRole("group", { name: /^Track:/ }).first()).toHaveAccessibleName(
    "Track: Lighthouse angle",
  );
  const reordered = await emissions();
  expect(reordered.sequences).toHaveLength(1);
  expect(reordered.cutListResults).toHaveLength(1);

  await clickWithoutMovingPointer(page);
  const { sequences, cutListResults } = await emissions();
  expect(sequences).toHaveLength(2);
  expect(sequences[1].tracks.map(({ id, placements }) => [id, placements.length])).toEqual([
    ["lighthouse", 2],
    ["harbor", 1],
    ["empty", 0],
    ["locked", 1],
  ]);
  expect(sequences[1].tracks[0].placements[1]).toMatchObject({
    clipId: "lighthouse",
    sequenceStartFrame: 90,
    sourceInOffsetFrames: 60,
  });
  expect(cutListResults).toHaveLength(2);
});

test("Split ignores empty space brought under the stationary pointer by a reorder", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  const timeline = await hoverTopPlacementInSplitMode(page);
  await page.getByRole("button", { name: "Bring Empty to top" }).press("Enter");
  await expect(timeline.getByRole("group", { name: /^Track:/ }).first()).toHaveAccessibleName(
    "Track: Empty",
  );

  const reordered = await emissions();
  expect(reordered.sequences).toHaveLength(1);
  expect(reordered.cutListResults).toHaveLength(1);
  await clickWithoutMovingPointer(page);
  expect(await emissions()).toEqual(reordered);
  await expect(timeline.getByText(splitFrameLabel, { exact: true })).toHaveCount(0);
});

test("Split still reports a locked placement brought under the stationary pointer", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  const timeline = await hoverTopPlacementInSplitMode(page);
  await page.getByRole("button", { name: "Bring Locked sound to top" }).press("Enter");
  await expect(timeline.getByRole("group", { name: /^Track:/ }).first()).toHaveAccessibleName(
    "Track: Locked sound",
  );

  const reordered = await emissions();
  expect(reordered.sequences).toHaveLength(1);
  expect(reordered.cutListResults).toHaveLength(1);
  await clickWithoutMovingPointer(page);
  await expect(page.getByText("Blocked: the track is locked.", { exact: true })).toBeVisible();
  expect(await emissions()).toEqual(reordered);
  await expect(timeline.getByText(splitFrameLabel, { exact: true })).toHaveCount(0);
});

test("Split ignores both placement boundaries but cuts one sequence frame inside the trailing edge", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  const timeline = await openSplitMode(page);
  const harbor = timeline.getByRole("button", { name: "Harbor Audio and video", exact: true });
  const { x, y, width, height } = (await harbor.boundingBox())!;
  const centerY = y + height / 2;
  for (const edgeX of [x, x + width - 1]) {
    await page.mouse.move(edgeX, centerY);
    await expect(timeline.getByText(/^Split at sequence frame /)).toHaveCount(0);
    await clickWithoutMovingPointer(page);
    expect(await emissions()).toEqual(noEdits);
  }

  // Harbor spans 120 sequence frames, from 30 inclusive to 150 exclusive.
  await page.mouse.move(x + width - width / 120, centerY);
  await expect(timeline.getByText("Split at sequence frame 149", { exact: true })).toBeVisible();
  await clickWithoutMovingPointer(page);
  const { sequences, cutListResults } = await emissions();
  expect(sequences).toHaveLength(1);
  expect(sequences[0].tracks[0].placements[1]).toMatchObject({
    clipId: "harbor",
    sequenceStartFrame: 149,
    sourceInOffsetFrames: 119,
  });
  expect(cutListResults).toHaveLength(1);
});
