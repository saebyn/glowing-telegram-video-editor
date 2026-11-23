import { expect, test } from "@playwright/test";
import { noEdits, recordEditorEmissions } from "./SequenceEditor.browserHarness";

const pageStory = "examples-sequence-editor-composition--replace-page-slots";
const hookStory = "examples-sequence-editor-composition--assemble-with-the-hook";

test("Storybook lists both composition examples separately from the default workflows", async ({
  request,
}) => {
  const response = await request.get("/index.json");
  expect(response.ok()).toBe(true);
  const { entries } = await response.json();
  expect(entries[pageStory]).toMatchObject({ type: "story", name: "Replace page slots" });
  expect(entries[hookStory]).toMatchObject({ type: "story", name: "Assemble with the hook" });
});

test("replacement slots share a playhead and a proposal becomes undoable only on acceptance", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${pageStory}&viewMode=story`);
  const timeline = page.getByRole("region", { name: "Frame-based timeline" });
  await expect(timeline).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("region", { name: "Wrapped Inspector" })).toBeVisible();
  await timeline.getByLabel("Seek by sequence frame").fill("60");
  await expect(page.getByLabel("Timeline sequence frame")).toHaveText("60");
  await expect(page.getByLabel("Preview sequence frame")).toHaveText("60");
  expect(await emissions()).toEqual(noEdits);

  await timeline.getByRole("button", { name: "Preview placement" }).click();
  await expect(timeline.getByRole("status", { name: "Placement preview" })).toHaveText(
    "Fits at sequence frame 60",
  );
  expect(await emissions()).toEqual(noEdits);
  await timeline.getByRole("button", { name: "Place clip" }).click();
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeDisabled();
  await expect(timeline.getByLabel("Placement count")).toHaveText("2");
  await expect.poll(emissions).toEqual({
    sequences: [
      {
        durationFrames: 240,
        tracks: [
          {
            id: "main",
            label: "Main",
            placements: [
              { id: "opening", clipId: "harbor", sequenceStartFrame: 0 },
              {
                id: "closing",
                clipId: "harbor",
                sequenceStartFrame: 120,
                sourceOutOffsetFrames: 60,
              },
              { id: expect.any(String), clipId: "bridge", sequenceStartFrame: 60 },
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
              { startFrame: 100, endFrame: 160 },
              { startFrame: 100, endFrame: 220 },
            ],
          },
          {
            s3Location: "s3://sequence-fixtures/bridge.mp4",
            sections: [{ startFrame: 300, endFrame: 360 }],
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
  await page.getByRole("button", { name: "Accept proposal" }).click();
  await expect(undo).toBeEnabled();
  await expect(timeline.getByLabel("Placement count")).toHaveText("3");
  await undo.click();
  const undone = await emissions();
  expect(undone.sequences).toHaveLength(2);
  expect(undone.sequences[1].tracks[0].placements.map(({ id }) => id)).toEqual([
    "opening",
    "closing",
  ]);
  expect(undone.cutLists[1]).toBeNull();
});

test("the host-built editor emits nothing for blocked or cancelled Timeline moves", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/iframe.html?id=${hookStory}&viewMode=story`);
  const host = page.getByRole("region", { name: "Host-built sequence editor" });
  const timeline = host.getByRole("region", { name: "Sequence timeline" });
  await expect(timeline).toBeVisible({ timeout: 20_000 });
  const [first, last] = await timeline.getByRole("button", { name: "Harbor", exact: true }).all();
  const [opening, closing] = await Promise.all([first.boundingBox(), last.boundingBox()]);
  if (!opening || !closing) throw new Error("Expected both Harbor placements");
  const grip = { x: opening.x + 15, y: opening.y + opening.height / 2 };
  const pixelsPerFrame = (closing.x - opening.x) / 120;
  async function drag(offset: number) {
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x + offset * pixelsPerFrame, grip.y, { steps: 12 });
  }

  await drag(95);
  await expect(timeline.getByRole("status")).toContainText("Blocked: Overlaps another placement");
  await page.mouse.up();
  expect(await emissions()).toEqual(noEdits);
  await drag(60);
  await expect(timeline.getByRole("status")).toHaveText("Harbor → Main · Sequence frame 60");
  await page.keyboard.press("Escape");
  await expect(timeline.getByRole("figure", { name: "Proposed placement: Harbor" })).toHaveCount(0);
  await page.mouse.up();
  expect(await emissions()).toEqual(noEdits);
  await expect(host.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});
