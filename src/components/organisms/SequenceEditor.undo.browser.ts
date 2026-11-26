import { expect, test } from "@playwright/test";
import type { CutList } from "@saebyn/glowing-telegram-types";
import type { Sequence } from "@/types";
import {
  compiled,
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

const layeredSequence: Sequence = {
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
      ],
    },
    {
      id: "main",
      label: "Main",
      placements: [
        { id: "harbor-bed", clipId: "harbor", sequenceStartFrame: 0, sourceOutOffsetFrames: 120 },
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
};

// Lighthouse covers sequence [0, 60); Harbor resumes from source frame 174.
const layeredCutList: CutList = {
  version: "1.0.0",
  inputMedia: [
    {
      s3Location: "s3://sequence-fixtures/lighthouse.mp4",
      sections: [{ startFrame: 501, endFrame: 561 }],
    },
    {
      s3Location: "s3://sequence-fixtures/harbor.mp4",
      sections: [{ startFrame: 174, endFrame: 354 }],
    },
  ],
  outputTrack: [
    { mediaIndex: 0, sectionIndex: 0 },
    { mediaIndex: 1, sectionIndex: 0 },
  ],
};

test("one Undo restores both placements and the old duration after an extending group move", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const alternate = timeline.getByRole("button", { name: "Lighthouse", exact: true }).last();
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeDisabled();

  const ruler = timeline.locator(".timeline-editor-time-area-interact");
  const rail = await ruler.boundingBox();
  if (!rail) throw new Error("Expected a visible sequence ruler");
  await ruler.click({ position: { x: rail.width / 4, y: rail.height / 2 } });
  await expect(page.getByLabel("Sequence playhead position")).toHaveText("Sequence frame 60");
  await harbor.click();
  await alternate.click({ modifiers: ["Shift"] });
  await expect(undo).toBeDisabled();

  await alternate.scrollIntoViewIfNeeded();
  const [main, bottom] = await Promise.all([harbor.boundingBox(), alternate.boundingBox()]);
  if (!main || !bottom) throw new Error("Expected placements on Main and Alternate");
  const grabX = bottom.x + 12;
  const grabY = bottom.y + bottom.height / 2;
  const mainY = main.y + main.height / 2;
  const pixelsPerFrame = (bottom.x - main.x) / 120;

  async function previewGroupMove(frameOffset: number) {
    await page.mouse.move(grabX, grabY);
    await page.mouse.down();
    await page.mouse.move(grabX + frameOffset * pixelsPerFrame, mainY, { steps: 12 });
  }

  await previewGroupMove(30);
  await expect(timeline.getByRole("status")).toContainText("Blocked");
  await page.mouse.up();
  await expect(undo).toBeDisabled();

  // Move Lighthouse from 120 to 180 on Main. Harbor shifts to 60 on Cutaways
  // and now ends at 300, extending the sequence.
  await previewGroupMove(60);
  await expect(timeline.getByRole("status")).toHaveText("Lighthouse → Main · Sequence frame 180");
  await expect(undo).toBeDisabled();
  expect(await emissions()).toStrictEqual(noEdits);
  await page.mouse.up();
  await expect(timeline).toContainText("Duration: 00:05");
  const moved = await emissions();
  expect(moved.sequences).toHaveLength(1);
  expect(moved.cutListResults).toHaveLength(1);

  await expect(undo).toBeEnabled();
  await undo.click();

  await expect.poll(emissions).toStrictEqual({
    sequences: [...moved.sequences, layeredSequence],
    cutListResults: [...moved.cutListResults, compiled(layeredCutList)],
  });
  await expect(timeline).toContainText("Duration: 00:04");
  await expect(undo).toBeDisabled();
});

