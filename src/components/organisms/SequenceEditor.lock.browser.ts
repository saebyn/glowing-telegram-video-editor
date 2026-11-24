import { expect, test } from "@playwright/test";
import {
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
  straightCutArgs,
} from "./SequenceEditor.browserHarness";

test("Lock is a host-owned edit and Undo unlocks before undoing the trim", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await timeline.getByRole("button", { name: "Lighthouse", exact: true }).click();
  await page.getByLabel("Source out (exclusive frame)").fill("620");
  await page.getByRole("button", { name: "Trim placement", exact: true }).click();
  const { sequences, cutListResults } = await emissions();
  const trim = sequences[0];
  expect(trim.tracks[0].placements[1].sourceOutOffsetFrames).toBe(-1);
  await timeline
    .getByRole("button", { name: "Lock track: Main", exact: true })
    .click({ timeout: 5_000 });
  await expect(
    timeline.getByRole("button", { name: "Unlock track: Main", exact: true }),
  ).toBeVisible();
  await expect.poll(emissions).toEqual({
    sequences: [trim, { ...trim, tracks: [{ ...trim.tracks[0], locked: true }] }],
    cutListResults: [cutListResults[0], cutListResults[0]],
  });
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await undo.click();
  await expect.poll(async () => (await emissions()).sequences[2]).toEqual(trim);
  await undo.click();
  await expect
    .poll(async () => (await emissions()).sequences[3].tracks[0].placements[1])
    .toEqual({
      id: "lighthouse-next",
      clipId: "lighthouse",
      sequenceStartFrame: 120,
    });
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(
    timeline.getByRole("button", { name: "Unlock track: Main", exact: true }),
  ).toBeVisible();
});

test("a locked placement can be selected but blocks an explicit group edit", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId, { "sequence.tracks[0].locked": "true" });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true }).first();
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  await harbor.click();
  await lighthouse.click({ modifiers: ["Shift"] });
  await expect(lighthouse).toHaveAttribute("aria-pressed", "true");
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("]");
  await expect(page.getByText("Blocked: the track is locked.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  expect(await emissions()).toStrictEqual(noEdits);
  await expect(lighthouse).toBeVisible();
  await expect(harbor).toBeVisible();
});

test("Split mode blocks a locked placement while Split at the playhead skips it", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId, { "sequence.tracks[0].locked": "true" });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true }).first();
  await page.getByRole("button", { name: "Split mode", exact: true }).click();
  const box = (await lighthouse.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await expect(timeline.getByText(/^Split at sequence frame /)).toHaveCount(0);
  await page.mouse.click(x, y);
  await expect(page.getByText("Blocked: the track is locked.", { exact: true })).toBeVisible();
  expect(await emissions()).toStrictEqual(noEdits);
  const ruler = timeline.locator(".timeline-editor-time-area-interact");
  const { width, height } = (await ruler.boundingBox())!;
  await ruler.click({ position: { x: width / 8, y: height / 2 } });
  await expect(page.getByLabel("Sequence playhead position")).toHaveText("Sequence frame 30");
  await page.getByRole("button", { name: "Split", exact: true }).click();
  await expect
    .poll(async () =>
      (await emissions()).sequences[0]?.tracks.map(({ placements }) => placements.length),
    )
    .toEqual([1, 2, 1]);
  expect((await emissions()).cutListResults).toHaveLength(1);
});

test("undoing removal restores the empty track in its locked state", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await page.getByRole("button", { name: "Add track", exact: true }).click();
  await timeline.getByRole("button", { name: "Lock track: Track 1", exact: true }).click();
  await timeline.getByRole("button", { name: "Remove track: Track 1", exact: true }).click();
  await expect(
    timeline.getByRole("button", { name: "Unlock track: Track 1", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    timeline.getByRole("button", { name: "Unlock track: Track 1", exact: true }),
  ).toBeVisible();
  const { sequences, cutListResults } = await emissions();
  expect(sequences[3]).toEqual(sequences[1]);
  expect(cutListResults).toHaveLength(4);
  expect(cutListResults[0]).toHaveProperty("ok", true);
  expect(cutListResults).toEqual(Array(4).fill(cutListResults[0]));
});

test("the Inspector can read locked ranges and transitions but cannot edit them", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.tracks[0].locked": "true",
    "sequence.tracks[0].placements[1].entryTransition.id": "locked-fade",
    "sequence.tracks[0].placements[1].entryTransition.kind": "fade",
    "sequence.tracks[0].placements[1].entryTransition.durationFrames": 24,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await expect(timeline.getByRole("button", { name: "Unlock track: Main" })).toBeVisible();
  await timeline.getByRole("button", { name: "Lighthouse", exact: true }).click();
  const inspector = page.getByRole("region", { name: "Inspector" });
  await expect(
    inspector.getByText("Source in/out (source frames): 501 inclusive – 621 exclusive"),
  ).toBeVisible();
  await inspector.getByLabel("Source out (exclusive frame)").fill("620");
  await inspector.getByRole("button", { name: "Trim placement", exact: true }).click();
  await expect(page.getByText("Blocked: the track is locked.", { exact: true })).toBeVisible();
  await expect(
    inspector
      .getByRole("group", { name: "End edge" })
      .getByRole("button", { name: "Add transition" }),
  ).toBeDisabled();
  await inspector
    .getByRole("group", { name: "Start edge" })
    .getByRole("button", { name: "Inspect transition" })
    .click();
  await expect(inspector.getByRole("heading", { name: "Transition Properties" })).toBeVisible();
  await expect(inspector.getByText("24 sequence frames", { exact: true })).toBeVisible();
  await expect(inspector.getByRole("spinbutton")).toHaveCount(0);
  expect(await emissions()).toEqual(noEdits);
  await expect(
    timeline.getByRole("button", { name: "Select entry fade: Lighthouse" }),
  ).toHaveAttribute("aria-pressed", "true");
});
