import { expect, test } from "@playwright/test";
import type { CutList } from "@saebyn/glowing-telegram-types";
import type { Sequence } from "@/types";
import {
  blockedOutput,
  compiled,
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

test("Redo restores both placements and the duration of an accepted group move", async ({
  page,
}) => {
  const lighthouseOpen = {
    id: "lighthouse-open",
    clipId: "lighthouse",
    sequenceStartFrame: 0,
    sourceOutOffsetFrames: -60,
  };
  const harborBed = {
    id: "harbor-bed",
    clipId: "harbor",
    sequenceStartFrame: 0,
    sourceOutOffsetFrames: 120,
  };
  const lighthouseAlternate = {
    id: "lighthouse-alternate",
    clipId: "lighthouse",
    sequenceStartFrame: 120,
    sourceInOffsetFrames: 6,
    sourceOutOffsetFrames: -6,
  };
  const original: Sequence = {
    tracks: [
      { id: "cutaways", label: "Cutaways", placements: [lighthouseOpen] },
      { id: "main", label: "Main", placements: [harborBed] },
      { id: "alternate", label: "Alternate", placements: [lighthouseAlternate] },
    ],
  };
  const moved: Sequence = {
    tracks: [
      {
        id: "cutaways",
        label: "Cutaways",
        placements: [lighthouseOpen, { ...harborBed, sequenceStartFrame: 60 }],
      },
      {
        id: "main",
        label: "Main",
        placements: [{ ...lighthouseAlternate, sequenceStartFrame: 180 }],
      },
      { id: "alternate", label: "Alternate", placements: [] },
    ],
  };
  // Originally Harbor is covered for the first 60 frames, so it resumes at source
  // frame 174. After the move it plays the whole [114, 354) range after Lighthouse.
  const originalCutList: CutList = {
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
  const movedCutList: CutList = {
    ...originalCutList,
    inputMedia: [
      originalCutList.inputMedia[0],
      {
        s3Location: "s3://sequence-fixtures/harbor.mp4",
        sections: [{ startFrame: 114, endFrame: 354 }],
      },
    ],
  };

  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true }).last();
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const redo = page.getByRole("button", { name: "Redo", exact: true });
  await expect(redo).toBeDisabled();
  await harbor.click();
  await lighthouse.click({ modifiers: ["Shift"] });
  await lighthouse.scrollIntoViewIfNeeded();
  const [main, alternate] = await Promise.all([harbor.boundingBox(), lighthouse.boundingBox()]);
  if (!main || !alternate) throw new Error("Expected placements on Main and Alternate");
  const x = alternate.x + 12;
  await page.mouse.move(x, alternate.y + alternate.height / 2);
  await page.mouse.down();
  await page.mouse.move(x + (alternate.x - main.x) / 2, main.y + main.height / 2, {
    steps: 12,
  });
  await expect(timeline.getByRole("status")).toHaveText("Lighthouse → Main · Sequence frame 180");
  await expect(redo).toBeDisabled();
  expect(await emissions()).toStrictEqual(noEdits);
  await page.mouse.up();
  await expect
    .poll(emissions)
    .toStrictEqual({ sequences: [moved], cutListResults: [compiled(movedCutList)] });
  await expect(redo).toBeDisabled();

  await undo.click();
  await expect(timeline).toContainText("Duration: 00:04");
  await expect.poll(emissions).toStrictEqual({
    sequences: [moved, original],
    cutListResults: [compiled(movedCutList), compiled(originalCutList)],
  });
  await expect(redo).toBeEnabled();

  await redo.click();
  await expect(timeline).toContainText("Duration: 00:05");
  await expect.poll(emissions).toStrictEqual({
    sequences: [moved, original, moved],
    cutListResults: [compiled(movedCutList), compiled(originalCutList), compiled(movedCutList)],
  });
  await expect(redo).toBeDisabled();
  await expect(undo).toBeEnabled();
});

function trimmedRoughCut(sourceOutOffsetFrames: number): Sequence {
  return {
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
            sourceOutOffsetFrames,
          },
        ],
      },
    ],
  };
}

