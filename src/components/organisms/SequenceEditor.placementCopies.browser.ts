import { expect, test } from "@playwright/test";
import {
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutDepartureAt,
  roughCutStoryId,
  straightCutArgs,
} from "./SequenceEditor.browserHarness";

test("Duplicate sends one extending edit and one compiler result; one Undo restores both", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouses = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await lighthouses.click();
  expect(await emissions()).toEqual(noEdits);

  await page.keyboard.press("Control+d");
  await expect(lighthouses).toHaveCount(2, { timeout: 3_000 });
  const duplicate = await emissions();
  expect(duplicate.sequences).toHaveLength(1);
  expect(duplicate.sequences[0]).toMatchObject({
    tracks: [
      {
        id: "main",
        placements: [
          { id: "harbor-open", sequenceStartFrame: 0 },
          { id: "lighthouse-next", sequenceStartFrame: 120 },
          { clipId: "lighthouse", sequenceStartFrame: 240 },
        ],
      },
    ],
  });
  expect(duplicate.cutListResults).toEqual([expect.objectContaining({ ok: true })]);

  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await undo.click();
  await expect(lighthouses).toHaveCount(1);
  await expect(undo).toBeDisabled();
  expect((await emissions()).cutListResults).toHaveLength(2);
});

test("Copy does not edit; Paste places at the hovered track and exact sequence frame", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouses = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await lighthouses.first().click();
  await page.keyboard.press("Control+c");
  expect(await emissions()).toEqual(noEdits);

  const ruler = (await timeline.locator(".timeline-editor-time-area-interact").boundingBox())!;
  const alternate = (await lighthouses.last().boundingBox())!;
  // Fly to frame 40 on Alternate; its [0, 120) gap is larger than the copied 60 frames.
  await page.mouse.move(ruler.x + ruler.width / 6, alternate.y + alternate.height / 2);
  await page.keyboard.press("Meta+v");

  await expect(lighthouses).toHaveCount(3, { timeout: 3_000 });
  const pasted = await emissions();
  expect(pasted.sequences).toHaveLength(1);
  expect(pasted.sequences[0].tracks[2]).toMatchObject({
    id: "alternate",
    placements: [
      { id: "lighthouse-alternate", sequenceStartFrame: 120 },
      { clipId: "lighthouse", sequenceStartFrame: 40, sourceOutOffsetFrames: -60 },
    ],
  });
  expect(pasted.cutListResults).toHaveLength(1);
  await expect(page.getByLabel("Sequence playhead position")).toHaveText("Sequence frame 0");
});

test("blocked Paste previews the requested frame, ignores an invalid click, then drops at a valid one", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbors = timeline.getByRole("button", { name: "Harbor", exact: true });
  await harbors.last().click();
  await page.keyboard.press("Control+c");
  const ruler = (await timeline.locator(".timeline-editor-time-area-interact").boundingBox())!;
  const row = (await harbors.last().boundingBox())!;
  const y = row.y + row.height / 2;
  const x = (frame: number) => ruler.x + ruler.width * (frame / 360);

  // Frame 121 is in the gap but the 120-frame copy would hit the placement at 240.
  await page.mouse.move(x(121), y);
  await page.keyboard.press("Control+v");
  const ghost = timeline.getByRole("figure", { name: "Proposed placement: Harbor" });
  await expect(ghost).toBeVisible({ timeout: 3_000 });
  await expect(timeline).toContainText("Main · Sequence frame 121 · Blocked");
  await page.mouse.click(x(121), y);
  await expect(ghost).toBeVisible();
  expect(await emissions()).toEqual(noEdits);

  await page.mouse.move(x(120), y);
  await expect(timeline).toContainText("Main · Sequence frame 120");
  expect(await emissions()).toEqual(noEdits);
  await page.mouse.click(x(120), y);
  await expect(ghost).toHaveCount(0);
  await expect(harbors).toHaveCount(3);
  const pasted = await emissions();
  expect(pasted.sequences).toHaveLength(1);
  expect(pasted.sequences[0].tracks[0].placements.at(-1)).toMatchObject({
    clipId: "harbor",
    sequenceStartFrame: 120,
    sourceInOffsetFrames: 6,
    sourceOutOffsetFrames: 6,
  });
  expect(pasted.cutListResults).toEqual([expect.objectContaining({ ok: true })]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(harbors).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});

test("a pointer press cannot confirm a Paste session that replaced it before release", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbors = timeline.getByRole("button", { name: "Harbor", exact: true });
  await harbors.last().click();
  await page.keyboard.press("Control+c");
  const ruler = (await timeline.locator(".timeline-editor-time-area-interact").boundingBox())!;
  const row = (await harbors.last().boundingBox())!;
  const y = row.y + row.height / 2;
  const x = (frame: number) => ruler.x + ruler.width * (frame / 360);
  const status = timeline.getByRole("status");

  await page.mouse.move(x(121), y);
  await page.keyboard.press("Control+v");
  await expect(status).toContainText("Sequence frame 121 · Blocked");
  await page.mouse.down();
  await page.keyboard.press("Control+v"); // Supersede the first drop without placing anything.
  await page.mouse.move(x(120), y); // One frame is less than the click/drag threshold.
  await expect(status).toHaveText(/Main · Sequence frame 120$/);
  await page.mouse.up();
  await expect(status).toHaveText(/Main · Sequence frame 120$/);
  expect(await emissions()).toEqual(noEdits);

  await page.mouse.click(x(120), y);
  await expect(harbors).toHaveCount(3);
  expect((await emissions()).cutListResults).toEqual([expect.objectContaining({ ok: true })]);
});

