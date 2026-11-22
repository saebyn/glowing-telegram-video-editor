import { expect, test } from "@playwright/test";
import {
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

test("the focused editor steps one sequence frame in either direction without editing", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const placement = timeline.getByRole("button", { name: "Harbor", exact: true }).first();
  const readout = page.getByLabel("Sequence playhead position");

  await placement.click();
  await expect(placement).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(readout).toHaveText("Sequence frame 0");
  await page.keyboard.press("ArrowRight");
  await expect(readout).toHaveText("Sequence frame 1");
  await page.keyboard.press("ArrowLeft");
  await expect(readout).toHaveText("Sequence frame 0");

  const grip = timeline.getByRole("slider", { name: "Sequence playhead" });
  await grip.press("End");
  await expect(readout).toHaveText("Sequence frame 360");
  await placement.focus();
  await page.keyboard.press("ArrowRight");
  await expect(readout).toHaveText("Sequence frame 360");
  await page.keyboard.press("ArrowLeft");
  await expect(readout).toHaveText("Sequence frame 359");
  await expect(placement).toHaveAttribute("aria-pressed", "true");
  expect(await emissions()).toStrictEqual(noEdits);
});

test("brackets nudge the whole selection by one sequence frame and only grow when needed", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const alternate = timeline.getByRole("button", { name: "Lighthouse", exact: true }).last();
  const grip = timeline.getByRole("slider", { name: "Sequence playhead" });

  await harbor.click();
  await alternate.click({ modifiers: ["Shift"] });
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  await expect(alternate).toBeFocused();

  // Harbor originally fills [0, 240), with Lighthouse covering the first 60 frames.
  await page.keyboard.press("]");
  const shifted = {
    durationFrames: 241,
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
          {
            id: "harbor-bed",
            clipId: "harbor",
            sequenceStartFrame: 1,
            sourceOutOffsetFrames: 120,
          },
        ],
      },
      {
        id: "alternate",
        label: "Alternate",
        placements: [
          {
            id: "lighthouse-alternate",
            clipId: "lighthouse",
            sequenceStartFrame: 121,
            sourceInOffsetFrames: 6,
            sourceOutOffsetFrames: -6,
          },
        ],
      },
    ],
  };
  const cutList = {
    version: "1.0.0",
    inputMedia: [
      {
        s3Location: "s3://sequence-fixtures/lighthouse.mp4",
        sections: [{ startFrame: 501, endFrame: 561 }],
      },
      {
        s3Location: "s3://sequence-fixtures/harbor.mp4",
        sections: [{ startFrame: 173, endFrame: 354 }],
      },
    ],
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 1, sectionIndex: 0 },
    ],
  };
  await expect.poll(emissions).toStrictEqual({ sequences: [shifted], cutLists: [cutList] });
  await expect(grip).toHaveAttribute("aria-valuemax", "241");
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  await expect(alternate).toHaveAttribute("aria-pressed", "true");

  // Moving back leaves the newly uncovered trailing frame; it does not shrink the edit.
  await page.keyboard.press("[");
  await expect.poll(emissions).toStrictEqual({
    sequences: [
      shifted,
      {
        durationFrames: 241,
        tracks: [
          shifted.tracks[0],
          {
            id: "main",
            label: "Main",
            placements: [
              {
                id: "harbor-bed",
                clipId: "harbor",
                sequenceStartFrame: 0,
                sourceOutOffsetFrames: 120,
              },
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
      },
    ],
    cutLists: [cutList, null],
  });
  await expect(grip).toHaveAttribute("aria-valuemax", "241");
  await expect(grip).toHaveAttribute("aria-valuenow", "0");
});

test("a nudge blocked at the start or by a stationary placement emits no edit", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId, {
    "sequence.tracks[0].placements[1].id": "stationary",
    "sequence.tracks[0].placements[1].clipId": "lighthouse",
    "sequence.tracks[0].placements[1].sequenceStartFrame": 60,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouses = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const lighthouse = lighthouses.first();
  const grip = timeline.getByRole("slider", { name: "Sequence playhead" });

  await expect(lighthouses).toHaveCount(3);
  await lighthouse.click();
  await harbor.click({ modifiers: ["Shift"] });
  // Both selected placements start at frame zero.
  await page.keyboard.press("[");
  expect(await emissions()).toStrictEqual(noEdits);
  // Moving right would grow the sequence and put the opening Lighthouse one
  // frame into the next Lighthouse, which starts at its current exclusive end.
  await page.keyboard.press("]");
  expect(await emissions()).toStrictEqual(noEdits);
  await expect(grip).toHaveAttribute("aria-valuemax", "240");
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  await expect(lighthouse).toHaveAttribute("aria-pressed", "true");
});

test("keyboard shortcuts leave Inspector inputs and focus outside the editor alone", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const editor = page.getByRole("region", { name: "Sequence editor", exact: true });
  const timeline = editor.getByRole("region", { name: "Sequence timeline" });
  const placement = timeline.getByRole("button", { name: "Harbor", exact: true });
  const playhead = editor.getByLabel("Sequence playhead position");
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await editor.focus();
  await page.keyboard.press("]");
  expect(await emissions()).toStrictEqual(noEdits);
  await placement.click();
  const sourceOut = editor.getByRole("spinbutton", { name: "Source out (exclusive frame)" });
  await expect(sourceOut).toHaveValue("354");
  await sourceOut.press("ArrowUp");
  await expect(sourceOut).toHaveValue("355");
  await sourceOut.press("ArrowRight");
  await sourceOut.press("]");
  await expect(sourceOut).toHaveValue("355");
  await expect(sourceOut).toBeFocused();
  await expect(playhead).toHaveText("Sequence frame 0");
  expect(await emissions()).toStrictEqual(noEdits);

  // Blur to the Storybook iframe body, outside the editor.
  await sourceOut.blur();
  await expect(sourceOut).not.toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("]");
  await expect(playhead).toHaveText("Sequence frame 0");
  expect(await emissions()).toStrictEqual(noEdits);

  await editor.focus();
  await expect(editor).toBeFocused();
  for (const key of [
    "Shift+ArrowRight",
    "Control+ArrowRight",
    "Meta+ArrowRight",
    "Alt+ArrowRight",
  ]) {
    await page.keyboard.press(key);
    await expect(playhead).toHaveText("Sequence frame 0");
  }
  await page.keyboard.press("n");
  expect(await emissions()).toStrictEqual(noEdits);
  await page.keyboard.press("ArrowRight");
  await expect(playhead).toHaveText("Sequence frame 1");
  expect(await emissions()).toStrictEqual(noEdits);
  expect(pageErrors).toStrictEqual([]);
});

test("a focused workspace separator keeps its arrow keys without stepping the playhead", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId);
  const separator = page.getByRole("separator", { name: "Resize Clip pool and Preview" });
  const pool = page.getByRole("region", { name: "Clip pool", exact: true });

  await expect(separator).toBeVisible();
  const before = await pool.boundingBox();
  if (!before) throw new Error("Expected a visible clip pool");
  await separator.press("ArrowRight");
  await expect.poll(async () => (await pool.boundingBox())?.width).toBeGreaterThan(before.width);
  await expect(page.getByLabel("Sequence playhead position")).toHaveText("Sequence frame 0");
  expect(await emissions()).toStrictEqual(noEdits);
});