test("an independent host replacement clears Undo without emitting either callback", async ({
  page,
}) => {
  await page.goto(`/?path=/story/${roughCutStoryId}`);
  const story = page.frameLocator("#storybook-preview-iframe");
  const timeline = story.getByRole("region", { name: "Sequence timeline" });
  const undo = story.getByRole("button", { name: "Undo", exact: true });
  await timeline.getByRole("button", { name: "Harbor", exact: true }).last().click();
  await story.getByLabel("Source out (exclusive frame)").fill("270");
  await story.getByRole("button", { name: "Trim placement", exact: true }).click();
  await expect(timeline).toContainText("Duration: 00:06.5");
  await expect(undo).toBeEnabled();

  await page.getByRole("tab", { name: /Controls/ }).click();
  await page.getByRole("switch", { name: "Edit sequence as JSON" }).click();
  const sequenceControl = page.getByRole("textbox", { name: "Edit sequence as JSON" });
  await sequenceControl.fill(
    JSON.stringify({
      durationFrames: 180,
      tracks: [
        {
          id: "main",
          label: "Replacement",
          placements: [{ id: "harbor-open", clipId: "harbor", sequenceStartFrame: 0 }],
        },
      ],
    }),
  );
  await sequenceControl.blur();
  await expect(timeline).toContainText("Duration: 00:03");
  await expect(timeline.getByText("Replacement", { exact: true })).toBeVisible();
  await expect(undo).toBeDisabled();

  const bounds = await undo.boundingBox();
  if (!bounds) throw new Error("Expected the visible Undo button");
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.getByRole("tab", { name: /^Actions\b/ }).click();
  const actions = page.getByRole("tabpanel", { name: "Actions" });
  await expect(actions.getByText("onSequenceChange", { exact: true })).toHaveCount(1);
  await expect(actions.getByText("onCutListResult", { exact: true })).toHaveCount(1);
});

test("Undo restores successive accepted edits newest first without recording the Undo itself", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const trim = page.getByRole("button", { name: "Trim placement", exact: true });
  const sourceOut = page.getByLabel("Source out (exclusive frame)");
  await timeline.getByRole("button", { name: "Harbor", exact: true }).last().click();

  await sourceOut.fill("270");
  await trim.click();
  await expect(timeline).toContainText("Duration: 00:06.5");
  await expect(undo).toBeEnabled();
  await sourceOut.fill("300");
  await trim.click();
  await expect(timeline).toContainText("Duration: 00:07");

  await undo.click();
  await expect(timeline).toContainText("Duration: 00:06.5");
  await expect(sourceOut).toHaveValue("270");
  await undo.click();
  await expect(timeline).toContainText("Duration: 00:06");
  await expect(sourceOut).toHaveValue("240");
  // Submitting the already accepted boundary is not a new edit.
  await trim.click();
  await expect(undo).toBeDisabled();
  const { sequences, cutListResults } = await emissions();
  expect(sequences.map(({ durationFrames }) => durationFrames)).toEqual([390, 420, 390, 360]);
  const gap = { ok: false, issues: [{ code: "sequence-gap", startFrame: 120, endFrame: 240 }] };
  expect(cutListResults).toEqual([gap, gap, gap, gap]);
});

test("a host that declines a proposal does not add or consume an Undo entry", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, { reviewEdits: "true" });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const trim = page.getByRole("button", { name: "Trim placement", exact: true });
  const accept = page.getByRole("button", { name: "Accept proposed edit" });
  const reject = page.getByRole("button", { name: "Reject proposed edit" });
  const originalDuration = timeline.getByText("Duration: 00:06", { exact: true });
  const extendedDuration = timeline.getByText("Duration: 00:06.5", { exact: true });

  await timeline.getByRole("button", { name: "Harbor", exact: true }).last().click();
  await page.getByLabel("Source out (exclusive frame)").fill("270");
  await trim.click();
  await reject.click();
  await expect(undo).toBeDisabled();
  await expect(originalDuration).toBeVisible();

  await trim.click();
  await accept.click();
  await expect(extendedDuration).toBeVisible();
  await expect(undo).toBeEnabled();

  await undo.click();
  await reject.click();
  await expect(extendedDuration).toBeVisible();
  await expect(undo).toBeEnabled();

  await undo.click();
  await accept.click();
  await expect(originalDuration).toBeVisible();
  await expect(undo).toBeDisabled();
  const { sequences, cutListResults } = await emissions();
  expect(sequences.map(({ durationFrames }) => durationFrames)).toEqual([390, 390, 360, 360]);
  expect(cutListResults).toHaveLength(4);
});
