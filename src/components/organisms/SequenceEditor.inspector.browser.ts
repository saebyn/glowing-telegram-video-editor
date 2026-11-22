import { expect, test } from "@playwright/test";
import {
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

test("the Inspector shows the selected placement's effective source in and out frames", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbors = timeline.getByRole("button", { name: "Harbor", exact: true });
  await expect(harbors).toHaveCount(2, { timeout: 20_000 });
  await harbors.last().click();

  const inspector = page.getByRole("region", { name: "Inspector", exact: true });
  await expect(inspector.getByRole("heading", { name: "Inspector", exact: true })).toBeVisible();
  // This placement starts and ends six native frames later than the reusable clip.
  await expect(
    inspector.getByText("Source in/out (source frames): 120 inclusive – 240 exclusive", {
      exact: true,
    }),
  ).toBeVisible();
  expect(await emissions()).toStrictEqual(noEdits);
});

test("the Inspector shows sequence start and end on the project frame grid", async ({ page }) => {
  // Trim 60 frames from the end of the last Harbor via the story's public sequence arg.
  await openWorkflow(page, roughCutStoryId, {
    "sequence.tracks[0].placements[1].sourceOutOffsetFrames": -54,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbors = timeline.getByRole("button", { name: "Harbor", exact: true });
  await expect(harbors).toHaveCount(2, { timeout: 20_000 });
  await harbors.last().click();

  const inspector = page.getByRole("region", { name: "Inspector", exact: true });
  await expect(
    inspector.getByText("Sequence start/end (sequence frames): 240 inclusive – 300 exclusive", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    inspector.getByText("Source in/out (source frames): 120 inclusive – 180 exclusive", {
      exact: true,
    }),
  ).toBeVisible();
});
