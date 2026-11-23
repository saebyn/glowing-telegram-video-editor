import { expect, test } from "@playwright/test";
import type { CutList } from "@saebyn/glowing-telegram-types";
import {
  blockedOutput,
  compiled,
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

const emptyTrackArgs = {
  "sequence.durationFrames": 120,
  startWithoutTracks: "true",
};

test("a host-supplied zero-track sequence can start with one Add track click", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, emptyTrackArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const prompt = timeline.getByText("Add your first track to begin", { exact: true });
  await expect(prompt).toBeVisible({ timeout: 2_000 });
  expect(await emissions()).toStrictEqual(noEdits);

  await page.getByRole("button", { name: "Add track", exact: true }).click();

  await expect(prompt).toHaveCount(0);
  await expect(timeline.getByText("Track 1", { exact: true })).toBeVisible();
  expect(await emissions()).toStrictEqual({
    sequences: [
      {
        durationFrames: 120,
        tracks: [{ id: expect.stringMatching(/\S/), label: "Track 1", placements: [] }],
      },
    ],
    cutListResults: [blockedOutput],
  });
});

test("a read-only zero-track sequence displays the empty state without offering an edit", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...emptyTrackArgs,
    "sequence.durationFrames": 0,
    readOnly: "true",
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });

  await expect(timeline.getByText("Add your first track to begin", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add track", exact: true })).toHaveCount(0);
  expect(await emissions()).toStrictEqual(noEdits);
});

test("add inserts above a selected placement's track and only the empty track can be removed", async ({
  page,
}) => {
  const original = {
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
  };
  const expectedCutList: CutList = {
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

  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await timeline.getByRole("button", { name: "Harbor", exact: true }).click();
  expect(await emissions()).toStrictEqual(noEdits);
  await page.getByRole("button", { name: "Add track", exact: true }).click();

  const remove = timeline.getByRole("button", { name: "Remove track: Track 1", exact: true });
  await expect(remove).toBeVisible({ timeout: 2_000 });
  await expect(timeline.getByRole("button", { name: /^Remove track/ })).toHaveCount(1);
  await remove.click();

  await expect(timeline.getByRole("button", { name: /^Remove track/ })).toHaveCount(0);
  await expect(timeline.getByText("Track 1", { exact: true })).toHaveCount(0);
  expect(await emissions()).toStrictEqual({
    sequences: [
      {
        durationFrames: 240,
        tracks: [
          { id: expect.stringMatching(/\S/), label: "Track 1", placements: [] },
          ...original.tracks,
        ],
      },
      original,
    ],
    cutListResults: [compiled(expectedCutList), compiled(expectedCutList)],
  });
});

test("Undo, not Remove track, restores the host's zero-track sequence", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, emptyTrackArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeDisabled();
  await page.getByRole("button", { name: "Add track", exact: true }).click();
  await expect(timeline.getByText("Track 1", { exact: true })).toBeVisible();
  await expect(timeline.getByRole("button", { name: /^Remove track/ })).toHaveCount(0);

  await undo.click({ timeout: 2_000 });

  await expect(timeline.getByText("Add your first track to begin", { exact: true })).toBeVisible();
  await expect(undo).toBeDisabled();
  expect(await emissions()).toStrictEqual({
    sequences: [
      {
        durationFrames: 120,
        tracks: [{ id: expect.stringMatching(/\S/), label: "Track 1", placements: [] }],
      },
      { durationFrames: 120, tracks: [] },
    ],
    cutListResults: [blockedOutput, blockedOutput],
  });
});