test("Paste without a hovered track enters drop mode; Escape after a locked click edits nothing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId, { "sequence.tracks[2].locked": "!true" });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouses = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await expect(timeline.getByRole("button", { name: "Unlock track: Alternate" })).toBeVisible();
  await lighthouses.first().click();
  await page.keyboard.press("Control+c");
  const ruler = (await timeline.locator(".timeline-editor-time-area-interact").boundingBox())!;
  await page.mouse.move(ruler.x + ruler.width / 6, ruler.y + ruler.height / 2);
  await page.keyboard.press("Control+v");
  const instructions = timeline.getByText("Paste: click to place or press Escape to cancel.", {
    exact: false,
  });
  const ghost = timeline.getByRole("figure", { name: "Proposed placement: Lighthouse" });
  await expect(instructions).toBeVisible();
  await expect(ghost).toHaveCount(0);

  const alternate = (await lighthouses.last().boundingBox())!;
  await page.mouse.click(ruler.x + ruler.width / 6, alternate.y + alternate.height / 2);
  await expect(timeline).toContainText(
    "Alternate · Sequence frame 40 · Blocked: The track is locked",
  );
  await expect(ghost).toBeVisible();
  expect(await emissions()).toEqual(noEdits);

  await page.keyboard.press("Escape");
  await expect(instructions).toHaveCount(0, { timeout: 3_000 });
  await expect(ghost).toHaveCount(0);
  expect(await emissions()).toEqual(noEdits);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});

test("Paste drop mode retargets a stationary preview on pan and does not paste on a drag", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, roughCutDepartureAt(540).args);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbors = timeline.getByRole("button", { name: "Harbor", exact: true });
  await harbors.first().click();
  await page.keyboard.press("Control+c");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const ruler = (await timeline.locator(".timeline-editor-time-area-interact").boundingBox())!;
  const opening = (await harbors.first().boundingBox())!;
  await page.mouse.move(ruler.x + ruler.width / 3, ruler.y + ruler.height / 2);
  await page.keyboard.press("Control+v");
  await expect(timeline).toContainText("Paste: click to place");
  // One zoom step shows 300 frames, so this point maps to 100 before pan and 400 after it.
  const x = ruler.x + ruler.width / 3;
  const y = opening.y + opening.height / 2;
  await page.mouse.move(x, y);
  await expect(timeline.getByRole("status")).toContainText("Main · Sequence frame 100 · Blocked");
  await page.mouse.wheel(ruler.width, 0);
  await expect(timeline.getByRole("status")).toHaveText(/Main · Sequence frame 400$/);
  await page.mouse.down();
  await page.mouse.move(x - 60, y, { steps: 8 });
  await page.mouse.up();
  await expect(timeline.getByRole("status")).toHaveText(/Main · Sequence frame 400$/);
  expect(await emissions()).toEqual(noEdits);
  await expect(harbors.first()).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await page.mouse.click(x - 60, y);
  await expect
    .poll(
      async () => (await emissions()).sequences[0]?.tracks[0].placements.at(-1)?.sequenceStartFrame,
    )
    .toBe(400);
});

test("Duplicate edits with only the sequence listener", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, { ...straightCutArgs, omitCutListListener: "!true" });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await lighthouse.click();
  await expect(lighthouse).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Control+d");
  await expect(lighthouse).toHaveCount(2);
  const result = await emissions();
  expect(result.sequences).toHaveLength(1);
  expect(result.cutListResults).toEqual([]);
});

test("the clipboard survives an accepted edit but not a host sequence replacement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(
    "/iframe.html?id=testing-sequence-editor-shortcuts--clipboard-host&viewMode=story",
  );
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbors = timeline.getByRole("button", { name: /^Harbor Audio and video$/ });
  await harbors.click({ timeout: 20_000 });
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+d");
  await expect(harbors).toHaveCount(2);

  const ruler = (await timeline.locator(".timeline-editor-time-area-interact").boundingBox())!;
  const row = (await harbors.first().boundingBox())!;
  const y = row.y + row.height / 2;
  await page.mouse.move(ruler.x + ruler.width * 0.75, y);
  await page.keyboard.press("Control+v");
  await expect(harbors).toHaveCount(3);

  await page.getByRole("button", { name: "Replace sequence" }).click();
  await expect(harbors).toHaveCount(1);
  const editor = page.getByRole("region", { name: "Sequence editor", exact: true });
  await editor.focus();
  await page.mouse.move(ruler.x + ruler.width * 0.75, y);
  await page.keyboard.press("Control+v");
  await expect(harbors).toHaveCount(1, { timeout: 3_000 });
});

test("placement shortcuts leave the focused source trim input alone", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbors = timeline.getByRole("button", { name: "Harbor", exact: true });
  await harbors.last().click();
  await page.keyboard.press("Control+c");
  const sourceOut = page.getByRole("spinbutton", { name: "Source out (exclusive frame)" });
  await sourceOut.focus();
  const ruler = (await timeline.locator(".timeline-editor-time-area-interact").boundingBox())!;
  const row = (await harbors.first().boundingBox())!;
  await page.mouse.move(ruler.x + ruler.width / 3, row.y + row.height / 2);
  await page.keyboard.press("Control+d");
  await page.keyboard.press("Control+v");
  await expect(sourceOut).toBeFocused();
  await expect(sourceOut).toHaveValue("240");
  expect(await emissions()).toEqual(noEdits);
});
