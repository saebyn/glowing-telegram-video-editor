import { expect, test } from "@playwright/test";
import {
  compiled,
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
  straightCutArgs,
} from "./SequenceEditor.browserHarness";

test("deleting the last placements shrinks the sequence to zero and Undo and Redo restore its duration", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const toolbarButton = (name: string) => page.getByRole("button", { name, exact: true });
  const remaining = {
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [{ id: "harbor-open", clipId: "harbor", sequenceStartFrame: 0 }],
      },
    ],
  };

  await expect(timeline).toContainText("Duration: 00:04");
  await timeline.getByRole("button", { name: "Lighthouse", exact: true }).click();
  expect(await emissions()).toStrictEqual(noEdits);
  await toolbarButton("Delete").click();
  await expect(timeline).toContainText("Duration: 00:02");
  await timeline.getByRole("button", { name: "Harbor", exact: true }).click();
  await toolbarButton("Delete").click();
  await expect(timeline).toContainText("Duration: 00:00");
  await toolbarButton("Undo").click();
  await expect(timeline).toContainText("Duration: 00:02");
  await toolbarButton("Redo").click();
  await expect(timeline).toContainText("Duration: 00:00");

  const empty = { tracks: [{ id: "main", label: "Main", placements: [] }] };
  const remainingOutput = compiled({
    version: "1.0.0",
    inputMedia: [
      {
        s3Location: "s3://sequence-fixtures/harbor.mp4",
        sections: [{ startFrame: 114, endFrame: 234 }],
      },
    ],
    outputTrack: [{ mediaIndex: 0, sectionIndex: 0 }],
  });
  const emptyOutput = { ok: false, issues: [{ code: "empty-sequence" }] };
  expect(await emissions()).toStrictEqual({
    sequences: [remaining, empty, remaining, empty],
    cutListResults: [remainingOutput, emptyOutput, remainingOutput, emptyOutput],
  });
});

test("Delete is visible but cannot emit an edit without a placement selection", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);

  const deleteButton = page.getByRole("button", { name: "Delete", exact: true });
  await expect(deleteButton).toBeVisible();
  await expect(deleteButton).toBeDisabled();
  const bounds = await deleteButton.boundingBox();
  if (!bounds) throw new Error("Expected the visible Delete button");
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  expect(await emissions()).toStrictEqual(noEdits);
});

test("Delete removes one Lighthouse placement without removing its other use or the reusable clip", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId, {
    "sequence.tracks[0].placements[0].transitionOut.id": "opening-reveal",
    "sequence.tracks[0].placements[0].transitionOut.kind": "fade",
    "sequence.tracks[0].placements[0].transitionOut.durationFrames": 12,
    "sequence.tracks[2].placements[0].transitionIn.id": "alternate-entry",
    "sequence.tracks[2].placements[0].transitionIn.kind": "fade",
    "sequence.tracks[2].placements[0].transitionIn.durationFrames": 18,
  });
  const deleteButton = page.getByRole("button", { name: "Delete", exact: true });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouses = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const pool = page.getByRole("heading", { name: "Clip Pool" }).locator("..");
  const poolLighthouse = pool.locator('[draggable="true"]').filter({ hasText: "Lighthouse" });

  await expect(lighthouses).toHaveCount(2);
  await expect(poolLighthouse).toBeVisible();
  await lighthouses.first().click();
  expect(await emissions()).toStrictEqual(noEdits);
  await expect(deleteButton).toBeEnabled();
  await deleteButton.click();

  // Main's Harbor now supplies the entire 240-frame output. The other
  // Lighthouse on Alternate is still placed, but it is covered by Main.
  await expect.poll(emissions).toStrictEqual({
    sequences: [
      {
        tracks: [
          { id: "cutaways", label: "Cutaways", placements: [] },
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
                transitionIn: { id: "alternate-entry", kind: "fade", durationFrames: 18 },
              },
            ],
          },
        ],
      },
    ],
    cutListResults: [
      compiled({
        version: "1.0.0",
        inputMedia: [
          {
            s3Location: "s3://sequence-fixtures/harbor.mp4",
            sections: [{ startFrame: 114, endFrame: 354 }],
          },
        ],
        outputTrack: [{ mediaIndex: 0, sectionIndex: 0 }],
      }),
    ],
  });
  await expect(lighthouses).toHaveCount(1);
  await expect(lighthouses).toBeVisible();
  await expect(poolLighthouse).toBeVisible();
  await expect(deleteButton).toBeDisabled();
  await expect(
    timeline.getByRole("button", { name: "Select reveal fade: Lighthouse" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    timeline.getByRole("button", { name: "Select reveal fade: Lighthouse" }),
  ).toBeVisible();
  expect((await emissions()).sequences[1].tracks[0].placements[0].transitionOut).toEqual({
    id: "opening-reveal",
    kind: "fade",
    durationFrames: 12,
  });
});

test("Delete removes the selection across tracks in one edit and leaves uncovered frames in place", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const deleteButton = page.getByRole("button", { name: "Delete", exact: true });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouses = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });

  await expect(lighthouses).toHaveCount(2);
  await lighthouses.first().click();
  await harbor.click({ modifiers: ["Shift"] });
  await expect(page.getByRole("region", { name: "Inspector", exact: true })).toContainText(
    "2 placements selected",
  );
  const target = page.getByRole("combobox", { name: "Inspect placement", exact: true });
  await target.selectOption({ label: "Harbor — Main, sequence frame 0" });
  expect(await emissions()).toStrictEqual(noEdits);
  await expect(deleteButton).toBeEnabled();
  await deleteButton.click();

  // Alternate still covers [120, 228); the end follows it, leaving only a leading gap.
  await expect.poll(emissions).toStrictEqual({
    sequences: [
      {
        tracks: [
          { id: "cutaways", label: "Cutaways", placements: [] },
          { id: "main", label: "Main", placements: [] },
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
    cutListResults: [
      { ok: false, issues: [{ code: "sequence-gap", startFrame: 0, endFrame: 120 }] },
    ],
  });
  await expect(lighthouses).toHaveCount(1);
  await expect(harbor).toHaveCount(0);
  await expect(timeline).toContainText("Duration: 00:03.8");
  await expect(deleteButton).toBeDisabled();
  await expect(target).toHaveCount(0);
  await expect(page.getByText("Select a placement to edit it.")).toBeVisible();
});
