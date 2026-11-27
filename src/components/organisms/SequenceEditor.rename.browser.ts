import { expect, test } from "@playwright/test";
import {
  compiled,
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
} from "./SequenceEditor.browserHarness";

test("renaming a track commits only its display name and preserves the compiled edit", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline", includeHidden: true });
  const mainLabel = timeline.getByText("Main", { exact: true });
  const rename = page.getByRole("button", { name: "Rename track", exact: true });

  await rename.scrollIntoViewIfNeeded();
  const labelBounds = await mainLabel.boundingBox();
  await rename.click();
  const dialog = page.getByRole("dialog", { name: "Rename track" });
  // Start on Cutaways, then choose the second track with the keyboard.
  await dialog.getByRole("combobox", { name: "Track", exact: true }).press("ArrowDown");
  const trackName = dialog.getByRole("textbox", { name: "Track name" });
  await expect(trackName).toHaveValue("Main");
  await trackName.fill("Harbor bed");
  await expect(mainLabel).toBeVisible();
  expect(await mainLabel.boundingBox()).toStrictEqual(labelBounds);
  expect(await emissions()).toStrictEqual(noEdits);

  await dialog.getByRole("button", { name: "Save name" }).click();
  // Cutaways' Lighthouse covers sequence [0, 60); the Main track's
  // Harbor supplies [60, 240) at the corresponding source offset.
  await expect.poll(emissions).toStrictEqual({
    sequences: [
      {
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
            label: "Harbor bed",
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
    cutListResults: [
      compiled({
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
      }),
    ],
  });
  await expect(timeline.getByText("Harbor bed", { exact: true })).toBeVisible();
  await expect(mainLabel).toHaveCount(0);
  await expect(dialog).toBeHidden();
});

test("submitting the current track name with Enter does not commit an edit", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const rename = page.getByRole("button", { name: "Rename track", exact: true });
  const dialog = page.getByRole("dialog", { name: "Rename track" });

  await rename.press("Enter");
  const trackName = dialog.getByRole("textbox", { name: "Track name" });
  await expect(trackName).toHaveValue("Cutaways");
  await trackName.fill("Temporary name");
  await trackName.fill("Cutaways");
  await trackName.press("Enter");

  await expect(dialog).toBeHidden();
  expect(await emissions()).toStrictEqual(noEdits);
});

test("Cancel and Escape discard a track name draft without committing or keeping it", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const rename = page.getByRole("button", { name: "Rename track", exact: true });
  const dialog = page.getByRole("dialog", { name: "Rename track" });
  const trackName = dialog.getByRole("textbox", { name: "Track name" });

  await rename.click();
  await trackName.fill("Abandoned by mouse");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(rename).toBeFocused();
  expect(await emissions()).toStrictEqual(noEdits);

  await page.keyboard.press("Enter");
  await expect(trackName).toHaveValue("Cutaways");
  await trackName.fill("Abandoned by keyboard");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(rename).toBeFocused();
  expect(await emissions()).toStrictEqual(noEdits);

  await page.keyboard.press("Enter");
  await expect(trackName).toHaveValue("Cutaways");
});

for (const duringRename of ["remove", "restore", "lock another track"] as const) {
  test(`an open Rename keeps its original target when an edit can ${duringRename}`, async ({
    page,
  }) => {
    const emissions = await recordEditorEmissions(page);
    await page.goto(
      "/iframe.html?id=examples-sequence-editor-composition--rename-during-another-edit&viewMode=story",
    );
    await page
      .getByRole("button", { name: "Rename track", exact: true })
      .click({ timeout: 20_000 });
    const dialog = page.getByRole("dialog");
    const name = dialog.getByRole("textbox", { name: "Track name" });
    if (duringRename === "remove") {
      // Even the default target must be captured before any typing.
      await name.press("F2");
      await name.fill("Do not rename Main");
    } else {
      await name.fill("Assembly");
      await name.press(duringRename === "restore" ? "F2" : "F4");
      if (duringRename === "restore") await name.press("F3");
    }
    const intervening = await emissions();
    expect(intervening.sequences).toHaveLength(duringRename === "restore" ? 2 : 1);
    await dialog.getByRole("button", { name: "Save name" }).click();
    await expect(dialog).toBeHidden();
    if (duringRename === "remove") {
      expect(await emissions()).toEqual(intervening);
      await expect(page.getByText("Main", { exact: true })).toBeVisible();
    } else {
      await expect(page.getByText("Assembly", { exact: true })).toBeVisible();
      const result = await emissions();
      expect(result.sequences).toEqual([
        ...intervening.sequences,
        {
          tracks: [
            { id: "reserve", label: "Assembly", placements: [] },
            intervening.sequences.at(-1)!.tracks[1],
          ],
        },
      ]);
      expect(result.cutListResults).toEqual([
        ...intervening.cutListResults,
        intervening.cutListResults.at(-1),
      ]);
    }
  });
}
