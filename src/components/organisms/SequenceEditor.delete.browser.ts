import { expect, test } from "@playwright/test";
import {
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
} from "./SequenceEditor.browserHarness";

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
  await openWorkflow(page, layeredEditStoryId);
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
        durationFrames: 240,
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
              },
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
            sections: [{ startFrame: 114, endFrame: 354 }],
          },
        ],
        outputTrack: [{ mediaIndex: 0, sectionIndex: 0 }],
      },
    ],
  });
  await expect(lighthouses).toHaveCount(1);
  await expect(lighthouses).toBeVisible();
  await expect(poolLighthouse).toBeVisible();
  await expect(deleteButton).toBeDisabled();
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
  expect(await emissions()).toStrictEqual(noEdits);
  await expect(deleteButton).toBeEnabled();
  await deleteButton.click();

  // Alternate still covers [120, 228), leaving both leading and trailing gaps
  // in the same 240-frame sequence.
  await expect.poll(emissions).toStrictEqual({
    sequences: [
      {
        durationFrames: 240,
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
    cutLists: [null],
  });
  await expect(lighthouses).toHaveCount(1);
  await expect(harbor).toHaveCount(0);
  await expect(timeline).toContainText("Duration: 00:04");
  await expect(deleteButton).toBeDisabled();
});