test("Redo reapplies successive undone edits one at a time, oldest first", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true }).last();
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const redo = page.getByRole("button", { name: "Redo", exact: true });
  const sourceOut = page.getByLabel("Source out (exclusive frame)");
  const trim = page.getByRole("button", { name: "Trim placement", exact: true });
  await harbor.click();
  await sourceOut.fill("270");
  await trim.click();
  await expect(timeline).toContainText("Duration: 00:06.5");
  await sourceOut.fill("300");
  await trim.click();
  await expect(timeline).toContainText("Duration: 00:07");
  await undo.click();
  await expect(sourceOut).toHaveValue("270");
  await undo.click();
  await expect(sourceOut).toHaveValue("240");

  const original = trimmedRoughCut(6);
  const firstTrim = trimmedRoughCut(36);
  const secondTrim = trimmedRoughCut(66);
  // Seeking and selecting another placement are session actions, not new history.
  const ruler = timeline.locator(".timeline-editor-time-area-interact");
  const rail = await ruler.boundingBox();
  if (!rail) throw new Error("Expected a visible sequence ruler");
  await ruler.click({ position: { x: rail.width / 4, y: rail.height / 2 } });
  await expect(page.getByLabel("Sequence playhead position")).toHaveText("Sequence frame 90");
  await timeline.getByRole("button", { name: "Harbor", exact: true }).first().click();
  expect(await emissions()).toStrictEqual({
    sequences: [firstTrim, secondTrim, firstTrim, original],
    cutListResults: [blockedOutput, blockedOutput, blockedOutput, blockedOutput],
  });

  await redo.click();
  await expect(timeline).toContainText("Duration: 00:06.5");
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect(timeline).toContainText("Duration: 00:07");
  await expect(redo).toBeDisabled();
  await expect.poll(emissions).toStrictEqual({
    sequences: [firstTrim, secondTrim, firstTrim, original, firstTrim, secondTrim],
    cutListResults: [
      blockedOutput,
      blockedOutput,
      blockedOutput,
      blockedOutput,
      blockedOutput,
      blockedOutput,
    ],
  });
});

test("a declined proposal preserves Redo, but a newly accepted edit clears it", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.goto(`/?path=/story/${roughCutStoryId}`);
  const story = page.frameLocator("#storybook-preview-iframe");
  const timeline = story.getByRole("region", { name: "Sequence timeline" });
  const undo = story.getByRole("button", { name: "Undo", exact: true });
  const redo = story.getByRole("button", { name: "Redo", exact: true });
  const sourceOut = story.getByLabel("Source out (exclusive frame)");
  const trim = story.getByRole("button", { name: "Trim placement", exact: true });
  await timeline.getByRole("button", { name: "Harbor", exact: true }).last().click();
  await sourceOut.fill("270");
  await trim.click();
  await expect(timeline).toContainText("Duration: 00:06.5");
  await sourceOut.fill("300");
  await trim.click();
  await expect(timeline).toContainText("Duration: 00:07");

  await page.getByRole("tab", { name: /Controls/ }).click();
  const acceptEdits = page.getByRole("row", { name: /^Accept edits\b/ }).getByRole("switch");
  await acceptEdits.press("Space");
  await expect(acceptEdits).not.toBeChecked();
  await undo.click();
  await expect(timeline).toContainText("Duration: 00:07");
  await expect(redo).toBeDisabled();
  await acceptEdits.press("Space");
  await expect(acceptEdits).toBeChecked();
  await undo.click();
  await expect(timeline).toContainText("Duration: 00:06.5");
  await undo.click();
  await expect(timeline).toContainText("Duration: 00:06");
  await expect(redo).toBeEnabled();

  await acceptEdits.press("Space");
  await expect(acceptEdits).not.toBeChecked();
  await redo.click();
  await expect(timeline).toContainText("Duration: 00:06");
  await expect(redo).toBeEnabled();
  await sourceOut.fill("330");
  await trim.click();
  await expect(timeline).toContainText("Duration: 00:06");
  await expect(redo).toBeEnabled();

  await acceptEdits.press("Space");
  await expect(acceptEdits).toBeChecked();
  await trim.click();
  await expect(timeline).toContainText("Duration: 00:07.5");
  await expect(redo).toBeDisabled();
  await expect(undo).toBeEnabled();
});

test("an independent sequence replacement clears the redo path without emitting callbacks", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.goto(`/?path=/story/${roughCutStoryId}`);
  const story = page.frameLocator("#storybook-preview-iframe");
  const timeline = story.getByRole("region", { name: "Sequence timeline" });
  const undo = story.getByRole("button", { name: "Undo", exact: true });
  const redo = story.getByRole("button", { name: "Redo", exact: true });
  await timeline.getByRole("button", { name: "Harbor", exact: true }).last().click();
  await story.getByLabel("Source out (exclusive frame)").fill("270");
  await story.getByRole("button", { name: "Trim placement", exact: true }).click();
  await expect(timeline).toContainText("Duration: 00:06.5");
  await undo.click();
  await expect(timeline).toContainText("Duration: 00:06");
  await expect(redo).toBeEnabled();

  await page.getByRole("tab", { name: /Controls/ }).click();
  await page.getByRole("switch", { name: "Edit sequence as JSON" }).click();
  const sequenceControl = page.getByRole("textbox", { name: "Edit sequence as JSON" });
  await sequenceControl.fill(
    JSON.stringify({
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
  await expect(timeline.getByText("Replacement", { exact: true })).toBeVisible();
  await expect(timeline).toContainText("Duration: 00:02");
  await expect(redo).toBeDisabled();
  await expect(undo).toBeDisabled();
  await page.getByRole("tab", { name: /^Actions\b/ }).click();
  const actions = page.getByRole("tabpanel", { name: "Actions" });
  await expect(actions.getByText("onSequenceChange", { exact: true })).toHaveCount(2);
  await expect(actions.getByText("onCutListResult", { exact: true })).toHaveCount(2);
});
